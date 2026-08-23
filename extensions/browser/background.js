import { DEFAULT_API_BASE, saveImprint } from "./lib/api.mjs";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "remember-save-page",
    title: "Save to Remember",
    contexts: ["page", "link", "video"]
  });
});

async function configuredConnection() {
  const stored = await chrome.storage.sync.get("apiBase");
  const localSecrets = await chrome.storage.local.get("accessToken");
  return { apiBase: stored.apiBase || DEFAULT_API_BASE, accessToken: localSecrets.accessToken };
}

async function saveTab(tab, explicitUrl) {
  const url = explicitUrl || tab?.url;
  if (!url) return;
  try {
    await saveImprint({ ...await configuredConnection(), url, title: tab?.title });
    await chrome.action.setBadgeBackgroundColor({ color: "#276856", tabId: tab?.id });
    await chrome.action.setBadgeText({ text: "✓", tabId: tab?.id });
  } catch {
    await chrome.action.setBadgeBackgroundColor({ color: "#A74734", tabId: tab?.id });
    await chrome.action.setBadgeText({ text: "!", tabId: tab?.id });
  }
  setTimeout(() => {
    if (tab?.id) void chrome.action.setBadgeText({ text: "", tabId: tab.id });
  }, 1800);
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "save-current-page") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await saveTab(tab);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "remember-save-page") return;
  await saveTab(tab, info.linkUrl || info.srcUrl || info.pageUrl);
});

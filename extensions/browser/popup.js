import { DEFAULT_API_BASE, isSavableUrl, normalizeApiBase, saveImprint } from "./lib/api.mjs";

const elements = {
  capture: document.querySelector("#capture-view"),
  settings: document.querySelector("#settings-view"),
  settingsToggle: document.querySelector("#settings-toggle"),
  title: document.querySelector("#page-title"),
  host: document.querySelector("#page-host"),
  save: document.querySelector("#save-button"),
  saveLabel: document.querySelector("#save-label"),
  reaction: document.querySelector("#reaction"),
  status: document.querySelector("#status"),
  apiBase: document.querySelector("#api-base"),
  accessToken: document.querySelector("#access-token"),
  settingsSave: document.querySelector("#settings-save"),
  settingsStatus: document.querySelector("#settings-status")
};

let activeTab;

function setStatus(node, message, state) {
  node.textContent = message;
  node.dataset.state = state || "";
}

async function load() {
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const savable = isSavableUrl(activeTab?.url);
  elements.title.textContent = activeTab?.title || "Ready to remember";
  elements.host.textContent = savable ? new URL(activeTab.url).hostname.replace(/^www\./, "") : "This page cannot be saved.";
  elements.save.disabled = !savable;
  const stored = await chrome.storage.sync.get("apiBase");
  elements.apiBase.value = stored.apiBase || DEFAULT_API_BASE;
  const localSecrets = await chrome.storage.local.get("accessToken");
  elements.accessToken.value = localSecrets.accessToken || "";
}

elements.save.addEventListener("click", async () => {
  elements.save.disabled = true;
  elements.saveLabel.textContent = "Saving";
  setStatus(elements.status, "Remembering this page...", "");
  try {
    const stored = await chrome.storage.sync.get("apiBase");
    const localSecrets = await chrome.storage.local.get("accessToken");
    const result = await saveImprint({
      apiBase: stored.apiBase || DEFAULT_API_BASE,
      accessToken: localSecrets.accessToken,
      url: activeTab.url,
      title: activeTab.title,
      reaction: elements.reaction.value
    });
    elements.saveLabel.textContent = result.duplicate ? "Already remembered" : "Saved";
    setStatus(elements.status, result.duplicate ? "This Imprint is already in your library." : "Saved. Analysis can continue in the background.", "success");
  } catch (error) {
    elements.saveLabel.textContent = "Try again";
    setStatus(elements.status, error.message, "error");
    elements.save.disabled = false;
  }
});

elements.settingsToggle.addEventListener("click", () => {
  const showingSettings = elements.settings.hidden;
  elements.settings.hidden = !showingSettings;
  elements.capture.hidden = showingSettings;
  elements.settingsToggle.setAttribute("aria-label", showingSettings ? "Close settings" : "Extension settings");
  elements.settingsToggle.textContent = showingSettings ? "×" : "•••";
});

elements.settingsSave.addEventListener("click", async () => {
  try {
    const apiBase = normalizeApiBase(elements.apiBase.value);
    const parsed = new URL(apiBase);
    if (parsed.protocol === "https:" && !parsed.hostname.endsWith(".workers.dev")) {
      const granted = await chrome.permissions.request({ origins: [`${parsed.origin}/*`] });
      if (!granted) throw new Error("Allow access to this API address so Remember can save pages.");
    }
    await chrome.storage.sync.set({ apiBase });
    await chrome.storage.local.set({ accessToken: elements.accessToken.value.trim() });
    setStatus(elements.settingsStatus, "Connection saved.", "success");
  } catch (error) {
    setStatus(elements.settingsStatus, error.message, "error");
  }
});

void load();

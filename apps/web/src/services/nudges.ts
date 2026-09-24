/**
 * Gentle reminders on the web: a single browser notification when a wait step ends. Each nudge is
 * sent once. Works while Remember is open in a tab (the web has no background alarms without push).
 */
const NUDGES_KEY = "remember-nudges-v1";

export function nudgesSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function nudgesEnabled() {
  try { return localStorage.getItem(NUDGES_KEY) === "on" && nudgesSupported() && Notification.permission === "granted"; }
  catch { return false; }
}

/** Turns reminders on (asking the browser for permission) or off. Resolves to the resulting state. */
export async function setNudgesEnabled(enabled: boolean): Promise<boolean> {
  if (!enabled || !nudgesSupported()) {
    try { localStorage.setItem(NUDGES_KEY, "off"); } catch { /* Nothing to remember. */ }
    return false;
  }
  let permission = Notification.permission;
  if (permission === "default") {
    try { permission = await Notification.requestPermission(); } catch { permission = "denied"; }
  }
  const on = permission === "granted";
  try { localStorage.setItem(NUDGES_KEY, on ? "on" : "off"); } catch { /* Nothing to remember. */ }
  return on;
}

export function sendNudge(title: string, body: string) {
  if (!nudgesEnabled()) return;
  try { new Notification(title, { body, tag: `remember-${title}` }); } catch { /* Some browsers only allow service-worker notifications. */ }
}

/** Whether first-run setup was finished or skipped on this device. */
export const SETUP_STORAGE_KEY = "remember-setup-v1";

export function isSetupDone() {
  try { return localStorage.getItem(SETUP_STORAGE_KEY) === "done"; } catch { return false; }
}

export function markSetupDone() {
  try { localStorage.setItem(SETUP_STORAGE_KEY, "done"); } catch { /* Setup may show again next time. */ }
}

/** First run: setup shows once the real snapshot is in, it hasn't been done, and nothing is set up yet. */
export function shouldShowSetup({ remote, loading, commitments }: { remote: boolean; loading: boolean; commitments: number }) {
  return remote && !loading && commitments === 0 && !isSetupDone();
}

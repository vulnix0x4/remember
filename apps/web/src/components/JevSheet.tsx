import { useEffect, useState } from "react";
import type { LifeOSController } from "../life/useLifeOS";
import { agoLabel } from "../life/planning";
import { Sheet } from "../ui/Sheet";
import { haptic, useToast } from "../ui/Toast";

type JevLife = Pick<LifeOSController, "brain" | "brainError" | "brainWorking" | "refreshBrain">;

const hours = Array.from({ length: 25 }, (_, hour) => hour);
function hourLabel(hour: number) {
  if (hour === 0 || hour === 24) return "12:00 AM";
  if (hour === 12) return "12:00 PM";
  return hour < 12 ? `${hour}:00 AM` : `${hour - 12}:00 PM`;
}

export function jevIsPlanning(life: Pick<LifeOSController, "brain">) {
  const brain = life.brain;
  return Boolean(brain?.settings.enabled && brain.status !== "paused" && brain.status !== "unavailable");
}

/** The small "Jev is planning your day" line under the Today title. Opens the Jev sheet. */
export function JevStatusLine({ life }: { life: JevLife }) {
  const [open, setOpen] = useState(false);
  const planning = jevIsPlanning(life);
  return <>
    <button className={`jev-line${planning ? "" : " paused"}`} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog">
      <i aria-hidden="true" />{planning ? "Jev is planning your day" : "Jev is paused"}
    </button>
    {open && <JevSheet life={life} onClose={() => setOpen(false)} />}
  </>;
}

/** Everything about Jev in one place: on/off, planning hours, preferences, and when it last planned. */
export function JevSheet({ life, onClose }: { life: JevLife; onClose: () => void }) {
  const { brain, brainWorking } = life;
  const toast = useToast();
  const [preferences, setPreferences] = useState(brain?.settings.preferences ?? "");
  const [startHour, setStartHour] = useState(brain?.settings.startHour ?? 8);
  const [endHour, setEndHour] = useState(brain?.settings.endHour ?? 21);
  const [enabled, setEnabled] = useState(brain?.settings.enabled ?? false);
  const [error, setError] = useState("");
  useEffect(() => {
    setPreferences(brain?.settings.preferences ?? "");
    setStartHour(brain?.settings.startHour ?? 8); setEndHour(brain?.settings.endHour ?? 21);
    setEnabled(brain?.settings.enabled ?? false);
  }, [brain?.settings.preferences, brain?.settings.startHour, brain?.settings.endHour, brain?.settings.enabled]);

  const toggle = async () => {
    if (!brain) return;
    const next = !enabled;
    setEnabled(next); setError(""); haptic();
    try { await life.refreshBrain({ ...brain.settings, enabled: next }); }
    catch { setEnabled(!next); setError("That didn’t change. Try again."); }
  };
  const close = () => {
    onClose();
    if (!brain) return;
    const changed = preferences !== brain.settings.preferences || startHour !== brain.settings.startHour || endHour !== brain.settings.endHour;
    if (!changed) return;
    if (endHour <= startHour) { toast.error("Your day must end after it starts. Hours were not changed."); return; }
    life.refreshBrain({ ...brain.settings, enabled, preferences: preferences.trim(), startHour, endHour })
      .catch(() => toast.error("Jev’s settings didn’t save. Try again."));
  };

  return <Sheet title="Jev" onClose={close} className="jev-sheet" closeLabel="Close and save">
    <div className="toggle-row">
      <span aria-hidden="true">Let Jev plan my day</span>
      <button className={`switch${enabled ? " on" : ""}`} type="button" role="switch" aria-checked={enabled} aria-label="Let Jev plan my day" disabled={!brain || brainWorking} onClick={() => void toggle()}><span /></button>
    </div>
    {!brain && <p className="sheet-note">Connect your Remember server to let Jev plan.</p>}
    <div className="form-grid">
      <label className="field"><span>Day starts</span><select value={startHour} disabled={!brain} onChange={(event) => setStartHour(Number(event.target.value))}>{hours.slice(0, 24).map((hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select></label>
      <label className="field"><span>Day ends</span><select value={endHour} disabled={!brain} onChange={(event) => setEndHour(Number(event.target.value))}>{hours.slice(1).map((hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select></label>
    </div>
    {endHour <= startHour && <p className="field-error" role="alert">Choose an end after the start.</p>}
    <label className="field"><span>What Jev should know</span><textarea value={preferences} maxLength={2000} disabled={!brain} onChange={(event) => setPreferences(event.target.value)} placeholder="I focus best in the morning. Chores after work." /></label>
    <p className="sheet-meta" role="status">{brainWorking ? "Jev is updating your plan…" : brain?.evaluatedAt ? `Last planned ${agoLabel(brain.evaluatedAt, new Date())}` : "Jev hasn’t planned yet"}</p>
    {(error || life.brainError) && <p role="alert" className="field-error">{error || life.brainError}</p>}
  </Sheet>;
}

import { ArrowRight, Path } from "@phosphor-icons/react";
import { useEffect, useState, type FormEvent } from "react";
import type { LifeOSController } from "../life/useLifeOS";

export function EverydayAutopilot({ life, onOpenPlan }: { life: Pick<LifeOSController, "snapshot" | "brain" | "brainError" | "brainWorking" | "refreshBrain">; onOpenPlan: () => void }) {
  const { brain, brainWorking, brainError } = life;
  const [preferences, setPreferences] = useState("");
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(21);
  const [error, setError] = useState("");
  useEffect(() => {
    setPreferences(brain?.settings.preferences ?? "");
    setStartHour(brain?.settings.startHour ?? 8); setEndHour(brain?.settings.endHour ?? 21);
  }, [brain?.settings.preferences, brain?.settings.startHour, brain?.settings.endHour]);
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!brain) return;
    setError("");
    if (endHour <= startHour) { setError("Choose an end time after your start time."); return; }
    try { await life.refreshBrain({ ...brain.settings, preferences, startHour, endHour }); }
    catch { setError("Your preferences could not be saved. Try again."); }
  };
  const toggle = async () => {
    if (!brain) return;
    try { setError(""); await life.refreshBrain({ ...brain.settings, enabled: !brain.settings.enabled }); }
    catch { setError("Automatic planning could not be changed. Try again."); }
  };
  const openTasks = new Set(life.snapshot.tasks.filter((task) => ["active", "queued", "inbox"].includes(task.status)).map((task) => task.id));
  const plan = brain?.plan.filter((block) => openTasks.has(block.taskId)).slice(0, 5) ?? [];
  const format = (value: string) => new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: brain?.settings.timeZone }).format(new Date(value));
  return <section className="everyday-autopilot" aria-labelledby="autopilot-title" aria-busy={brainWorking}>
    <header><Path size={24} aria-hidden="true" /><div><h2 id="autopilot-title">Your next steps</h2><p>Jev arranges your tasks around your time, priorities, and what matters to you.</p></div></header>
    <label className="autopilot-permission"><input type="checkbox" checked={brain?.settings.enabled ?? false} disabled={!brain || brainWorking} onChange={() => void toggle()} /><span>Let Jev keep my day planned<small>Updates automatically. You can change any task.</small></span></label>
    <p role="status">{brainWorking ? "Jev is updating your plan…" : brain?.message ?? "Connect your Remember server with its OpenRouter key to turn on automatic planning."}</p>
    {plan.length > 0 && <ol className="brain-agenda">{plan.map((block) => <li key={block.taskId}><time dateTime={block.startAt}>{format(block.startAt)}</time><div><strong>{block.title}</strong><p>{block.firstStep || block.reason}</p></div></li>)}</ol>}
    {!!brain?.unscheduledCount && <p className="autopilot-scope">{brain.unscheduledCount} tasks still need an opening or more context.</p>}
    <div className="autopilot-actions"><button className="button secondary" type="button" onClick={onOpenPlan}>Open Plan <ArrowRight size={15} /></button></div>
    {brain && <details className="brain-preferences"><summary>What Jev knows about my day</summary>
      <p>{brain.contextUsed.length ? brain.contextUsed.join(" · ") : "Jev will use your tasks, calendar, and goals as you add them."}</p>
      <form onSubmit={save}>
        <label>What makes a day work for you?<textarea value={preferences} maxLength={2000} onChange={(event) => setPreferences(event.target.value)} placeholder="I focus best in the morning. Keep chores for after work. Leave room to unwind." /></label>
        <div className="brain-hours"><label>Day starts<input type="number" min={0} max={23} value={startHour} onChange={(event) => setStartHour(Number(event.target.value))} required /></label><label>Day ends<input type="number" min={1} max={24} value={endHour} onChange={(event) => setEndHour(Number(event.target.value))} required /></label></div>
        <small>Hours use the 24-hour clock in {brain.settings.timeZone}. Calendar commitments remain fixed.</small>
        <button className="button secondary" type="submit" disabled={brainWorking}>Save preferences</button>
      </form>
      {brain.evaluatedAt && <small>Last planned {format(brain.evaluatedAt)}{brain.model ? ` · ${brain.model} through OpenRouter` : ""}</small>}
    </details>}
    {(error || brainError) && <p role="alert" className="field-error">{error || brainError}</p>}
  </section>;
}

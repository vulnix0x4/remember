import { useEffect, useRef, useState } from "react";
import { CaretRight, Plus } from "@phosphor-icons/react";
import { agoLabel } from "../life/planning";
import { mutationMessage } from "../life/TaskViews";
import type { Commitment, CommitmentKind } from "../life/types";
import type { LifeOSController } from "../life/useLifeOS";
import { nudgesEnabled, nudgesSupported, setNudgesEnabled } from "../services/nudges";
import { haptic, useToast } from "../ui/Toast";
import { CommitmentEditor } from "./CommitmentEditor";
import { choreTemplates, commitmentMeta, commitmentTemplates, type CommitmentTemplate } from "./templates";

type JevLife = Pick<LifeOSController, "brain" | "brainError" | "brainWorking" | "refreshBrain">;
type SetupLife = JevLife & Pick<LifeOSController, "snapshot" | "createCommitment" | "updateCommitment" | "deleteCommitment">;

export function hourLabel(hour: number) {
  const value = hour % 24;
  if (value === 0) return "12 AM";
  if (value === 12) return "12 PM";
  return value < 12 ? `${value} AM` : `${value - 12} PM`;
}

export const dayPresets = [
  { key: "early", label: "Early bird", start: 6, end: 21 },
  { key: "regular", label: "Regular", start: 8, end: 22 },
  { key: "night", label: "Night owl", start: 12, end: 3 },
] as const;

function SectionHeading({ id, children }: { id: string; children: string }) {
  return <h2 id={id} className="section-label">{children}</h2>;
}

/** Your day: when Jev may plan, and whether it plans at all. */
export function YourDaySection({ life, heading = true }: { life: JevLife; heading?: boolean }) {
  const { brain, brainWorking } = life;
  const toast = useToast();
  const [startHour, setStartHour] = useState(brain?.settings.startHour ?? 8);
  const [endHour, setEndHour] = useState(brain?.settings.endHour ?? 22);
  const [enabled, setEnabled] = useState(brain?.settings.enabled ?? true);
  const [customOpen, setCustomOpen] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<{ startHour: number; endHour: number } | null>(null);
  useEffect(() => {
    if (!brain) return;
    if (pending.current) {
      // A choice made before Jev's settings arrived: save it now.
      const choice = pending.current; pending.current = null;
      void life.refreshBrain({ ...brain.settings, ...choice }).catch(() => toast.error("Jev’s settings didn’t save. Try again."));
      return;
    }
    setStartHour(brain.settings.startHour); setEndHour(brain.settings.endHour); setEnabled(brain.settings.enabled);
  }, [brain?.settings.startHour, brain?.settings.endHour, brain?.settings.enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const preset = dayPresets.find((option) => option.start === startHour && option.end === endHour);
  const selected = customOpen || !preset ? "custom" : preset.key;

  const save = (start: number, end: number) => {
    setStartHour(start); setEndHour(end);
    if (start === end) { setError("Pick a different end hour."); return; }
    setError("");
    if (!brain) { pending.current = { startHour: start, endHour: end }; return; }
    const previous = { start: brain.settings.startHour, end: brain.settings.endHour };
    life.refreshBrain({ ...brain.settings, startHour: start, endHour: end })
      .catch(() => { setStartHour(previous.start); setEndHour(previous.end); toast.error("Jev’s settings didn’t save. Try again."); });
  };
  const toggle = async () => {
    if (!brain) return;
    const next = !enabled;
    setEnabled(next); haptic();
    try { await life.refreshBrain({ ...brain.settings, enabled: next }); }
    catch { setEnabled(!next); toast.error("That didn’t change. Try again."); }
  };

  return <section className="setup-section" id={heading ? "settings-your-day" : undefined} aria-labelledby={heading ? "your-day-title" : undefined} aria-label={heading ? undefined : "Your day"}>
    {heading && <SectionHeading id="your-day-title">Your day</SectionHeading>}
    <div className="big-choices" role="group" aria-label="Day shape">
      {dayPresets.map((option) => <button key={option.key} type="button" className={`big-choice${selected === option.key ? " selected" : ""}`} aria-pressed={selected === option.key} onClick={() => { haptic(6); setCustomOpen(false); save(option.start, option.end); }}>
        <strong>{option.label}</strong><small>{hourLabel(option.start)} – {hourLabel(option.end)}</small>
      </button>)}
      <button type="button" className={`big-choice${selected === "custom" ? " selected" : ""}`} aria-pressed={selected === "custom"} onClick={() => { haptic(6); setCustomOpen(true); }}>
        <strong>Custom</strong><small>{selected === "custom" ? `${hourLabel(startHour)} – ${hourLabel(endHour)}` : "Pick your own hours"}</small>
      </button>
    </div>
    {selected === "custom" && <div className="form-grid">
      <label className="field"><span>I wake up</span><select value={startHour} onChange={(event) => save(Number(event.target.value), endHour)}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select></label>
      <label className="field"><span>I wind down</span><select value={endHour} onChange={(event) => save(startHour, Number(event.target.value))}>{Array.from({ length: 24 }, (_, index) => index + 1).map((hour) => <option key={hour} value={hour}>{hourLabel(hour)}{hour < startHour ? " (next day)" : ""}</option>)}</select></label>
    </div>}
    {error && <p className="field-error" role="alert">{error}</p>}
    {!error && endHour < startHour && <p className="setup-note">Ends after midnight.</p>}
    <div className="toggle-row">
      <span aria-hidden="true">Let Jev plan my day</span>
      <button className={`switch${enabled ? " on" : ""}`} type="button" role="switch" aria-checked={enabled} aria-label="Let Jev plan my day" disabled={!brain || brainWorking} onClick={() => void toggle()}><span /></button>
    </div>
    {brain
      ? <p className="setup-note" role="status">{brainWorking ? "Jev is updating your plan…" : brain.evaluatedAt ? `Last planned ${agoLabel(brain.evaluatedAt, new Date())}` : "Jev hasn’t planned yet"}</p>
      : <p className="setup-note">Connect your Remember server to let Jev plan.</p>}
    {life.brainError && <p role="alert" className="field-error">{life.brainError}</p>}
  </section>;
}

/** Commitments or chores: a grouped list, one add row, and templates to tap. */
export function CommitmentSection({ life, kind, heading = true }: { life: SetupLife; kind: CommitmentKind; heading?: boolean }) {
  const toast = useToast();
  const [editing, setEditing] = useState<Commitment | null>(null);
  const [adding, setAdding] = useState<CommitmentTemplate | null | undefined>(undefined);
  const items = life.snapshot.commitments.filter((item) => item.kind === kind).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const templates = (kind === "chore" ? choreTemplates : commitmentTemplates).filter((template) => !items.some((item) => item.title.toLowerCase() === template.title.toLowerCase()));
  const title = kind === "chore" ? "Chores" : "Commitments";
  const headingId = kind === "chore" ? "chores-title" : "commitments-title";
  const addTemplate = async (template: CommitmentTemplate) => {
    haptic();
    try {
      const created = await life.createCommitment({ ...template });
      toast.show({ message: `Added ${template.title}`, action: { label: "Undo", onAction: () => life.deleteCommitment(created.id).catch((reason) => toast.error(mutationMessage(reason))) } });
    } catch (reason) { toast.error(mutationMessage(reason)); }
  };
  return <section className="setup-section" aria-labelledby={heading ? headingId : undefined} aria-label={heading ? undefined : title}>
    {heading && <SectionHeading id={headingId}>{title}</SectionHeading>}
    <ul className="setup-list">
      {items.map((item) => <li key={item.id}>
        <button className="setup-row" type="button" onClick={() => setEditing(item)}>
          <span><strong>{item.title}</strong><small>{commitmentMeta(item)}</small></span>
          <CaretRight size={16} aria-hidden="true" />
        </button>
      </li>)}
      <li><button className="setup-row add" type="button" onClick={() => setAdding(null)}><Plus size={18} weight="bold" aria-hidden="true" /><span>{kind === "chore" ? "Add chore" : "Add commitment"}</span></button></li>
    </ul>
    {templates.length > 0 && <div className="template-chips" role="group" aria-label={kind === "chore" ? "Chore ideas" : "Commitment ideas"}>
      {templates.map((template) => <button key={template.title} className="chip template-chip" type="button" aria-label={`Add ${template.title}`} onClick={() => void addTemplate(template)}><Plus size={14} weight="bold" aria-hidden="true" />{template.title}</button>)}
    </div>}
    {editing && <CommitmentEditor key={editing.id} life={life} kind={kind} commitment={editing} onClose={() => setEditing(null)} />}
    {adding !== undefined && <CommitmentEditor life={life} kind={kind} template={adding ?? undefined} onClose={() => setAdding(undefined)} />}
  </section>;
}

/** Nudges: one switch for gentle reminders (browser notifications). */
export function NudgesSection({ heading = true }: { heading?: boolean }) {
  const toast = useToast();
  const [on, setOn] = useState(nudgesEnabled);
  const supported = nudgesSupported();
  const toggle = async () => {
    haptic();
    const next = await setNudgesEnabled(!on);
    setOn(next);
    if (!on && !next) toast.error("Your browser blocked reminders. Allow notifications for Remember, then try again.");
  };
  return <section className="setup-section" aria-labelledby={heading ? "nudges-title" : undefined} aria-label={heading ? undefined : "Nudges"}>
    {heading && <SectionHeading id="nudges-title">Nudges</SectionHeading>}
    <div className="toggle-row">
      <span aria-hidden="true">Gentle reminders</span>
      <button className={`switch${on ? " on" : ""}`} type="button" role="switch" aria-checked={on} aria-label="Gentle reminders" disabled={!supported} onClick={() => void toggle()}><span /></button>
    </div>
    <p className="setup-note">{supported ? "When a wait is over, once." : "This browser can’t send reminders."}</p>
  </section>;
}

/** About me for Jev: free text that shapes the plan. Saves when you leave the field. */
export function AboutMeSection({ life, heading = true }: { life: JevLife; heading?: boolean }) {
  const toast = useToast();
  const saved = life.brain?.settings.preferences ?? "";
  const [text, setText] = useState(saved);
  useEffect(() => { setText(saved); }, [saved]);
  const save = () => {
    const brain = life.brain;
    if (!brain || text.trim() === brain.settings.preferences) return;
    life.refreshBrain({ ...brain.settings, preferences: text.trim() }).catch(() => toast.error("Jev’s settings didn’t save. Try again."));
  };
  return <section className="setup-section" aria-labelledby={heading ? "about-me-title" : undefined} aria-label={heading ? undefined : "About me for Jev"}>
    {heading && <SectionHeading id="about-me-title">About me for Jev</SectionHeading>}
    <label className="field"><span className="sr-only">What Jev should know</span><textarea value={text} maxLength={2000} disabled={!life.brain} onChange={(event) => setText(event.target.value)} onBlur={save} placeholder="I focus best in the morning. Chores after work." /></label>
  </section>;
}

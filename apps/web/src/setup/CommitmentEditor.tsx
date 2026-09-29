import { useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Plus, Trash, X } from "@phosphor-icons/react";
import type { CommitmentInput } from "../services/life";
import { ChipGroup, mutationMessage } from "../life/TaskViews";
import type { Commitment, CommitmentImportance, CommitmentKind } from "../life/types";
import type { LifeOSController } from "../life/useLifeOS";
import { Sheet } from "../ui/Sheet";
import { haptic, useToast } from "../ui/Toast";
import { DAY_BITS, DAY_LETTERS, DAY_NAMES, EVERY_DAY, WEEKDAYS, importanceLabels, rhythmChoices, type CommitmentTemplate } from "./templates";

type SetupLife = Pick<LifeOSController, "createCommitment" | "updateCommitment" | "deleteCommitment">;

interface StepDraft { key: number; title: string; wait: string }

const lengthChoices = [15, 30, 45, 60, 90, 120, 180];
function lengthLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`;
}

const importanceChoices: Array<{ value: CommitmentImportance; detail: string }> = [
  { value: "must", detail: "Always planned first" },
  { value: "high", detail: "Planned when it fits well" },
  { value: "normal", detail: "Only if there’s room" },
];

/** Snapshot of what the editor would save, or null when it isn't valid yet. */
function toInput(draft: { title: string; kind: CommitmentKind; days: number; everyDays: number | null; fixedStart: string | null; durationMinutes: number; importance: CommitmentImportance; steps: StepDraft[]; notes: string }): CommitmentInput | null {
  const title = draft.title.replace(/\s+/g, " ").trim();
  if (!title || draft.days <= 0) return null;
  const steps = draft.steps
    .map((step) => ({ title: step.title.trim(), wait: Math.round(Number(step.wait)) }))
    .filter((step) => step.title)
    .slice(0, 20)
    .map((step) => (Number.isFinite(step.wait) && step.wait >= 1 ? { title: step.title, waitMinutes: Math.min(600, step.wait) } : { title: step.title }));
  return {
    title, kind: draft.kind, days: draft.days, everyDays: draft.kind === "chore" ? draft.everyDays ?? 7 : null,
    fixedStart: draft.kind === "commitment" ? draft.fixedStart : null, durationMinutes: Math.min(720, Math.max(5, draft.durationMinutes)),
    importance: draft.importance, steps, notes: draft.notes,
  };
}

/** The same fields as the saved commitment, for comparing and for Undo. */
function fromCommitment(commitment: Commitment): CommitmentInput {
  const { title, kind, days, everyDays, fixedStart, durationMinutes, importance, steps, notes, active } = commitment;
  return { title, kind, days, everyDays, fixedStart, durationMinutes, importance, steps, notes, active };
}

function samePatch(input: CommitmentInput, commitment: Commitment): Partial<CommitmentInput> {
  const current = fromCommitment(commitment);
  const patch: Partial<CommitmentInput> = {};
  (Object.keys(input) as Array<keyof CommitmentInput>).forEach((key) => {
    if (JSON.stringify(input[key] ?? null) !== JSON.stringify(current[key] ?? null)) (patch as Record<string, unknown>)[key] = input[key];
  });
  return patch;
}

function DayChips({ days, onChange, label, emptyMeansAny = false }: { days: number; onChange: (days: number) => void; label: string; emptyMeansAny?: boolean }) {
  const shown = emptyMeansAny && days === EVERY_DAY ? 0 : days;
  const toggle = (bit: number) => {
    haptic(6);
    const next = shown ^ bit;
    onChange(emptyMeansAny && next === 0 ? EVERY_DAY : next);
  };
  return <div className="day-chips" role="group" aria-label={label}>
    {DAY_BITS.map((bit, index) => { const on = Boolean(shown & bit); return <button key={bit} type="button" className={`day-chip${on ? " selected" : ""}`} aria-pressed={on} aria-label={DAY_NAMES[index]} onClick={() => toggle(bit)}>{DAY_LETTERS[index]}</button>; })}
  </div>;
}

/**
 * One sheet for adding or changing a commitment or a chore. Existing ones save when the sheet closes;
 * new ones are added with the one primary button.
 */
export function CommitmentEditor({ life, kind, commitment, template, onClose }: { life: SetupLife; kind: CommitmentKind; commitment?: Commitment; template?: CommitmentTemplate; onClose: () => void }) {
  const toast = useToast();
  const seed = commitment ?? template;
  const stepKey = useRef(0);
  const nextKey = () => { stepKey.current += 1; return stepKey.current; };
  const [title, setTitle] = useState(seed?.title ?? "");
  const [days, setDays] = useState(seed?.days ?? EVERY_DAY);
  const [everyDays, setEveryDays] = useState<number | null>(seed?.everyDays ?? (kind === "chore" ? 7 : null));
  const [fixedStart, setFixedStart] = useState<string | null>(commitment?.fixedStart ?? null);
  const [duration, setDuration] = useState(seed?.durationMinutes ?? (kind === "chore" ? 30 : 60));
  const [importance, setImportance] = useState<CommitmentImportance>(seed?.importance ?? (kind === "chore" ? "normal" : "high"));
  const [steps, setSteps] = useState<StepDraft[]>(() => (seed?.steps ?? []).map((step) => ({ key: nextKey(), title: step.title, wait: step.waitMinutes ? String(step.waitMinutes) : "" })));
  const [saving, setSaving] = useState(false);
  const input = toInput({ title, kind, days, everyDays, fixedStart, durationMinutes: duration, importance, steps, notes: commitment?.notes ?? "" });
  const noun = kind === "chore" ? "chore" : "commitment";

  const close = () => {
    onClose();
    if (!commitment) return;
    if (!input) { toast.error(title.trim() ? "Pick at least one day. Changes weren’t saved." : "It needs a name. Changes weren’t saved."); return; }
    const patch = samePatch(input, commitment);
    if (!Object.keys(patch).length) return;
    life.updateCommitment(commitment.id, patch).catch((reason) => toast.error(mutationMessage(reason)));
  };
  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!input || saving) return;
    setSaving(true);
    try {
      await life.createCommitment(input);
      haptic([8, 30, 8]); onClose();
      toast.show({ message: "Added · Jev will fit it in" });
    } catch (reason) { toast.error(mutationMessage(reason)); setSaving(false); }
  };
  const remove = () => {
    if (!commitment) return;
    onClose(); haptic();
    life.deleteCommitment(commitment.id)
      .then(() => toast.show({ message: "Deleted", action: { label: "Undo", onAction: () => life.createCommitment(fromCommitment(commitment)).catch((reason) => toast.error(mutationMessage(reason))) } }))
      .catch((reason) => toast.error(mutationMessage(reason)));
  };
  const updateStep = (key: number, patch: Partial<StepDraft>) => setSteps((current) => current.map((step) => step.key === key ? { ...step, ...patch } : step));
  const moveStep = (index: number, by: number) => setSteps((current) => {
    const next = [...current]; const [moved] = next.splice(index, 1); next.splice(index + by, 0, moved); return next;
  });

  const lengthOptions = [...new Set([...lengthChoices, ...(kind === "chore" ? [5, 10] : []), duration])].sort((a, b) => a - b).map((value) => ({ label: lengthLabel(value), value }));
  const rhythmOptions = everyDays && !rhythmChoices.some((choice) => choice.value === everyDays) ? [...rhythmChoices, { label: `Every ${everyDays} days`, value: everyDays }] : rhythmChoices;

  const body = <>
    <label className="sr-only" htmlFor="commitment-title">Name</label>
    <textarea id="commitment-title" className="task-sheet-title" rows={1} value={title} maxLength={200} placeholder={kind === "chore" ? "Name the chore" : "Name it"} data-auto-focus={commitment ? undefined : true} onChange={(event) => setTitle(event.target.value.replace(/\n/g, " "))} />

    {kind === "commitment" ? <>
      <fieldset className="chip-field">
        <legend>Days</legend>
        <DayChips days={days} onChange={setDays} label="Days" />
        <div className="chip-row">
          <button type="button" className={`chip${days === EVERY_DAY ? " selected" : ""}`} aria-pressed={days === EVERY_DAY} onClick={() => { haptic(6); setDays(EVERY_DAY); }}>Every day</button>
          <button type="button" className={`chip${days === WEEKDAYS ? " selected" : ""}`} aria-pressed={days === WEEKDAYS} onClick={() => { haptic(6); setDays(WEEKDAYS); }}>Weekdays</button>
        </div>
        {days === 0 && <p className="field-error" role="alert">Pick at least one day.</p>}
      </fieldset>
      <ChipGroup label="Time" options={[{ label: "Jev picks", value: false }, { label: "At a set time", value: true }]} value={fixedStart !== null} onChange={(set) => setFixedStart(set ? fixedStart ?? "09:00" : null)} />
      {fixedStart !== null && <label className="field"><span>Start time</span><input type="time" value={fixedStart} step={300} onChange={(event) => { if (event.target.value) setFixedStart(event.target.value); }} /></label>}
      <ChipGroup label="How long" options={lengthOptions} value={duration} onChange={setDuration} />
      <fieldset className="chip-field">
        <legend>How important</legend>
        <div className="big-choices">
          {importanceChoices.map((choice) => <button key={choice.value} type="button" className={`big-choice${importance === choice.value ? " selected" : ""}`} aria-pressed={importance === choice.value} onClick={() => { haptic(6); setImportance(choice.value); }}>
            <strong>{importanceLabels[choice.value]}</strong><small>{choice.detail}</small>
          </button>)}
        </div>
      </fieldset>
    </> : <>
      <ChipGroup label="How often" options={rhythmOptions} value={everyDays ?? 7} onChange={setEveryDays} />
      <fieldset className="chip-field">
        <legend>Best days <small>Optional</small></legend>
        <DayChips days={days} onChange={setDays} label="Best days" emptyMeansAny />
      </fieldset>
      <ChipGroup label="Active time" options={lengthOptions} value={duration} onChange={setDuration} />
      <fieldset className="chip-field">
        <legend>Steps</legend>
        {steps.length > 0 && <ol className="step-list">
          {steps.map((step, index) => <li key={step.key} className="step-row">
            <div className="step-main">
              <span className="step-number" aria-hidden="true">{index + 1}</span>
              <input aria-label={`Step ${index + 1}`} value={step.title} maxLength={200} placeholder="What to do" onChange={(event) => updateStep(step.key, { title: event.target.value })} />
            </div>
            <div className="step-tools">
              <label className="step-wait"><span>Wait</span><input type="number" inputMode="numeric" min={1} max={600} value={step.wait} placeholder="–" aria-label={`Wait minutes for step ${index + 1}`} onChange={(event) => updateStep(step.key, { wait: event.target.value })} /><span>min</span></label>
              <button className="icon-button" type="button" aria-label={`Move step ${index + 1} up`} disabled={index === 0} onClick={() => moveStep(index, -1)}><ArrowUp size={18} /></button>
              <button className="icon-button" type="button" aria-label={`Move step ${index + 1} down`} disabled={index === steps.length - 1} onClick={() => moveStep(index, 1)}><ArrowDown size={18} /></button>
              <button className="icon-button" type="button" aria-label={`Remove step ${index + 1}`} onClick={() => setSteps((current) => current.filter((item) => item.key !== step.key))}><X size={18} /></button>
            </div>
          </li>)}
        </ol>}
        {steps.length < 20 && <button className="btn quiet add-step" type="button" onClick={() => setSteps((current) => [...current, { key: nextKey(), title: "", wait: "" }])}><Plus size={17} weight="bold" aria-hidden="true" /> Add step</button>}
      </fieldset>
    </>}

    {commitment
      ? <button className="btn quiet danger" type="button" onClick={remove}><Trash size={17} aria-hidden="true" /> Delete</button>
      : <button className="btn primary" type="submit" disabled={!input || saving}>{saving ? "Adding…" : kind === "chore" ? "Add chore" : "Add commitment"}</button>}
  </>;

  return commitment
    ? <Sheet title={`Edit ${noun}`} hideTitle onClose={close} className="task-sheet commitment-editor" closeLabel="Close and save">{body}</Sheet>
    : <Sheet title={kind === "chore" ? "New chore" : "New commitment"} hideTitle onClose={onClose} className="task-sheet commitment-editor" onSubmit={(event) => void add(event)}>{body}</Sheet>;
}

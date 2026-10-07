import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowsInSimple, Check, Clock, FolderSimple, Lightning, Plus, Question, ShuffleSimple, Trash } from "@phosphor-icons/react";
import * as lifeService from "../services/life";
import { estimateMinutes, parseQuickTask, quickTaskChips, whenOptions, describeRepeat } from "../services/quickTask";
import { activeProjects, fileTask, nextProjectChoice, splitDump } from "../services/projects";
import { useLockIn } from "./lockInContext";
import { AddBar, type AddBarChip } from "../ui/AddBar";
import { Sheet } from "../ui/Sheet";
import { haptic, useToast } from "../ui/Toast";
import { dueLabel, durationLabel, isImportant, startLabel, planByTask, pickNow, taskMeta, timeLabel, todayTasks, laterTasks } from "./planning";
import { BIG_MINUTES, WARMUP_COUNT, WARMUP_MINUTES, endMorning, morningCandidates, morningPick, shouldOfferMorning, skipMorning, startMorning, useMorningSession, writeMorning } from "./morning";
import type { BlockerReason, Goal, LifeTask, PracticeOutcome, PracticeResult } from "./types";
import type { LifeOSController } from "./useLifeOS";

/* ---------- Shared hooks ---------- */

/** Re-renders on an interval so "now" based labels stay correct. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export interface FocusTimerState { accumulatedMs: number; startedAt: number | null }
const TIMER_EVENT = "remember-focus-timer";

export function focusTimerStorageKey(taskId: string) { return `remember-focus-timer-v1:${taskId}`; }
export function focusTimerElapsedMs(timer: FocusTimerState, now = Date.now()) { return timer.accumulatedMs + (timer.startedAt === null ? 0 : Math.max(0, now - timer.startedAt)); }

function readFocusTimer(taskId: string): FocusTimerState | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(focusTimerStorageKey(taskId)) ?? "null") as Partial<FocusTimerState> | null;
    if (!stored) return null;
    return { accumulatedMs: Math.max(0, Number(stored.accumulatedMs) || 0), startedAt: typeof stored.startedAt === "number" ? stored.startedAt : null };
  } catch { return null; }
}

function writeFocusTimer(taskId: string, timer: FocusTimerState | null) {
  try {
    if (timer) sessionStorage.setItem(focusTimerStorageKey(taskId), JSON.stringify(timer));
    else sessionStorage.removeItem(focusTimerStorageKey(taskId));
  } catch { /* The timer still works for this view. */ }
  window.dispatchEvent(new CustomEvent(TIMER_EVENT, { detail: taskId }));
}

export function startFocusTimer(taskId: string) {
  if (!readFocusTimer(taskId)) writeFocusTimer(taskId, { accumulatedMs: 0, startedAt: Date.now() });
}
export function clearFocusTimer(taskId: string) { writeFocusTimer(taskId, null); }
/** Stops the clock but keeps the time spent (used by Leave focus). */
export function pauseFocusTimer(taskId: string) {
  const timer = readFocusTimer(taskId);
  if (timer && timer.startedAt !== null) writeFocusTimer(taskId, { accumulatedMs: focusTimerElapsedMs(timer), startedAt: null });
}
/** Starts the clock, or restarts a paused one. */
export function resumeFocusTimer(taskId: string) {
  const timer = readFocusTimer(taskId);
  if (!timer) writeFocusTimer(taskId, { accumulatedMs: 0, startedAt: Date.now() });
  else if (timer.startedAt === null) writeFocusTimer(taskId, { ...timer, startedAt: Date.now() });
}

/** A per-task stopwatch that survives reloads within the session. */
export function useFocusTimer(taskId: string | undefined) {
  const [timer, setTimer] = useState<FocusTimerState | null>(() => taskId ? readFocusTimer(taskId) : null);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    setTimer(taskId ? readFocusTimer(taskId) : null);
    const sync = (event: Event) => { if (!taskId || (event as CustomEvent<string>).detail === taskId) setTimer(taskId ? readFocusTimer(taskId) : null); };
    window.addEventListener(TIMER_EVENT, sync);
    return () => window.removeEventListener(TIMER_EVENT, sync);
  }, [taskId]);
  const running = Boolean(timer && timer.startedAt !== null);
  useEffect(() => {
    if (!running) return;
    const update = () => setClock(Date.now());
    const interval = window.setInterval(update, 1_000);
    document.addEventListener("visibilitychange", update);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", update); };
  }, [running]);
  const elapsedSeconds = timer ? Math.floor(focusTimerElapsedMs(timer, clock) / 1_000) : 0;
  const toggle = useCallback(() => {
    if (!taskId || !timer) return;
    const now = Date.now(); setClock(now);
    writeFocusTimer(taskId, timer.startedAt === null ? { ...timer, startedAt: now } : { accumulatedMs: focusTimerElapsedMs(timer, now), startedAt: null });
    haptic();
  }, [taskId, timer]);
  return { started: Boolean(timer), running, elapsedSeconds, toggle };
}

function clockText(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const mm = String(minutes).padStart(2, "0"); const ss = String(rest).padStart(2, "0");
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function mutationMessage(reason: unknown) {
  return reason instanceof Error && reason.message ? reason.message : "That didn’t save. Check your connection and try again.";
}

/**
 * The one thing to do now. During the morning flow that's the next warm-up task or the big one;
 * otherwise the active task or Jev's pick. Today, Plan, and Up next all agree on it.
 */
export function useNowPick(life: LifeOSController, now: Date) {
  const { tasks, commitments } = life.snapshot;
  const session = useMorningSession();
  const plan = useMemo(() => planByTask(life.brain, tasks), [life.brain, tasks]);
  const available = useMemo(() => todayTasks(tasks, plan, now), [tasks, plan, now]);
  const candidates = useMemo(() => morningCandidates(available, commitments), [available, commitments]);
  const hasActive = tasks.some((task) => task.status === "active");
  const morning = hasActive ? null : morningPick(session, tasks, candidates.small, now);
  const pick = morning ? { task: morning.task, block: plan.get(morning.task.id) } : pickNow(tasks, plan, now);
  const offerMorning = shouldOfferMorning(session, candidates, now, life.brain?.settings.startHour, hasActive);
  return { plan, pick, morning, candidates, offerMorning };
}

/* ---------- Task actions (optimistic, with Undo) ---------- */

export function useTaskActions(life: LifeOSController) {
  const toast = useToast();
  const lockIn = useLockIn();
  const fail = useCallback((reason: unknown) => { toast.error(mutationMessage(reason)); }, [toast]);

  /**
   * Adds one task, or several when the text is a brain dump. Each one files itself into a project
   * (`projectId` overrides that for a single task; `focusProjectId` is the project in view).
   */
  const add = useCallback(async (text: string, options: AddOptions = {}) => {
    const drafts = taskDrafts(text, life.snapshot.goals, life.snapshot.tasks, options);
    const created: LifeTask[] = [];
    try {
      for (const draft of drafts) {
        created.push(await life.createTask({
          title: draft.parsed.title,
          durationMinutes: draft.parsed.durationMinutes ?? estimateMinutes(draft.parsed.title, life.snapshot.tasks),
          notBefore: draft.parsed.notBefore?.toISOString() ?? null,
          dueAt: draft.parsed.dueAt?.toISOString() ?? null,
          repeatEveryDays: draft.parsed.repeatEveryDays ?? null,
          priority: draft.parsed.priority ?? "normal",
          goalId: draft.projectId,
          area: "direction",
          status: "queued",
        }));
      }
      haptic([8, 30, 8]);
      if (created.length > 1) {
        toast.show({ message: `Added ${created.length} tasks`, action: { label: "Undo", onAction: async () => {
          try { for (const task of created) await life.updateTask(task.id, { status: "removed" }); } catch (reason) { fail(reason); }
        } } });
      } else {
        const project = life.snapshot.goals.find((goal) => goal.id === drafts[0]?.projectId);
        toast.show({ message: project ? `Added to ${project.title}` : "Added · Jev will fit it in" });
      }
    } catch (reason) {
      fail(reason);
      // Keep the words only when nothing was saved, so a retry can't make doubles.
      return created.length ? undefined : false;
    }
  }, [fail, life, toast]);

  /** Start makes the task current, starts its clock, and opens lock-in mode, all in one tap. */
  const start = useCallback(async (task: LifeTask) => {
    resumeFocusTimer(task.id); haptic();
    lockIn.open(task.id);
    if (task.status === "active") return;
    try { await life.updateTask(task.id, { status: "active" }); }
    catch (reason) { clearFocusTimer(task.id); lockIn.close(); fail(reason); }
  }, [fail, life, lockIn]);

  const restoreStatus = (task: LifeTask) => task.status === "active" ? "active" : task.status === "inbox" ? "inbox" : "queued";

  const undoComplete = useCallback(async (task: LifeTask, completedAt: number) => {
    try {
      if (task.repeatEveryDays && life.remote) {
        // Completing a repeating task makes its next occurrence on the server. Bring that
        // occurrence back as this task so repeating keeps working, and retire the finished copy.
        await life.refresh();
        const occurrence = lifeService.readLocalLife().tasks.find((candidate) => candidate.id !== task.id
          && candidate.status === "queued" && candidate.title === task.title
          && candidate.repeatEveryDays === task.repeatEveryDays && Date.parse(candidate.createdAt) >= completedAt - 60_000);
        if (occurrence) {
          await life.updateTask(occurrence.id, { status: restoreStatus(task), notBefore: task.notBefore ?? null, dueAt: task.dueAt });
          await life.updateTask(task.id, { status: "removed" });
          return;
        }
      }
      await life.updateTask(task.id, { status: restoreStatus(task) });
    } catch (reason) { fail(reason); }
  }, [fail, life]);

  const complete = useCallback(async (task: LifeTask, minutesSpent?: number, result?: PracticeResult) => {
    const completedAt = Date.now();
    try {
      await life.completeTask(task.id, minutesSpent, result);
      clearFocusTimer(task.id); haptic([8, 40, 12]);
      toast.show({ message: "Done", action: { label: "Undo", onAction: () => undoComplete(task, completedAt) } });
      return true;
    } catch (reason) { fail(reason); return false; }
  }, [fail, life, toast, undoComplete]);

  const remove = useCallback(async (task: LifeTask) => {
    try {
      await life.updateTask(task.id, { status: "removed" });
      clearFocusTimer(task.id); haptic();
      toast.show({ message: "Deleted", action: { label: "Undo", onAction: async () => { try { await life.updateTask(task.id, { status: task.status }); } catch (reason) { fail(reason); } } } });
    } catch (reason) { fail(reason); }
  }, [fail, life, toast]);

  const notNow = useCallback(async (task: LifeTask) => {
    try {
      await life.blockTask(task.id, "different"); haptic();
      toast.show({ message: "Moved aside", action: { label: "Undo", onAction: async () => { try { await life.updateTask(task.id, { status: restoreStatus(task), notBefore: task.notBefore ?? null }); } catch (reason) { fail(reason); } } } });
    } catch (reason) { fail(reason); }
  }, [fail, life, toast]);

  const stuck = useCallback(async (task: LifeTask, reason: BlockerReason) => {
    if (reason === "different") return notNow(task);
    try {
      await life.blockTask(task.id, reason); haptic();
      const message = reason === "big" ? "Made it smaller" : reason === "time" ? "Made it 5 minutes" : "Here’s a first step";
      toast.show({ message, action: { label: "Undo", onAction: async () => { try { await life.updateTask(task.id, { title: task.title, firstStep: task.firstStep, durationMinutes: task.durationMinutes }); } catch (error) { fail(error); } } } });
    } catch (error) { fail(error); }
  }, [fail, life, notNow, toast]);

  return { add, start, complete, remove, notNow, stuck };
}

/* ---------- Add bar for tasks ---------- */

export interface AddOptions {
  /** A project picked with the chip. `undefined` lets the task file itself. Ignored for a brain dump. */
  projectId?: string | null;
  /** The project in view: a running deep-work block, or Plan filtered to it. */
  focusProjectId?: string | null;
}

/** What the text will become: one task, or one per piece of a brain dump, each with its project. */
export function taskDrafts(text: string, goals: Goal[], tasks: LifeTask[], options: AddOptions = {}, now = new Date()) {
  const pieces = splitDump(text);
  if (pieces.length) {
    return pieces.map((piece) => {
      const parsed = parseQuickTask(piece, now, tasks);
      return { parsed, projectId: fileTask(parsed.title, goals, tasks, options.focusProjectId), dump: true };
    });
  }
  const parsed = parseQuickTask(text, now, tasks);
  const projectId = options.projectId !== undefined ? options.projectId : fileTask(parsed.title, goals, tasks, options.focusProjectId);
  return [{ parsed, projectId, dump: false }];
}

export function TaskAddBar({ life, focusProjectId, placeholder = "Add a task…" }: { life: LifeOSController; focusProjectId?: string | null; placeholder?: string }) {
  const actions = useTaskActions(life);
  const [text, setText] = useState("");
  /** The project tapped on the chip; it sticks until the bar is cleared. */
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const { goals, tasks } = life.snapshot;
  const hasProjects = activeProjects(goals).length > 0;
  const options: AddOptions = { projectId: picked, focusProjectId };
  const drafts = text.trim() ? taskDrafts(text, goals, tasks, options) : [];
  const name = (id: string | null) => goals.find((goal) => goal.id === id)?.title;
  let leading: ReactNode = null;
  let chips: AddBarChip[] = [];
  if (drafts.length > 1) {
    const counts = new Map<string, number>();
    for (const draft of drafts) if (draft.projectId) counts.set(draft.projectId, (counts.get(draft.projectId) ?? 0) + 1);
    chips = [{ kind: "count", label: `${drafts.length} tasks` }, ...[...counts].map(([id, count]) => ({ kind: "project" as const, label: `${count} → ${name(id) ?? "Project"}` }))];
  } else if (drafts.length === 1) {
    chips = quickTaskChips(drafts[0].parsed, new Date(), tasks);
    if (hasProjects) {
      const current = drafts[0].projectId;
      leading = <li className="chip-button-item"><button className={`parse-chip-button${current ? "" : " loose"}`} type="button" aria-label={current ? `Project: ${name(current)}. Tap to change` : "No project. Tap to pick one"} onClick={() => { haptic(6); setPicked(nextProjectChoice(current, goals)); }}>
        <FolderSimple size={13} weight="bold" aria-hidden="true" />{current ? name(current) : "No project"}
      </button></li>;
    }
  }
  return <AddBar
    label="Add a task"
    placeholder={placeholder}
    sendLabel="Add task"
    value={text}
    onValueChange={(value) => { setText(value); if (!value.trim()) setPicked(undefined); }}
    leading={leading}
    chips={() => chips}
    inputProps={{ onPaste: (event) => {
      // A text field drops line breaks, and a pasted list needs them to become separate tasks.
      const pasted = event.clipboardData.getData("text");
      if (!/\n/.test(pasted)) return;
      event.preventDefault();
      const field = event.currentTarget;
      const start = field.selectionStart ?? text.length; const end = field.selectionEnd ?? text.length;
      setText(`${text.slice(0, start)}${pasted.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join("; ")}${text.slice(end)}`);
    } }}
    onSubmit={async (value) => {
      const result = await actions.add(value, options);
      if (result !== false) setPicked(undefined);
      return result;
    }}
  />;
}

/* ---------- Now card ---------- */

export function NowCard({ life, compact = false, onOpenPlan, onOpenTask }: { life: LifeOSController; compact?: boolean; onOpenPlan?: () => void; onOpenTask?: (task: LifeTask) => void }) {
  const now = useNow();
  const { tasks } = life.snapshot;
  const { pick, morning, candidates, offerMorning } = useNowPick(life, now);
  const later = useMemo(() => laterTasks(tasks, now), [tasks, now]);
  const task = pick?.task;
  const timer = useFocusTimer(task?.id);
  const actions = useTaskActions(life);
  const lockIn = useLockIn();
  const [stuckOpen, setStuckOpen] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setReasonOpen(false); }, [task?.id]);

  if (life.loading && !tasks.length) return <section className="now-card now-loading" aria-label="Now" aria-busy="true"><span className="skeleton wide" /><span className="skeleton" /></section>;

  if (offerMorning && !compact) {
    const quick = Math.min(WARMUP_COUNT, candidates.small.length);
    return <section className="now-card morning-offer" aria-labelledby="now-title">
      <span className="now-label">Morning</span>
      <h2 id="now-title" className="now-title">{candidates.big && quick ? "Warm up, then the big one" : candidates.big ? "Start with the big one" : "Warm up with quick ones"}</h2>
      <ol className="morning-steps">
        {quick > 0 && <li>{quick === 1 ? "1 quick one" : `${quick} quick ones`} · {WARMUP_MINUTES} min max</li>}
        {candidates.big && <li>{BIG_MINUTES} min on {candidates.big.title}</li>}
        <li>Then anything you like</li>
      </ol>
      <div className="now-actions">
        <button className="btn primary" type="button" onClick={() => { haptic(); writeMorning(startMorning(candidates, new Date())); }}>Start my morning</button>
        <button className="btn quiet" type="button" onClick={() => writeMorning(skipMorning(new Date()))}>Not today</button>
      </div>
    </section>;
  }

  if (!task) {
    if (compact) return null;
    if (later.length) {
      const next = new Date(later[0].notBefore ?? later[0].scheduledStart ?? Date.now());
      return <section className="now-card now-empty" aria-labelledby="now-title">
        <h2 id="now-title" className="now-title">You’re clear until {timeLabel(next, now)}</h2>
        <p className="now-sub">Rest, or get ahead.</p>
        {onOpenPlan && <button className="btn quiet" type="button" onClick={onOpenPlan}>Pull one forward</button>}
      </section>;
    }
    return <section className="now-card now-empty" aria-labelledby="now-title">
      <h2 id="now-title" className="now-title">What’s on your mind?</h2>
      <p className="now-sub">Add anything below. Jev will plan it.</p>
    </section>;
  }

  const doing = task.status === "active" && timer.started;
  const minutesSpent = Math.max(1, Math.round(timer.elapsedSeconds / 60));
  const finish = async () => {
    if (task.source === "practice") { setPracticeOpen(true); return; }
    setBusy(true);
    await actions.complete(task, minutesSpent);
    setBusy(false);
  };
  const start = startLabel(task, now, pick?.block);
  const due = dueLabel(task, now);

  const sheets = <>
    {stuckOpen && <StuckSheet task={task} life={life} onClose={() => setStuckOpen(false)} />}
    {practiceOpen && <PracticeResultSheet task={task} onClose={() => setPracticeOpen(false)} onComplete={async (result) => { if (await actions.complete(task, minutesSpent, result)) setPracticeOpen(false); }} />}
  </>;

  if (compact) {
    return <section className={`now-card compact${doing ? " doing" : ""}`} aria-label={doing ? "Doing now" : "Now"}>
      <button className="now-compact-main" type="button" onClick={() => onOpenTask?.(task)}>
        <span className="now-label">{doing && <i className="pulse-dot" aria-hidden="true" />}{doing ? "Doing" : "Now"}</span>
        <strong>{task.title}</strong>
        {doing && <span className="now-compact-timer" aria-hidden="true">{clockText(timer.elapsedSeconds)}</span>}
      </button>
      {doing
        ? <button className="btn primary small" type="button" disabled={busy} onClick={() => void finish()}>Done</button>
        : <button className="btn primary small" type="button" onClick={() => void actions.start(task)}>Start</button>}
      {sheets}
    </section>;
  }

  if (doing) {
    return <section className="now-card doing" aria-labelledby="now-title">
      <span className="now-label"><i className="pulse-dot" aria-hidden="true" />Doing</span>
      <h2 id="now-title" className="now-title">{task.title}</h2>
      {task.firstStep && <p className="now-sub">Start with: {task.firstStep}</p>}
      <button className="now-timer" type="button" onClick={timer.toggle} aria-label={timer.running ? "Pause timer" : "Resume timer"}>
        <span role="timer" aria-label={`Elapsed time ${Math.floor(timer.elapsedSeconds / 60)} minutes ${timer.elapsedSeconds % 60} seconds`}>{clockText(timer.elapsedSeconds)}</span>
        <small aria-hidden="true">{timer.running ? "Tap to pause" : "Paused · tap to resume"}</small>
      </button>
      <div className="now-actions">
        <button className="btn primary" type="button" disabled={busy} onClick={() => void finish()}>{busy ? "Saving…" : "Done"}</button>
        <button className="btn secondary" type="button" onClick={() => setStuckOpen(true)}>I’m stuck</button>
        <button className="btn quiet" type="button" onClick={() => { resumeFocusTimer(task.id); lockIn.open(task.id); }}>Back to focus</button>
      </div>
      {sheets}
    </section>;
  }

  const bigOne = morning?.stage === "big";
  return <section className="now-card" aria-labelledby="now-title">
    <span className="now-label">{morning?.label ?? "Now"}</span>
    <h2 id="now-title" className="now-title">{task.title}</h2>
    {bigOne && <p className="now-sub">Just {BIG_MINUTES} minutes. You can stop after.</p>}
    {task.firstStep && <p className="now-sub">Start with: {task.firstStep}</p>}
    <div className="meta-chips">
      <span><Clock size={14} weight="bold" aria-hidden="true" />{durationLabel(task.durationMinutes)}</span>
      {start && <span>{start}</span>}
      {due && <span>{due}</span>}
      {isImportant(task) && <span>{task.priority === "must" ? "Urgent" : "Important"}</span>}
    </div>
    {pick?.block?.reason && <button className={`now-reason${reasonOpen ? " open" : ""}`} type="button" aria-expanded={reasonOpen} onClick={() => setReasonOpen(!reasonOpen)}>{pick.block.reason}</button>}
    <div className="now-actions">
      <button className="btn primary" type="button" onClick={() => void actions.start(task)}>Start</button>
      <button className="btn quiet" type="button" onClick={() => { if (bigOne) endMorning(); void actions.notNow(task); }}>Not now</button>
    </div>
    {sheets}
  </section>;
}

/* ---------- Stuck sheet ---------- */

const stuckOptions: Array<{ reason: BlockerReason; label: string; icon: typeof Lightning }> = [
  { reason: "big", label: "It’s too big", icon: ArrowsInSimple },
  { reason: "unclear", label: "Not sure where to start", icon: Question },
  { reason: "time", label: "Only have 5 minutes", icon: Clock },
  { reason: "different", label: "Do something else", icon: ShuffleSimple },
];

export function StuckSheet({ task, life, onClose }: { task: LifeTask; life: LifeOSController; onClose: () => void }) {
  const actions = useTaskActions(life);
  const [working, setWorking] = useState(false);
  const choose = async (reason: BlockerReason) => {
    setWorking(true); onClose();
    await actions.stuck(task, reason);
  };
  return <Sheet title="What’s getting in the way?" onClose={onClose} className="stuck-sheet">
    <div className="stuck-options">
      {stuckOptions.map(({ reason, label, icon: Icon }, index) => <button key={reason} type="button" data-auto-focus={index === 0 ? true : undefined} disabled={working} onClick={() => void choose(reason)}><Icon size={22} aria-hidden="true" />{label}</button>)}
    </div>
    <button className="btn quiet danger" type="button" disabled={working} onClick={() => { onClose(); void actions.remove(task); }}>Delete task</button>
  </Sheet>;
}

/* ---------- Practice result ---------- */

const practiceOutcomeOptions: Array<{ value: PracticeOutcome; label: string; detail: string }> = [
  { value: "helped", label: "It helped", detail: "I want to carry this forward" },
  { value: "mixed", label: "Somewhat", detail: "Part of it worked" },
  { value: "not_for_me", label: "Not for me", detail: "Trying it helped me let it go" },
];

export function PracticeResultSheet({ task, onClose, onComplete }: { task: LifeTask; onClose: () => void; onComplete: (result: PracticeResult) => Promise<void> }) {
  const [outcome, setOutcome] = useState<PracticeOutcome | null>(null);
  const [reflection, setReflection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!outcome) return;
    setSubmitting(true);
    await onComplete({ outcome, reflection: reflection.trim() });
    setSubmitting(false);
  };
  return <Sheet title="What happened when you tried it?" onClose={onClose} onSubmit={(event) => void submit(event)}>
    <p className="sheet-note">You tried “{task.title}.”</p>
    <fieldset className="choice-list-plain">
      <legend className="sr-only">Did this help?</legend>
      {practiceOutcomeOptions.map((option) => <label key={option.value} className={outcome === option.value ? "selected" : ""}>
        <input type="radio" name="practice-outcome" value={option.value} checked={outcome === option.value} onChange={() => setOutcome(option.value)} />
        <span><strong>{option.label}</strong> <small>{option.detail}</small></span>
        {outcome === option.value && <Check size={16} weight="bold" aria-hidden="true" />}
      </label>)}
    </fieldset>
    <label className="field"><span>What did you notice? <small>Optional</small></span><textarea value={reflection} maxLength={2000} onChange={(event) => setReflection(event.target.value)} placeholder="The part I want to remember is…" /></label>
    <button className="btn primary" type="submit" disabled={!outcome || submitting}>{submitting ? "Saving…" : "Finish and remember this"}</button>
  </Sheet>;
}

/* ---------- Task row ---------- */

export function TaskRow({ task, meta, onOpen, onComplete, onStart }: { task: LifeTask; meta: string; onOpen: () => void; onComplete: () => Promise<unknown>; onStart?: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const complete = async () => {
    setLeaving(true); haptic();
    const result = await onComplete();
    if (result === false) setLeaving(false);
  };
  return <li className={`task-row${leaving ? " leaving" : ""}`}>
    <button className="task-check" type="button" aria-label={`Complete ${task.title}`} disabled={leaving} onClick={() => void complete()}>{leaving && <Check size={16} weight="bold" />}</button>
    <button className="task-row-main" type="button" onClick={onOpen}>
      <strong>{task.title}</strong>
      <small>{meta}</small>
    </button>
    {onStart && <button className="task-row-start" type="button" onClick={onStart} aria-label={`Start ${task.title}`}>Start</button>}
  </li>;
}

export function TaskList({ tasks, life, now, onOpen, showStart = true, showProject = false }: { tasks: LifeTask[]; life: LifeOSController; now: Date; onOpen: (task: LifeTask) => void; showStart?: boolean; showProject?: boolean }) {
  const actions = useTaskActions(life);
  const plan = planByTask(life.brain, life.snapshot.tasks);
  const meta = (task: LifeTask) => {
    const line = taskMeta(task, now, plan.get(task.id));
    const project = showProject && task.goalId ? life.snapshot.goals.find((goal) => goal.id === task.goalId)?.title : undefined;
    return project ? `${project} · ${line}` : line;
  };
  return <ul className="task-list">
    {tasks.map((task) => <TaskRow key={task.id} task={task} meta={meta(task)} onOpen={() => onOpen(task)} onComplete={() => actions.complete(task)} onStart={showStart ? () => void actions.start(task) : undefined} />)}
  </ul>;
}

/** Up to three tasks after the Now task. */
export function UpNext({ life, onSeeAll, onOpen }: { life: LifeOSController; onSeeAll: () => void; onOpen: (task: LifeTask) => void }) {
  const now = useNow();
  const { plan, pick } = useNowPick(life, now);
  const current = pick?.task.id;
  const next = todayTasks(life.snapshot.tasks, plan, now).filter((task) => task.id !== current);
  if (!next.length) return null;
  return <section className="today-section" aria-labelledby="up-next-title">
    <h2 id="up-next-title" className="section-label">Up next</h2>
    <TaskList tasks={next.slice(0, 3)} life={life} now={now} onOpen={onOpen} showStart={false} />
    <button className="btn quiet" type="button" onClick={onSeeAll}>See all in Plan</button>
  </section>;
}

/* ---------- Task sheet ---------- */

const durationChoices = [5, 15, 30, 60, 90];
const repeatChoices: Array<{ label: string; value: number | null }> = [{ label: "Never", value: null }, { label: "Daily", value: 1 }, { label: "Weekly", value: 7 }, { label: "Monthly", value: 30 }];

export function ChipGroup<T>({ label, options, value, onChange }: { label: string; options: Array<{ label: string; value: T }>; value: T; onChange: (value: T) => void }) {
  return <fieldset className="chip-field">
    <legend>{label}</legend>
    <div className="chip-row" role="group" aria-label={label}>
      {options.map((option) => <button key={option.label} className={`chip${option.value === value ? " selected" : ""}`} type="button" aria-pressed={option.value === value} onClick={() => { haptic(6); onChange(option.value); }}>{option.label}</button>)}
    </div>
  </fieldset>;
}

export function TaskSheet({ task, life, onClose }: { task: LifeTask; life: LifeOSController; onClose: () => void }) {
  const now = useMemo(() => new Date(), []);
  const actions = useTaskActions(life);
  const toast = useToast();
  const [title, setTitle] = useState(task.title);
  const [firstStep, setFirstStep] = useState(task.firstStep);
  const [duration, setDuration] = useState(task.durationMinutes);
  const [notBefore, setNotBefore] = useState<string | null>(task.notBefore && Date.parse(task.notBefore) > now.getTime() ? task.notBefore : null);
  const [repeat, setRepeat] = useState<number | null>(task.repeatEveryDays ?? null);
  const [important, setImportant] = useState(isImportant(task));
  const [projectId, setProjectId] = useState<string | null>(task.goalId);
  const projects = activeProjects(life.snapshot.goals);
  const projectOptions: Array<{ label: string; value: string | null }> = [
    { label: "None", value: null },
    ...projects.map((project) => ({ label: project.title, value: project.id })),
    // A task in a paused project keeps showing where it lives.
    ...(task.goalId && !projects.some((project) => project.id === task.goalId) ? life.snapshot.goals.filter((goal) => goal.id === task.goalId).map((goal) => ({ label: goal.title, value: goal.id })) : []),
  ];
  const when = whenOptions(now);
  const matchedWhen = when.find((option) => option.date ? notBefore !== null && Math.abs(Date.parse(notBefore) - option.date.getTime()) < 60_000 : notBefore === null);
  const whenChoices: Array<{ label: string; value: string | null }> = [
    ...when.map((option) => ({ label: option.label, value: option.date ? (matchedWhen === option && notBefore ? notBefore : option.date.toISOString()) : null })),
    ...(!matchedWhen && notBefore ? [{ label: timeLabel(notBefore, now), value: notBefore }] : []),
  ];
  const durationOptions = [...new Set([...durationChoices, task.durationMinutes])].sort((a, b) => a - b).map((value) => ({ label: value === 60 ? "1 hr" : value > 90 && value % 60 === 0 ? `${value / 60} hr` : `${value} min`, value }));
  const repeatOptions = repeat && !repeatChoices.some((choice) => choice.value === repeat) ? [...repeatChoices, { label: describeRepeat(repeat), value: repeat }] : repeatChoices;

  const changes = (): Partial<LifeTask> => {
    const patch: Partial<LifeTask> = {};
    const cleanTitle = title.trim() || task.title;
    if (cleanTitle !== task.title) patch.title = cleanTitle;
    if (firstStep.trim() !== task.firstStep) patch.firstStep = firstStep.trim();
    if (duration !== task.durationMinutes) patch.durationMinutes = duration;
    const originalNotBefore = task.notBefore && Date.parse(task.notBefore) > now.getTime() ? task.notBefore : null;
    if (notBefore !== originalNotBefore) patch.notBefore = notBefore;
    if (repeat !== (task.repeatEveryDays ?? null)) patch.repeatEveryDays = repeat;
    if (important !== isImportant(task)) patch.priority = important ? "high" : "normal";
    if (projectId !== task.goalId) patch.goalId = projectId;
    return patch;
  };
  const save = async (extra: Partial<LifeTask> = {}) => {
    const patch = { ...changes(), ...extra };
    if (!Object.keys(patch).length) return true;
    try { await life.updateTask(task.id, patch); return true; }
    catch (reason) { toast.error(mutationMessage(reason)); return false; }
  };
  const close = () => { onClose(); void save(); };
  const startNow = async () => {
    onClose();
    if (await save({ notBefore: null })) await actions.start({ ...task, notBefore: null });
  };
  return <Sheet title="Edit task" hideTitle onClose={close} className="task-sheet" closeLabel="Close and save">
    <label className="sr-only" htmlFor="task-sheet-title">Task</label>
    <textarea id="task-sheet-title" className="task-sheet-title" rows={1} value={title} maxLength={240} onChange={(event) => setTitle(event.target.value.replace(/\n/g, " "))} />
    <label className="field"><span className="sr-only">First step</span><input value={firstStep} maxLength={500} onChange={(event) => setFirstStep(event.target.value)} placeholder="Start with…" /></label>
    <ChipGroup label="How long" options={durationOptions} value={duration} onChange={setDuration} />
    <ChipGroup label="When" options={whenChoices} value={notBefore} onChange={setNotBefore} />
    <ChipGroup label="Repeat" options={repeatOptions} value={repeat} onChange={setRepeat} />
    {projectOptions.length > 1 && <ChipGroup label="Project" options={projectOptions} value={projectId} onChange={setProjectId} />}
    <div className="toggle-row">
      <span aria-hidden="true">Important</span>
      <button className={`switch${important ? " on" : ""}`} type="button" role="switch" aria-checked={important} aria-label="Important" onClick={() => { haptic(6); setImportant(!important); }}><span /></button>
    </div>
    <button className="btn primary" type="button" onClick={() => void startNow()}>Start now</button>
    <button className="btn quiet danger" type="button" onClick={() => { onClose(); void actions.remove(task); }}><Trash size={17} aria-hidden="true" /> Delete</button>
  </Sheet>;
}

/* ---------- Daily basics ---------- */

function todayKey() { const date = new Date(); date.setHours(12, 0, 0, 0); return date.toISOString(); }
function sameLocalDay(value: string, day: Date) {
  const date = new Date(value);
  return date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate();
}

export function DailyBasics({ life, heading = true }: { life: LifeOSController; heading?: boolean }) {
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const items = life.snapshot.floor;
  const today = new Date();
  const toggle = async (id: string) => {
    haptic();
    try { await life.toggleFloorItem(id, todayKey()); }
    catch (reason) { toast.error(mutationMessage(reason)); }
  };
  return <section className="today-section" aria-labelledby={heading ? "basics-title" : undefined} aria-label={heading ? undefined : "Daily basics"}>
    {heading && <h2 id="basics-title" className="section-label">Daily basics</h2>}
    {items.length ? <div className="basics-row">
      {items.map((item) => { const done = item.completionDates.some((value) => sameLocalDay(value, today)); return <button key={item.id} className={`basic-chip${done ? " done" : ""}`} type="button" aria-pressed={done} onClick={() => void toggle(item.id)}><span className="basic-check" aria-hidden="true">{done && <Check size={13} weight="bold" />}</span>{item.title}</button>; })}
      <button className="basic-chip add" type="button" onClick={() => setAdding(true)}><Plus size={14} weight="bold" aria-hidden="true" /> Add</button>
    </div> : <button className="btn quiet" type="button" onClick={() => setAdding(true)}>Add a daily habit</button>}
    {adding && <DailyBasicSheet life={life} onClose={() => setAdding(false)} />}
  </section>;
}

function DailyBasicSheet({ life, onClose }: { life: LifeOSController; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try { await life.createFloorItem({ title: title.trim(), area: "health", target: 1, unit: "time" }); haptic(); onClose(); }
    catch (reason) { toast.error(mutationMessage(reason)); setSaving(false); }
  };
  return <Sheet title="Add a daily habit" onClose={onClose} onSubmit={(event) => void submit(event)}>
    <p className="sheet-note">Something small you can do even on a bad day.</p>
    <label className="field"><span className="sr-only">Daily habit</span><input data-auto-focus value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Take medication" /></label>
    <button className="btn primary" type="submit" disabled={!title.trim() || saving}>{saving ? "Adding…" : "Add habit"}</button>
  </Sheet>;
}

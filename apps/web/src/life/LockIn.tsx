import { useEffect, useId, useRef, useState } from "react";
import { Check } from "@phosphor-icons/react";
import * as lifeService from "../services/life";
import { mutationMessage } from "./TaskViews";
import { HoldButton } from "../ui/HoldButton";
import { ModalBackdrop } from "../ui/Sheet";
import { haptic, useToast } from "../ui/Toast";
import { useLockIn } from "./lockInContext";
import { doneToday } from "./planning";
import { advanceRoutine, enterStep, readRoutine, startWait, waitDoneMessage, waitLeftLabel, waitRemainingMs, writeRoutine, type RoutineProgress } from "./routine";
import { PracticeResultSheet, StuckSheet, clearFocusTimer, pauseFocusTimer, resumeFocusTimer, useFocusTimer, useTaskActions } from "./TaskViews";
import type { LifeTask, PracticeResult, RoutineStep } from "./types";
import type { LifeOSController } from "./useLifeOS";

/** How long the win moment stays before returning to Today. */
export const WIN_MOMENT_MS = 2_000;

function clockText(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  const mm = String(minutes).padStart(2, "0"); const ss = String(rest).padStart(2, "0");
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function spokenDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return minutes ? `${minutes} minute${minutes === 1 ? "" : "s"} ${rest} second${rest === 1 ? "" : "s"}` : `${rest} second${rest === 1 ? "" : "s"}`;
}

/** Still something to show. A routine waiting in the background is queued until its wait ends, and that's fine. */
function stillOpen(task: LifeTask, now: number, backgroundWait = false) {
  return (task.status === "active" || task.status === "queued" || task.status === "inbox") && (backgroundWait || !(task.notBefore && Date.parse(task.notBefore) > now));
}

/** Renders lock-in mode for whichever task Start opened. Lives once, at the app root. */
export function LockInHost({ life, onFinished }: { life: LifeOSController; onFinished: () => void }) {
  const { taskId, close } = useLockIn();
  if (!taskId) return null;
  return <LockInView key={taskId} taskId={taskId} life={life} onClose={close} onFinished={() => { close(); onFinished(); }} />;
}

const SIZE = 248;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A ring that empties as time passes. After zero it fills in the accent color and counts up. */
function CountdownRing({ totalSeconds, elapsedSeconds, running, onToggle, spokenPrefix = "Time left" }: { totalSeconds: number; elapsedSeconds: number; running: boolean; onToggle?: () => void; spokenPrefix?: string }) {
  const left = totalSeconds - elapsedSeconds;
  const over = left < 0;
  const used = over ? 0 : Math.min(1, Math.max(0, elapsedSeconds / Math.max(1, totalSeconds)));
  const caption = over ? "Over time · no rush" : onToggle && !running ? "Paused · tap to go" : onToggle ? "Tap to pause" : "left";
  const face = <>
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" focusable="false">
      <circle className="ring-track" cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} strokeWidth={STROKE} />
      <circle className="ring-arc" cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} strokeWidth={STROKE} strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * used} transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`} />
    </svg>
    <span className="ring-center">
      <span className="ring-time" role="timer" aria-label={over ? `Over time by ${spokenDuration(-left)}` : `${spokenPrefix} ${spokenDuration(left)}`}>{over ? `+${clockText(-left)}` : clockText(left)}</span>
      <small aria-hidden="true">{caption}</small>
    </span>
  </>;
  const classes = `lockin-ring${over ? " over" : ""}${onToggle && !running ? " paused" : ""}`;
  return onToggle
    ? <button className={classes} type="button" onClick={onToggle} aria-label={running ? "Pause timer" : "Resume timer"}>{face}</button>
    : <div className={classes}>{face}</div>;
}

const readyItems = ["Phone face down", "Water nearby", "Close everything else"];

function GetReady() {
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const toggle = (item: string) => { haptic(6); setChecked((current) => { const next = new Set(current); if (next.has(item)) next.delete(item); else next.add(item); return next; }); };
  return <div className="get-ready" role="group" aria-label="Get ready">
    {readyItems.map((item) => { const on = checked.has(item); return <button key={item} type="button" className={`ready-chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggle(item)}>
      <span className="ready-check" aria-hidden="true">{on && <Check size={13} weight="bold" />}</span>{item}
    </button>; })}
  </div>;
}

function useClock(intervalMs = 1_000) {
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setClock(Date.now());
    const timer = window.setInterval(update, intervalMs);
    document.addEventListener("visibilitychange", update);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, [intervalMs]);
  return clock;
}

function clampProgress(progress: RoutineProgress, steps: RoutineStep[]): RoutineProgress {
  return progress.step <= steps.length - 1 ? progress : { ...progress, step: Math.max(0, steps.length - 1) };
}

export function LockInView({ taskId, life, onClose, onFinished }: { taskId: string; life: LifeOSController; onClose: () => void; onFinished: () => void }) {
  const titleId = useId();
  const toast = useToast();
  const actions = useTaskActions(life);
  const clock = useClock();
  const live = life.snapshot.tasks.find((task) => task.id === taskId);
  const lastTask = useRef(live);
  if (live) lastTask.current = live;
  const task = lastTask.current;
  const timer = useFocusTimer(taskId);
  const [phase, setPhase] = useState<"focus" | "win">("focus");
  const [winCount, setWinCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [stuckOpen, setStuckOpen] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);

  const commitment = task?.commitmentId ? life.snapshot.commitments.find((item) => item.id === task.commitmentId) : undefined;
  const steps = commitment?.steps ?? [];
  const routine = steps.length > 0;
  const [storedProgress, setProgress] = useState<RoutineProgress>(() => readRoutine(taskId) ?? enterStep(steps, 0));
  const progress = clampProgress(storedProgress, steps);

  // A routine whose wait is running lives in the background: no focus clock until it's picked up again.
  const backgroundWait = routine && progress.waitEndsAt !== null;
  // Make sure the clock runs whenever lock-in is showing (for example after a reload).
  const hasTask = Boolean(task);
  const startsInBackground = useRef(backgroundWait).current;
  useEffect(() => { if (hasTask && !startsInBackground) resumeFocusTimer(taskId); }, [hasTask, startsInBackground, taskId]);
  const { step: stepIndex, waitEndsAt, notified } = progress;
  useEffect(() => { if (routine) writeRoutine(taskId, { step: stepIndex, waitEndsAt, notified }); }, [routine, taskId, stepIndex, waitEndsAt, notified]);
  // Close quietly when the task is moved aside, deleted, or finished somewhere else.
  const finishing = useRef(false);
  useEffect(() => {
    if (phase === "win" || finishing.current) return;
    if (!live || !stillOpen(live, Date.now(), backgroundWait)) onClose();
  }, [live, phase, onClose, backgroundWait]);
  // The nudge when a wait ends is sent by RoutineNudger, which runs even when lock-in is closed.
  const waitLeft = waitRemainingMs(progress, Math.max(clock, Date.now()));
  const waitOver = routine && progress.waitEndsAt !== null && waitLeft === 0;
  const finished = useRef(onFinished); finished.current = onFinished;
  useEffect(() => {
    if (phase !== "win") return;
    const timeout = window.setTimeout(() => finished.current(), WIN_MOMENT_MS);
    return () => window.clearTimeout(timeout);
  }, [phase]);

  if (!task) return null;
  const minutesSpent = Math.max(1, Math.round(timer.elapsedSeconds / 60));

  const complete = async (result?: PracticeResult) => {
    setBusy(true);
    finishing.current = true;
    const ok = await actions.complete(task, minutesSpent, result);
    setBusy(false);
    if (!ok) { finishing.current = false; return false; }
    writeRoutine(taskId, null);
    setWinCount(doneToday(lifeService.readLocalLife().tasks, new Date()).length);
    setPracticeOpen(false);
    setPhase("win");
    return true;
  };
  const done = () => { if (task.source === "practice") setPracticeOpen(true); else void complete(); };
  /** Coming back from a wait makes the task current again, with its clock running. */
  const reactivate = () => {
    resumeFocusTimer(taskId);
    const current = life.snapshot.tasks.find((item) => item.id === taskId);
    if (!current || (current.status === "active" && !current.notBefore)) return;
    finishing.current = true; // Don't close while the task is on its way back from "later".
    life.updateTask(taskId, { status: "active", notBefore: null })
      .catch((reason) => toast.error(mutationMessage(reason)))
      .finally(() => { finishing.current = false; });
  };
  const nextStep = () => {
    haptic();
    const fromWait = progress.waitEndsAt !== null;
    const moved = advanceRoutine(progress, steps);
    if (fromWait) reactivate();
    if (moved.finished) { if (fromWait) setProgress({ ...progress, waitEndsAt: null }); done(); return; }
    setProgress(moved.progress);
  };
  /** "Start 45-min timer": the routine moves to the background and Jev offers something else meanwhile. */
  const startTimer = async () => {
    const step = steps[progress.step];
    const next = startWait(progress, steps);
    haptic([8, 30, 8]);
    finishing.current = true;
    writeRoutine(taskId, next);
    clearFocusTimer(taskId);
    onClose();
    toast.show({ message: `${step?.title ?? "Timer"} · we’ll nudge you` });
    try { await life.updateTask(taskId, { status: "queued", notBefore: new Date(next.waitEndsAt!).toISOString() }); }
    catch (reason) { toast.error(mutationMessage(reason)); }
  };
  const leave = () => { pauseFocusTimer(taskId); onClose(); };

  if (phase === "win") {
    return <ModalBackdrop className="lockin-backdrop" onClose={() => undefined} closeOnEscape={false} closeOnBackdrop={false}>
      <section className="lockin win" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="lockin-win" role="status">
          <span className="win-check" aria-hidden="true"><Check size={52} weight="bold" /></span>
          <h2 id={titleId} className="win-title">Done.</h2>
          <p className="win-sub">That’s {winCount} today.</p>
        </div>
      </section>
    </ModalBackdrop>;
  }

  const step = routine ? steps[progress.step] : undefined;
  const waiting = routine && progress.waitEndsAt !== null && waitLeft > 0;
  const lastStep = routine && progress.step >= steps.length - 1;
  const waitToStart = routine && Boolean(step?.waitMinutes) && progress.waitEndsAt === null;
  const showReady = timer.elapsedSeconds < 60 && !backgroundWait && !waitToStart;
  const stuckButton = <button className="btn secondary" type="button" onClick={() => setStuckOpen(true)}>I’m stuck</button>;

  return <ModalBackdrop className="lockin-backdrop" onClose={() => undefined} closeOnEscape={false} closeOnBackdrop={false}>
    <section className={`lockin${routine ? " routine" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="lockin-head">
        <span className="now-label">{timer.running && <i className="pulse-dot" aria-hidden="true" />}{routine ? `Step ${progress.step + 1} of ${steps.length}` : timer.running ? "Focus" : "Paused"}</span>
        <h2 id={titleId} className={routine ? "lockin-task" : "lockin-title"}>{task.title}</h2>
        {!routine && task.firstStep && <p className="lockin-sub">Start with: {task.firstStep}</p>}
        {routine && <span className="routine-progress" aria-hidden="true">{steps.map((_, index) => <i key={index} className={index < progress.step ? "done" : index === progress.step ? "current" : ""} />)}</span>}
      </header>

      <div className="lockin-body">
        {routine && step ? <>
          <p className="lockin-step">{step.title}</p>
          {waiting && <>
            <CountdownRing totalSeconds={(step.waitMinutes ?? 1) * 60} elapsedSeconds={(step.waitMinutes ?? 1) * 60 - waitLeft / 1_000} running spokenPrefix="Wait left" />
            <p className="lockin-sub" role="status">{step.title} · {waitLeftLabel(waitLeft)}</p>
            <p className="lockin-note">It keeps running while you do other things.</p>
          </>}
          {waitOver && <p className="lockin-sub accent" role="status">{waitDoneMessage(steps, progress.step)}</p>}
        </> : <CountdownRing totalSeconds={Math.max(1, task.durationMinutes) * 60} elapsedSeconds={timer.elapsedSeconds} running={timer.running} onToggle={timer.toggle} />}
        {showReady && <GetReady />}
      </div>

      <div className="lockin-actions">
        {routine
          ? waiting
            ? <button className="btn secondary" type="button" data-auto-focus onClick={nextStep}>It’s done already</button>
            : waitToStart ? <>
              <button className="btn primary" type="button" data-auto-focus onClick={() => void startTimer()}>Start {step?.waitMinutes}-min timer</button>
              {stuckButton}
            </> : <>
              <button className="btn primary" type="button" data-auto-focus disabled={busy} onClick={nextStep}>{busy ? "Saving…" : lastStep ? "Done" : "Next step"}</button>
              {stuckButton}
            </>
          : <>
            <button className="btn primary" type="button" data-auto-focus disabled={busy} onClick={done}>{busy ? "Saving…" : "Done"}</button>
            {stuckButton}
          </>}
        <HoldButton label="Leave focus" onComplete={leave} />
      </div>

      {stuckOpen && <StuckSheet task={task} life={life} onClose={() => setStuckOpen(false)} />}
      {practiceOpen && <PracticeResultSheet task={task} onClose={() => setPracticeOpen(false)} onComplete={async (result) => { await complete(result); }} />}
    </section>
  </ModalBackdrop>;
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sendNudge } from "../services/nudges";
import { haptic, useToast } from "../ui/Toast";
import { useLockIn } from "./lockInContext";
import { ROUTINE_EVENT, advanceRoutine, readRoutine, waitDoneMessage, waitDoneTitle, waitMinutesLeftLabel, waitRemainingMs, writeRoutine, type RoutineProgress } from "./routine";
import { mutationMessage, resumeFocusTimer } from "./TaskViews";
import type { LifeTask, RoutineStep } from "./types";
import type { LifeOSController } from "./useLifeOS";

type RoutineLife = Pick<LifeOSController, "snapshot" | "updateTask">;

export interface BackgroundRoutine {
  task: LifeTask;
  steps: RoutineStep[];
  progress: RoutineProgress;
  leftMs: number;
  over: boolean;
}

/** Every open routine whose wait was started: running in the background, or finished and waiting to be picked up. */
export function useBackgroundRoutines(life: Pick<LifeOSController, "snapshot">, tickMs = 15_000): BackgroundRoutine[] {
  const [clock, setClock] = useState(() => Date.now());
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => { setVersion((value) => value + 1); setClock(Date.now()); };
    const tick = window.setInterval(() => setClock(Date.now()), tickMs);
    window.addEventListener(ROUTINE_EVENT, bump);
    window.addEventListener("storage", bump);
    document.addEventListener("visibilitychange", bump);
    return () => { window.clearInterval(tick); window.removeEventListener(ROUTINE_EVENT, bump); window.removeEventListener("storage", bump); document.removeEventListener("visibilitychange", bump); };
  }, [tickMs]);
  const { tasks, commitments } = life.snapshot;
  return useMemo(() => {
    const now = Math.max(clock, Date.now());
    return tasks.flatMap((task) => {
      if (!task.commitmentId || !(task.status === "queued" || task.status === "inbox" || task.status === "active")) return [];
      const steps = commitments.find((item) => item.id === task.commitmentId)?.steps ?? [];
      const progress = steps.length ? readRoutine(task.id) : null;
      if (!progress || progress.waitEndsAt === null || progress.step >= steps.length) return [];
      const leftMs = waitRemainingMs(progress, now);
      return [{ task, steps, progress, leftMs, over: leftMs === 0 }];
    }).sort((a, b) => a.progress.waitEndsAt! - b.progress.waitEndsAt!);
  }, [tasks, commitments, clock, version]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Picks a routine back up: after its wait, move to the next step and make it current; during it, just show it. */
export function useContinueRoutine(life: RoutineLife) {
  const lockIn = useLockIn();
  const toast = useToast();
  return useCallback((entry: BackgroundRoutine) => {
    haptic(); toast.dismiss();
    if (!entry.over) { lockIn.open(entry.task.id); return; }
    const moved = advanceRoutine(entry.progress, entry.steps);
    writeRoutine(entry.task.id, moved.finished ? { ...entry.progress, waitEndsAt: null } : moved.progress);
    resumeFocusTimer(entry.task.id);
    // Make it current first, so lock-in doesn't see a task that still starts "later".
    void life.updateTask(entry.task.id, { status: "active", notBefore: null })
      .then(() => lockIn.open(entry.task.id))
      .catch((reason) => toast.error(mutationMessage(reason)));
  }, [life, lockIn, toast]);
}

/** "In the background" on Today: laundry and friends, running while you do other things. */
export function BackgroundSection({ life }: { life: RoutineLife }) {
  const routines = useBackgroundRoutines(life);
  const continueRoutine = useContinueRoutine(life);
  if (!routines.length) return null;
  return <section className="today-section background-section" aria-labelledby="background-title">
    <h2 id="background-title" className="section-label">In the background</h2>
    <ul className="background-list">
      {routines.map((entry) => {
        const step = entry.steps[entry.progress.step];
        const next = entry.steps[entry.progress.step + 1];
        return <li key={entry.task.id} className={entry.over ? "over" : ""}>
          <button className="background-main" type="button" onClick={() => continueRoutine(entry)}>
            {entry.over
              ? <><strong>{waitDoneTitle(entry.steps, entry.progress.step)}</strong><small>{next?.title ?? entry.task.title}</small></>
              : <><strong>{entry.task.title}</strong><small>{step?.title} · <span className="background-left">{waitMinutesLeftLabel(entry.leftMs)}</span></small></>}
          </button>
          {entry.over
            ? <button className="btn secondary small" type="button" aria-label={`Continue ${entry.task.title}`} onClick={() => continueRoutine(entry)}>Continue</button>
            : <i className="background-dot" aria-hidden="true" />}
        </li>;
      })}
    </ul>
  </section>;
}

/**
 * Sends the one nudge per wait, wherever the person is in the app: a notification when they've looked
 * away, a toast with Continue when Remember is on screen.
 */
export function RoutineNudger({ life }: { life: RoutineLife }) {
  const routines = useBackgroundRoutines(life, 5_000);
  const continueRoutine = useContinueRoutine(life);
  const lockIn = useLockIn();
  const toast = useToast();
  const sent = useRef(new Set<string>());
  useEffect(() => {
    routines.filter((entry) => entry.over && !entry.progress.notified).forEach((entry) => {
      const key = `${entry.task.id}:${entry.progress.waitEndsAt}`;
      if (sent.current.has(key)) return;
      sent.current.add(key);
      writeRoutine(entry.task.id, { ...entry.progress, notified: true });
      const message = waitDoneMessage(entry.steps, entry.progress.step);
      haptic([10, 40, 10]);
      if (document.visibilityState === "hidden") sendNudge("Remember", message);
      else if (lockIn.taskId !== entry.task.id) toast.show({ message, duration: 10_000, action: { label: "Continue", onAction: () => continueRoutine({ ...entry, progress: { ...entry.progress, notified: true } }) } });
    });
  }, [routines, lockIn.taskId, toast, continueRoutine]);
  return null;
}

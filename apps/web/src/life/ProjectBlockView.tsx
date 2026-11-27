import { useEffect, useId, useRef, useState } from "react";
import { Check } from "@phosphor-icons/react";
import { HoldButton } from "../ui/HoldButton";
import { ModalBackdrop } from "../ui/Sheet";
import { haptic, useToast } from "../ui/Toast";
import { useLockIn } from "./lockInContext";
import { planByTask } from "./planning";
import { blockCounts, blockTask, useProjectBlock, writeBlock, type ProjectBlock } from "./projectBlock";
import { StuckSheet, TaskAddBar, mutationMessage, pauseFocusTimer, resumeFocusTimer, useFocusTimer, useNow, useTaskActions } from "./TaskViews";
import type { LifeOSController } from "./useLifeOS";

/** How long the win moment stays when a block ends. */
const WIN_MOMENT_MS = 2_000;

/** Renders the deep-work block while one is running. Lives once, at the app root. */
export function ProjectBlockHost({ life }: { life: LifeOSController }) {
  const block = useProjectBlock();
  const project = block ? life.snapshot.goals.find((goal) => goal.id === block.projectId) : undefined;
  // A project that's gone (or not loaded yet) shows nothing; once data is in and it's still missing, end the block.
  useEffect(() => { if (block && !project && !life.loading && life.snapshot.goals.length) writeBlock(null); }, [block, project, life.loading, life.snapshot.goals.length]);
  if (!block || !project) return null;
  return <ProjectBlockView key={`${block.projectId}-${block.startedAt}`} block={block} projectTitle={project.title} life={life} />;
}

function clockText(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  const mm = String(minutes).padStart(2, "0"); const ss = String(rest).padStart(2, "0");
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

const SIZE = 248;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function BlockRing({ totalSeconds, elapsedSeconds }: { totalSeconds: number; elapsedSeconds: number }) {
  const left = totalSeconds - elapsedSeconds;
  const over = left <= 0;
  const used = over ? 0 : Math.min(1, Math.max(0, elapsedSeconds / Math.max(1, totalSeconds)));
  const minutesLeft = Math.ceil(left / 60);
  return <div className={`lockin-ring${over ? " over" : ""}`}>
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" focusable="false">
      <circle className="ring-track" cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} strokeWidth={STROKE} />
      <circle className="ring-arc" cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} strokeWidth={STROKE} strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * used} transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`} />
    </svg>
    <span className="ring-center">
      <span className="ring-time" role="timer" aria-label={over ? "Block done" : `${minutesLeft} minute${minutesLeft === 1 ? "" : "s"} left in this block`}>{clockText(over ? 0 : left)}</span>
      <small aria-hidden="true">{over ? "Block done · finish when ready" : "left in this block"}</small>
    </span>
  </div>;
}

/**
 * Deep work on one project: the ring counts down the whole block, and the project's tasks come one
 * at a time. Done moves straight to the next one, with no win screen in between.
 */
export function ProjectBlockView({ block, projectTitle, life }: { block: ProjectBlock; projectTitle: string; life: LifeOSController }) {
  const titleId = useId();
  const toast = useToast();
  const actions = useTaskActions(life);
  const lockIn = useLockIn();
  const clock = useNow(1_000);
  const plan = planByTask(life.brain, life.snapshot.tasks);
  const task = blockTask(block.projectId, life.snapshot.tasks, plan, clock);
  const counts = blockCounts(block, life.snapshot.tasks, plan, clock);
  const timer = useFocusTimer(task?.id);
  const [stuckOpen, setStuckOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [win, setWin] = useState<number | null>(null);

  // A block replaces single-task lock-in while it runs.
  useEffect(() => { if (lockIn.taskId) lockIn.close(); }, [lockIn]);

  // The next task becomes current by itself, and its clock runs so the time spent is saved.
  const starting = useRef<string | null>(null);
  useEffect(() => {
    if (!task || win !== null) return;
    resumeFocusTimer(task.id);
    if (task.status === "active" || starting.current === task.id) return;
    starting.current = task.id;
    life.updateTask(task.id, { status: "active" }).catch((reason) => { toast.error(mutationMessage(reason)); starting.current = null; });
  }, [task, life, toast, win]);

  useEffect(() => {
    if (win === null) return;
    const timeout = window.setTimeout(() => writeBlock(null), WIN_MOMENT_MS);
    return () => window.clearTimeout(timeout);
  }, [win]);

  const totalSeconds = block.minutes * 60;
  const elapsedSeconds = Math.max(0, (clock.getTime() - block.startedAt) / 1_000);
  const timeUp = elapsedSeconds >= totalSeconds;

  const done = async () => {
    if (!task) return;
    setBusy(true);
    await actions.complete(task, Math.max(1, Math.round(timer.elapsedSeconds / 60)));
    setBusy(false);
  };

  /** Ends the block. The current task goes back to the list, then a short win if anything got done. */
  const wrapUp = async () => {
    haptic([8, 40, 12]);
    if (task) {
      pauseFocusTimer(task.id);
      if (task.status === "active") life.updateTask(task.id, { status: "queued" }).catch((reason) => toast.error(mutationMessage(reason)));
    }
    if (counts.done > 0) setWin(counts.done);
    else writeBlock(null);
  };

  if (win !== null) {
    return <ModalBackdrop className="lockin-backdrop" onClose={() => undefined} closeOnEscape={false} closeOnBackdrop={false}>
      <section className="lockin win" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="lockin-win" role="status">
          <span className="win-check" aria-hidden="true"><Check size={52} weight="bold" /></span>
          <h2 id={titleId} className="win-title">Deep work done.</h2>
          <p className="win-sub">{win === 1 ? `1 done for ${projectTitle}.` : `${win} done for ${projectTitle}.`}</p>
        </div>
      </section>
    </ModalBackdrop>;
  }

  return <ModalBackdrop className="lockin-backdrop" onClose={() => undefined} closeOnEscape={false} closeOnBackdrop={false}>
    <section className="lockin project-block" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="lockin-head">
        <span className="now-label"><i className="pulse-dot" aria-hidden="true" />Deep work · {projectTitle}</span>
        <h2 id={titleId} className="lockin-title">{task ? task.title : `${projectTitle} is clear`}</h2>
        {task?.firstStep && <p className="lockin-sub">Start with: {task.firstStep}</p>}
        {task ? <p className="lockin-note">{counts.done} done · {Math.max(0, counts.toGo - 1)} to go</p>
          : <p className="lockin-sub">Add what’s next below, or wrap up.</p>}
      </header>

      <div className="lockin-body">
        <BlockRing totalSeconds={totalSeconds} elapsedSeconds={elapsedSeconds} />
      </div>

      <div className="lockin-actions">
        {task ? <>
          <button className="btn primary" type="button" data-auto-focus disabled={busy} onClick={() => void done()}>{busy ? "Saving…" : "Done"}</button>
          {timeUp
            ? <button className="btn secondary" type="button" onClick={() => void wrapUp()}>Wrap up</button>
            : <button className="btn secondary" type="button" onClick={() => setStuckOpen(true)}>I’m stuck</button>}
        </> : <button className="btn primary" type="button" onClick={() => void wrapUp()}>Wrap up</button>}
        <HoldButton label="End block" onComplete={() => void wrapUp()} />
      </div>

      <TaskAddBar life={life} focusProjectId={block.projectId} placeholder={`Add to ${projectTitle}…`} />
      {stuckOpen && task && <StuckSheet task={task} life={life} onClose={() => setStuckOpen(false)} />}
    </section>
  </ModalBackdrop>;
}

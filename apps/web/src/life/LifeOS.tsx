import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarBlank,
  Check,
  CheckCircle,
  Clock,
  CloudArrowUp,
  DownloadSimple,
  File,
  FolderOpen,
  Heartbeat,
  Lightning,
  ListChecks,
  Pause,
  Play,
  Plus,
  Target,
  Trash,
  Timer,
  TrendDown,
  TrendUp,
  Wallet,
  Warning,
  X,
} from "@phosphor-icons/react";
import type { Page } from "../types";
import type { BlockerReason, CalendarEvent, HealthMetric, LifeArea, LifeTask, VaultFile } from "./types";
import type { LifeOSController } from "./useLifeOS";

const areaLabels: Record<LifeArea, string> = {
  health: "Health", work: "Work", relationships: "Relationships", environment: "Environment",
  money: "Money", growth: "Growth", direction: "Direction",
};

const blockerOptions: Array<{ reason: BlockerReason; label: string; detail: string }> = [
  { reason: "big", label: "It’s too big", detail: "Shrink it to a two-minute start" },
  { reason: "unclear", label: "It’s unclear", detail: "Define one visible first action" },
  { reason: "time", label: "I don’t have time", detail: "Make a useful five-minute version" },
  { reason: "place", label: "I’m in the wrong place", detail: "Adapt it to where you are" },
  { reason: "different", label: "Something else matters", detail: "Move to the next best action" },
  { reason: "irrelevant", label: "This no longer matters", detail: "Remove it from the path" },
];

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function eventTime(event: CalendarEvent) {
  if (event.allDay) return "All day";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(event.startAt));
}

function sameDay(value: string, day: Date) {
  const date = new Date(value);
  return date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate();
}

function relativeDue(value: string | null) {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  if (diff < 0) return "Overdue";
  if (diff < 86_400_000) return "Due today";
  return `Due ${shortDate(value)}`;
}

function AreaBadge({ area }: { area: LifeArea }) { return <span className={`life-area area-${area}`}>{areaLabels[area]}</span>; }

function ModuleEmpty({ icon: Icon, title, detail, action, onAction }: { icon: typeof Target; title: string; detail: string; action?: string; onAction?: () => void }) {
  return <div className="module-empty"><span><Icon size={24} /></span><div><strong>{title}</strong><p>{detail}</p></div>{action && onAction && <button type="button" onClick={onAction}>{action} <ArrowRight size={14} /></button>}</div>;
}

function SurfaceHeader({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: React.ReactNode }) {
  return <header className="page-heading life-heading"><div><p className="date-label">{eyebrow}</p><h1>{title}</h1><p>{detail}</p></div>{action}</header>;
}

function LifeModalBackdrop({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const backdrop = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => [...(backdrop.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ?? [])];
    const frame = window.requestAnimationFrame(() => (backdrop.current?.querySelector<HTMLElement>("[data-auto-focus]") ?? focusable()[0])?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); return; }
      if (event.key !== "Tab") return;
      const controls = focusable(); if (!controls.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { window.cancelAnimationFrame(frame); document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, []);
  return <div ref={backdrop} className="life-modal-backdrop" role="presentation">{children}</div>;
}

export function LifeOverview({ life, onNavigate }: { life: LifeOSController; onNavigate: (page: Page) => void }) {
  const { snapshot } = life;
  const active = snapshot.tasks.find((task) => task.status === "active");
  const todayEvents = snapshot.events.filter((event) => sameDay(event.startAt, new Date()) && event.status !== "cancelled").slice(0, 3);
  const activeGoals = snapshot.goals.filter((goal) => goal.status === "active");
  const lastDay = Date.now() - 36 * 60 * 60 * 1000;
  const recentHealth = snapshot.health.filter((metric) => new Date(metric.startAt).getTime() >= lastDay);
  const steps = recentHealth.filter((metric) => metric.type === "steps").reduce((sum, metric) => sum + metric.value, 0);
  const sleep = recentHealth.find((metric) => metric.type === "sleep")?.value;
  const netWorth = snapshot.accounts.reduce((sum, account) => sum + (account.type === "credit" || account.type === "loan" ? -Math.abs(account.balance) : account.balance), 0);
  const floorComplete = snapshot.floor.filter((item) => item.completionDates.some((value) => sameDay(value, new Date()))).length;
  return <section className="life-overview" aria-label="Life dashboard">
    <div className="life-overview-title"><div><span className="section-kicker"><Lightning size={14} weight="fill" /> Your operating system</span><h2>One view of what matters now.</h2></div><span className={`sync-indicator ${life.remote ? "online" : "local"}`}>{life.remote ? "Private sync on" : "Saved on this device"}</span></div>
    <div className="life-dashboard-grid">
      <article className="now-card dashboard-now">
        <div className="card-label"><span>Now</span><button type="button" onClick={() => onNavigate("tasks")}>Open Tasks <ArrowRight size={14} /></button></div>
        {active ? <><AreaBadge area={active.area} /><h3>{active.title}</h3><p>{active.firstStep || "Define the first physical step before you start."}</p><div className="now-meta"><span><Clock size={15} /> {active.durationMinutes} min</span>{relativeDue(active.dueAt) && <span className="due-chip">{relativeDue(active.dueAt)}</span>}</div></> : <ModuleEmpty icon={ListChecks} title="Nothing is selected" detail="Add a move and Remember will make it your single next action." action="Choose a move" onAction={() => onNavigate("tasks")} />}
        {snapshot.floor.length > 0 && <button className="floor-today" type="button" onClick={() => onNavigate("tasks")}><CheckCircle size={16} weight={floorComplete === snapshot.floor.length ? "fill" : "regular"} /><span>Life Floor</span><strong>{floorComplete}/{snapshot.floor.length} today</strong></button>}
      </article>
      <article className="dashboard-module"><div className="card-label"><span>Calendar</span><button type="button" onClick={() => onNavigate("calendar")}>View day</button></div>{todayEvents.length ? <div className="mini-agenda">{todayEvents.map((event) => <div key={event.id}><time>{eventTime(event)}</time><span><strong>{event.title}</strong><small>{event.calendarName}</small></span></div>)}</div> : <ModuleEmpty icon={CalendarBlank} title="Your day is open" detail="Synced events and scheduled moves will meet here." />}</article>
      <article className="dashboard-module"><div className="card-label"><span>Goals</span><button type="button" onClick={() => onNavigate("goals")}>See direction</button></div>{activeGoals.length ? <div className="goal-mini">{activeGoals.slice(0, 2).map((goal) => <div key={goal.id}><span><AreaBadge area={goal.area} /><strong>{goal.title}</strong></span><div><i style={{ width: `${goal.progress}%` }} /></div><small>{goal.progress}%</small></div>)}</div> : <ModuleEmpty icon={Target} title="No active direction" detail="Choose one result worth organizing the next month around." />}</article>
      <article className="dashboard-module health-module"><div className="card-label"><span>Health</span><button type="button" onClick={() => onNavigate("health")}>Open health</button></div><div className="health-pulse"><span><Heartbeat size={22} weight="duotone" /></span><div><strong>{Math.round(steps).toLocaleString()}</strong><small>steps today</small></div><div><strong>{sleep ? `${sleep.toFixed(1)}h` : "—"}</strong><small>sleep</small></div></div></article>
      <article className="dashboard-module"><div className="card-label"><span>Money</span><button type="button" onClick={() => onNavigate("money")}>Open money</button></div><div className="money-glance"><strong>{snapshot.accounts.length ? money(netWorth) : "Not connected"}</strong><span>{snapshot.accounts.length ? `Across ${snapshot.accounts.length} accounts` : "Add accounts manually or connect a provider later."}</span></div></article>
      <article className="dashboard-module"><div className="card-label"><span>Files</span><button type="button" onClick={() => onNavigate("files")}>Open vault</button></div><div className="vault-glance"><FolderOpen size={28} weight="duotone" /><strong>{snapshot.files.length} private files</strong><span>{snapshot.files[0] ? `Newest: ${snapshot.files[0].name}` : "Documents, exports, plans, and anything you want close."}</span></div></article>
    </div>
  </section>;
}

function ActiveMove({ life, task }: { life: LifeOSController; task: LifeTask }) {
  const [seconds, setSeconds] = useState(0); const [running, setRunning] = useState(false); const [blocking, setBlocking] = useState(false);
  useEffect(() => { if (!running) return; const timer = window.setInterval(() => setSeconds((value) => value + 1), 1_000); return () => window.clearInterval(timer); }, [running]);
  const elapsed = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return <article className="active-move">
    <div className="active-move-top"><div><span className="section-kicker"><Lightning size={14} weight="fill" /> Your one move</span><AreaBadge area={task.area} /></div><span className="move-duration"><Clock size={15} /> {task.durationMinutes} minutes</span></div>
    <h2>{task.title}</h2><div className="first-action"><span>First physical action</span><p>{task.firstStep || "Write the first visible action, then do only that."}</p></div>
    {running && <div className="focus-timer" role="timer"><Timer size={24} /><strong>{elapsed}</strong><span>Stay with this move</span></div>}
    <div className="active-actions"><button className="button primary" type="button" onClick={() => setRunning((value) => !value)}>{running ? <><Pause size={17} weight="fill" /> Pause</> : <><Play size={17} weight="fill" /> Start now</>}</button><button className="button secondary" type="button" onClick={() => void life.completeTask(task.id, Math.max(1, Math.round(seconds / 60)))}><Check size={17} weight="bold" /> Complete</button><button className="blocker-trigger" type="button" onClick={() => setBlocking(true)}>I can’t do this</button></div>
    {blocking && <div className="blocker-overlay" role="dialog" aria-modal="true" aria-labelledby="blocker-heading"><button className="blocker-close" type="button" aria-label="Close blocker menu" onClick={() => setBlocking(false)}><X size={19} /></button><div><p className="date-label">No guilt. Change the move.</p><h3 id="blocker-heading">What’s blocking this?</h3></div><div className="blocker-grid">{blockerOptions.map((option) => <button key={option.reason} type="button" onClick={() => { void life.blockTask(task.id, option.reason); setBlocking(false); }}><strong>{option.label}</strong><span>{option.detail}</span><ArrowRight size={16} /></button>)}</div></div>}
  </article>;
}

export function TasksPage({ life }: { life: LifeOSController }) {
  const [showAdd, setShowAdd] = useState(false); const [showFloorAdd, setShowFloorAdd] = useState(false); const { snapshot } = life;
  const active = snapshot.tasks.find((task) => task.status === "active");
  const queued = snapshot.tasks.filter((task) => task.status === "queued" || task.status === "inbox");
  const waiting = snapshot.tasks.filter((task) => task.status === "waiting");
  const done = snapshot.tasks.filter((task) => task.status === "done").slice(0, 8);
  return <div className="page life-page tasks-page page-enter"><SurfaceHeader eyebrow="RESET execution engine" title="Do the next right thing." detail="One active move. Everything else waits its turn." action={<button className="button primary desktop-action" type="button" onClick={() => setShowAdd(true)}><Plus size={17} /> Add move</button>} />
    {active ? <ActiveMove life={life} task={active} /> : <div className="empty-active"><ModuleEmpty icon={Lightning} title="Choose what happens next" detail="The first queued move becomes active. Keep it physical and small enough to begin." action="Add your first move" onAction={() => setShowAdd(true)} /></div>}
    <section className="task-section"><div className="section-title-row"><div><span>Up next</span><h2>The path</h2></div><small>{queued.length} waiting</small></div>{queued.length ? <div className="task-path">{queued.map((task, index) => <article key={task.id}><span className="task-number">{String(index + 1).padStart(2, "0")}</span><div><span className="task-row-meta"><AreaBadge area={task.area} />{task.priority !== "normal" && <em>{task.priority}</em>}</span><strong>{task.title}</strong><p>{task.firstStep || "First step not defined"}</p></div><span className="task-time">{task.durationMinutes}m</span><button type="button" onClick={() => void life.updateTask(task.id, { status: "active" })}>Make now</button></article>)}</div> : <ModuleEmpty icon={ListChecks} title="The queue is clear" detail="When the active move is complete, add only what deserves to come next." />}</section>
    <LifeFloor life={life} onAdd={() => setShowFloorAdd(true)} />
    {(waiting.length > 0 || done.length > 0) && <section className="task-history-grid">{waiting.length > 0 && <div><h3>Waiting</h3>{waiting.map((task) => <button key={task.id} type="button" onClick={() => void life.updateTask(task.id, { status: "queued" })}><span>{task.title}</span><small>Return to queue</small></button>)}</div>}{done.length > 0 && <div><h3>Recently completed</h3>{done.map((task) => <div key={task.id}><CheckCircle size={17} weight="fill" /><span>{task.title}</span><small>{task.completedAt ? shortDate(task.completedAt) : "Done"}</small></div>)}</div>}</section>}
    {showAdd && <TaskComposer life={life} onClose={() => setShowAdd(false)} />}
    {showFloorAdd && <FloorComposer life={life} onClose={() => setShowFloorAdd(false)} />}
  </div>;
}

function todayKey() { const date = new Date(); date.setHours(12, 0, 0, 0); return date.toISOString(); }

function LifeFloor({ life, onAdd }: { life: LifeOSController; onAdd: () => void }) {
  const date = todayKey();
  return <section className="life-floor"><div className="section-title-row"><div><span>Life Floor</span><h2>Minimums that keep you okay.</h2></div><button type="button" onClick={onAdd}><Plus size={15} /> Add baseline</button></div><p className="floor-intro">These are not streaks or stretch goals. They are the smallest daily actions that stop a hard week from becoming a lost month.</p>
    {life.snapshot.floor.length ? <div className="floor-grid">{life.snapshot.floor.map((item) => { const done = item.completionDates.some((value) => sameDay(value, new Date())); return <button key={item.id} className={done ? "complete" : ""} type="button" aria-pressed={done} onClick={() => void life.toggleFloorItem(item.id, date)}><span className="floor-check">{done ? <Check size={17} weight="bold" /> : null}</span><span><strong>{item.title}</strong><small>{item.target} {item.unit} · {areaLabels[item.area]}</small></span></button>; })}</div> : <ModuleEmpty icon={CheckCircle} title="Set your Life Floor" detail="Pick two or three basics you can still do on a bad day: water, medication, movement, sunlight, or one reset." action="Add a baseline" onAction={onAdd} />}
  </section>;
}

function FloorComposer({ life, onClose }: { life: LifeOSController; onClose: () => void }) {
  const [title, setTitle] = useState(""); const [area, setArea] = useState<LifeArea>("health"); const [target, setTarget] = useState(1); const [unit, setUnit] = useState("time");
  const submit = async (event: FormEvent) => { event.preventDefault(); await life.createFloorItem({ title, area, target, unit }); onClose(); };
  return <LifeModalBackdrop onClose={onClose}><form className="life-modal compact" role="dialog" aria-modal="true" aria-labelledby="floor-title" onSubmit={(event) => void submit(event)}><button className="blocker-close" type="button" aria-label="Close" onClick={onClose}><X size={19} /></button><p className="date-label">Life Floor</p><h2 id="floor-title">Define enough.</h2><label><span>Daily baseline</span><input data-auto-focus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Take medication" required /></label><div className="form-grid"><label><span>Area</span><select value={area} onChange={(event) => setArea(event.target.value as LifeArea)}>{Object.entries(areaLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Target</span><input type="number" min="1" max="100" step="1" value={target} onChange={(event) => setTarget(Number(event.target.value))} required /></label></div><label><span>Unit</span><input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="time, minutes, glasses…" required /></label><button className="button primary" type="submit" disabled={!title.trim() || !unit.trim()}>Add to my floor</button></form></LifeModalBackdrop>;
}

function TaskComposer({ life, onClose }: { life: LifeOSController; onClose: () => void }) {
  const [title, setTitle] = useState(""); const [firstStep, setFirstStep] = useState(""); const [area, setArea] = useState<LifeArea>("direction"); const [duration, setDuration] = useState(15); const [priority, setPriority] = useState<LifeTask["priority"]>("normal");
  const submit = async (event: FormEvent) => { event.preventDefault(); await life.createTask({ title, firstStep, area, durationMinutes: duration, priority, status: "queued" }); onClose(); };
  return <LifeModalBackdrop onClose={onClose}><form className="life-modal" role="dialog" aria-modal="true" aria-labelledby="new-task-title" onSubmit={(event) => void submit(event)}><button className="blocker-close" type="button" aria-label="Close" onClick={onClose}><X size={19} /></button><p className="date-label">New move</p><h2 id="new-task-title">Make it startable.</h2><label><span>Outcome</span><input data-auto-focus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What will be different when this is done?" required /></label><label><span>First physical action</span><textarea value={firstStep} onChange={(event) => setFirstStep(event.target.value)} placeholder="Open…, write…, call…, put…" required /></label><div className="form-grid"><label><span>Area</span><select value={area} onChange={(event) => setArea(event.target.value as LifeArea)}>{Object.entries(areaLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Time box</span><select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>{[5, 10, 15, 25, 45, 60, 90].map((value) => <option key={value} value={value}>{value} minutes</option>)}</select></label><label><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value as LifeTask["priority"])}><option value="normal">Normal</option><option value="high">High</option><option value="must">Must</option><option value="low">Low</option></select></label></div><button className="button primary" type="submit" disabled={!title.trim() || !firstStep.trim()}>Add to the path <ArrowRight size={16} /></button></form></LifeModalBackdrop>;
}

export function GoalsPage({ life }: { life: LifeOSController }) {
  const [adding, setAdding] = useState(false); const [title, setTitle] = useState(""); const [area, setArea] = useState<LifeArea>("direction"); const [why, setWhy] = useState("");
  const goals = life.snapshot.goals.filter((goal) => goal.status !== "archived");
  const submit = async (event: FormEvent) => { event.preventDefault(); await life.createGoal({ title, area, why }); setTitle(""); setWhy(""); setAdding(false); };
  return <div className="page life-page goals-page page-enter"><SurfaceHeader eyebrow="Direction" title="Goals with a job to do." detail="Goals create a path. Tasks create evidence." action={<button className="button primary desktop-action" type="button" onClick={() => setAdding(true)}><Plus size={17} /> New goal</button>} />
    {goals.length ? <div className="goal-grid">{goals.map((goal) => <article key={goal.id} className={goal.status !== "active" ? "paused" : ""}><div><AreaBadge area={goal.area} /><button type="button" onClick={() => void life.updateGoal(goal.id, { status: goal.status === "active" ? "paused" : "active" })}>{goal.status === "active" ? "Pause" : "Resume"}</button></div><h2>{goal.title}</h2>{goal.why && <p>{goal.why}</p>}<div className="goal-progress"><span><i style={{ width: `${goal.progress}%` }} /></span><strong>{goal.progress}%</strong></div><input aria-label={`Progress for ${goal.title}`} type="range" min="0" max="100" step="5" value={goal.progress} onChange={(event) => void life.updateGoal(goal.id, { progress: Number(event.target.value), ...(Number(event.target.value) === 100 ? { status: "completed" } : {}) })} /><button className="goal-add-move" type="button" onClick={() => void life.createTask({ title: `Move ${goal.title} forward`, firstStep: "Choose the smallest visible action that produces evidence today.", goalId: goal.id, area: goal.area, source: "goal", status: "queued" })}><Plus size={15} /> Add a move from this goal</button></article>)}</div> : <ModuleEmpty icon={Target} title="Choose one direction" detail="A useful goal describes an observable result, not a permanent identity project." action="Create a goal" onAction={() => setAdding(true)} />}
    {adding && <LifeModalBackdrop onClose={() => setAdding(false)}><form className="life-modal" role="dialog" aria-modal="true" aria-labelledby="new-goal-title" onSubmit={(event) => void submit(event)}><button className="blocker-close" type="button" aria-label="Close" onClick={() => setAdding(false)}><X size={19} /></button><p className="date-label">New direction</p><h2 id="new-goal-title">What result matters?</h2><label><span>Goal</span><input data-auto-focus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Publish the first version" required /></label><label><span>Why this matters now</span><textarea value={why} onChange={(event) => setWhy(event.target.value)} placeholder="This matters because…" /></label><label><span>Life area</span><select value={area} onChange={(event) => setArea(event.target.value as LifeArea)}>{Object.entries(areaLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="button primary" type="submit" disabled={!title.trim()}>Create goal</button></form></LifeModalBackdrop>}
  </div>;
}

export function CalendarPage({ life }: { life: LifeOSController }) {
  const [selected, setSelected] = useState(() => new Date()); const [adding, setAdding] = useState(false);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => { const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() + index); return day; }), []);
  const events = life.snapshot.events.filter((event) => sameDay(event.startAt, selected) && event.status !== "cancelled").sort((a, b) => a.startAt.localeCompare(b.startAt));
  const scheduledTasks = life.snapshot.tasks.filter((task) => task.scheduledStart && sameDay(task.scheduledStart, selected));
  return <div className="page life-page calendar-page page-enter"><SurfaceHeader eyebrow="Time" title="Calendar meets intention." detail="Your commitments and your next moves finally share the same day." action={<button className="button primary desktop-action" type="button" onClick={() => setAdding(true)}><Plus size={17} /> Add event</button>} />
    <div className="week-strip">{days.map((day) => <button key={day.toISOString()} className={sameDay(day.toISOString(), selected) ? "selected" : ""} type="button" onClick={() => setSelected(day)}><span>{new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(day)}</span><strong>{day.getDate()}</strong>{life.snapshot.events.some((event) => sameDay(event.startAt, day)) && <i />}</button>)}</div>
    <section className="day-agenda"><div className="agenda-date"><span>{new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(selected)}</span><h2>{new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(selected)}</h2><small>{events.length + scheduledTasks.length} commitments</small></div><div className="agenda-list">{events.map((event) => <article key={event.id}><time>{eventTime(event)}</time><span className={`calendar-dot source-${event.source}`} /><div><strong>{event.title}</strong><p>{[event.location, event.calendarName].filter(Boolean).join(" · ")}</p></div></article>)}{scheduledTasks.map((task) => <article key={task.id}><time>{eventTime({ startAt: task.scheduledStart!, allDay: false } as CalendarEvent)}</time><span className="calendar-dot source-task" /><div><strong>{task.title}</strong><p>Scheduled move · {task.durationMinutes} minutes</p></div></article>)}{!events.length && !scheduledTasks.length && <ModuleEmpty icon={CalendarBlank} title="Nothing scheduled" detail="Open time is useful. Protect it deliberately or leave it open on purpose." action="Add an event" onAction={() => setAdding(true)} />}</div></section>
    <div className="calendar-sync-note"><CloudArrowUp size={19} /><div><strong>Calendar sync is source-aware</strong><p>Apple Calendar imports from the iPhone app. Google and Outlook events use the same private event model without turning tasks into duplicate calendar clutter.</p></div></div>
    {adding && <EventComposer life={life} selected={selected} onClose={() => setAdding(false)} />}
  </div>;
}

function localInputValue(date: Date) { const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
function EventComposer({ life, selected, onClose }: { life: LifeOSController; selected: Date; onClose: () => void }) {
  const startSeed = new Date(selected); startSeed.setHours(Math.max(new Date().getHours() + 1, 9), 0, 0, 0); const endSeed = new Date(startSeed.getTime() + 60 * 60_000);
  const [title, setTitle] = useState(""); const [start, setStart] = useState(localInputValue(startSeed)); const [end, setEnd] = useState(localInputValue(endSeed)); const [location, setLocation] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); await life.addCalendarEvent({ externalId: crypto.randomUUID(), source: "manual", calendarName: "Personal", title, notes: "", location, url: null, startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), allDay: false, status: "confirmed" }); onClose(); };
  return <LifeModalBackdrop onClose={onClose}><form className="life-modal" role="dialog" aria-modal="true" aria-labelledby="new-event-title" onSubmit={(event) => void submit(event)}><button className="blocker-close" type="button" aria-label="Close" onClick={onClose}><X size={19} /></button><p className="date-label">New event</p><h2 id="new-event-title">Protect the time.</h2><label><span>Title</span><input data-auto-focus value={title} onChange={(event) => setTitle(event.target.value)} required /></label><div className="form-grid"><label><span>Starts</span><input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} required /></label><label><span>Ends</span><input type="datetime-local" value={end} min={start} onChange={(event) => setEnd(event.target.value)} required /></label></div><label><span>Location</span><input value={location} onChange={(event) => setLocation(event.target.value)} /></label><button className="button primary" type="submit" disabled={!title.trim() || !start || !end}>Add to calendar</button></form></LifeModalBackdrop>;
}

function latestMetric(metrics: HealthMetric[], type: HealthMetric["type"]) { return metrics.filter((metric) => metric.type === type).sort((a, b) => b.startAt.localeCompare(a.startAt))[0]; }

export function HealthPage({ life }: { life: LifeOSController }) {
  const [logging, setLogging] = useState<"weight" | "water" | null>(null); const [value, setValue] = useState("");
  const metrics = life.snapshot.health; const today = metrics.filter((metric) => sameDay(metric.startAt, new Date()));
  const steps = today.filter((metric) => metric.type === "steps").reduce((sum, metric) => sum + metric.value, 0);
  const energy = today.filter((metric) => metric.type === "active_energy").reduce((sum, metric) => sum + metric.value, 0);
  const exercise = today.filter((metric) => metric.type === "exercise_minutes").reduce((sum, metric) => sum + metric.value, 0);
  const sleep = latestMetric(metrics, "sleep"); const weight = latestMetric(metrics, "weight"); const resting = latestMetric(metrics, "resting_heart_rate"); const hrv = latestMetric(metrics, "heart_rate_variability");
  const log = async (event: FormEvent) => { event.preventDefault(); if (!logging || !Number.isFinite(Number(value))) return; const timestamp = nowIso(); await life.syncHealth([{ externalId: crypto.randomUUID(), type: logging, value: Number(value), unit: logging === "weight" ? "lb" : "mL", startAt: timestamp, endAt: timestamp, source: "manual", metadata: {} }]); setLogging(null); setValue(""); };
  return <div className="page life-page health-page page-enter"><SurfaceHeader eyebrow="Body" title="Health, without the noise." detail="Apple Health data becomes useful context—not another score to obsess over." action={<button className="button secondary desktop-action" type="button" onClick={() => setLogging("weight")}><Plus size={17} /> Log metric</button>} />
    <section className="health-hero"><div><span className="health-ring"><Heartbeat size={38} weight="duotone" /></span><p>Today’s movement</p><strong>{Math.round(steps).toLocaleString()}</strong><small>steps</small></div><div className="health-today-stats"><article><span>Active energy</span><strong>{Math.round(energy)}</strong><small>kcal</small></article><article><span>Exercise</span><strong>{Math.round(exercise)}</strong><small>minutes</small></article><article><span>Sleep</span><strong>{sleep ? sleep.value.toFixed(1) : "—"}</strong><small>hours</small></article></div></section>
    <div className="health-metric-grid"><article><span>Weight</span><strong>{weight ? weight.value.toFixed(1) : "—"}</strong><small>{weight?.unit ?? "No data"}</small><button type="button" onClick={() => setLogging("weight")}>Log</button></article><article><span>Resting heart rate</span><strong>{resting ? Math.round(resting.value) : "—"}</strong><small>{resting?.unit ?? "Apple Health"}</small></article><article><span>HRV</span><strong>{hrv ? Math.round(hrv.value) : "—"}</strong><small>{hrv?.unit ?? "Apple Health"}</small></article><article><span>Water</span><strong>{Math.round(today.filter((metric) => metric.type === "water").reduce((sum, metric) => sum + metric.value, 0))}</strong><small>mL today</small><button type="button" onClick={() => setLogging("water")}>Log</button></article></div>
    <section className="health-sync-card"><div><span><CloudArrowUp size={24} /></span><div><strong>Apple Health sync</strong><p>The iPhone app reads only the categories you approve and sends normalized measurements to your private Remember database. Revoking Health access stops collection immediately.</p></div></div><span className={metrics.some((metric) => metric.source !== "manual") ? "connected" : "not-connected"}>{metrics.some((metric) => metric.source !== "manual") ? "Connected" : "Connect on iPhone"}</span></section>
    {metrics.length > 0 && <section className="health-history"><div className="section-title-row"><div><span>Recent</span><h2>Measurements</h2></div></div>{metrics.slice(0, 12).map((metric) => <div key={metric.id}><span className="metric-icon"><Heartbeat size={16} /></span><strong>{metric.type.replaceAll("_", " ")}</strong><span>{metric.value.toLocaleString()} {metric.unit}</span><time>{shortDate(metric.startAt)}</time></div>)}</section>}
    {logging && <LifeModalBackdrop onClose={() => setLogging(null)}><form className="life-modal compact" role="dialog" aria-modal="true" aria-labelledby="health-log-title" onSubmit={(event) => void log(event)}><button className="blocker-close" type="button" aria-label="Close" onClick={() => setLogging(null)}><X size={19} /></button><p className="date-label">Manual health entry</p><h2 id="health-log-title">Log {logging}.</h2><label><span>{logging === "weight" ? "Pounds" : "Milliliters"}</span><input data-auto-focus type="number" step="any" min="0" value={value} onChange={(event) => setValue(event.target.value)} required /></label><button className="button primary" type="submit">Save measurement</button></form></LifeModalBackdrop>}
  </div>;
}

function nowIso() { return new Date().toISOString(); }

export function MoneyPage({ life }: { life: LifeOSController }) {
  const [addingAccount, setAddingAccount] = useState(false); const [addingTransaction, setAddingTransaction] = useState(false);
  const { accounts, transactions } = life.snapshot; const netWorth = accounts.reduce((sum, account) => sum + (account.type === "credit" || account.type === "loan" ? -Math.abs(account.balance) : account.balance), 0);
  const thisMonth = new Date(); const monthTransactions = transactions.filter((transaction) => { const date = new Date(transaction.occurredAt); return date.getMonth() === thisMonth.getMonth() && date.getFullYear() === thisMonth.getFullYear(); });
  const spent = Math.abs(monthTransactions.filter((transaction) => transaction.amount < 0).reduce((sum, transaction) => sum + transaction.amount, 0)); const income = monthTransactions.filter((transaction) => transaction.amount > 0).reduce((sum, transaction) => sum + transaction.amount, 0);
  return <div className="page life-page money-page page-enter"><SurfaceHeader eyebrow="Money" title="Know where you stand." detail="A calm private ledger for balances, spending, and the decisions ahead." action={<button className="button primary desktop-action" type="button" onClick={() => setAddingTransaction(true)}><Plus size={17} /> Add transaction</button>} />
    <section className="money-hero"><div><span>Net worth</span><strong>{money(netWorth)}</strong><small>{accounts.length ? `${accounts.length} accounts included` : "Add your first account"}</small></div><article><TrendDown size={20} /><span>Spent this month</span><strong>{money(spent)}</strong></article><article><TrendUp size={20} /><span>Income this month</span><strong>{money(income)}</strong></article></section>
    <div className="money-columns"><section><div className="section-title-row"><div><span>Accounts</span><h2>Your money</h2></div><button type="button" onClick={() => setAddingAccount(true)}><Plus size={15} /> Add</button></div>{accounts.length ? <div className="account-list">{accounts.map((account) => <article key={account.id}><span className="account-icon"><Wallet size={20} /></span><div><strong>{account.name}</strong><small>{account.institution || account.type}</small></div><span>{money(account.balance, account.currency)}</span></article>)}</div> : <ModuleEmpty icon={Wallet} title="No accounts yet" detail="Start manually. Provider sync can replace manual balances without changing this view." action="Add account" onAction={() => setAddingAccount(true)} />}</section><section><div className="section-title-row"><div><span>Activity</span><h2>Recent</h2></div></div>{transactions.length ? <div className="transaction-list">{transactions.slice(0, 12).map((transaction) => <article key={transaction.id}><div><strong>{transaction.merchant || transaction.name}</strong><small>{transaction.category} · {shortDate(transaction.occurredAt)}</small></div><span className={transaction.amount < 0 ? "negative" : "positive"}>{money(transaction.amount, transaction.currency)}</span></article>)}</div> : <ModuleEmpty icon={TrendDown} title="No activity" detail="Transactions you import or add will be categorized here." />}</section></div>
    {addingAccount && <AccountComposer life={life} onClose={() => setAddingAccount(false)} />}{addingTransaction && <TransactionComposer life={life} onClose={() => setAddingTransaction(false)} />}
  </div>;
}

function AccountComposer({ life, onClose }: { life: LifeOSController; onClose: () => void }) {
  const [name, setName] = useState(""); const [institution, setInstitution] = useState(""); const [type, setType] = useState<"checking" | "savings" | "credit" | "investment" | "cash" | "loan" | "other">("checking"); const [balance, setBalance] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); await life.addFinanceAccount({ name, institution, type, balance: Number(balance), currency: "USD", source: "manual" }); onClose(); };
  return <LifeModalBackdrop onClose={onClose}><form className="life-modal compact" role="dialog" aria-modal="true" aria-labelledby="finance-account-title" onSubmit={(event) => void submit(event)}><button className="blocker-close" type="button" aria-label="Close" onClick={onClose}><X size={19} /></button><p className="date-label">New account</p><h2 id="finance-account-title">Add a balance.</h2><label><span>Name</span><input data-auto-focus value={name} onChange={(event) => setName(event.target.value)} placeholder="Everyday checking" required /></label><label><span>Institution</span><input value={institution} onChange={(event) => setInstitution(event.target.value)} /></label><div className="form-grid"><label><span>Type</span><select value={type} onChange={(event) => setType(event.target.value as typeof type)}>{["checking", "savings", "credit", "investment", "cash", "loan", "other"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label><span>Balance</span><input type="number" step="0.01" value={balance} onChange={(event) => setBalance(event.target.value)} required /></label></div><button className="button primary" type="submit">Add account</button></form></LifeModalBackdrop>;
}

function TransactionComposer({ life, onClose }: { life: LifeOSController; onClose: () => void }) {
  const [name, setName] = useState(""); const [amount, setAmount] = useState(""); const [category, setCategory] = useState("Uncategorized"); const [accountId, setAccountId] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); await life.addFinanceTransaction({ accountId: accountId || null, name, merchant: name, amount: Number(amount), currency: "USD", category, occurredAt: nowIso(), status: "posted", notes: "" }); onClose(); };
  return <LifeModalBackdrop onClose={onClose}><form className="life-modal compact" role="dialog" aria-modal="true" aria-labelledby="finance-transaction-title" onSubmit={(event) => void submit(event)}><button className="blocker-close" type="button" aria-label="Close" onClick={onClose}><X size={19} /></button><p className="date-label">New transaction</p><h2 id="finance-transaction-title">Record the movement.</h2><label><span>Name or merchant</span><input data-auto-focus value={name} onChange={(event) => setName(event.target.value)} required /></label><div className="form-grid"><label><span>Amount</span><input type="number" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Use - for spending" required /></label><label><span>Category</span><input value={category} onChange={(event) => setCategory(event.target.value)} /></label></div>{life.snapshot.accounts.length > 0 && <label><span>Account</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">No account</option>{life.snapshot.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>}<button className="button primary" type="submit">Save transaction</button></form></LifeModalBackdrop>;
}

export function FilesPage({ life }: { life: LifeOSController }) {
  const input = useRef<HTMLInputElement>(null); const [query, setQuery] = useState(""); const [uploading, setUploading] = useState(false); const [error, setError] = useState("");
  const files = life.snapshot.files.filter((file) => `${file.name} ${file.folder} ${file.tags.join(" ")} ${file.summary}`.toLowerCase().includes(query.toLowerCase()));
  const upload = async (file?: File) => { if (!file) return; setUploading(true); setError(""); try { await life.uploadFile(file, {}); } catch (reason) { setError(reason instanceof Error ? reason.message : "Upload failed."); } finally { setUploading(false); if (input.current) input.current.value = ""; } };
  const download = async (file: VaultFile) => { setError(""); try { const blob = await life.downloadFile(file.id); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.name; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0); } catch (reason) { setError(reason instanceof Error ? reason.message : "Download failed."); } };
  return <div className="page life-page files-page page-enter"><SurfaceHeader eyebrow="Private vault" title="Your files, in context." detail="Keep the documents that belong beside your plans, memories, and decisions." action={<><input ref={input} type="file" hidden aria-label="Upload file" onChange={(event) => void upload(event.target.files?.[0])} /><button className="button primary desktop-action" type="button" disabled={uploading} onClick={() => input.current?.click()}><CloudArrowUp size={17} /> {uploading ? "Uploading…" : "Upload file"}</button></>} />
    <div className="vault-toolbar"><label><FolderOpen size={18} /><input aria-label="Search files" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search files, folders, or tags" /></label><span>{files.length} files · 25 MB each</span></div>{error && <p className="life-error" role="alert"><Warning size={16} /> {error}</p>}
    {files.length ? <div className="file-grid">{files.map((file) => <article key={file.id}><span className="file-icon"><File size={27} weight="duotone" /></span><div><strong>{file.name}</strong><small>{file.folder || "Vault"} · {(file.sizeBytes / 1_024).toFixed(file.sizeBytes > 1_024 * 1_024 ? 0 : 1)} KB</small>{file.summary && <p>{file.summary}</p>}</div><span className="file-actions"><button type="button" aria-label={`Download ${file.name}`} onClick={() => void download(file)}><DownloadSimple size={18} /></button><button type="button" aria-label={`Delete ${file.name}`} onClick={() => { if (window.confirm(`Delete ${file.name}? This cannot be undone.`)) void life.deleteFile(file.id); }}><Trash size={17} /></button></span></article>)}</div> : <ModuleEmpty icon={FolderOpen} title={query ? "No matching files" : "The vault is empty"} detail={query ? "Try another name, folder, or tag." : "Upload a plan, receipt, export, document, or anything you need to keep private."} action={!query ? "Upload your first file" : undefined} onAction={() => input.current?.click()} />}
  </div>;
}

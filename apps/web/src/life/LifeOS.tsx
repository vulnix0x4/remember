import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import {
  CalendarBlank,
  CaretDown,
  Check,
  CloudArrowUp,
  DownloadSimple,
  File,
  FolderOpen,
  FolderSimple,
  Heartbeat,
  ListChecks,
  MagnifyingGlass,
  Target,
  Trash,
  TrendDown,
  Wallet,
  Warning,
} from "@phosphor-icons/react";
import {
  Button as AriaButton,
  ComboBox,
  Input as AriaInput,
  Label as AriaLabel,
  ListBox,
  ListBoxItem,
  Popover as AriaPopover,
} from "react-aria-components/ComboBox";
import type { CalendarEvent, FinanceAccount, FinanceTransaction, Goal, HealthMetric, LifeTask, VaultFile } from "./types";
import type { LifeOSController } from "./useLifeOS";
import { AddBar, AddBarButton } from "../ui/AddBar";
import { Empty } from "../ui/Empty";
import { Sheet } from "../ui/Sheet";
import { haptic, useToast } from "../ui/Toast";
import { doneToday, durationLabel, isOpen, laterTasks, pickNow, planByTask, timeLabel, todayTasks } from "./planning";
import { isSavedNight } from "./sleep";
import { ChipGroup, DailyBasics, NowCard, TaskAddBar, TaskList, TaskSheet, mutationMessage, useNow } from "./TaskViews";
import { activeProjects } from "../services/projects";
import { BLOCK_LENGTHS, BLOCK_MINUTES, writeBlock } from "./projectBlock";

export { focusTimerElapsedMs, focusTimerStorageKey } from "./TaskViews";

interface ChoiceOption<T extends string | number> {
  value: T;
  label: string;
  detail?: string;
}

interface SearchChoiceOption {
  id: string;
  label: string;
  detail?: string;
}

const fallbackCurrencies = ["USD", "CAD", "EUR", "GBP", "AUD", "JPY", "CNY", "INR", "MXN"];
const supportedValues = Intl as typeof Intl & { supportedValuesOf?: (key: "currency") => string[] };
const currencyCodes = (() => {
  try { return supportedValues.supportedValuesOf?.("currency") ?? fallbackCurrencies; }
  catch { return fallbackCurrencies; }
})();
const currencyNames = (() => {
  try { return new Intl.DisplayNames([navigator.language || "en-US"], { type: "currency" }); }
  catch { return null; }
})();
const currencyOptions: SearchChoiceOption[] = currencyCodes.map((code) => ({
  id: code,
  label: code,
  detail: currencyNames?.of(code) ?? "Currency",
}));

const accountTypeOptions = ["checking", "savings", "credit", "investment", "cash", "loan", "other"].map((value) => ({
  value: value as FinanceAccount["type"],
  label: value[0].toUpperCase() + value.slice(1),
}));
const categoryOptions = ["Uncategorized", "Food", "Transport", "Shopping", "Housing", "Health", "Entertainment"];

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function totalsByCurrency<T>(items: T[], amount: (item: T) => number, currency: (item: T) => string) {
  const totals = new Map<string, number>();
  items.forEach((item) => {
    const code = currency(item).toUpperCase() || "USD";
    totals.set(code, (totals.get(code) ?? 0) + amount(item));
  });
  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, total]) => money(total, code))
    .join(" · ");
}

function accountTotals(accounts: FinanceAccount[]) {
  return totalsByCurrency(
    accounts,
    (account) => account.type === "credit" || account.type === "loan" ? -Math.abs(account.balance) : account.balance,
    (account) => account.currency,
  );
}

function transactionTotals(transactions: FinanceTransaction[], direction: "expense" | "income") {
  const matching = transactions.filter((transaction) => direction === "expense" ? transaction.amount < 0 : transaction.amount > 0);
  return totalsByCurrency(matching, (transaction) => direction === "expense" ? Math.abs(transaction.amount) : transaction.amount, (transaction) => transaction.currency);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function fileSize(value: number) {
  if (value >= 1_048_576) return `${(value / 1_048_576).toFixed(value >= 10_485_760 ? 0 : 1)} MB`;
  return `${Math.max(1, value / 1_024).toFixed(value >= 102_400 ? 0 : 1)} KB`;
}

function eventTime(event: CalendarEvent) {
  if (event.allDay) return "All day";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(event.startAt));
}

function sameDay(value: string, day: Date) {
  const date = new Date(value);
  return date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate();
}

function useMutationState() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const run = async (work: () => Promise<unknown>, onSuccess: () => void) => {
    setSubmitting(true);
    setError("");
    try {
      await work();
      onSuccess();
    } catch (reason) {
      setError(mutationMessage(reason));
    } finally {
      setSubmitting(false);
    }
  };
  return { submitting, error, run };
}

function MutationError({ message }: { message: string }) {
  return message ? <p className="life-error" role="alert"><Warning size={16} /> {message}</p> : null;
}

function ChoiceGroup<T extends string | number>({ label, value, options, onChange, compact = false }: {
  label: string;
  value: T;
  options: ReadonlyArray<ChoiceOption<T>>;
  onChange: (value: T) => void;
  compact?: boolean;
}) {
  const name = useId();
  return <fieldset className={`choice-group${compact ? " compact" : ""}`}>
    <legend>{label}</legend>
    <div className="choice-options">
      {options.map((option) => <label className={value === option.value ? "selected" : ""} key={String(option.value)}>
        <input type="radio" name={name} value={String(option.value)} checked={value === option.value} onChange={() => onChange(option.value)} />
        <span><strong>{option.label}</strong>{option.detail && <small>{option.detail}</small>}</span>
        {value === option.value && <Check size={15} weight="bold" aria-hidden="true" />}
      </label>)}
    </div>
  </fieldset>;
}

function SearchChoice({ label, value, options, onChange, placeholder }: {
  label: string;
  value: string;
  options: SearchChoiceOption[];
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return <ComboBox<SearchChoiceOption>
    className="search-choice"
    defaultItems={options}
    menuTrigger="input"
    selectedKey={value}
    onSelectionChange={(key) => { if (key !== null) onChange(String(key)); }}
  >
    <AriaLabel>{label}</AriaLabel>
    <div className="search-choice-field">
      <MagnifyingGlass size={17} aria-hidden="true" />
      <AriaInput ref={inputRef} placeholder={placeholder} />
      <AriaButton
        type="button"
        aria-label={`Show ${label.toLowerCase()} options`}
        onPress={() => window.setTimeout(() => inputRef.current?.focus(), 0)}
      ><CaretDown size={16} /></AriaButton>
    </div>
    <AriaPopover className="choice-popover" offset={7}>
      <ListBox<SearchChoiceOption> className="choice-list" renderEmptyState={() => <div className="choice-empty">No matching options</div>}>
        {(option) => <ListBoxItem id={option.id} textValue={`${option.label}${option.detail ? ` — ${option.detail}` : ""}`} className="choice-list-item">
          {({ isSelected }) => <><span><strong>{option.label}</strong>{option.detail && <small>{option.detail}</small>}</span>{isSelected && <Check size={16} weight="bold" aria-hidden="true" />}</>}
        </ListBoxItem>}
      </ListBox>
    </AriaPopover>
  </ComboBox>;
}

const healthStatisticsMarker = "healthkit_statistics";
const sleepUnionMarker = "healthkit_sleep_union";

function isHealthManaged(metric: HealthMetric) {
  return metric.source.toLowerCase() !== "manual"
    || metric.metadata.aggregation === healthStatisticsMarker
    || metric.metadata.aggregation === sleepUnionMarker
    || metric.metadata.bundleIdentifier != null
    || metric.metadata.stage != null;
}

/** Uses one authoritative/device total so Watch and iPhone rows are never cross-summed. */
export function cumulativeHealthTotal(metrics: HealthMetric[], type: HealthMetric["type"], day = new Date()) {
  const matching = metrics.filter((metric) => metric.type === type && sameDay(metric.startAt, day));
  const manualTotal = matching.filter((metric) => !isHealthManaged(metric)).reduce((total, metric) => total + metric.value, 0);
  const authoritative = matching
    .filter((metric) => metric.metadata.aggregation === healthStatisticsMarker)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  if (authoritative) return Math.max(0, authoritative.value) + manualTotal;

  const bySource = new Map<string, number>();
  matching.filter(isHealthManaged).forEach((metric) => {
    const source = typeof metric.metadata.bundleIdentifier === "string" ? metric.metadata.bundleIdentifier : metric.source;
    bySource.set(source, (bySource.get(source) ?? 0) + metric.value);
  });
  return Math.max(0, ...bySource.values(), 0) + manualTotal;
}

function sleepDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setHours(date.getHours() - 12);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function unionHours(metrics: HealthMetric[]) {
  const intervals = metrics
    .map((metric) => ({ start: new Date(metric.startAt).getTime(), end: new Date(metric.endAt).getTime(), value: metric.value }))
    .filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  let total = 0;
  let currentStart: number | null = null;
  let currentEnd = 0;
  intervals.forEach((interval) => {
    if (currentStart === null) { currentStart = interval.start; currentEnd = interval.end; return; }
    if (interval.start <= currentEnd) currentEnd = Math.max(currentEnd, interval.end);
    else { total += currentEnd - currentStart; currentStart = interval.start; currentEnd = interval.end; }
  });
  if (currentStart !== null) total += currentEnd - currentStart;
  const invalidFallback = metrics
    .filter((metric) => { const start = new Date(metric.startAt).getTime(); const end = new Date(metric.endAt).getTime(); return !Number.isFinite(start) || !Number.isFinite(end) || end <= start; })
    .reduce((sum, metric) => sum + Math.max(0, metric.value), 0);
  return total / 3_600_000 + invalidFallback;
}

/** Unions overlapping records from the latest logical sleep night. */
export function latestNightSleep(metrics: HealthMetric[]) {
  const sleep = metrics
    .filter((metric) => metric.type === "sleep" && Number.isFinite(metric.value) && metric.value > 0)
    .sort((left, right) => new Date(left.endAt).getTime() - new Date(right.endAt).getTime());
  if (!sleep.length) return undefined;
  const latestDay = sleepDay(sleep.at(-1)!.endAt || sleep.at(-1)!.startAt);
  const nightMetrics = sleep.filter((metric) => sleepDay(metric.endAt || metric.startAt) === latestDay);
  // A night saved by Going to bed and I'm up stands in only when nothing else recorded it. It never adds to Apple Health's hours.
  const latestDayMetrics = nightMetrics.filter((metric) => !isSavedNight(metric));
  if (!latestDayMetrics.length) return [...nightMetrics].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0].value;
  const valid = latestDayMetrics
    .map((metric) => ({ metric, start: new Date(metric.startAt).getTime(), end: new Date(metric.endAt).getTime() }))
    .filter((entry) => Number.isFinite(entry.start) && Number.isFinite(entry.end) && entry.end > entry.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const sessions: Array<{ metrics: HealthMetric[]; end: number }> = [];
  valid.forEach(({ metric, start, end }) => {
    const current = sessions.at(-1);
    if (!current || start - current.end > 4 * 60 * 60 * 1_000) sessions.push({ metrics: [metric], end });
    else { current.metrics.push(metric); current.end = Math.max(current.end, end); }
  });
  const invalid = latestDayMetrics.filter((metric) => { const start = new Date(metric.startAt).getTime(); const end = new Date(metric.endAt).getTime(); return !Number.isFinite(start) || !Number.isFinite(end) || end <= start; });
  const latest = [...(sessions.at(-1)?.metrics ?? []), ...invalid];
  const manualTotal = latest.filter((metric) => !isHealthManaged(metric)).reduce((sum, metric) => sum + Math.max(0, metric.value), 0);
  const authoritative = latest
    .filter((metric) => metric.metadata.aggregation === sleepUnionMarker)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  const healthHours = authoritative ? Math.max(0, authoritative.value) : unionHours(latest.filter(isHealthManaged));
  const total = healthHours + manualTotal;
  return total > 0 ? total : undefined;
}

/* ---------- Plan → Tasks ---------- */

const FILTER_KEY = "remember-plan-filter-v1";
function readFilter() { try { return sessionStorage.getItem(FILTER_KEY) ?? "all"; } catch { return "all"; } }

export function TasksPage({ life }: { life: LifeOSController }) {
  const now = useNow();
  const [openTask, setOpenTask] = useState<LifeTask | null>(null);
  const [storedFilter, setStoredFilter] = useState(readFilter);
  const { tasks, goals } = life.snapshot;
  const projects = activeProjects(goals);
  // "all", "other" (loose tasks), or a project's id. A project that's gone falls back to all.
  const filter = storedFilter === "all" || storedFilter === "other" || projects.some((project) => project.id === storedFilter) ? storedFilter : "all";
  const setFilter = (value: string) => { haptic(6); setStoredFilter(value); try { sessionStorage.setItem(FILTER_KEY, value); } catch { /* Just for this view. */ } };
  const shown = (task: LifeTask) => filter === "all" || (filter === "other" ? !task.goalId || !projects.some((project) => project.id === task.goalId) : task.goalId === filter);
  const plan = planByTask(life.brain, tasks);
  const current = pickNow(tasks, plan, now)?.task;
  const today = todayTasks(tasks, plan, now).filter((task) => task.id !== current?.id && shown(task));
  const later = laterTasks(tasks, now).filter(shown);
  const done = doneToday(tasks, now);
  const focusProject = projects.find((project) => project.id === filter);
  return <div className="screen-body tasks-page">
    <NowCard life={life} compact onOpenTask={setOpenTask} />
    {projects.length > 0 && <div className="chip-row scroll project-filter" role="group" aria-label="Show tasks for">
      {[{ id: "all", label: "All" }, ...projects.map((project) => ({ id: project.id, label: project.title })), { id: "other", label: "Other" }].map((option) =>
        <button key={option.id} className={`chip${filter === option.id ? " selected" : ""}`} type="button" aria-pressed={filter === option.id} onClick={() => setFilter(option.id)}>{option.label}</button>)}
    </div>}
    {today.length > 0 && <section className="today-section" aria-labelledby="tasks-today"><h2 id="tasks-today" className="section-label">Today</h2><TaskList tasks={today} life={life} now={now} onOpen={setOpenTask} showProject={filter === "all"} /></section>}
    {later.length > 0 && <section className="today-section" aria-labelledby="tasks-later"><h2 id="tasks-later" className="section-label">Later</h2><TaskList tasks={later} life={life} now={now} onOpen={setOpenTask} showProject={filter === "all"} /></section>}
    {filter === "all" && !current && !later.length && !life.loading && <Empty icon={ListChecks} title="Nothing planned yet" detail="Type anything below. Jev will fit it in." />}
    {filter !== "all" && !today.length && !later.length && <Empty icon={ListChecks} title={focusProject ? `Nothing in ${focusProject.title}` : "No other tasks"} detail={focusProject ? "Add what's next below." : "Everything has a project."} />}
    <DailyBasics life={life} />
    {done.length > 0 && <details className="done-today">
      <summary><span className="section-label">Done today · {done.length}</span><CaretDown size={14} aria-hidden="true" /></summary>
      <ul>{done.map((task) => <li key={task.id}><Check size={16} weight="bold" aria-hidden="true" /><span>{task.title}</span></li>)}</ul>
    </details>}
    {openTask && <TaskSheet key={openTask.id} task={openTask} life={life} onClose={() => setOpenTask(null)} />}
    <TaskAddBar life={life} focusProjectId={focusProject?.id ?? null} placeholder={focusProject ? `Add to ${focusProject.title}…` : "Add a task…"} />
  </div>;
}

/* ---------- Plan → Projects ---------- */

function projectSummary(project: Goal, tasks: LifeTask[], plan: ReturnType<typeof planByTask>, now: Date) {
  const open = tasks.filter((task) => task.goalId === project.id && isOpen(task));
  const next = todayTasks(tasks, plan, now).find((task) => task.goalId === project.id) ?? null;
  const minutes = open.reduce((total, task) => total + task.durationMinutes, 0);
  const meta = open.length ? `${open.length === 1 ? "1 task" : `${open.length} tasks`} · ${durationLabel(minutes)}` : "No tasks yet";
  return { open, next, meta };
}

export function ProjectsPage({ life }: { life: LifeOSController }) {
  const toast = useToast();
  const now = useNow();
  const [openId, setOpenId] = useState<string | null>(null);
  const plan = planByTask(life.brain, life.snapshot.tasks);
  const projects = life.snapshot.goals.filter((goal) => goal.status === "active" || goal.status === "paused")
    .sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) || a.createdAt.localeCompare(b.createdAt));
  const open = life.snapshot.goals.find((goal) => goal.id === openId);
  const addProject = async (text: string) => {
    try { await life.createGoal({ title: text, area: "direction" }); haptic([8, 30, 8]); toast.show({ message: `${text} added` }); }
    catch (reason) { toast.error(mutationMessage(reason)); return false; }
  };
  return <div className="screen-body goals-page">
    {projects.length ? <ul className="goal-list">{projects.map((project) => {
      const summary = projectSummary(project, life.snapshot.tasks, plan, now);
      return <li key={project.id} className={`goal-card project-card${project.status !== "active" ? " paused" : ""}`}>
        <button className="goal-main" type="button" onClick={() => setOpenId(project.id)}>
          <strong>{project.title}</strong>
          <small>{project.status === "paused" ? `Paused · ${summary.meta}` : summary.meta}</small>
          {summary.next && <span className="project-next">Next: {summary.next.title}</span>}
        </button>
        {project.status === "active" && <button className="btn secondary" type="button" onClick={() => startProjectBlock(project.id)}>Work on it</button>}
      </li>;
    })}</ul> : <Empty icon={FolderSimple} title="What are you working on?" detail="Add one below, like College or My app." />}
    {open && <ProjectSheet key={open.id} project={open} life={life} onClose={() => setOpenId(null)} />}
    <AddBar label="Add a project" placeholder="Add a project…" sendLabel="Add project" onSubmit={addProject} />
  </div>;
}

/** Starts deep work on a project. The block view opens over everything, from wherever this was tapped. */
export function startProjectBlock(projectId: string, minutes = BLOCK_MINUTES) {
  haptic([8, 30, 8]);
  writeBlock({ projectId, startedAt: Date.now(), minutes });
}

function ProjectSheet({ project, life, onClose }: { project: Goal; life: LifeOSController; onClose: () => void }) {
  const toast = useToast();
  const now = useNow();
  const [title, setTitle] = useState(project.title);
  const [minutes, setMinutes] = useState(BLOCK_MINUTES);
  const [openTask, setOpenTask] = useState<LifeTask | null>(null);
  const plan = planByTask(life.brain, life.snapshot.tasks);
  const { open } = projectSummary(project, life.snapshot.tasks, plan, now);
  const ordered = [...todayTasks(open, plan, now), ...laterTasks(open, now)];
  const saveTitle = async () => {
    const clean = title.trim();
    if (!clean || clean === project.title) return;
    try { await life.updateGoal(project.id, { title: clean }); } catch (reason) { toast.error(mutationMessage(reason)); }
  };
  const close = () => { onClose(); void saveTitle(); };
  const setStatus = (status: Goal["status"]) => {
    onClose(); haptic(); void saveTitle();
    life.updateGoal(project.id, { status }).catch((reason) => toast.error(mutationMessage(reason)));
    const message = status === "completed" ? `${project.title} finished` : status === "paused" ? `${project.title} paused` : `${project.title} resumed`;
    toast.show({ message, action: { label: "Undo", onAction: () => life.updateGoal(project.id, { status: project.status }) } });
  };
  if (openTask) return <TaskSheet key={openTask.id} task={openTask} life={life} onClose={() => setOpenTask(null)} />;
  return <Sheet title="Project" hideTitle onClose={close} className="task-sheet project-sheet" closeLabel="Close and save">
    <label className="sr-only" htmlFor="project-sheet-title">Project name</label>
    <textarea id="project-sheet-title" className="task-sheet-title" rows={1} value={title} maxLength={200} onChange={(event) => setTitle(event.target.value.replace(/\n/g, " "))} />
    {ordered.length ? <TaskList tasks={ordered} life={life} now={now} onOpen={setOpenTask} showStart={false} /> : <p className="sheet-note">No tasks yet. Anything you add about {project.title} lands here.</p>}
    {project.status === "active" && <>
      <ChipGroup label="How long" options={BLOCK_LENGTHS.map((value) => ({ label: durationLabel(value), value }))} value={minutes} onChange={setMinutes} />
      <button className="btn primary" type="button" onClick={() => { close(); startProjectBlock(project.id, minutes); }}>Work on it</button>
    </>}
    <button className="btn quiet" type="button" onClick={() => setStatus(project.status === "paused" ? "active" : "paused")}>{project.status === "paused" ? "Resume" : "Pause"}</button>
    <button className="btn quiet" type="button" onClick={() => setStatus("completed")}>Finish project</button>
  </Sheet>;
}

/* ---------- Plan → Calendar ---------- */

export function CalendarPage({ life }: { life: LifeOSController }) {
  const toast = useToast();
  const now = useNow();
  const [selected, setSelected] = useState(() => new Date());
  const [adding, setAdding] = useState(false);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => { const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() + index); return day; }), []);
  const events = life.snapshot.events.filter((event) => sameDay(event.startAt, selected) && event.status !== "cancelled").sort((a, b) => a.startAt.localeCompare(b.startAt));
  const plan = planByTask(life.brain, life.snapshot.tasks);
  const planned = life.snapshot.tasks
    .filter((task) => ["active", "queued", "inbox"].includes(task.status))
    .map((task) => ({ task, startAt: plan.get(task.id)?.startAt ?? task.scheduledStart ?? null }))
    .filter((entry): entry is { task: LifeTask; startAt: string } => Boolean(entry.startAt && sameDay(entry.startAt, selected)))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const connected = life.snapshot.events.some((event) => event.source !== "manual" && event.source !== "task");
  const agenda = [
    ...events.map((event) => ({ key: event.id, at: event.allDay ? "" : event.startAt, time: eventTime(event), title: event.title, meta: [event.location, event.calendarName].filter(Boolean).join(" · "), planned: false })),
    ...planned.map(({ task, startAt }) => ({ key: task.id, at: startAt, time: timeLabel(startAt, selected), title: task.title, meta: `Jev planned · ${task.durationMinutes} min`, planned: true })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return <div className="screen-body calendar-page">
    <div className="week-strip" role="group" aria-label="Choose a day">{days.map((day) => { const isSelected = sameDay(day.toISOString(), selected); return <button key={day.toISOString()} className={isSelected ? "selected" : ""} type="button" aria-pressed={isSelected} onClick={() => setSelected(day)}><span>{new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(day)}</span><strong>{day.getDate()}</strong>{life.snapshot.events.some((event) => sameDay(event.startAt, day)) && <i aria-hidden="true" />}</button>; })}</div>
    <section className="today-section" aria-labelledby="agenda-title">
      <h2 id="agenda-title" className="section-label">{sameDay(selected.toISOString(), now) ? "Today" : new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(selected)}</h2>
      {agenda.length ? <ul className="agenda">{agenda.map((item) => <li key={item.key} className={item.planned ? "planned" : ""}><time>{item.time}</time><div><strong>{item.title}</strong>{item.meta && <small>{item.meta}</small>}</div></li>)}</ul>
        : <Empty icon={CalendarBlank} title="Nothing scheduled" detail="Open time is good time." />}
      <button className="btn quiet" type="button" onClick={() => setAdding(true)}>Add event</button>
    </section>
    {!connected && <button className="btn secondary" type="button" onClick={() => toast.show({ message: "Open Remember on your iPhone to connect Apple Calendar" })}>Connect calendar</button>}
    {adding && <EventComposer life={life} selected={selected} onClose={() => setAdding(false)} />}
    <TaskAddBar life={life} />
  </div>;
}

function localInputValue(date: Date) { const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
function EventComposer({ life, selected, onClose }: { life: LifeOSController; selected: Date; onClose: () => void }) {
  const startSeed = new Date(selected); startSeed.setHours(Math.max(new Date().getHours() + 1, 9), 0, 0, 0); const endSeed = new Date(startSeed.getTime() + 60 * 60_000);
  const [title, setTitle] = useState(""); const [start, setStart] = useState(localInputValue(startSeed)); const [end, setEnd] = useState(localInputValue(endSeed)); const [location, setLocation] = useState("");
  const mutation = useMutationState();
  const submit = async (event: FormEvent) => { event.preventDefault(); await mutation.run(() => life.addCalendarEvent({ externalId: crypto.randomUUID(), source: "manual", calendarName: "Personal", title, notes: "", location, url: null, startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), allDay: false, status: "confirmed" }), onClose); };
  return <Sheet title="Add an event" onClose={onClose} onSubmit={(event) => void submit(event)}>
    <label className="field"><span>Title</span><input data-auto-focus value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
    <div className="form-grid"><label className="field"><span>Starts</span><input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} required /></label><label className="field"><span>Ends</span><input type="datetime-local" value={end} min={start} onChange={(event) => setEnd(event.target.value)} required /></label></div>
    <label className="field"><span>Location</span><input value={location} onChange={(event) => setLocation(event.target.value)} /></label>
    <MutationError message={mutation.error} />
    <button className="btn primary" type="submit" disabled={!title.trim() || !start || !end || mutation.submitting}>{mutation.submitting ? "Adding…" : "Add event"}</button>
  </Sheet>;
}

/* ---------- Life → Health ---------- */

function latestMetric(metrics: HealthMetric[], type: HealthMetric["type"]) { return metrics.filter((metric) => metric.type === type).sort((a, b) => b.startAt.localeCompare(a.startAt))[0]; }

export function HealthPage({ life }: { life: LifeOSController }) {
  const [logging, setLogging] = useState<"weight" | "water" | null>(null); const [value, setValue] = useState("");
  const mutation = useMutationState();
  const metrics = life.snapshot.health;
  const steps = cumulativeHealthTotal(metrics, "steps");
  const energy = cumulativeHealthTotal(metrics, "active_energy");
  const exercise = cumulativeHealthTotal(metrics, "exercise_minutes");
  const water = cumulativeHealthTotal(metrics, "water");
  const sleepHours = latestNightSleep(metrics); const weight = latestMetric(metrics, "weight"); const resting = latestMetric(metrics, "resting_heart_rate"); const hrv = latestMetric(metrics, "heart_rate_variability");
  const synced = metrics.some((metric) => metric.source !== "manual");
  const log = async (event: FormEvent) => { event.preventDefault(); if (!logging || !Number.isFinite(Number(value))) return; const timestamp = new Date().toISOString(); await mutation.run(() => life.syncHealth([{ externalId: crypto.randomUUID(), type: logging, value: Number(value), unit: logging === "weight" ? "lb" : "mL", startAt: timestamp, endAt: timestamp, source: "manual", metadata: {} }]), () => { setLogging(null); setValue(""); }); };
  return <div className="screen-body health-page">
    <section className="card hero-stat" aria-label="Today’s movement">
      <span className="hero-stat-label"><Heartbeat size={18} weight="fill" aria-hidden="true" /> Today</span>
      <strong>{Math.round(steps).toLocaleString()}</strong><small>steps</small>
      <div className="stat-row"><div><strong>{Math.round(energy)}</strong><small>kcal</small></div><div><strong>{Math.round(exercise)}</strong><small>exercise min</small></div><div><strong>{sleepHours ? sleepHours.toFixed(1) : "—"}</strong><small>hr sleep</small></div></div>
    </section>
    <ul className="stat-grid">
      <li className="card"><small>Weight</small><strong>{weight ? weight.value.toFixed(1) : "—"}</strong><small>{weight?.unit ?? "No data"}</small><button className="btn quiet" type="button" onClick={() => setLogging("weight")} aria-label="Log weight">Log</button></li>
      <li className="card"><small>Water</small><strong>{Math.round(water)}</strong><small>mL today</small><button className="btn quiet" type="button" onClick={() => setLogging("water")} aria-label="Log water">Log</button></li>
      <li className="card"><small>Resting heart</small><strong>{resting ? Math.round(resting.value) : "—"}</strong><small>{resting?.unit ?? "bpm"}</small></li>
      <li className="card"><small>HRV</small><strong>{hrv ? Math.round(hrv.value) : "—"}</strong><small>{hrv?.unit ?? "ms"}</small></li>
    </ul>
    {!synced && <Empty icon={CloudArrowUp} title="Connect Apple Health on your iPhone" detail="Only the categories you approve are shared." />}
    {metrics.length > 0 && <section className="today-section" aria-labelledby="health-recent"><h2 id="health-recent" className="section-label">Recent</h2><ul className="plain-list">{metrics.slice(0, 12).map((metric) => <li key={metric.id}><span>{metric.type.replaceAll("_", " ")}</span><strong>{metric.value.toLocaleString()} {metric.unit}</strong><time>{shortDate(metric.startAt)}</time></li>)}</ul></section>}
    {logging && <Sheet title={logging === "weight" ? "Log weight" : "Log water"} onClose={() => setLogging(null)} onSubmit={(event) => void log(event)}>
      <label className="field"><span>{logging === "weight" ? "Pounds" : "Milliliters"}</span><input data-auto-focus type="number" inputMode="decimal" step="any" min="0" value={value} onChange={(event) => setValue(event.target.value)} required /></label>
      <MutationError message={mutation.error} />
      <button className="btn primary" type="submit" disabled={!value || mutation.submitting}>{mutation.submitting ? "Saving…" : "Save"}</button>
    </Sheet>}
  </div>;
}

/* ---------- Life → Money ---------- */

/** "12.50 lunch" → { name: "Lunch", amount: 12.5 }; a leading "+" means income. */
export function parseTransactionText(text: string) {
  const match = /([+-]?)\$?\s*(\d+(?:[.,]\d{1,2})?)/.exec(text);
  const amount = match ? Number(match[2].replace(",", ".")) : null;
  const name = (match ? text.replace(match[0], " ") : text).replace(/\s+/g, " ").trim();
  return { name: name ? name[0].toUpperCase() + name.slice(1) : "", amount, income: match?.[1] === "+" };
}

export function MoneyPage({ life }: { life: LifeOSController }) {
  const [addingAccount, setAddingAccount] = useState(false); const [draft, setDraft] = useState<string | null>(null);
  const { accounts, transactions } = life.snapshot;
  const thisMonth = new Date(); const monthTransactions = transactions.filter((transaction) => { const date = new Date(transaction.occurredAt); return date.getMonth() === thisMonth.getMonth() && date.getFullYear() === thisMonth.getFullYear(); });
  const spent = transactionTotals(monthTransactions, "expense"); const income = transactionTotals(monthTransactions, "income");
  return <div className="screen-body money-page">
    <section className="card hero-stat" aria-label="Net worth by currency">
      <span className="hero-stat-label">Net worth by currency</span>
      <strong className="money-total">{accounts.length ? accountTotals(accounts) : "—"}</strong>
      <div className="stat-row two"><div><small>Spent this month</small><strong>{spent || "—"}</strong></div><div><small>Income this month</small><strong>{income || "—"}</strong></div></div>
    </section>
    <section className="today-section" aria-labelledby="money-accounts">
      <div className="section-head"><h2 id="money-accounts" className="section-label">Accounts</h2><button className="btn secondary small" type="button" onClick={() => setAddingAccount(true)}>Add an account</button></div>
      {accounts.length ? <ul className="plain-list rows">{accounts.map((account) => <li key={account.id}><span className="row-icon" aria-hidden="true"><Wallet size={19} /></span><div><strong>{account.name}</strong><small>{account.institution || account.type}</small></div><strong>{money(account.balance, account.currency)}</strong></li>)}</ul>
        : <Empty icon={Wallet} title="No accounts yet" />}
    </section>
    <section className="today-section" aria-labelledby="money-recent">
      <h2 id="money-recent" className="section-label">Recent</h2>
      {transactions.length ? <ul className="plain-list rows">{transactions.slice(0, 12).map((transaction) => <li key={transaction.id}><div><strong>{transaction.merchant || transaction.name}</strong><small>{transaction.category} · {shortDate(transaction.occurredAt)}</small></div><strong className={transaction.amount < 0 ? "negative" : "positive"}>{money(transaction.amount, transaction.currency)}</strong></li>)}</ul>
        : <Empty icon={TrendDown} title="No transactions yet" detail="Type one below, like “12.50 lunch”." />}
    </section>
    {addingAccount && <AccountComposer life={life} onClose={() => setAddingAccount(false)} />}
    {draft !== null && <TransactionComposer life={life} initialText={draft} onClose={() => setDraft(null)} />}
    <AddBar label="Add a transaction" placeholder="Add a transaction…" sendLabel="Add transaction" onSubmit={(text) => { setDraft(text); }} />
  </div>;
}

function AccountComposer({ life, onClose }: { life: LifeOSController; onClose: () => void }) {
  const [name, setName] = useState(""); const [institution, setInstitution] = useState(""); const [type, setType] = useState<FinanceAccount["type"]>("checking"); const [balance, setBalance] = useState(""); const [currency, setCurrency] = useState("USD");
  const mutation = useMutationState();
  const submit = async (event: FormEvent) => { event.preventDefault(); await mutation.run(() => life.addFinanceAccount({ name, institution, type, balance: Number(balance), currency, source: "manual" }), onClose); };
  return <Sheet title="Add an account" onClose={onClose} onSubmit={(event) => void submit(event)}>
    <label className="field"><span>Name</span><input data-auto-focus value={name} onChange={(event) => setName(event.target.value)} placeholder="Everyday checking" required /></label>
    <label className="field"><span>Institution</span><input value={institution} onChange={(event) => setInstitution(event.target.value)} /></label>
    <ChoiceGroup label="Account type" value={type} options={accountTypeOptions} onChange={setType} compact />
    <label className="field"><span>Balance</span><input type="number" inputMode="decimal" step="0.01" value={balance} onChange={(event) => setBalance(event.target.value)} required /></label>
    <SearchChoice label="Currency" value={currency} options={currencyOptions} onChange={setCurrency} placeholder="Search currency name or code" />
    <MutationError message={mutation.error} />
    <button className="btn primary" type="submit" disabled={!name.trim() || !balance || mutation.submitting}>{mutation.submitting ? "Adding…" : "Add account"}</button>
  </Sheet>;
}

function TransactionComposer({ life, initialText = "", onClose }: { life: LifeOSController; initialText?: string; onClose: () => void }) {
  const seed = useMemo(() => parseTransactionText(initialText), [initialText]);
  const [name, setName] = useState(seed.name); const [amount, setAmount] = useState(seed.amount ? String(seed.amount) : ""); const [category, setCategory] = useState("Uncategorized"); const [accountId, setAccountId] = useState(""); const [currency, setCurrency] = useState("USD"); const [direction, setDirection] = useState<"expense" | "income">(seed.income ? "income" : "expense");
  const mutation = useMutationState();
  const toast = useToast();
  const submit = async (event: FormEvent) => { event.preventDefault(); const positiveAmount = Math.abs(Number(amount)); await mutation.run(() => life.addFinanceTransaction({ accountId: accountId || null, name, merchant: name, amount: direction === "expense" ? -positiveAmount : positiveAmount, currency, category, occurredAt: new Date().toISOString(), status: "posted", notes: "" }), () => { haptic([8, 30, 8]); toast.show({ message: "Transaction added" }); onClose(); }); };
  const selectAccount = (nextId: string) => { setAccountId(nextId); const account = life.snapshot.accounts.find((entry) => entry.id === nextId); if (account) setCurrency(account.currency); };
  const categoryChoice = categoryOptions.includes(category) ? category : "custom";
  const accountOptions: Array<ChoiceOption<string>> = [{ value: "none", label: "No account" }, ...life.snapshot.accounts.map((account) => ({ value: account.id, label: account.name, detail: `${account.currency} · ${account.institution || account.type}` }))];
  const searchableAccounts: SearchChoiceOption[] = accountOptions.map((option) => ({ id: option.value, label: option.label, detail: option.detail }));
  return <Sheet title="Add a transaction" onClose={onClose} onSubmit={(event) => void submit(event)}>
    <ChoiceGroup label="Transaction type" value={direction} options={[{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }]} onChange={setDirection} compact />
    <label className="field"><span>Name or merchant</span><input data-auto-focus={seed.name ? undefined : true} value={name} onChange={(event) => setName(event.target.value)} required /></label>
    <label className="field"><span>Amount</span><input data-auto-focus={seed.name && !seed.amount ? true : undefined} type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required /></label>
    <SearchChoice label="Currency" value={currency} options={currencyOptions} onChange={setCurrency} placeholder="Search currency name or code" />
    {life.snapshot.accounts.length > 0 && (accountOptions.length <= 6
      ? <ChoiceGroup label="Account" value={accountId || "none"} options={accountOptions} onChange={(value) => selectAccount(value === "none" ? "" : value)} compact />
      : <SearchChoice label="Account" value={accountId || "none"} options={searchableAccounts} onChange={(value) => selectAccount(value === "none" ? "" : value)} placeholder="Search account name" />)}
    <ChoiceGroup label="Category" value={categoryChoice} options={[...categoryOptions.map((value) => ({ value, label: value })), { value: "custom", label: "Other" }]} onChange={(value) => setCategory(value === "custom" ? "" : value)} compact />
    {(categoryChoice === "custom" || category === "") && <label className="field"><span>Custom category</span><input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Coffee, travel, subscriptions…" required /></label>}
    <MutationError message={mutation.error} />
    <button className="btn primary" type="submit" disabled={!name.trim() || !amount || Number(amount) <= 0 || !category.trim() || mutation.submitting}>{mutation.submitting ? "Saving…" : "Save transaction"}</button>
  </Sheet>;
}

/* ---------- Life → Files ---------- */

export function FilesPage({ life }: { life: LifeOSController }) {
  const input = useRef<HTMLInputElement>(null); const [query, setQuery] = useState(""); const [uploading, setUploading] = useState(false); const [deleting, setDeleting] = useState(false); const [pendingDeletion, setPendingDeletion] = useState<VaultFile | null>(null);
  const toast = useToast();
  const deleteDetailId = useId();
  const files = life.snapshot.files.filter((file) => `${file.name} ${file.folder} ${file.tags.join(" ")} ${file.summary}`.toLowerCase().includes(query.toLowerCase()));
  const upload = async (file?: File) => { if (!file) return; setUploading(true); try { await life.uploadFile(file, {}); if (input.current) input.current.value = ""; haptic([8, 30, 8]); toast.show({ message: "File added" }); } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Upload failed."); } finally { setUploading(false); } };
  const download = async (file: VaultFile) => { try { const blob = await life.downloadFile(file.id); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.name; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0); } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Download failed."); } };
  const remove = async () => { if (!pendingDeletion) return; setDeleting(true); try { await life.deleteFile(pendingDeletion.id); setPendingDeletion(null); toast.show({ message: "File deleted" }); } catch (reason) { toast.error(reason instanceof Error ? reason.message : "File deletion failed."); } finally { setDeleting(false); } };
  return <div className="screen-body files-page">
    <input ref={input} type="file" hidden aria-label="Upload file" onChange={(event) => void upload(event.target.files?.[0])} />
    {life.snapshot.files.length > 0 && <label className="search-pill"><MagnifyingGlass size={18} aria-hidden="true" /><span className="sr-only">Search files</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search files" /></label>}
    {files.length ? <ul className="plain-list rows">{files.map((file) => <li key={file.id}><span className="row-icon" aria-hidden="true"><File size={20} /></span><div><strong>{file.name}</strong><small>{file.folder || "Vault"} · {fileSize(file.sizeBytes)}</small></div><span className="row-actions"><button className="icon-button" type="button" aria-label={`Download ${file.name}`} onClick={() => void download(file)}><DownloadSimple size={19} /></button><button className="icon-button" type="button" aria-label={`Delete ${file.name}`} onClick={() => setPendingDeletion(file)}><Trash size={18} /></button></span></li>)}</ul>
      : <Empty icon={FolderOpen} title={query ? "No matching files" : "No files yet"} detail={query ? "Try another name." : "Keep receipts, plans, and documents here."} />}
    {pendingDeletion && <Sheet role="alertdialog" title={`Delete ${pendingDeletion.name}?`} describedBy={deleteDetailId} closeDisabled={deleting} onClose={() => { if (!deleting) setPendingDeletion(null); }}>
      <p className="sheet-note" id={deleteDetailId}>This permanently removes the file from Remember. This cannot be undone.</p>
      <button className="btn secondary" type="button" disabled={deleting} onClick={() => setPendingDeletion(null)}>Keep file</button>
      <button className="btn quiet danger" type="button" disabled={deleting} onClick={() => void remove()}>{deleting ? "Deleting…" : "Delete file"}</button>
    </Sheet>}
    <AddBarButton label={uploading ? "Adding…" : "Add a file"} icon={<CloudArrowUp size={20} weight="bold" />} disabled={uploading} onClick={() => input.current?.click()} />
  </div>;
}

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  CalendarBlank,
  CaretDown,
  Check,
  CheckCircle,
  Clock,
  CloudArrowUp,
  DownloadSimple,
  File,
  FolderOpen,
  Heartbeat,
  ListChecks,
  MagnifyingGlass,
  Minus,
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
import {
  Button as AriaButton,
  ComboBox,
  Input as AriaInput,
  Label as AriaLabel,
  ListBox,
  ListBoxItem,
  Popover as AriaPopover,
} from "react-aria-components/ComboBox";
import type { BlockerReason, CalendarEvent, FinanceAccount, FinanceTransaction, HealthMetric, LifeArea, LifeTask, PracticeOutcome, PracticeResult, VaultFile } from "./types";
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

const areaOptions = Object.entries(areaLabels).map(([value, label]) => ({ value: value as LifeArea, label }));
const durationOptions = [5, 10, 15, 25, 45, 60, 90].map((value) => ({ value, label: `${value} min` }));
const priorityOptions: Array<ChoiceOption<LifeTask["priority"]>> = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "must", label: "Must do" },
];
const accountTypeOptions = ["checking", "savings", "credit", "investment", "cash", "loan", "other"].map((value) => ({
  value: value as FinanceAccount["type"],
  label: value[0].toUpperCase() + value.slice(1),
}));
const categoryOptions = ["Uncategorized", "Food", "Transport", "Shopping", "Housing", "Health", "Entertainment"];
const unitOptions = ["time", "minutes", "glasses", "pages", "steps"];

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

function relativeDue(value: string | null) {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  if (diff < 0) return "Overdue";
  if (diff < 86_400_000) return "Due today";
  return `Due ${shortDate(value)}`;
}

function mutationMessage(reason: unknown) {
  return reason instanceof Error && reason.message ? reason.message : "That didn’t save. Check your connection and try again.";
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

function NumberStepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <div className="stepper-field">
    <span>{label}</span>
    <div className="number-stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}><Minus size={17} /></button>
      <output aria-live="polite" aria-label={`${label}: ${value}`}>{value}</output>
      <button type="button" aria-label={`Increase ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}><Plus size={17} /></button>
    </div>
  </div>;
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
  const latestDayMetrics = sleep.filter((metric) => sleepDay(metric.endAt || metric.startAt) === latestDay);
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
    const background = [...document.querySelectorAll<HTMLElement>(".app-shell > *")].map((element) => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute("aria-hidden"),
    }));
    background.forEach(({ element }) => {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => [...(backdrop.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ?? [])];
    const frame = window.requestAnimationFrame(() => (backdrop.current?.querySelector<HTMLElement>("[data-auto-focus]") ?? focusable()[0])?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") { event.preventDefault(); close.current(); return; }
      if (event.key !== "Tab") return;
      const controls = focusable(); if (!controls.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      background.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      });
      previous?.focus();
    };
  }, []);
  return createPortal(<div ref={backdrop} className="life-modal-backdrop" role="presentation">{children}</div>, document.body);
}

interface FocusTimerState { accumulatedMs: number; startedAt: number | null }

export function focusTimerStorageKey(taskId: string) { return `remember-focus-timer-v1:${taskId}`; }
export function focusTimerElapsedMs(timer: FocusTimerState, now = Date.now()) { return timer.accumulatedMs + (timer.startedAt === null ? 0 : Math.max(0, now - timer.startedAt)); }

function readFocusTimer(taskId: string): FocusTimerState {
  try {
    const stored = JSON.parse(sessionStorage.getItem(focusTimerStorageKey(taskId)) ?? "null") as Partial<FocusTimerState> | null;
    return { accumulatedMs: Math.max(0, Number(stored?.accumulatedMs) || 0), startedAt: typeof stored?.startedAt === "number" ? stored.startedAt : null };
  } catch { return { accumulatedMs: 0, startedAt: null }; }
}

const practiceOutcomeOptions: Array<ChoiceOption<PracticeOutcome>> = [
  { value: "helped", label: "It helped", detail: "I want to carry this forward" },
  { value: "mixed", label: "Somewhat", detail: "Part of it worked" },
  { value: "not_for_me", label: "Not for me", detail: "Trying it helped me let it go" },
];

function PracticeCompletionModal({ task, submitting, error, onClose, onComplete }: { task: LifeTask; submitting: boolean; error: string; onClose: () => void; onComplete: (result: PracticeResult) => void }) {
  const [outcome, setOutcome] = useState<PracticeOutcome | null>(null);
  const [reflection, setReflection] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (outcome) onComplete({ outcome, reflection: reflection.trim() });
  };
  return <LifeModalBackdrop onClose={onClose}><form className="life-modal practice-completion" role="dialog" aria-modal="true" aria-labelledby="practice-result-title" onSubmit={submit}>
    <button className="blocker-close" type="button" aria-label="Close" onClick={onClose}><X size={19} /></button>
    <p className="date-label">Real-life result</p>
    <h2 id="practice-result-title">What happened when you tried it?</h2>
    <p className="practice-prompt">You tested “{task.title}.” This answer becomes evidence in your Personal Compass.</p>
    <ChoiceGroup label="Did this help?" value={outcome ?? ""} options={practiceOutcomeOptions} onChange={(value) => setOutcome(value as PracticeOutcome)} />
    <label><span>What did you notice? <small>Optional</small></span><textarea value={reflection} maxLength={2000} onChange={(event) => setReflection(event.target.value)} placeholder="The part I want to remember is…" /></label>
    <MutationError message={error} />
    <button className="button primary" type="submit" disabled={!outcome || submitting}>{submitting ? "Remembering…" : "Finish and remember this"}</button>
  </form></LifeModalBackdrop>;
}

function ActiveMove({ life, task }: { life: LifeOSController; task: LifeTask }) {
  const storageKey = focusTimerStorageKey(task.id);
  const blockerTrigger = useRef<HTMLButtonElement>(null);
  const blockerPanel = useRef<HTMLDivElement>(null);
  const [timer, setTimer] = useState<FocusTimerState>(() => readFocusTimer(task.id));
  const [clock, setClock] = useState(Date.now());
  const [blocking, setBlocking] = useState(false); const [blockSaving, setBlockSaving] = useState(false); const [completing, setCompleting] = useState(false); const [showPracticeResult, setShowPracticeResult] = useState(false); const [actionError, setActionError] = useState("");
  const running = timer.startedAt !== null;
  useEffect(() => { try { sessionStorage.setItem(storageKey, JSON.stringify(timer)); } catch { /* Timer still works for this view. */ } }, [storageKey, timer]);
  useEffect(() => {
    if (!running) return;
    const update = () => setClock(Date.now());
    const interval = window.setInterval(update, 1_000);
    document.addEventListener("visibilitychange", update);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", update); };
  }, [running]);
  useEffect(() => {
    if (!blocking) return;
    const frame = window.requestAnimationFrame(() => blockerPanel.current?.querySelector<HTMLElement>("button")?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setBlocking(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", closeOnEscape);
      blockerTrigger.current?.focus();
    };
  }, [blocking]);
  const elapsedSeconds = Math.floor(focusTimerElapsedMs(timer, clock) / 1_000);
  const elapsed = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:${String(elapsedSeconds % 60).padStart(2, "0")}`;
  const toggleTimer = () => { const now = Date.now(); setClock(now); setTimer((current) => current.startedAt === null ? { ...current, startedAt: now } : { accumulatedMs: focusTimerElapsedMs(current, now), startedAt: null }); };
  const complete = async (result?: PracticeResult) => {
    setCompleting(true); setActionError("");
    try { await life.completeTask(task.id, Math.max(1, Math.round(elapsedSeconds / 60)), result); sessionStorage.removeItem(storageKey); setShowPracticeResult(false); }
    catch (reason) { setActionError(mutationMessage(reason)); }
    finally { setCompleting(false); }
  };
  const chooseBlocker = async (reason: BlockerReason) => {
    setBlockSaving(true); setActionError("");
    try { await life.blockTask(task.id, reason); if (reason === "different" || reason === "irrelevant") sessionStorage.removeItem(storageKey); setBlocking(false); }
    catch (error) { setActionError(mutationMessage(error)); }
    finally { setBlockSaving(false); }
  };
  return <article className="active-move">
    <div className="active-move-top"><div><span className="section-kicker">Current task</span><AreaBadge area={task.area} /></div><span className="move-duration"><Clock size={15} /> {task.durationMinutes} minutes</span></div>
    <h2>{task.title}</h2><div className="first-action"><span>First physical action</span><p>{task.firstStep || "Write the first visible action, then do only that."}</p></div>
    {(running || elapsedSeconds > 0) && <div className="focus-timer" role="timer" aria-label={`Elapsed time ${Math.floor(elapsedSeconds / 60)} minutes ${elapsedSeconds % 60} seconds`}><Timer size={24} /><strong aria-hidden="true">{elapsed}</strong><span>{running ? "In progress" : "Paused"}</span></div>}
    <div className="active-actions"><button className="button primary" type="button" onClick={toggleTimer}>{running ? <><Pause size={17} weight="fill" /> Pause</> : <><Play size={17} weight="fill" /> {elapsedSeconds ? "Resume" : "Start now"}</>}</button><button className="button secondary" type="button" disabled={completing} onClick={() => task.source === "practice" ? setShowPracticeResult(true) : void complete()}><Check size={17} weight="bold" /> {completing ? "Completing…" : task.source === "practice" ? "Finish experiment" : "Complete"}</button><button ref={blockerTrigger} className="blocker-trigger" type="button" aria-expanded={blocking} aria-controls="task-blocker-panel" onClick={() => { setActionError(""); setBlocking(true); }}>I can’t do this</button></div>
    {!blocking && <MutationError message={actionError} />}
    {blocking && <div id="task-blocker-panel" ref={blockerPanel} className="blocker-overlay" role="region" aria-labelledby="blocker-heading"><button className="blocker-close" type="button" aria-label="Close blocker menu" onClick={() => setBlocking(false)}><X size={19} /></button><div><p className="date-label">Adjust this task</p><h3 id="blocker-heading">What’s blocking you?</h3></div><div className="blocker-grid">{blockerOptions.map((option) => <button key={option.reason} type="button" disabled={blockSaving} onClick={() => void chooseBlocker(option.reason)}><strong>{option.label}</strong><span>{option.detail}</span><ArrowRight size={16} /></button>)}</div><MutationError message={actionError} /></div>}
    {showPracticeResult && <PracticeCompletionModal task={task} submitting={completing} error={actionError} onClose={() => { if (!completing) { setShowPracticeResult(false); setActionError(""); } }} onComplete={(result) => void complete(result)} />}
  </article>;
}

export function TasksPage({ life }: { life: LifeOSController }) {
  const [showAdd, setShowAdd] = useState(false); const [showFloorAdd, setShowFloorAdd] = useState(false); const { snapshot } = life;
  const active = snapshot.tasks.find((task) => task.status === "active");
  const timing = new Map(life.brain?.plan.map((block) => [block.taskId, block.startAt]) ?? []);
  const queued = snapshot.tasks.filter((task) => task.status === "queued" || task.status === "inbox").sort((a, b) => (timing.get(a.id) ?? "9999").localeCompare(timing.get(b.id) ?? "9999"));
  const waiting = snapshot.tasks.filter((task) => task.status === "waiting");
  const done = snapshot.tasks.filter((task) => task.status === "done").slice(0, 8);
  return <div className="page life-page tasks-page page-enter"><SurfaceHeader eyebrow="Plan" title="Tasks" detail="Choose one next action and keep the rest in order." action={<button className="button primary desktop-action" type="button" onClick={() => setShowAdd(true)}><Plus size={17} /> Add task</button>} />
    {active ? <ActiveMove key={active.id} life={life} task={active} /> : <div className="empty-active"><ModuleEmpty icon={ListChecks} title="Choose what happens next" detail="Add a small, specific action to get started." /></div>}
    <section className="task-section"><div className="section-title-row"><div><span>Up next</span><h2>Queue</h2></div><small>{queued.length} waiting</small></div>{queued.length ? <div className="task-path">{queued.map((task, index) => <article key={task.id}><span className="task-number">{String(index + 1).padStart(2, "0")}</span><div><span className="task-row-meta"><AreaBadge area={task.area} />{task.priority !== "normal" && <em>{task.priority}</em>}</span><strong>{task.title}</strong><p>{timing.has(task.id) ? new Date(timing.get(task.id)!).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }) : task.firstStep || "First step not defined"}{task.repeatEveryDays ? ` · Repeats every ${task.repeatEveryDays} days` : ""}</p></div><span className="task-time">{task.durationMinutes}m</span><button type="button" onClick={() => void life.updateTask(task.id, { status: "active" })}>Do next</button></article>)}</div> : <ModuleEmpty icon={ListChecks} title="The queue is clear" detail="Add another task when you know what comes next." />}</section>
    <LifeFloor life={life} onAdd={() => setShowFloorAdd(true)} />
    {(waiting.length > 0 || done.length > 0) && <section className="task-history-grid">{waiting.length > 0 && <div><h3>Waiting</h3>{waiting.map((task) => <button key={task.id} type="button" onClick={() => void life.updateTask(task.id, { status: "queued" })}><span>{task.title}</span><small>Return to queue</small></button>)}</div>}{done.length > 0 && <div><h3>Recently completed</h3>{done.map((task) => <div key={task.id}><CheckCircle size={17} weight="fill" /><span>{task.title}</span><small>{task.completedAt ? shortDate(task.completedAt) : "Done"}</small></div>)}</div>}</section>}
    {showAdd && <TaskComposer life={life} onClose={() => setShowAdd(false)} />}
    {showFloorAdd && <FloorComposer life={life} onClose={() => setShowFloorAdd(false)} />}
  </div>;
}

function todayKey() { const date = new Date(); date.setHours(12, 0, 0, 0); return date.toISOString(); }

function LifeFloor({ life, onAdd }: { life: LifeOSController; onAdd: () => void }) {
  const date = todayKey();
  return <section className="life-floor"><div className="section-title-row"><div><span>Every day</span><h2>Daily basics</h2></div><button type="button" onClick={onAdd}><Plus size={15} /> Add daily basic</button></div><p className="floor-intro">Keep a short list of the basics you want to cover each day.</p>
    {life.snapshot.floor.length ? <div className="floor-grid">{life.snapshot.floor.map((item) => { const done = item.completionDates.some((value) => sameDay(value, new Date())); return <button key={item.id} className={done ? "complete" : ""} type="button" aria-pressed={done} onClick={() => void life.toggleFloorItem(item.id, date)}><span className="floor-check">{done ? <Check size={17} weight="bold" /> : null}</span><span><strong>{item.title}</strong><small>{item.target} {item.unit} · {areaLabels[item.area]}</small></span></button>; })}</div> : <ModuleEmpty icon={CheckCircle} title="Add a daily basic" detail="Pick two or three basics you can still do on a bad day: water, medication, movement, sunlight, or one reset." />}
  </section>;
}

function FloorComposer({ life, onClose }: { life: LifeOSController; onClose: () => void }) {
  const [title, setTitle] = useState(""); const [area, setArea] = useState<LifeArea>("health"); const [target, setTarget] = useState(1); const [unit, setUnit] = useState("time");
  const mutation = useMutationState();
  const submit = async (event: FormEvent) => { event.preventDefault(); await mutation.run(() => life.createFloorItem({ title, area, target, unit }), onClose); };
  const usesCustomUnit = !unitOptions.includes(unit);
  return <LifeModalBackdrop onClose={onClose}><form className="life-modal compact" role="dialog" aria-modal="true" aria-labelledby="floor-title" onSubmit={(event) => void submit(event)}>
    <button className="blocker-close" type="button" aria-label="Close" onClick={onClose}><X size={19} /></button>
    <p className="date-label">Daily basics</p><h2 id="floor-title">Add a daily basic</h2>
    <label><span>Daily basic</span><input data-auto-focus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Take medication" required /></label>
    <ChoiceGroup label="Area" value={area} options={areaOptions} onChange={setArea} compact />
    <NumberStepper label="Daily target" value={target} min={1} max={100} onChange={setTarget} />
    <ChoiceGroup label="Unit" value={usesCustomUnit ? "custom" : unit} options={[...unitOptions.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) })), { value: "custom", label: "Custom" }]} onChange={(value) => setUnit(value === "custom" ? "" : value)} compact />
    {(usesCustomUnit || unit === "") && <label><span>Custom unit</span><input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="miles, doses, servings…" required /></label>}
    <MutationError message={mutation.error} />
    <button className="button primary" type="submit" disabled={!title.trim() || !unit.trim() || mutation.submitting}>{mutation.submitting ? "Adding…" : "Add daily basic"}</button>
  </form></LifeModalBackdrop>;
}

function TaskComposer({ life, onClose }: { life: LifeOSController; onClose: () => void }) {
  const [title, setTitle] = useState(""); const [firstStep, setFirstStep] = useState(""); const [area, setArea] = useState<LifeArea>("direction"); const [duration, setDuration] = useState(15); const [priority, setPriority] = useState<LifeTask["priority"]>("normal");
  const mutation = useMutationState();
  const [repeatEveryDays, setRepeatEveryDays] = useState(0);
  const submit = async (event: FormEvent) => { event.preventDefault(); await mutation.run(() => life.createTask({ title, firstStep, area, durationMinutes: duration, priority, status: "queued", repeatEveryDays: repeatEveryDays || null }), onClose); };
  return <LifeModalBackdrop onClose={onClose}><form className="life-modal" role="dialog" aria-modal="true" aria-labelledby="new-task-title" onSubmit={(event) => void submit(event)}>
    <button className="blocker-close" type="button" aria-label="Close" onClick={onClose}><X size={19} /></button>
    <p className="date-label">New task</p><h2 id="new-task-title">Add a task</h2>
    <label><span>Outcome</span><input data-auto-focus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What will be different when this is done?" required /></label>
    <label><span>First physical action</span><textarea value={firstStep} onChange={(event) => setFirstStep(event.target.value)} placeholder="Open…, write…, call…, put…" required /></label>
    <ChoiceGroup label="Area" value={area} options={areaOptions} onChange={setArea} compact />
    <ChoiceGroup label="Time box" value={duration} options={durationOptions} onChange={setDuration} compact />
    <ChoiceGroup label="Priority" value={priority} options={priorityOptions} onChange={setPriority} compact />
    <ChoiceGroup label="Repeat after completion" value={repeatEveryDays} options={[{ value: 0, label: "Once" }, { value: 1, label: "Daily" }, { value: 7, label: "Weekly" }, { value: 30, label: "Every 30 days" }]} onChange={setRepeatEveryDays} compact />
    {repeatEveryDays > 0 && <p className="muted">Jev will find time for the next occurrence after you finish this one.</p>}
    <MutationError message={mutation.error} />
    <button className="button primary" type="submit" disabled={!title.trim() || !firstStep.trim() || mutation.submitting}>{mutation.submitting ? "Creating…" : <>Create task <ArrowRight size={16} /></>}</button>
  </form></LifeModalBackdrop>;
}

export function GoalsPage({ life }: { life: LifeOSController }) {
  const [adding, setAdding] = useState(false); const [title, setTitle] = useState(""); const [area, setArea] = useState<LifeArea>("direction"); const [why, setWhy] = useState("");
  const mutation = useMutationState();
  const goals = life.snapshot.goals.filter((goal) => goal.status !== "archived");
  const submit = async (event: FormEvent) => { event.preventDefault(); await mutation.run(() => life.createGoal({ title, area, why }), () => { setTitle(""); setWhy(""); setAdding(false); }); };
  return <div className="page life-page goals-page page-enter"><SurfaceHeader eyebrow="Plan" title="Goals" detail="Track the outcomes you are actively working toward." action={<button className="button primary desktop-action" type="button" onClick={() => setAdding(true)}><Plus size={17} /> New goal</button>} />
    {goals.length ? <div className="goal-grid">{goals.map((goal) => <article key={goal.id} className={goal.status !== "active" ? "paused" : ""}><div><AreaBadge area={goal.area} /><button type="button" onClick={() => void life.updateGoal(goal.id, { status: goal.status === "active" ? "paused" : "active" })}>{goal.status === "active" ? "Pause" : "Resume"}</button></div><h2>{goal.title}</h2>{goal.why && <p>{goal.why}</p>}<div className="goal-progress"><span><i style={{ width: `${goal.progress}%` }} /></span><strong>{goal.progress}%</strong></div><input aria-label={`Progress for ${goal.title}`} type="range" min="0" max="100" step="5" value={goal.progress} onChange={(event) => void life.updateGoal(goal.id, { progress: Number(event.target.value), ...(Number(event.target.value) === 100 ? { status: "completed" } : {}) })} /><button className="goal-add-move" type="button" onClick={() => void life.createTask({ title: `Move ${goal.title} forward`, firstStep: "Choose the smallest visible action that produces evidence today.", goalId: goal.id, area: goal.area, source: "goal", status: "queued" })}><Plus size={15} /> Add task from goal</button></article>)}</div> : <ModuleEmpty icon={Target} title="Choose one direction" detail="A useful goal describes an observable result, not a permanent identity project." />}
    {adding && <LifeModalBackdrop onClose={() => setAdding(false)}><form className="life-modal" role="dialog" aria-modal="true" aria-labelledby="new-goal-title" onSubmit={(event) => void submit(event)}>
      <button className="blocker-close" type="button" aria-label="Close" onClick={() => setAdding(false)}><X size={19} /></button>
      <p className="date-label">New goal</p><h2 id="new-goal-title">What result matters?</h2>
      <label><span>Goal</span><input data-auto-focus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Publish the first version" required /></label>
      <label><span>Why this matters now</span><textarea value={why} onChange={(event) => setWhy(event.target.value)} placeholder="This matters because…" /></label>
      <ChoiceGroup label="Life area" value={area} options={areaOptions} onChange={setArea} compact />
      <MutationError message={mutation.error} />
      <button className="button primary" type="submit" disabled={!title.trim() || mutation.submitting}>{mutation.submitting ? "Creating…" : "Create goal"}</button>
    </form></LifeModalBackdrop>}
  </div>;
}

export function CalendarPage({ life }: { life: LifeOSController }) {
  const [selected, setSelected] = useState(() => new Date()); const [adding, setAdding] = useState(false);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => { const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() + index); return day; }), []);
  const events = life.snapshot.events.filter((event) => sameDay(event.startAt, selected) && event.status !== "cancelled").sort((a, b) => a.startAt.localeCompare(b.startAt));
  const planned = new Map(life.brain?.plan.map((block) => [block.taskId, block]) ?? []);
  const scheduledTasks = life.snapshot.tasks.filter((task) => ["active", "queued", "inbox"].includes(task.status)).map((task) => ({ ...task, scheduledStart: task.scheduledStart ?? planned.get(task.id)?.startAt ?? null })).filter((task) => task.scheduledStart && sameDay(task.scheduledStart, selected));
  return <div className="page life-page calendar-page page-enter"><SurfaceHeader eyebrow="Plan" title="Calendar" detail="See events and scheduled tasks together." action={<button className="button primary desktop-action" type="button" onClick={() => setAdding(true)}><Plus size={17} /> Add event</button>} />
    <div className="week-strip">{days.map((day) => <button key={day.toISOString()} className={sameDay(day.toISOString(), selected) ? "selected" : ""} type="button" onClick={() => setSelected(day)}><span>{new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(day)}</span><strong>{day.getDate()}</strong>{life.snapshot.events.some((event) => sameDay(event.startAt, day)) && <i />}</button>)}</div>
    <section className="day-agenda"><div className="agenda-date"><span>{new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(selected)}</span><h2>{new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(selected)}</h2><small>{events.length + scheduledTasks.length} commitments</small></div><div className="agenda-list">{events.map((event) => <article key={event.id}><time>{eventTime(event)}</time><span className={`calendar-dot source-${event.source}`} /><div><strong>{event.title}</strong><p>{[event.location, event.calendarName].filter(Boolean).join(" · ")}</p></div></article>)}{scheduledTasks.map((task) => <article key={task.id}><time>{eventTime({ startAt: task.scheduledStart!, allDay: false } as CalendarEvent)}</time><span className="calendar-dot source-task" /><div><strong>{task.title}</strong><p>Scheduled task · {task.durationMinutes} minutes</p></div></article>)}{!events.length && !scheduledTasks.length && <ModuleEmpty icon={CalendarBlank} title="Nothing scheduled" detail="Open time is useful. Protect it deliberately or leave it open on purpose." />}</div></section>
    <div className="calendar-sync-note"><CloudArrowUp size={19} /><div><strong>Calendar sync</strong><p>Apple Calendar imports from the iPhone app. Google and Outlook events use the same private event model.</p></div></div>
    {adding && <EventComposer life={life} selected={selected} onClose={() => setAdding(false)} />}
  </div>;
}

function localInputValue(date: Date) { const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
function EventComposer({ life, selected, onClose }: { life: LifeOSController; selected: Date; onClose: () => void }) {
  const startSeed = new Date(selected); startSeed.setHours(Math.max(new Date().getHours() + 1, 9), 0, 0, 0); const endSeed = new Date(startSeed.getTime() + 60 * 60_000);
  const [title, setTitle] = useState(""); const [start, setStart] = useState(localInputValue(startSeed)); const [end, setEnd] = useState(localInputValue(endSeed)); const [location, setLocation] = useState("");
  const mutation = useMutationState();
  const submit = async (event: FormEvent) => { event.preventDefault(); await mutation.run(() => life.addCalendarEvent({ externalId: crypto.randomUUID(), source: "manual", calendarName: "Personal", title, notes: "", location, url: null, startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), allDay: false, status: "confirmed" }), onClose); };
  return <LifeModalBackdrop onClose={onClose}><form className="life-modal" role="dialog" aria-modal="true" aria-labelledby="new-event-title" onSubmit={(event) => void submit(event)}><button className="blocker-close" type="button" aria-label="Close" onClick={onClose}><X size={19} /></button><p className="date-label">New event</p><h2 id="new-event-title">Add an event</h2><label><span>Title</span><input data-auto-focus value={title} onChange={(event) => setTitle(event.target.value)} required /></label><div className="form-grid"><label><span>Starts</span><input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} required /></label><label><span>Ends</span><input type="datetime-local" value={end} min={start} onChange={(event) => setEnd(event.target.value)} required /></label></div><label><span>Location</span><input value={location} onChange={(event) => setLocation(event.target.value)} /></label><MutationError message={mutation.error} /><button className="button primary" type="submit" disabled={!title.trim() || !start || !end || mutation.submitting}>{mutation.submitting ? "Adding…" : "Add event"}</button></form></LifeModalBackdrop>;
}

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
  const log = async (event: FormEvent) => { event.preventDefault(); if (!logging || !Number.isFinite(Number(value))) return; const timestamp = nowIso(); await mutation.run(() => life.syncHealth([{ externalId: crypto.randomUUID(), type: logging, value: Number(value), unit: logging === "weight" ? "lb" : "mL", startAt: timestamp, endAt: timestamp, source: "manual", metadata: {} }]), () => { setLogging(null); setValue(""); }); };
  return <div className="page life-page health-page page-enter"><SurfaceHeader eyebrow="Life" title="Health" detail="Review synced activity and add manual measurements." action={<button className="button secondary desktop-action" type="button" onClick={() => setLogging("weight")}><Plus size={17} /> Log weight</button>} />
    <section className="health-hero"><div><span className="health-ring"><Heartbeat size={38} weight="duotone" /></span><p>Today’s movement</p><strong>{Math.round(steps).toLocaleString()}</strong><small>steps</small></div><div className="health-today-stats"><article><span>Active energy</span><strong>{Math.round(energy)}</strong><small>kcal</small></article><article><span>Exercise</span><strong>{Math.round(exercise)}</strong><small>minutes</small></article><article><span>Sleep</span><strong>{sleepHours ? sleepHours.toFixed(1) : "—"}</strong><small>hours last night</small></article></div></section>
    <div className="health-metric-grid"><article><span>Weight</span><strong>{weight ? weight.value.toFixed(1) : "—"}</strong><small>{weight?.unit ?? "No data"}</small></article><article><span>Resting heart rate</span><strong>{resting ? Math.round(resting.value) : "—"}</strong><small>{resting?.unit ?? "Apple Health"}</small></article><article><span>HRV</span><strong>{hrv ? Math.round(hrv.value) : "—"}</strong><small>{hrv?.unit ?? "Apple Health"}</small></article><article><span>Water</span><strong>{Math.round(water)}</strong><small>mL today</small><button type="button" onClick={() => setLogging("water")}>Log</button></article></div>
    <section className="health-sync-card"><div><span><CloudArrowUp size={24} /></span><div><strong>Apple Health sync</strong><p>The iPhone app reads only the categories you approve and sends normalized measurements to your private Remember database. Revoking Health access stops collection immediately.</p></div></div><span className={metrics.some((metric) => metric.source !== "manual") ? "connected" : "not-connected"}>{metrics.some((metric) => metric.source !== "manual") ? "Connected" : "Connect on iPhone"}</span></section>
    {metrics.length > 0 && <section className="health-history"><div className="section-title-row"><div><span>Recent</span><h2>Measurements</h2></div></div>{metrics.slice(0, 12).map((metric) => <div key={metric.id}><span className="metric-icon"><Heartbeat size={16} /></span><strong>{metric.type.replaceAll("_", " ")}</strong><span>{metric.value.toLocaleString()} {metric.unit}</span><time>{shortDate(metric.startAt)}</time></div>)}</section>}
    {logging && <LifeModalBackdrop onClose={() => setLogging(null)}><form className="life-modal compact" role="dialog" aria-modal="true" aria-labelledby="health-log-title" onSubmit={(event) => void log(event)}><button className="blocker-close" type="button" aria-label="Close" onClick={() => setLogging(null)}><X size={19} /></button><p className="date-label">Manual health entry</p><h2 id="health-log-title">Log {logging}</h2><label><span>{logging === "weight" ? "Pounds" : "Milliliters"}</span><input data-auto-focus type="number" step="any" min="0" value={value} onChange={(event) => setValue(event.target.value)} required /></label><MutationError message={mutation.error} /><button className="button primary" type="submit" disabled={mutation.submitting}>{mutation.submitting ? "Saving…" : "Save measurement"}</button></form></LifeModalBackdrop>}
  </div>;
}

function nowIso() { return new Date().toISOString(); }

export function MoneyPage({ life }: { life: LifeOSController }) {
  const [addingAccount, setAddingAccount] = useState(false); const [addingTransaction, setAddingTransaction] = useState(false);
  const { accounts, transactions } = life.snapshot;
  const thisMonth = new Date(); const monthTransactions = transactions.filter((transaction) => { const date = new Date(transaction.occurredAt); return date.getMonth() === thisMonth.getMonth() && date.getFullYear() === thisMonth.getFullYear(); });
  const spent = transactionTotals(monthTransactions, "expense"); const income = transactionTotals(monthTransactions, "income");
  return <div className="page life-page money-page page-enter"><SurfaceHeader eyebrow="Life" title="Money" detail="Review balances, spending, and recent activity." action={<button className="button primary desktop-action" type="button" onClick={() => setAddingTransaction(true)}><Plus size={17} /> Add transaction</button>} />
    <section className="money-hero"><div><span>Net worth by currency</span><strong>{accounts.length ? accountTotals(accounts) : "—"}</strong><small>{accounts.length ? `${accounts.length} accounts · currencies kept separate` : "Add your first account"}</small></div><article><TrendDown size={20} /><span>Spent this month</span><strong>{spent || "—"}</strong></article><article><TrendUp size={20} /><span>Income this month</span><strong>{income || "—"}</strong></article></section>
    <div className="money-columns"><section><div className="section-title-row"><div><span>Accounts</span><h2>Your money</h2></div><button type="button" onClick={() => setAddingAccount(true)}><Plus size={15} /> Add account</button></div>{accounts.length ? <div className="account-list">{accounts.map((account) => <article key={account.id}><span className="account-icon"><Wallet size={20} /></span><div><strong>{account.name}</strong><small>{account.institution || account.type}</small></div><span>{money(account.balance, account.currency)}</span></article>)}</div> : <ModuleEmpty icon={Wallet} title="No accounts yet" detail="Start manually. Provider sync can replace manual balances without changing this view." />}</section><section><div className="section-title-row"><div><span>Activity</span><h2>Recent</h2></div></div>{transactions.length ? <div className="transaction-list">{transactions.slice(0, 12).map((transaction) => <article key={transaction.id}><div><strong>{transaction.merchant || transaction.name}</strong><small>{transaction.category} · {shortDate(transaction.occurredAt)}</small></div><span className={transaction.amount < 0 ? "negative" : "positive"}>{money(transaction.amount, transaction.currency)}</span></article>)}</div> : <ModuleEmpty icon={TrendDown} title="No activity" detail="Transactions you import or add will be categorized here." />}</section></div>
    {addingAccount && <AccountComposer life={life} onClose={() => setAddingAccount(false)} />}{addingTransaction && <TransactionComposer life={life} onClose={() => setAddingTransaction(false)} />}
  </div>;
}

function AccountComposer({ life, onClose }: { life: LifeOSController; onClose: () => void }) {
  const [name, setName] = useState(""); const [institution, setInstitution] = useState(""); const [type, setType] = useState<FinanceAccount["type"]>("checking"); const [balance, setBalance] = useState(""); const [currency, setCurrency] = useState("USD");
  const mutation = useMutationState();
  const submit = async (event: FormEvent) => { event.preventDefault(); await mutation.run(() => life.addFinanceAccount({ name, institution, type, balance: Number(balance), currency, source: "manual" }), onClose); };
  return <LifeModalBackdrop onClose={onClose}><form className="life-modal compact" role="dialog" aria-modal="true" aria-labelledby="finance-account-title" onSubmit={(event) => void submit(event)}>
    <button className="blocker-close" type="button" aria-label="Close" onClick={onClose}><X size={19} /></button>
    <p className="date-label">New account</p><h2 id="finance-account-title">Add an account</h2>
    <label><span>Name</span><input data-auto-focus value={name} onChange={(event) => setName(event.target.value)} placeholder="Everyday checking" required /></label>
    <label><span>Institution</span><input value={institution} onChange={(event) => setInstitution(event.target.value)} /></label>
    <ChoiceGroup label="Account type" value={type} options={accountTypeOptions} onChange={setType} compact />
    <label><span>Balance</span><input type="number" inputMode="decimal" step="0.01" value={balance} onChange={(event) => setBalance(event.target.value)} required /></label>
    <SearchChoice label="Currency" value={currency} options={currencyOptions} onChange={setCurrency} placeholder="Search currency name or code" />
    <MutationError message={mutation.error} />
    <button className="button primary" type="submit" disabled={!name.trim() || !balance || mutation.submitting}>{mutation.submitting ? "Adding…" : "Add account"}</button>
  </form></LifeModalBackdrop>;
}

function TransactionComposer({ life, onClose }: { life: LifeOSController; onClose: () => void }) {
  const [name, setName] = useState(""); const [amount, setAmount] = useState(""); const [category, setCategory] = useState("Uncategorized"); const [accountId, setAccountId] = useState(""); const [currency, setCurrency] = useState("USD"); const [direction, setDirection] = useState<"expense" | "income">("expense");
  const mutation = useMutationState();
  const submit = async (event: FormEvent) => { event.preventDefault(); const positiveAmount = Math.abs(Number(amount)); await mutation.run(() => life.addFinanceTransaction({ accountId: accountId || null, name, merchant: name, amount: direction === "expense" ? -positiveAmount : positiveAmount, currency, category, occurredAt: nowIso(), status: "posted", notes: "" }), onClose); };
  const selectAccount = (nextId: string) => { setAccountId(nextId); const account = life.snapshot.accounts.find((entry) => entry.id === nextId); if (account) setCurrency(account.currency); };
  const categoryChoice = categoryOptions.includes(category) ? category : "custom";
  const accountOptions: Array<ChoiceOption<string>> = [{ value: "none", label: "No account" }, ...life.snapshot.accounts.map((account) => ({ value: account.id, label: account.name, detail: `${account.currency} · ${account.institution || account.type}` }))];
  const searchableAccounts: SearchChoiceOption[] = accountOptions.map((option) => ({ id: option.value, label: option.label, detail: option.detail }));
  return <LifeModalBackdrop onClose={onClose}><form className="life-modal compact" role="dialog" aria-modal="true" aria-labelledby="finance-transaction-title" onSubmit={(event) => void submit(event)}>
    <button className="blocker-close" type="button" aria-label="Close" onClick={onClose}><X size={19} /></button>
    <p className="date-label">New transaction</p><h2 id="finance-transaction-title">Add a transaction</h2>
    <ChoiceGroup label="Transaction type" value={direction} options={[{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }]} onChange={setDirection} compact />
    <label><span>Name or merchant</span><input data-auto-focus value={name} onChange={(event) => setName(event.target.value)} required /></label>
    <label><span>Amount</span><input type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required /></label>
    <SearchChoice label="Currency" value={currency} options={currencyOptions} onChange={setCurrency} placeholder="Search currency name or code" />
    {life.snapshot.accounts.length > 0 && (accountOptions.length <= 6
      ? <ChoiceGroup label="Account" value={accountId || "none"} options={accountOptions} onChange={(value) => selectAccount(value === "none" ? "" : value)} compact />
      : <SearchChoice label="Account" value={accountId || "none"} options={searchableAccounts} onChange={(value) => selectAccount(value === "none" ? "" : value)} placeholder="Search account name" />)}
    <ChoiceGroup label="Category" value={categoryChoice} options={[...categoryOptions.map((value) => ({ value, label: value })), { value: "custom", label: "Other" }]} onChange={(value) => setCategory(value === "custom" ? "" : value)} compact />
    {(categoryChoice === "custom" || category === "") && <label><span>Custom category</span><input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Coffee, travel, subscriptions…" required /></label>}
    <MutationError message={mutation.error} />
    <button className="button primary" type="submit" disabled={!name.trim() || !amount || Number(amount) <= 0 || !category.trim() || mutation.submitting}>{mutation.submitting ? "Saving…" : "Save transaction"}</button>
  </form></LifeModalBackdrop>;
}

export function FilesPage({ life }: { life: LifeOSController }) {
  const input = useRef<HTMLInputElement>(null); const [query, setQuery] = useState(""); const [uploading, setUploading] = useState(false); const [deleting, setDeleting] = useState(false); const [pendingDeletion, setPendingDeletion] = useState<VaultFile | null>(null); const [error, setError] = useState("");
  const files = life.snapshot.files.filter((file) => `${file.name} ${file.folder} ${file.tags.join(" ")} ${file.summary}`.toLowerCase().includes(query.toLowerCase()));
  const upload = async (file?: File) => { if (!file) return; setUploading(true); setError(""); try { await life.uploadFile(file, {}); if (input.current) input.current.value = ""; } catch (reason) { setError(reason instanceof Error ? reason.message : "Upload failed."); } finally { setUploading(false); } };
  const download = async (file: VaultFile) => { setError(""); try { const blob = await life.downloadFile(file.id); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.name; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0); } catch (reason) { setError(reason instanceof Error ? reason.message : "Download failed."); } };
  const remove = async () => { if (!pendingDeletion) return; setDeleting(true); setError(""); try { await life.deleteFile(pendingDeletion.id); setPendingDeletion(null); } catch (reason) { setError(reason instanceof Error ? reason.message : "File deletion failed."); } finally { setDeleting(false); } };
  return <div className="page life-page files-page page-enter"><SurfaceHeader eyebrow="Life" title="Files" detail="Keep private documents close to the plans and ideas they support." action={<><input ref={input} type="file" hidden aria-label="Upload file" onChange={(event) => void upload(event.target.files?.[0])} /><button className="button primary desktop-action" type="button" disabled={uploading} onClick={() => input.current?.click()}><CloudArrowUp size={17} /> {uploading ? "Uploading…" : "Upload file"}</button></>} />
    <div className="vault-toolbar"><label><FolderOpen size={18} /><input aria-label="Search files" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search files, folders, or tags" /></label><span>{files.length} files · 25 MB each</span></div>{error && <p className="life-error" role="alert"><Warning size={16} /> {error}</p>}
    {files.length ? <div className="file-grid">{files.map((file) => <article key={file.id}><span className="file-icon"><File size={27} weight="duotone" /></span><div><strong>{file.name}</strong><small>{file.folder || "Vault"} · {fileSize(file.sizeBytes)}</small>{file.summary && <p>{file.summary}</p>}</div><span className="file-actions"><button type="button" aria-label={`Download ${file.name}`} onClick={() => void download(file)}><DownloadSimple size={18} /></button><button type="button" aria-label={`Delete ${file.name}`} onClick={() => setPendingDeletion(file)}><Trash size={17} /></button></span></article>)}</div> : <ModuleEmpty icon={FolderOpen} title={query ? "No matching files" : "The vault is empty"} detail={query ? "Try another name, folder, or tag." : "Upload a plan, receipt, export, document, or anything you need to keep private."} />}
    {pendingDeletion && <LifeModalBackdrop onClose={() => { if (!deleting) setPendingDeletion(null); }}><section className="life-modal compact destructive-confirm" role="alertdialog" aria-modal="true" aria-labelledby="delete-file-title" aria-describedby="delete-file-detail"><button className="blocker-close" type="button" aria-label="Close" disabled={deleting} onClick={() => setPendingDeletion(null)}><X size={19} /></button><p className="date-label">Remove from Files</p><h2 id="delete-file-title">Delete {pendingDeletion.name}?</h2><p id="delete-file-detail">This permanently removes the file from Remember. This cannot be undone.</p><div className="confirm-actions"><button className="button secondary" type="button" disabled={deleting} onClick={() => setPendingDeletion(null)}>Keep file</button><button className="button danger" type="button" disabled={deleting} onClick={() => void remove()}>{deleting ? "Deleting…" : "Delete file"}</button></div></section></LifeModalBackdrop>}
  </div>;
}

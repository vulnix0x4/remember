import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Article,
  BookOpen,
  Books,
  CaretDown,
  CaretRight,
  ChatCircleDots,
  Check,
  Clock,
  Cloud,
  Database,
  DownloadSimple,
  GearSix,
  Headphones,
  House,
  LinkSimple,
  ListChecks,
  LockKey,
  MagnifyingGlass,
  Moon,
  PaperPlaneRight,
  Path,
  Play,
  Plus,
  Quotes,
  ShieldCheck,
  SquaresFour,
  Sun,
  Warning,
  WifiSlash,
  X,
  YoutubeLogo,
} from "@phosphor-icons/react";
import { imprints as fixtureImprints, suggestedQuestions } from "./fixtures";
import { AskAPIError, apiConfig, askLibrary, downloadLibraryExport, getApiToken, loadEvolution, loadImprint, loadImprints, loadResurfacedMemory, loadSession, login, logout, rateContextualReturn, reflectOnMemory, retryImprint, saveImprint, searchImprints, setApiToken, updatePrinciple, type AppSession, type EvolutionOverview, type MemoryReflectionResponse, type ResurfacedMemory } from "./services/api";
import { exportImprintsJson, exportImprintsMarkdown } from "./services/export";
import { mergeMemoryFeedback, readMemoryFeedback } from "./services/memoryFeedback";
import { canReturnImprint, latestByItem } from "./product/returnEligibility";
import type { AskMessage, Imprint, Page, PrimaryPage, ReturnCue } from "./types";
import { LifeOverview } from "./life/LifeOverview";
import { EverydayAutopilot } from "./components/EverydayAutopilot";
import type { LifeTask } from "./life/types";
import { useLifeOS, type LifeOSController } from "./life/useLifeOS";
import { CarryForwardSection } from "./components/CarryForwardSection";
import { AskOutcomeActions } from "./components/AskOutcomeActions";
import { LivingThreadsSection } from "./components/LivingThreadsSection";
import { PersonalCompassSection } from "./components/PersonalCompassSection";
import { WeeklySynthesisCard } from "./components/WeeklySynthesisCard";
import { DecisionWorkspace } from "./components/DecisionWorkspace";
import { BringBackSection } from "./components/BringBackSection";
import { ReturnCuePicker } from "./components/ReturnCuePicker";
import { buildLivingThreads } from "./product/livingThreads";
import { contextualReturnLabel, findContextualReturn, type ContextualReturn } from "./product/contextualReturn";
import { buildWeeklySynthesis } from "./product/weeklySynthesis";
import { findReturnForMoment, scheduleReturnDay, returnCueChoices, returnCueLabel, returnCueQuestion, returnCueReason } from "./product/returnCues";

const TasksPage = lazy(() => import("./life/LifeOS").then((module) => ({ default: module.TasksPage })));
const CalendarPage = lazy(() => import("./life/LifeOS").then((module) => ({ default: module.CalendarPage })));
const GoalsPage = lazy(() => import("./life/LifeOS").then((module) => ({ default: module.GoalsPage })));
const HealthPage = lazy(() => import("./life/LifeOS").then((module) => ({ default: module.HealthPage })));
const MoneyPage = lazy(() => import("./life/LifeOS").then((module) => ({ default: module.MoneyPage })));
const FilesPage = lazy(() => import("./life/LifeOS").then((module) => ({ default: module.FilesPage })));

const navItems: { page: PrimaryPage; label: string; icon: typeof House }[] = [
  { page: "home", label: "Today", icon: House },
  { page: "plan", label: "Plan", icon: ListChecks },
  { page: "library", label: "Library", icon: Books },
  { page: "ask", label: "Ask", icon: ChatCircleDots },
  { page: "you", label: "Life", icon: SquaresFour },
];

const mobileNavItems = navItems;

const pageTitles: Record<Page, string> = {
  home: "Today",
  plan: "Plan",
  tasks: "Tasks",
  goals: "Goals",
  calendar: "Calendar",
  health: "Health",
  money: "Money",
  files: "Files",
  library: "Your library",
  ask: "Ask",
  evolution: "Patterns",
  you: "Life",
  settings: "Settings",
};

const validPages = new Set<Page>([
  "home", "plan", "tasks", "goals", "calendar", "library", "ask", "evolution", "you", "health", "money", "files", "settings",
]);

type AppRoute = { page: Page; detailId: string | null };
type ThemePreference = "system" | "light" | "dark";

function preferredSystemTheme(): "light" | "dark" {
  return window.matchMedia?.("(prefers-color-scheme: light)")?.matches ? "light" : "dark";
}

function routeFromHash(hash = window.location.hash): AppRoute {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  if (parts[0] === "patterns") return { page: "evolution", detailId: null };
  if ((parts[0] === "item" && parts[1]) || (parts[0] === "library" && parts[1] === "item" && parts[2])) {
    return { page: "library", detailId: parts[0] === "item" ? parts[1] : parts[2] };
  }
  return { page: validPages.has(parts[0] as Page) ? parts[0] as Page : "home", detailId: null };
}

function primaryForPage(page: Page): PrimaryPage | null {
  if (page === "settings") return null;
  if (page === "plan" || page === "tasks" || page === "goals" || page === "calendar") return "plan";
  if (page === "library" || page === "evolution") return "library";
  if (page === "you" || page === "health" || page === "money" || page === "files") return "you";
  return page;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function todayLabel() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

function sourceIcon(type: Imprint["sourceType"]) {
  if (type === "YouTube") return YoutubeLogo;
  if (type === "Podcast") return Headphones;
  if (type === "Thought") return Quotes;
  return Article;
}

function isXSource(imprint: Imprint) {
  try { return ["x.com", "twitter.com"].includes(new URL(imprint.url).hostname.replace(/^www\./, "")); } catch { return false; }
}

function isTikTokSource(imprint: Imprint) {
  try {
    const host = new URL(imprint.url).hostname.replace(/^www\./, "");
    return host === "tiktok.com" || host.endsWith(".tiktok.com");
  } catch { return false; }
}

function isVideoSource(imprint: Imprint) {
  return imprint.sourceType === "YouTube" || isTikTokSource(imprint) || (isXSource(imprint) && Boolean(imprint.thumbnailUrl));
}

function sourceLabel(imprint: Imprint) {
  if (isTikTokSource(imprint)) return "TikTok";
  if (isXSource(imprint)) return isVideoSource(imprint) ? "X video" : "X post";
  return imprint.sourceType;
}

function analysisScopeLabel(imprint: Imprint) {
  if (imprint.analysisScope === "thought") return "Your thought reflected";
  if (imprint.analysisScope === "caption") return "Caption analyzed";
  if (imprint.analysisScope === "post") return "Post text analyzed";
  if (imprint.analysisScope === "article") return "Article analyzed";
  if (imprint.analysisScope === "transcript") return "Transcript analyzed";
  return null;
}

function secondsUrl(imprint: Imprint, seconds?: number) {
  if (!seconds || imprint.sourceType !== "YouTube") return imprint.url;
  const delimiter = imprint.url.includes("?") ? "&" : "?";
  return `${imprint.url}${delimiter}t=${seconds}s`;
}

function previewCopy(value: string, maxLength = 176) {
  if (value.length <= maxLength) return value;
  const boundary = value.lastIndexOf(" ", maxLength);
  const end = boundary > maxLength * 0.72 ? boundary : maxLength;
  return `${value.slice(0, end).replace(/[\s,;:–—-]+$/u, "")}…`;
}

function AppMark() {
  return <span className="brand-mark" aria-hidden="true"><span /></span>;
}

function LoginPage({ onAuthenticated }: { onAuthenticated: (session: AppSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      onAuthenticated(await login(email, password));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign in failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main className="login-shell">
      <section className="login-story" aria-label="About Remember">
        <button className="brand login-brand" type="button" aria-label="Remember"><AppMark /><span>Remember</span></button>
        <div className="login-story-copy">
          <p className="login-eyebrow">Private by design</p>
          <h1>Keep what matters.</h1>
          <p>Save useful ideas, plan your day, and keep the details of your life in one private place.</p>
        </div>
        <p className="login-trust"><ShieldCheck size={17} /> Private by design. Your sources remain yours.</p>
      </section>
      <section className="login-panel">
        <form className="login-card page-enter" onSubmit={submit}>
          <span className="login-lock"><LockKey size={22} weight="duotone" /></span>
          <div><p className="login-kicker">Welcome back</p><h2>Enter Remember</h2><p className="login-intro">Sign in to continue to your private space.</p></div>
          <label htmlFor="login-email"><span>Email</span><input id="login-email" type="email" value={email} autoComplete="username" required onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="you@example.com" /></label>
          <label htmlFor="login-password"><span>Password</span><input id="login-password" type="password" value={password} autoComplete="current-password" required onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="Your password" /></label>
          {error && <p className="login-error" role="alert"><Warning size={16} /> {error}</p>}
          <button className="button primary login-submit" type="submit" disabled={submitting || !email || !password}>{submitting ? <><span className="login-spinner" /> Opening your space…</> : <>Continue <ArrowRight size={17} /></>}</button>
          <p className="login-footnote"><LockKey size={13} /> Secure, private session · 7 days</p>
        </form>
      </section>
    </main>
  );
}

function AuthLoading() {
  return <main className="auth-loading" aria-live="polite"><AppMark /><span className="login-spinner" /><p>Opening Remember…</p></main>;
}

function IconButton({ label, children, onClick, className }: { label: string; children: ReactNode; onClick?: () => void; className?: string }) {
  return <button className={cx("icon-button", className)} type="button" aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

function EmptyState({ query }: { query?: string }) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-icon"><MagnifyingGlass size={24} /></span>
      <h2>{query ? "Nothing found" : "Nothing saved yet"}</h2>
      <p>{query ? `No saved items match “${query}”. Try a theme, creator, or idea.` : "Save a link you want to keep. It will appear here."}</p>
    </div>
  );
}

function ProcessingLine({ label = "Analyzing" }: { label?: string }) {
  return (
    <div className="processing-line" role="status" aria-live="polite">
      <span className="processing-pulse" />
      <span>{label}</span>
      <span className="processing-shimmer" aria-hidden="true" />
    </div>
  );
}

function FeatureLoading({ label, heading }: { label: string; heading?: string }) {
  return <div className="feature-loading" role="status" aria-live="polite">{heading && <h1 className="sr-only">{heading}</h1>}<span className="login-spinner" /><span>{label}</span></div>;
}

function StatusBadge({ status }: { status: Imprint["status"] }) {
  if (status === "ready") return null;
  const labels = { processing: "Analyzing", partial: "Some details available", failed: "Couldn’t analyze" };
  return <span className={cx("status-badge", status)}>{status === "failed" ? <Warning size={13} /> : <span className="status-dot" />}{labels[status]}</span>;
}

function AnalysisScopeBadge({ imprint }: { imprint: Imprint }) {
  const label = imprint.status === "ready" ? analysisScopeLabel(imprint) : null;
  return label ? <span className="scope-badge"><ShieldCheck size={12} /> {label}</span> : null;
}

function ImprintArtwork({ imprint, large = false }: { imprint: Imprint; large?: boolean }) {
  const SourceIcon = isVideoSource(imprint) ? Play : sourceIcon(imprint.sourceType);
  return (
    <div className={cx("imprint-art", `tone-${imprint.color}`, large && "large", imprint.thumbnailUrl && "has-source-image")} aria-hidden="true">
      {imprint.thumbnailUrl && <img src={imprint.thumbnailUrl} alt="" loading={large ? "eager" : "lazy"} decoding="async" />}
      <span className="art-source-mark"><SourceIcon size={large ? 31 : 23} weight="fill" /></span>
    </div>
  );
}

function ImprintRow({ imprint, onOpen }: { imprint: Imprint; onOpen: (id: string) => void }) {
  return (
    <button className="imprint-row" type="button" onClick={() => onOpen(imprint.id)}>
      <ImprintArtwork imprint={imprint} />
      <span className="imprint-copy">
        <span className="imprint-meta"><span>{sourceLabel(imprint)}</span><span>{imprint.savedAt}</span><StatusBadge status={imprint.status} /><AnalysisScopeBadge imprint={imprint} />{imprint.syncState === "local" && <span className="scope-badge local"><Cloud size={12} /> Waiting to sync</span>}</span>
        <strong>{imprint.title}</strong>
        <span className="imprint-essence">{imprint.essence}</span>
        <span className="theme-list">{imprint.themes.slice(0, 3).map((theme) => <span key={theme}>{theme}</span>)}</span>
      </span>
      <CaretRight className="row-arrow" size={19} aria-hidden="true" />
    </button>
  );
}

const reflectionChoices: Array<{ value: MemoryReflectionResponse; label: string }> = [
  { value: "still_true", label: "Still true" },
  { value: "changed_mind", label: "I see it differently" },
  { value: "not_sure", label: "Not sure yet" },
  { value: "no_longer_relevant", label: "Let it go" },
];

const reflectionInsights: Record<MemoryReflectionResponse, { title: string; body: string }> = {
  still_true: { title: "Kept as part of your compass.", body: "Remember will treat this as something that still feels true now." },
  changed_mind: { title: "Your change of mind is part of the story.", body: "Remember will use this as evidence of how your thinking has evolved." },
  not_sure: { title: "Left open without forcing an answer.", body: "Remember will hold this lightly until new context can help." },
  no_longer_relevant: { title: "Released from your current guidance.", body: "Remember will stop bringing this back as something you should follow." },
};

function MemoryCheckIn({ imprint, onSeeCompass, onRecorded }: { imprint: Imprint; onSeeCompass: () => void; onRecorded?: (response: MemoryReflectionResponse) => void }) {
  const [reflection, setReflection] = useState<MemoryReflectionResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const choose = async (choice: MemoryReflectionResponse) => {
    setSubmitting(true);
    setFailed(false);
    const recorded = await reflectOnMemory(imprint.id, choice);
    if (!mounted.current) return;
    setSubmitting(false);
    if (recorded) { setReflection(choice); onRecorded?.(choice); }
    else setFailed(true);
  };
  if (reflection) {
    const insight = reflectionInsights[reflection];
    return <div className="memory-check-in complete" role="status">
      <span className="memory-check-icon"><Check size={17} weight="bold" /></span>
      <span><strong>{insight.title}</strong><small>{insight.body}</small></span>
      <button className="text-button" type="button" onClick={onSeeCompass}>See how I’m changing <ArrowRight size={15} /></button>
    </div>;
  }
  return <div className="memory-check-in">
    <div><strong>Where does this land now?</strong><small>Your answer teaches Remember what belongs in your life today.</small></div>
    <div className="memory-check-choices" role="group" aria-label="Where does this memory land now?">
      {reflectionChoices.map((choice) => <button type="button" key={choice.value} disabled={submitting} onClick={() => void choose(choice.value)}>{choice.label}</button>)}
    </div>
    {failed && <p className="login-error" role="alert"><Warning size={15} /> That answer was not saved. Please try again.</p>}
  </div>;
}

function ResurfacedFeature({ imprint, onOpen, onSeeCompass, onReflected }: { imprint: Imprint; onOpen: (id: string) => void; onSeeCompass: () => void; onReflected: (response: MemoryReflectionResponse) => void }) {
  const essencePreview = previewCopy(imprint.essence);
  const copyScale = imprint.essence.length > 150 ? "copy-long" : imprint.essence.length > 90 ? "copy-medium" : undefined;
  return (
    <section className={cx("resurface-feature", copyScale)} aria-labelledby="resurface-title">
      <div className="resurface-art"><ImprintArtwork imprint={imprint} large /></div>
      <div className="resurface-content">
        <div className="section-kicker">Saved {imprint.savedAt}</div>
        <h2 id="resurface-title" title={essencePreview === imprint.essence ? undefined : imprint.essence}>{essencePreview}</h2>
        <p>{imprint.hypothesis}</p>
        <div className="source-inline">{isVideoSource(imprint) ? <Play size={16} weight="fill" /> : <Article size={16} weight="fill" />}<span>{imprint.title}</span>{imprint.duration && <span>{imprint.duration}</span>}</div>
        <MemoryCheckIn key={imprint.id} imprint={imprint} onSeeCompass={onSeeCompass} onRecorded={onReflected} />
        <button className="text-button" type="button" onClick={() => onOpen(imprint.id)}>Open saved item <ArrowRight size={16} /></button>
      </div>
    </section>
  );
}

function ContextualReturnFeature({ match, life, onOpen, onOpenPlan, onExplore, onNotToday, onSeeCompass, onReflected }: { match: ContextualReturn; life: LifeOSController; onOpen: (id: string) => void; onOpenPlan: () => void; onExplore: (question: string) => void; onNotToday: () => void; onSeeCompass: () => void; onReflected: (response: MemoryReflectionResponse) => void }) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");
  const [dismissing, setDismissing] = useState(false);
  const [reflected, setReflected] = useState(false);
  const addAction = async () => {
    if (!match.suggestedAction || adding) return;
    if (added) { onOpenPlan(); return; }
    setAdding(true);
    setError("");
    try {
      await life.createTask({
        title: match.suggestedAction.title,
        firstStep: match.suggestedAction.firstStep,
        notes: `Returned for “${match.contextTitle}” from “${match.imprint.title}”.\n${match.imprint.url}`,
        area: match.contextArea,
        durationMinutes: match.suggestedAction.durationMinutes,
        priority: "normal",
        energy: "any",
        status: "queued",
        source: "practice",
        sourceItemId: match.imprint.id,
      });
      setAdded(true);
      void rateContextualReturn(match.imprint.id, "useful");
    } catch {
      setError("That action was not added. Please try again.");
    } finally {
      setAdding(false);
    }
  };
  const notToday = async () => {
    setDismissing(true); setError("");
    const recorded = await rateContextualReturn(match.imprint.id, "not_today");
    setDismissing(false);
    if (recorded) onNotToday();
    else setError("That preference was not saved. Please try again.");
  };
  return <section className="contextual-return" aria-labelledby="contextual-return-title">
    <div className="contextual-return-context">
      <span>For your {contextualReturnLabel(match.contextKind)}</span>
      <strong>{match.contextTitle}</strong>
      {match.contextDetail && <small>{match.contextDetail}</small>}
    </div>
    <div className="contextual-return-memory">
      <span>{match.livedResult === "helped" ? "Helped you before" : match.livedResult === "mixed" ? "Worth another try" : "This may be useful now"}</span>
      <h2 id="contextual-return-title">{match.imprint.essence}</h2>
      <p>{match.reason}</p>
      <div className="source-inline"><BookOpen size={16} /><span>{match.imprint.title}</span></div>
      {!reflected && <>{match.suggestedAction && <div className="contextual-return-action">
        <span>One move for today</span>
        <strong>{match.suggestedAction.title}</strong>
        <small>{match.suggestedAction.durationMinutes} minutes, carried into Plan with its source</small>
      </div>}
      <div className="contextual-return-actions">
        {match.suggestedAction
          ? <button className="button primary" type="button" disabled={adding} onClick={() => void addAction()}>{added ? <Check size={17} weight="bold" /> : <Plus size={17} weight="bold" />} {adding ? "Adding…" : added ? "Added to Plan" : "Try this today"}</button>
          : <button className="button primary" type="button" onClick={() => onOpen(match.imprint.id)}>Open saved item <ArrowRight size={16} /></button>}
        <button className="button secondary" type="button" onClick={() => onExplore(match.question)}><ChatCircleDots size={17} /> Ask about this</button>
      </div>
      <div className="contextual-return-links">{match.suggestedAction && <button className="text-button" type="button" onClick={() => onOpen(match.imprint.id)}>Open saved item</button>}<button className="text-button muted" type="button" disabled={dismissing || adding} onClick={() => void notToday()}>{dismissing ? "Saving…" : "Not for today"}</button></div></>}
      {error && <p className="field-error" role="alert"><Warning size={15} /> {error}</p>}
      <MemoryCheckIn key={match.imprint.id} imprint={match.imprint} onSeeCompass={onSeeCompass} onRecorded={(response) => { setReflected(true); onReflected(response); }} />
    </div>
  </section>;
}

function IntentionalReturnFeature({ imprint, cue, onOpen, onExplore, onSeeCompass, onReflected }: { imprint: Imprint; cue: ReturnCue; onOpen: (id: string) => void; onExplore: (question: string) => void; onSeeCompass: () => void; onReflected: (response: MemoryReflectionResponse) => void }) {
  return <section className="intentional-return" aria-labelledby="intentional-return-title">
    <div className="intentional-return-kicker">You asked Remember to keep this for</div>
    <h2 id="intentional-return-title">{returnCueLabel(cue)}</h2>
    <p className="intentional-return-idea">{imprint.essence}</p>
    <p>{returnCueReason(cue)}</p>
    <div className="source-inline"><BookOpen size={16} /><span>{imprint.title}</span></div>
    <MemoryCheckIn key={imprint.id} imprint={imprint} onSeeCompass={onSeeCompass} onRecorded={onReflected} />
    <div className="contextual-return-actions">
      <button className="button primary" type="button" onClick={() => onOpen(imprint.id)}>Open saved item <ArrowRight size={16} /></button>
      <button className="button secondary" type="button" onClick={() => onExplore(returnCueQuestion(imprint, cue))}><ChatCircleDots size={17} /> Work with this in Ask</button>
    </div>
  </section>;
}

function ReturnMomentStrip({ selected, onSelect }: { selected: ReturnCue | null; onSelect: (cue: ReturnCue | null) => void }) {
  return <section className="return-moment-strip" aria-labelledby="return-moment-title">
    <div><h2 id="return-moment-title">What would help right now?</h2><p>Ask your own saved ideas for the right kind of support.</p></div>
    <div role="group" aria-label="Choose what would help right now">
      {returnCueChoices.filter((choice) => choice.value !== "date").map((choice) => <button className={selected === choice.value ? "active" : ""} type="button" key={choice.value} aria-pressed={selected === choice.value} onClick={() => onSelect(selected === choice.value ? null : choice.value)}>{choice.shortLabel}</button>)}
    </div>
  </section>;
}

type HomeReturn = { kind: "intentional"; imprint: Imprint; cue: ReturnCue }
  | { kind: "contextual"; imprint: Imprint; match: ContextualReturn }
  | { kind: "resurfaced"; imprint: Imprint };

function HomePage({ imprints, resurfaced, onOpen, onNavigate, life, libraryLoading }: { imprints: Imprint[]; resurfaced: ResurfacedMemory | null; onOpen: (id: string) => void; onNavigate: (p: Page) => void; life: LifeOSController; libraryLoading: boolean }) {
  const [selectedNeed, setSelectedNeed] = useState<ReturnCue | null>(null);
  const [contextOverview, setContextOverview] = useState<EvolutionOverview | null>(null);
  const [dismissedContextualItems, setDismissedContextualItems] = useState<Set<string>>(() => new Set());
  const [localHistory, setLocalHistory] = useState(() => readMemoryFeedback(apiConfig.baseUrl));
  const [completedReturn, setCompletedReturn] = useState<HomeReturn | null>(null);
  const [completedItems, setCompletedItems] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const controller = new AbortController();
    loadEvolution(controller.signal).then((overview) => {
      setContextOverview(overview);
      setLocalHistory(readMemoryFeedback(apiConfig.baseUrl));
    }).catch(() => undefined);
    return () => controller.abort();
  }, []);
  const localRecentQuestion = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem(ASK_RECENT_QUESTION_STORAGE_KEY) ?? "null") as EvolutionOverview["recentQuestion"]; }
    catch { return null; }
  }, []);
  const returnHistory = useMemo(() => {
    const practiceResults = latestByItem(life.snapshot.tasks.flatMap((task) => task.source === "practice" && task.sourceItemId && task.practiceOutcome
      ? [{ itemId: task.sourceItemId, outcome: task.practiceOutcome, occurredAt: task.reflectedAt ?? task.updatedAt }] : []));
    const rejected = [...practiceResults.values()].filter((result) => result.outcome === "not_for_me").map((result) => result.itemId);
    return { ...mergeMemoryFeedback(localHistory, contextOverview), excludingItemIds: new Set([...dismissedContextualItems, ...completedItems, ...rejected]) };
  }, [contextOverview, dismissedContextualItems, completedItems, life.snapshot.tasks, localHistory]);
  const surfaced = resurfaced ? imprints.find((item) => item.id === resurfaced.itemId && canReturnImprint(item, returnHistory)) : undefined;
  const rightNow = useMemo(() => findContextualReturn(imprints, life.snapshot, {
    ...returnHistory,
    recentQuestion: contextOverview?.recentQuestion ?? localRecentQuestion,
  }), [contextOverview, returnHistory, imprints, life.snapshot, localRecentQuestion]);
  const dueReturn = useMemo(() => findReturnForMoment(imprints, "date", new Date(), returnHistory), [imprints, returnHistory]);
  const requestedReturn = useMemo(() => selectedNeed ? findReturnForMoment(imprints, selectedNeed, new Date(), returnHistory) : null, [imprints, selectedNeed, returnHistory]);
  const weeklySynthesis = useMemo(() => buildWeeklySynthesis(imprints, life.snapshot), [imprints, life.snapshot]);
  const activeReturn: HomeReturn | null = completedReturn ?? (selectedNeed
    ? requestedReturn ? { kind: "intentional", imprint: requestedReturn, cue: selectedNeed } : null
    : dueReturn ? { kind: "intentional", imprint: dueReturn, cue: "date" }
    : rightNow ? { kind: "contextual", imprint: rightNow.imprint, match: rightNow }
    : surfaced ? { kind: "resurfaced", imprint: surfaced } : null);
  const featured = activeReturn?.imprint;
  const onReflected = () => {
    if (!activeReturn) return;
    setCompletedReturn(activeReturn);
    setCompletedItems((current) => new Set([...current, activeReturn.imprint.id]));
    setLocalHistory(readMemoryFeedback(apiConfig.baseUrl));
  };
  const recent = imprints.filter((item) => item.id !== featured?.id).slice(0, 3);
  const carryWeeklyForward = async (task: LifeTask, revision: { title: string; firstStep: string }) => {
    await life.createTask({
      title: revision.title,
      firstStep: revision.firstStep,
      notes: task.notes,
      area: task.area,
      durationMinutes: task.durationMinutes,
      priority: task.priority,
      energy: task.energy,
      status: "queued",
      source: "practice",
      sourceItemId: task.sourceItemId ?? null,
    });
    onNavigate("tasks");
  };
  return (
    <div className="page home-page page-enter">
      <header className="page-heading home-heading">
        <div><p className="date-label">{todayLabel()}</p><h1>Today</h1><p>{requestedReturn ? "Something you deliberately kept is here for this moment." : dueReturn ? "An idea you chose for today is ready." : rightNow ? "One thing you saved connects to what you are doing now." : surfaced ? "An older idea is ready to revisit." : "Your next actions and recent saves, in one place."}</p></div>
      </header>
      <LifeOverview life={life} onNavigate={onNavigate} />
      <EverydayAutopilot life={life} onOpenPlan={() => onNavigate("tasks")} />
      <ReturnMomentStrip selected={selectedNeed} onSelect={(cue) => { setSelectedNeed(cue); setCompletedReturn(null); setCompletedItems(new Set()); setLocalHistory(readMemoryFeedback(apiConfig.baseUrl)); }} />
      {libraryLoading && imprints.length === 0 ? <FeatureLoading label="Loading your saved items…" />
        : activeReturn?.kind === "intentional" ? <IntentionalReturnFeature key={`intentional:${activeReturn.cue}:${activeReturn.imprint.id}`} imprint={activeReturn.imprint} cue={activeReturn.cue} onOpen={onOpen} onExplore={(question) => { sessionStorage.setItem(ASK_SEED_STORAGE_KEY, question); onNavigate("ask"); }} onSeeCompass={() => onNavigate("evolution")} onReflected={onReflected} />
        : selectedNeed ? <div className="return-cue-empty" role="status"><Clock size={20} /><span><strong>No idea is waiting for this moment yet</strong><small>Open any saved item and choose “{returnCueLabel(selectedNeed)}.”</small></span></div>
        : activeReturn?.kind === "contextual" ? <ContextualReturnFeature key={`contextual:${activeReturn.imprint.id}`} match={activeReturn.match} life={life} onOpen={onOpen} onOpenPlan={() => onNavigate("tasks")} onExplore={(question) => { sessionStorage.setItem(ASK_SEED_STORAGE_KEY, question); onNavigate("ask"); }} onNotToday={() => { setDismissedContextualItems((current) => new Set([...current, activeReturn.imprint.id])); setLocalHistory(readMemoryFeedback(apiConfig.baseUrl)); }} onSeeCompass={() => onNavigate("evolution")} onReflected={onReflected} />
        : activeReturn?.kind === "resurfaced" ? <ResurfacedFeature key={`resurfaced:${activeReturn.imprint.id}`} imprint={activeReturn.imprint} onOpen={onOpen} onSeeCompass={() => onNavigate("evolution")} onReflected={onReflected} />
        : weeklySynthesis ? null : imprints.length === 0 ? <EmptyState /> : <div className="partial-state" role="status"><Clock size={20} /><span><strong>Nothing to return right now</strong><small>Remember will bring something back when it connects to your current direction or has had time to settle.</small></span></div>}
      {completedReturn && <button className="button secondary" type="button" onClick={() => setCompletedReturn(null)}><Check size={17} /> Done with this return</button>}
      {weeklySynthesis && <WeeklySynthesisCard synthesis={weeklySynthesis} onCarryForward={carryWeeklyForward} onOpen={onOpen} />}
      {!libraryLoading && recent.length > 0 && <section className="recent-section" aria-labelledby="recent-title">
        <div className="section-heading-row"><div><h2 id="recent-title">Recently saved</h2><p>Your latest saved items.</p></div><button className="text-button" type="button" onClick={() => onNavigate("library")}>View library <ArrowRight size={16} /></button></div>
        <div className="recent-list">{recent.map((item) => <ImprintRow key={item.id} imprint={item} onOpen={onOpen} />)}</div>
      </section>}
    </div>
  );
}

function LibraryPage({ imprints, onOpen, loading }: { imprints: Imprint[]; onOpen: (id: string) => void; loading: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState<"Newest" | "Oldest">("Newest");
  const [searchResults, setSearchResults] = useState<Imprint[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchRequest = useRef(0);
  const filters = ["All", "Thoughts", "Videos", "Articles", "Analyzing", "Couldn’t analyze"];
  useEffect(() => {
    const request = ++searchRequest.current;
    if (!query.trim()) { setSearchResults(null); setSearching(false); setSearchError(""); return; }
    const controller = new AbortController();
    setSearching(true);
    setSearchError("");
    const timeout = window.setTimeout(() => {
      searchImprints(query, imprints, controller.signal).then(({ items }) => {
        if (searchRequest.current === request) setSearchResults(items);
      }).catch((error) => {
        if (searchRequest.current === request && !(error instanceof DOMException && error.name === "AbortError")) setSearchError("Search is unavailable right now. Your library is still here.");
      }).finally(() => { if (searchRequest.current === request) setSearching(false); });
    }, 280);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [imprints, query]);
  const visible = useMemo(() => {
    let items = searchResults ?? (query.trim() ? [] : imprints);
    if (filter === "Thoughts") items = items.filter((item) => item.sourceType === "Thought");
    if (filter === "Videos") items = items.filter(isVideoSource);
    if (filter === "Articles") items = items.filter((item) => !isVideoSource(item) && item.sourceType !== "Podcast" && item.sourceType !== "Thought");
    if (filter === "Analyzing") items = items.filter((item) => item.status === "processing");
    if (filter === "Couldn’t analyze") items = items.filter((item) => item.status === "partial" || item.status === "failed");
    return sort === "Newest" ? items : [...items].reverse();
  }, [filter, imprints, query, searchResults, sort]);
  return (
    <div className="page page-enter">
      <header className="page-heading library-heading">
        <div><h1>Your library</h1><p>{imprints.length} saved item{imprints.length === 1 ? "" : "s"}.</p></div>
      </header>
      {loading && imprints.length === 0 ? <FeatureLoading label="Loading your saved items…" /> : <>
      <div className="library-tools">
        <label className="search-field"><span className="sr-only">Search your library</span><MagnifyingGlass size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by idea, theme, or source" /></label>
        <div className="sort-segmented" role="group" aria-label="Sort library">
          <button type="button" aria-pressed={sort === "Newest"} onClick={() => setSort("Newest")}>Newest</button>
          <button type="button" aria-pressed={sort === "Oldest"} onClick={() => setSort("Oldest")}>Oldest</button>
        </div>
      </div>
      {searchError && <p className="life-error" role="alert"><Warning size={16} /> {searchError}</p>}
      <div className="filter-strip" role="group" aria-label="Filter library">{filters.map((item) => <button className={cx(filter === item && "active")} type="button" key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div>
      <div className="library-summary"><span>{searching ? "Searching…" : `${visible.length} saved item${visible.length === 1 ? "" : "s"}`}</span><span>{sort} first</span></div>
      {visible.length ? <div className="library-grid">{visible.map((item) => <ImprintRow key={item.id} imprint={item} onOpen={onOpen} />)}</div> : <EmptyState query={query || (filter !== "All" ? filter : undefined)} />}
      </>}
    </div>
  );
}

function DetailPage({ imprint, imprints, life, onBack, onOpen, onOpenPlan, onUpdate }: { imprint: Imprint; imprints: Imprint[]; life: LifeOSController; onBack: () => void; onOpen: (id: string) => void; onOpenPlan: () => void; onUpdate: (item: Imprint) => void }) {
  const analysisNoteId = useId();
  const [principleStatus, setPrincipleStatus] = useState(imprint.principleStatus);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const related = imprints.filter((item) => imprint.connectionIds.includes(item.id));
  useEffect(() => setPrincipleStatus(imprint.principleStatus), [imprint.principleStatus]);
  const retry = async () => {
    setRetrying(true);
    setActionError("");
    try { onUpdate(await retryImprint(imprint)); }
    catch (error) { setActionError(error instanceof Error ? error.message : "Analysis could not be restarted."); }
    finally { setRetrying(false); }
  };
  const togglePrinciple = async () => {
    if (!imprint.principleId) return;
    const next = principleStatus === "active" ? "candidate" : "active";
    setActionError("");
    try {
      await updatePrinciple(imprint.principleId, next);
      setPrincipleStatus(next);
      onUpdate({ ...imprint, principleStatus: next });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "This principle could not be updated.");
    }
  };
  const momentsEmpty = imprint.status === "processing"
    ? <div className="partial-state"><Clock size={20} /><span><strong>Finding key moments</strong><small>This section updates automatically when analysis finishes.</small></span></div>
    : <div className="partial-state"><Clock size={20} /><span><strong>No timestamped moments</strong><small>{isVideoSource(imprint) ? "No verified timestamps were available for this source." : "Timestamped moments apply to videos with a verified transcript."}</small></span></div>;
  return (
    <div className="page detail-page page-enter">
      <button className="back-button" type="button" onClick={onBack}><ArrowLeft size={18} /> Library</button>
      <header className={cx("detail-hero", imprint.sourceType === "Thought" && "thought-detail-hero")}>
        {imprint.sourceType !== "Thought" && <div className="detail-art"><ImprintArtwork imprint={imprint} large /></div>}
        <div className="detail-title">
          <div className="source-inline"><span>{sourceLabel(imprint)}</span><span>{imprint.savedAt}</span><StatusBadge status={imprint.status} /><AnalysisScopeBadge imprint={imprint} /></div>
          <h1>{imprint.sourceType === "Thought" ? "Your thought" : imprint.title}</h1>
          <p className="creator">{imprint.creator}</p>
          {imprint.sourceType !== "Thought" && <a className="button secondary" href={imprint.url} target="_blank" rel="noreferrer">Open source <ArrowUpRight size={16} /></a>}
        </div>
      </header>
      {imprint.status === "processing" && <ProcessingLine label="Finding moments, themes, and connections" />}
      {imprint.status === "failed" && <div className="partial-state" role="alert"><Warning size={20} /><span><strong>Analysis needs another try</strong><small>{imprint.summary}</small></span><button className="button primary" type="button" disabled={retrying} onClick={() => void retry()}>{retrying ? "Retrying..." : "Try again"}</button></div>}
      {actionError && <p className="login-error" role="alert"><Warning size={15} /> {actionError}</p>}
      <div className="detail-layout">
        <div className="detail-main">
          {imprint.sourceType === "Thought" && imprint.noteText
            ? <section className="thought-original"><span>Your words</span><p>{imprint.noteText}</p></section>
            : <section className="essence-section"><Quotes size={23} weight="fill" /><p>{imprint.essence}</p></section>}
          <section className="content-section">
            <h2>{imprint.sourceType === "Thought" ? "Remember’s reflection" : "What it says"}</h2>
            {imprint.sourceType === "Thought" && <p className="reflection-lead">{imprint.essence}</p>}
            <p>{imprint.summary}</p>
            {imprint.summary.length > 120 && <button className="text-button" type="button" aria-expanded={summaryOpen} aria-controls={analysisNoteId} onClick={() => setSummaryOpen(!summaryOpen)}>{summaryOpen ? "Hide analysis note" : "How this was analyzed"} <CaretDown className={cx(summaryOpen && "rotate")} size={15} /></button>}
            {summaryOpen && <div className="analysis-note" id={analysisNoteId}><ShieldCheck size={18} /> {imprint.sourceType === "Thought" ? "This reflection uses only what you wrote and the memories you chose to keep." : "This summary comes from the source. It does not assume why you saved it."}</div>}
          </section>
          {imprint.keyIdeas.length > 0 && <section className="content-section"><h2>Ideas worth keeping</h2><ol className="idea-list">{imprint.keyIdeas.map((idea, index) => <li key={idea}><span>{String(index + 1).padStart(2, "0")}</span><p>{idea}</p></li>)}</ol></section>}
          {imprint.sourceType !== "Thought" && <section className="content-section"><h2>Key moments</h2>{imprint.moments.length ? <div className="moment-list">{imprint.moments.map((moment) => <a key={moment.time} href={secondsUrl(imprint, moment.seconds)} target="_blank" rel="noreferrer"><span className="moment-time"><Play size={12} weight="fill" /> {moment.time}</span><span><strong>{moment.title}</strong><small>{moment.note}</small></span><ArrowUpRight size={16} /></a>)}</div> : momentsEmpty}</section>}
          <BringBackSection imprint={imprint} onUpdate={onUpdate} />
          <CarryForwardSection imprint={imprint} life={life} onOpenPlan={onOpenPlan} />
          {imprint.principle && <section className="carry-section"><div><span className="section-kicker"><Path size={15} /> A possible principle</span><h2>{imprint.principle}</h2><p>Suggested from this source. Keep it only if it feels true to you.</p></div>{imprint.principleId && <button className={cx("button", principleStatus === "active" ? "secondary success" : "primary")} type="button" onClick={() => void togglePrinciple()}>{principleStatus === "active" ? <><Check size={17} weight="bold" /> Kept</> : "Keep this principle"}</button>}</section>}
          {related.length > 0 && <section className="content-section"><h2>This connects to</h2><div className="connection-list">{related.map((item, index) => <button type="button" key={item.id} onClick={() => onOpen(item.id)}><span className="connection-type">{index === 0 ? "Extends" : "Same theme"}</span><span className="connection-copy"><strong>{item.essence}</strong><small>{item.title}</small></span><CaretRight size={17} /></button>)}</div></section>}
        </div>
        <aside className="detail-aside">
          <section><h2>When you saved this</h2><strong>{imprint.lifePeriod}</strong><span>{imprint.savedAt}</span></section>
          <section><h2>Themes</h2><div className="theme-list large">{imprint.themes.map((theme) => <span key={theme}>{theme}</span>)}</div></section>
          {imprint.hypothesis && <section className="hypothesis"><h2>Why this may have mattered</h2><p>{imprint.hypothesis}</p><span>A possibility, not a fact</span></section>}
          {imprint.uncertainty && <section className="uncertainty"><h2>What is uncertain</h2><p>{imprint.uncertainty}</p></section>}
        </aside>
      </div>
    </div>
  );
}

function answerFor(question: string): AskMessage {
  if (apiConfig.baseUrl) return {
    id: crypto.randomUUID(), role: "assistant",
    text: "I couldn’t reach your library just now. Nothing was inferred or filled in with demo content. Please try again in a moment.",
    grounded: false,
    limitations: ["Your saved sources could not be reached."],
  };
  const lower = question.toLowerCase();
  if (lower.includes("contradict") || lower.includes("disagree")) return {
    id: crypto.randomUUID(), role: "assistant",
    text: "Two instincts sit in tension across your library. Some saves ask you to accept uncertainty and stop forcing an answer. Others frame discipline as keeping a chosen future visible. Together, they suggest that you value deliberate action, but not action used to escape discomfort.",
    grounded: true,
    limitations: ["Preview answer generated from local development fixtures."],
    citations: [{ imprintId: "uncertainty", label: "How to live with uncertainty" }, { imprintId: "discipline", label: "Discipline is remembering what you want", seconds: 312 }]
  };
  if (lower.includes("success")) return {
    id: crypto.randomUUID(), role: "assistant",
    text: "Based only on what you have saved, success seems less connected to recognition and more connected to independence, meaningful work, and becoming someone you respect. This is a tentative pattern, not a fact about you.",
    grounded: true,
    limitations: ["Preview answer generated from local development fixtures."],
    citations: [{ imprintId: "creative-life", label: "The shape of a creative life" }, { imprintId: "worst-years", label: "Your worst years can shape your best life", seconds: 522 }]
  };
  return {
    id: crypto.randomUUID(), role: "assistant",
    text: "Identity is the clearest recurring theme. Your saves often return to how a person changes through loss, uncertainty, creative work, and letting go. The pattern is not about finding one fixed self. It is about choosing what to carry into the next version.",
    grounded: true,
    limitations: ["Preview answer generated from local development fixtures."],
    citations: [{ imprintId: "worst-years", label: "Your worst years can shape your best life", seconds: 198 }, { imprintId: "letting-go", label: "Letting go without losing what mattered", seconds: 1265 }, { imprintId: "uncertainty", label: "How to live with uncertainty" }]
  };
}

const ASK_MESSAGES_STORAGE_KEY = "remember-ask-session-v2";
const ASK_THREAD_STORAGE_KEY = "remember-ask-thread-v2";
const ASK_SEED_STORAGE_KEY = "remember-ask-seed-v1";
const ASK_RECENT_QUESTION_STORAGE_KEY = "remember-ask-recent-question-v1";
const ASK_MIN_LENGTH = 2;
const ASK_MAX_LENGTH = 1_000;

interface AskFailureState {
  title: string;
  message: string;
  question: string;
}

function clearAskStorage() {
  sessionStorage.removeItem(ASK_MESSAGES_STORAGE_KEY);
  sessionStorage.removeItem(ASK_THREAD_STORAGE_KEY);
}

function askFailureCopy(error: unknown): Pick<AskFailureState, "title" | "message"> {
  if (error instanceof AskAPIError) {
    if (error.status === 401) return { title: "Sign in again", message: "Your session expired. Reload Remember, sign in, and then try this question again." };
    if (error.status === 429) return { title: "Ask needs a moment", message: "There were too many questions at once. Wait a moment, then try again." };
    if (error.code === "timeout") return { title: "That answer took too long", message: "Your question is still here. Try again and Remember will keep using only your saved sources." };
    if (error.code === "network_error") return { title: "Can’t reach your library", message: "Check your connection, then try this question again." };
    if (error.status === 422) return { title: "Check that question", message: error.message };
    return { title: "Couldn’t answer that", message: error.message };
  }
  return { title: "Couldn’t answer that", message: "Your question is still here. Try again in a moment." };
}

function AskPage({ imprints, life, onOpen, onOpenPlan, onUpdate }: { imprints: Imprint[]; life: LifeOSController; onOpen: (id: string) => void; onOpenPlan: () => void; onUpdate: (imprint: Imprint) => void }) {
  const [input, setInput] = useState(() => sessionStorage.getItem(ASK_SEED_STORAGE_KEY) ?? "");
  const [messages, setMessages] = useState<AskMessage[]>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(ASK_MESSAGES_STORAGE_KEY) ?? "[]");
      return Array.isArray(saved) ? saved : [];
    } catch { return []; }
  });
  const [thinking, setThinking] = useState(false);
  const [failure, setFailure] = useState<AskFailureState | null>(null);
  const [validationError, setValidationError] = useState("");
  const [decisionOpen, setDecisionOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const threadIdRef = useRef<string | null>(sessionStorage.getItem(ASK_THREAD_STORAGE_KEY));
  const validationID = useId();
  const searchNoteID = useId();
  useEffect(() => { sessionStorage.removeItem(ASK_SEED_STORAGE_KEY); }, []);
  useEffect(() => {
    if (messages.length) sessionStorage.setItem(ASK_MESSAGES_STORAGE_KEY, JSON.stringify(messages));
    else sessionStorage.removeItem(ASK_MESSAGES_STORAGE_KEY);
  }, [messages]);
  useEffect(() => {
    if (!messages.length && !thinking && !failure) return;
    conversationEndRef.current?.scrollIntoView?.({
      block: "end",
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [failure, messages.length, thinking]);

  const clearThread = () => {
    threadIdRef.current = null;
    sessionStorage.removeItem(ASK_THREAD_STORAGE_KEY);
  };
  const requestAnswer = async (question: string) => {
    const currentThread = threadIdRef.current;
    try {
      return await askLibrary(question, undefined, undefined, undefined, currentThread ?? undefined);
    } catch (error) {
      if (currentThread && error instanceof AskAPIError && error.code === "thread_not_found") {
        clearThread();
        return askLibrary(question);
      }
      throw error;
    }
  };
  const send = async (question: string, appendQuestion = true) => {
    const clean = question.trim();
    if (busyRef.current) return;
    if (clean.length < ASK_MIN_LENGTH) {
      setValidationError("Use at least two characters so Remember has something to search for.");
      inputRef.current?.focus();
      return;
    }
    if (clean.length > ASK_MAX_LENGTH) {
      setValidationError("Keep the question to 1,000 characters or fewer.");
      inputRef.current?.focus();
      return;
    }
    if (appendQuestion) setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: clean }]);
    sessionStorage.setItem(ASK_RECENT_QUESTION_STORAGE_KEY, JSON.stringify({ question: clean, askedAt: new Date().toISOString() }));
    setInput("");
    setValidationError("");
    setFailure(null);
    busyRef.current = true;
    setThinking(true);
    try {
      let answer = await requestAnswer(clean);
      if (!answer) {
        await new Promise((resolve) => window.setTimeout(resolve, 450));
        answer = answerFor(clean);
      }
      if (answer.threadId) {
        threadIdRef.current = answer.threadId;
        sessionStorage.setItem(ASK_THREAD_STORAGE_KEY, answer.threadId);
      }
      setMessages((current) => [...current, answer]);
    } catch (error) {
      setFailure({ ...askFailureCopy(error), question: clean });
    } finally {
      busyRef.current = false;
      setThinking(false);
    }
  };
  const startNewConversation = () => {
    if (busyRef.current) return;
    setMessages([]);
    setFailure(null);
    setValidationError("");
    setInput("");
    setDecisionOpen(false);
    clearAskStorage();
    threadIdRef.current = null;
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void send(input); };
  return (
    <div className="page ask-page page-enter">
      <header className="page-heading"><div><h1>Ask</h1><p>Talk through anything you have saved. Supporting material stays out of the way until you want it.</p></div>{!decisionOpen && <button className="button secondary ask-new-button" type="button" disabled={thinking || (messages.length === 0 && !failure)} onClick={startNewConversation}>New conversation</button>}</header>
      {decisionOpen ? (
        <DecisionWorkspace
          imprints={imprints}
          life={life}
          onBack={() => setDecisionOpen(false)}
          onOpen={onOpen}
          onOpenPlan={onOpenPlan}
          onContinue={(question) => { setDecisionOpen(false); void send(question); }}
        />
      ) : messages.length === 0 ? (
        <div className="ask-start">
          <div className="ask-mark" aria-hidden="true"><ChatCircleDots size={28} /></div>
          <h2>What are you looking for?</h2>
          <p>Ask about an idea, a source, or a pattern in your library.</p>
          <button className="decision-entry" type="button" onClick={() => setDecisionOpen(true)}><span><Path size={22} /><span><strong>Think through a decision</strong><small>See what your own memory says before you choose.</small></span></span><ArrowRight size={18} /></button>
          <div className="question-grid">{suggestedQuestions.map((question) => <button type="button" key={question} onClick={() => void send(question)}><span>{question}</span><ArrowUpRight size={16} /></button>)}</div>
        </div>
      ) : (
        <div className="conversation" aria-live="polite">
          {messages.map((message) => <article className={cx("message", message.role)} key={message.id}>{message.role === "assistant" && <span className="assistant-mark"><AppMark /></span>}<div><p>{message.text}</p>{message.grounded !== undefined && <small className="composer-note"><ShieldCheck size={13} /> {message.grounded ? "From your saves" : "Not enough in your saves yet"}</small>}{message.citations && message.citations.length > 0 && <details className="citations"><summary><BookOpen size={15} /><span>Supporting saves</span><CaretDown size={14} /></summary><div>{message.citations.map((citation) => { const imprint = imprints.find((item) => item.id === citation.imprintId); const content = <>{citation.label}{citation.seconds !== undefined ? <small>{Math.floor(citation.seconds / 60)}:{String(citation.seconds % 60).padStart(2, "0")}</small> : null}</>; return imprint ? <button type="button" key={citation.imprintId} onClick={() => onOpen(citation.imprintId)}>{content}</button> : citation.url ? <a key={citation.imprintId} href={citation.url} target="_blank" rel="noreferrer">{content}<ArrowUpRight size={12} /></a> : null; })}</div></details>}{message.limitations?.slice(0, 1).map((limitation) => <small className="answer-caveat" key={limitation}>{limitation}</small>)}<AskOutcomeActions message={message} imprints={imprints} life={life} onOpenPlan={onOpenPlan} onUpdate={onUpdate} /></div></article>)}
          {thinking && <div className="message assistant"><span className="assistant-mark"><AppMark /></span><div className="thinking"><span /><span /><span /><span className="sr-only">Thinking</span></div></div>}
          {failure && <section className="ask-failure" role="alert"><Warning size={20} /><div><strong>{failure.title}</strong><p>{failure.message}</p><button className="button secondary" type="button" onClick={() => void send(failure.question, false)}>Try again</button></div></section>}
          <div ref={conversationEndRef} aria-hidden="true" />
        </div>
      )}
      {!decisionOpen && <form className="ask-composer" noValidate onSubmit={submit}>
        <label htmlFor="ask-input" className="sr-only">Ask your library</label>
        <textarea ref={inputRef} id="ask-input" value={input} rows={1} minLength={ASK_MIN_LENGTH} maxLength={ASK_MAX_LENGTH} aria-invalid={Boolean(validationError)} aria-describedby={`${searchNoteID}${validationError ? ` ${validationID}` : ""}`} onChange={(event) => { setInput(event.target.value); setValidationError(""); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(input); } }} placeholder="Ask anything about what shaped you" />
        <button type="submit" aria-label="Send question" disabled={!input.trim() || thinking}><PaperPlaneRight size={19} weight="fill" /></button>
        <span className="composer-note" id={searchNoteID}><ShieldCheck size={13} /> Searching your saved items</span>
        {validationError && <span className="ask-validation field-error" id={validationID} role="alert">{validationError}</span>}
      </form>}
    </div>
  );
}

function EvolutionPage({ imprints, life, onOpen, onOpenPlan, onExplore }: { imprints: Imprint[]; life: LifeOSController; onOpen: (id: string) => void; onOpenPlan: () => void; onExplore: (question: string) => void }) {
  const [tab, setTab] = useState<"Compass" | "Threads" | "Takeaways" | "Contrasts" | "History">("Compass");
  const [overview, setOverview] = useState<EvolutionOverview | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    loadEvolution(controller.signal).then((result) => { setOverview(result); setLoadFailed(Boolean(apiConfig.baseUrl && !result)); }).catch((error) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) setLoadFailed(true);
    });
    return () => controller.abort();
  }, []);
  const tabs = ["Compass", "Threads", "Takeaways", "Contrasts", "History"] as const;
  const usesPreviewData = !apiConfig.baseUrl;
  const previewOverview: EvolutionOverview = {
    themes: [],
    principles: [
      { id: "preview-kept", itemId: "creative-life", text: "Protect a small daily window for making before consuming.", status: "active" },
      { id: "preview-candidate", itemId: "worst-years", text: "During a hard period, notice what it is changing instead of treating the whole period as wasted.", status: "candidate" },
    ],
    tensions: [{ id: "preview-tension", fromItemId: "creative-life", toItemId: "uncertainty", explanation: "Protecting your focus and staying open to an unexpected path can both matter. The unresolved question is when each one deserves to lead." }],
    timeline: [],
    reflections: [
      { id: "preview-reflection", itemId: "uncertainty", response: "not_sure", occurredAt: "2026-08-29T12:00:00Z" },
    ],
    returnFeedback: [],
    recentQuestion: null,
  };
  const baseOverview = overview ?? (usesPreviewData ? previewOverview : { themes: [], principles: [], tensions: [], timeline: [], reflections: [], returnFeedback: [], recentQuestion: null });
  const feedback = mergeMemoryFeedback(readMemoryFeedback(apiConfig.baseUrl), baseOverview);
  const knownItemIds = new Set(imprints.map((item) => item.id));
  const effectiveOverview = { ...baseOverview,
    reflections: feedback.reflections.filter((entry) => knownItemIds.has(entry.itemId)),
    returnFeedback: feedback.returnFeedback.filter((entry) => knownItemIds.has(entry.itemId)),
  };
  const threads = useMemo(() => buildLivingThreads(imprints, effectiveOverview.reflections), [imprints, effectiveOverview.reflections]);
  const principles = effectiveOverview.principles.filter((principle) => principle.status !== "dismissed");
  const tension = overview?.tensions[0]?.explanation;
  const timeline = overview ? overview.timeline.map((entry) => ({ month: entry.month, title: entry.theme, themes: `${entry.count} saved item${entry.count === 1 ? "" : "s"}` })) : usesPreviewData ? [{ month: "June 2026", title: "Learning to stay with uncertainty", themes: "Identity, uncertainty, patience" }, { month: "July 2026", title: "Learning to release without erasing", themes: "Relationships, acceptance, grief" }, { month: "August 2026", title: "Rebuilding through meaningful work", themes: "Purpose, building, independence" }] : [];
  const changePrinciple = async (id: string, status: "candidate" | "active" | "dismissed") => {
    if (apiConfig.baseUrl) await updatePrinciple(id, status);
    setOverview((current) => {
      const source = current ?? effectiveOverview;
      return { ...source, principles: source.principles.map((principle) => principle.id === id ? { ...principle, status } : principle) };
    });
  };
  const retryPractice = async (task: LifeTask, revision: { title: string; firstStep: string }) => {
    await life.createTask({
      title: revision.title,
      firstStep: revision.firstStep,
      notes: task.notes,
      area: task.area,
      durationMinutes: task.durationMinutes,
      priority: task.priority,
      energy: task.energy,
      status: "queued",
      source: "practice",
      sourceItemId: task.sourceItemId ?? null,
    });
  };
  return (
    <div className="page evolution-page page-enter">
      <header className="page-heading"><div><h1>Patterns</h1><p>Follow the ideas you return to, how they change, and where they lead next.</p></div></header>
      <div className="tab-strip" role="group" aria-label="Pattern views">{tabs.map((item) => <button aria-pressed={tab === item} type="button" key={item} onClick={() => setTab(item)}>{item}</button>)}</div>
      {loadFailed && <div className="partial-state" role="alert"><Warning size={20} /><span><strong>Couldn’t load patterns</strong><small>Your saved items are still available. Try again.</small></span></div>}
      {tab === "Compass" && <PersonalCompassSection overview={effectiveOverview} life={life.snapshot} imprints={imprints} onOpen={onOpen} onOpenPlan={onOpenPlan} onPrincipleChange={changePrinciple} onReflectPractice={life.reflectOnPractice} onRetryPractice={retryPractice} />}
      {tab === "Threads" && <LivingThreadsSection threads={threads} onOpen={onOpen} onExplore={onExplore} />}
      {tab === "Takeaways" && <section className="principles-section"><div className="section-heading-row"><div><h2>Takeaways</h2><p>Ideas pulled directly from individual saved items.</p></div></div>{principles.length ? <div className="principle-grid">{principles.map((principle) => <article key={`${principle.itemId}-${principle.text}`}><span>From one saved item</span><h3>{principle.text}</h3><button type="button" onClick={() => onOpen(principle.itemId)}>Open saved item <CaretRight size={15} /></button></article>)}</div> : <div className="partial-state"><Path size={20} /><span><strong>No takeaways yet</strong><small>Takeaways will appear when a saved item has a clear idea to keep.</small></span></div>}</section>}
      {tab === "Contrasts" && <section className="tension-section"><div className="tension-mark"><Path size={25} weight="light" /></div><div><span className="section-kicker">Compare two saves</span><h2>{tension ? "A useful contrast" : usesPreviewData ? "Example contrast" : "No contrasts yet"}</h2><p>{tension || (usesPreviewData ? "This preview shows where two saved items may take different approaches." : "Contrasts appear when two saves take different approaches to the same topic.")}</p>{tension && <div className="tension-sources"><button type="button" onClick={() => onOpen(overview!.tensions[0].fromItemId)}>First saved item</button><span>and</span><button type="button" onClick={() => onOpen(overview!.tensions[0].toItemId)}>Second saved item</button></div>}</div></section>}
      {tab === "History" && <section className="timeline-section"><div className="section-heading-row"><div><h2>Topics over time</h2><p>See which topics appeared in each month you saved something.</p></div></div>{timeline.length ? <div className="timeline">{timeline.map((entry, index) => <article className={index === timeline.length - 1 ? "current" : ""} key={`${entry.month}-${entry.title}`}><time>{entry.month}</time><div><strong>{entry.title}</strong><p>{entry.themes}</p></div></article>)}</div> : <div className="partial-state"><Clock size={20} /><span><strong>No history yet</strong><small>Months appear here after you save and process items.</small></span></div>}</section>}
    </div>
  );
}

function SettingsPage({ imprints, life, theme, onTheme, session, onSignOut, onClose }: { imprints: Imprint[]; life: LifeOSController; theme: ThemePreference; onTheme: (theme: ThemePreference) => void; session: AppSession | null; onSignOut: () => void; onClose: () => void }) {
  const [apiToken, setApiTokenValue] = useState(() => getApiToken());
  const [exporting, setExporting] = useState<"json" | "md" | null>(null);
  const [exportError, setExportError] = useState("");
  const download = async (format: "json" | "md") => {
    setExporting(format);
    setExportError("");
    try {
      const content = apiConfig.baseUrl
        ? await downloadLibraryExport(format === "json" ? "json" : "markdown")
        : new Blob([format === "json" ? exportImprintsJson(imprints, life.snapshot) : exportImprintsMarkdown(imprints, life.snapshot)], { type: format === "json" ? "application/json" : "text/markdown" });
      const url = URL.createObjectURL(content);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `remember-export.${format}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Your export could not be downloaded.");
    } finally {
      setExporting(null);
    }
  };
  return (
    <div className="page settings-page page-enter">
      <header className="page-heading"><div><h1>Settings</h1><p>Control your appearance, account, and exported data.</p></div><button className="button secondary settings-close" type="button" onClick={onClose}><ArrowLeft size={17} /> Back</button></header>
      <div className="settings-layout">
        <section className="settings-group"><div className="settings-title"><span><Moon size={19} /></span><div><h2>Appearance</h2><p>System follows your device automatically.</p></div></div><div className="segmented" role="group" aria-label="Color theme"><button type="button" aria-pressed={theme === "system"} className={theme === "system" ? "active" : ""} onClick={() => onTheme("system")}>System</button><button type="button" aria-pressed={theme === "light"} className={theme === "light" ? "active" : ""} onClick={() => onTheme("light")}><Sun size={16} /> Light</button><button type="button" aria-pressed={theme === "dark"} className={theme === "dark" ? "active" : ""} onClick={() => onTheme("dark")}><Moon size={16} /> Dark</button></div></section>
        <section className="settings-group"><div className="settings-title"><span><DownloadSimple size={19} /></span><div><h2>Your data</h2><p>Download a copy whenever you need one.</p></div></div><div className="export-actions"><button className="button secondary" type="button" disabled={exporting !== null} onClick={() => void download("md")}><BookOpen size={17} /> {exporting === "md" ? "Preparing..." : "Export Markdown"}</button><button className="button secondary" type="button" disabled={exporting !== null} onClick={() => void download("json")}><Database size={17} /> {exporting === "json" ? "Preparing..." : "Export JSON"}</button></div>{exportError && <p className="field-error" role="alert"><Warning size={15} /> {exportError}</p>}<div className="privacy-note"><ShieldCheck size={17} /><span><strong>Your saved items and personal records are included.</strong><small>Exports include saved item summaries, goals, tasks, calendar, health, finance, and file metadata. Download file contents separately.</small></span></div></section>
        {apiConfig.authMode === "token" && apiConfig.baseUrl && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/.test(apiConfig.baseUrl) && <section className="settings-group api-connection"><div className="settings-title"><span><Cloud size={19} /></span><div><h2>Private API connection</h2><p>Use a personal preview token for this browser only.</p></div></div><label className="token-field" htmlFor="api-token"><span>Bearer token</span><input id="api-token" type="password" value={apiToken} autoComplete="off" onChange={(event) => { setApiTokenValue(event.target.value); setApiToken(event.target.value); }} placeholder="Paste a private preview token" /></label><div className="privacy-note warning"><Warning size={17} /><span><strong>Private preview only.</strong><small>Browser tokens are not suitable for a public app. Add identity-provider authentication before launch.</small></span></div></section>}
        <section className="settings-group account"><div className="avatar">L</div><div><h2>Luke</h2><p>{session?.email || (apiConfig.authMode === "access" ? "Protected by Cloudflare Access" : "Local preview profile")}</p></div>{apiConfig.authMode === "access" ? <a className="button secondary" href="/cdn-cgi/access/logout">Sign out</a> : apiConfig.authMode === "password" ? <button className="button secondary" type="button" onClick={onSignOut}>Sign out</button> : <button className="button secondary" type="button" disabled aria-describedby="account-preview-note">Account sync coming soon</button>}{apiConfig.authMode === "token" && <span className="sr-only" id="account-preview-note">Account management is unavailable in this local preview.</span>}</section>
      </div>
    </div>
  );
}

function CaptureDialog({ open, imprints, onClose, onSaved }: { open: boolean; imprints: Imprint[]; onClose: () => void; onSaved: (imprint: Imprint) => Promise<"synced" | "local"> }) {
  const [kind, setKind] = useState<"link" | "thought">("link");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [thought, setThought] = useState("");
  const [returnCue, setReturnCue] = useState<ReturnCue | undefined>();
  const [returnDate, setReturnDate] = useState("");
  const [error, setError] = useState("");
  const [savedMode, setSavedMode] = useState<"synced" | "local" | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const thoughtRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    setSavedMode(null);
    setSaving(false);
    setError("");
    window.setTimeout(() => kind === "link" ? inputRef.current?.focus() : thoughtRef.current?.focus(), 80);
  }, [kind, open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey);
  }, [onClose, open]);
  if (!open) return null;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const returnAt = returnCue === "date" ? scheduleReturnDay(returnDate) : undefined;
    if (returnCue === "date" && !returnAt) { setError("Choose today or a future day for this idea to come back."); return; }
    let draft: Imprint;
    if (kind === "thought") {
      const words = thought.trim();
      if (!words) { setError("Write the thought you want Remember to keep."); return; }
      const id = crypto.randomUUID();
      const firstLine = words.split(/\n+/).find(Boolean) ?? words;
      const title = firstLine.length > 96 ? `${firstLine.slice(0, 93).trimEnd()}…` : firstLine;
      draft = {
        id,
        title,
        creator: "You",
        sourceType: "Thought",
        url: `remember://thought/${id}`,
        savedAt: "Just now",
        lifePeriod: "Current chapter",
        essence: "Remember is finding what this connects to.",
        summary: "Remember is connecting this thought to what you have saved and said before.",
        themes: [], keyIdeas: [], moments: [], experiments: [], noteText: words,
        returnCue, returnAt, status: "processing", color: "violet", connectionIds: [], analysisScope: "pending",
      };
    } else {
      let parsed: URL;
      try { parsed = new URL(url); if (parsed.protocol !== "https:") throw new Error(); }
      catch { setError("Enter a complete public link that starts with https://"); return; }
      const duplicate = imprints.find((item) => item.url === parsed.toString() || item.url === url);
      if (duplicate) { setError("You already saved this. Open it from your library instead."); return; }
      const normalizedHost = parsed.hostname.replace(/^www\./, "");
      const isYoutube = normalizedHost.includes("youtube.com") || normalizedHost.includes("youtu.be");
      const isTikTok = normalizedHost === "tiktok.com" || normalizedHost.endsWith(".tiktok.com");
      draft = { id: crypto.randomUUID(), title: isYoutube ? "New YouTube save" : isTikTok ? "New TikTok save" : normalizedHost, creator: isTikTok ? "TikTok" : parsed.hostname, sourceType: isYoutube ? "YouTube" : "Article", url: parsed.toString(), savedAt: "Just now", lifePeriod: "Current chapter", essence: note || "Saved safely. Details are on the way.", summary: "Waiting to process this saved item.", themes: [], keyIdeas: [], moments: [], experiments: [], personalReaction: note || undefined, returnCue, returnAt, status: "processing", color: "sage", connectionIds: [], analysisScope: "pending" };
    }
    setSaving(true);
    setError("");
    try {
      const mode = await onSaved(draft);
      setSavedMode(mode);
      window.setTimeout(() => {
        setUrl(""); setNote(""); setThought(""); setReturnCue(undefined); setReturnDate(""); setKind("link"); onClose();
      }, 1800);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `This ${kind} could not be saved. Please try again.`);
    } finally {
      setSaving(false);
    }
  };
  const readyToSave = kind === "link" ? Boolean(url.trim()) : Boolean(thought.trim());
  const saveConfirmation = savedMode === "local"
    ? "Reconnect to upload it and begin analysis."
    : returnCue ? `Remember will bring it back ${returnCueLabel(returnCue).toLowerCase()}.`
    : kind === "thought" ? "Your thought is now part of what Remember can connect and return to."
    : "Analysis is running in the background.";
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="capture-dialog" role="dialog" aria-modal="true" aria-labelledby="capture-title">
        <IconButton label="Close" className="dialog-close" onClick={onClose}><X size={19} /></IconButton>
        {savedMode ? <div className="capture-success" role="status"><span><Check size={26} weight="bold" /></span><h2>{savedMode === "synced" ? "Saved" : "Saved on this device"}</h2><p>{saveConfirmation}</p>{savedMode === "synced" && <ProcessingLine label={kind === "thought" ? "Connecting your thought" : "Analyzing your saved item"} />}</div> : <>
          <div className="capture-heading"><span className="capture-mark">{kind === "thought" ? <Quotes size={22} /> : <LinkSimple size={22} />}</span><h2 id="capture-title">Save something</h2><p>{kind === "thought" ? "Keep a realization, question, or idea in your own words." : "Paste a link. Add context only if you want to."}</p></div>
          <form onSubmit={(event) => void submit(event)}>
            <div className="capture-form-scroll">
              <div className="segmented capture-kind-switch" role="group" aria-label="What are you saving?">
                <button type="button" className={kind === "link" ? "active" : ""} aria-pressed={kind === "link"} onClick={() => { setKind("link"); setError(""); }}><LinkSimple size={17} /> Link</button>
                <button type="button" className={kind === "thought" ? "active" : ""} aria-pressed={kind === "thought"} onClick={() => { setKind("thought"); setError(""); }}><Quotes size={17} /> Thought</button>
              </div>
              {kind === "link" ? <>
                <label htmlFor="capture-url">Link</label><div className={cx("url-input", error && "has-error")}><LinkSimple size={19} /><input ref={inputRef} id="capture-url" value={url} disabled={saving} onChange={(event) => { setUrl(event.target.value); setError(""); }} placeholder="https://youtube.com/watch?v=..." inputMode="url" autoComplete="url" /></div>
                <div className="note-field"><label htmlFor="capture-note">Why did this matter? <span>Optional</span></label><textarea id="capture-note" value={note} disabled={saving} onChange={(event) => setNote(event.target.value)} placeholder="A sentence is enough." rows={3} /></div>
              </> : <div className="thought-field"><label htmlFor="capture-thought">Your thought</label><textarea ref={thoughtRef} id="capture-thought" value={thought} disabled={saving} onChange={(event) => { setThought(event.target.value); setError(""); }} placeholder="An idea, realization, question, or line you don’t want to lose…" rows={6} /><small>This becomes part of Ask, Patterns, and the ideas Remember can bring back later.</small></div>}
              {error && <p className="field-error" role="alert"><Warning size={15} /> {error}</p>}
              <ReturnCuePicker cue={returnCue} date={returnDate} onCue={(cue) => { setReturnCue(cue); if (cue !== "date") setReturnDate(""); setError(""); }} onDate={(value) => { setReturnDate(value); setError(""); }} />
            </div>
            <div className="capture-actions">
              <button className="button primary full" type="submit" disabled={!readyToSave || saving}>{saving ? "Saving..." : <>Save now <ArrowRight size={17} /></>}</button>
              <p className="save-note"><Cloud size={14} /> {kind === "thought" ? "Your words stay in your private Remember library." : "We confirm whether the link reached your private library."}</p>
            </div>
          </form>
        </>}
      </section>
    </div>
  );
}

function ConnectivityBanner({ remoteUnavailable, onRetry }: { remoteUnavailable: boolean; onRetry: () => void }) {
  const [offline, setOffline] = useState(() => !navigator.onLine);
  useEffect(() => { const update = () => setOffline(!navigator.onLine); window.addEventListener("online", update); window.addEventListener("offline", update); return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); }; }, []);
  if (offline) return <div className="offline-banner" role="status"><WifiSlash size={16} /> You are offline. New saves stay on this device until you reconnect.</div>;
  return remoteUnavailable ? <div className="offline-banner cached-banner" role="status"><Cloud size={16} /><span>Showing the saved copy on this device. Remember will reconnect automatically.</span><button type="button" onClick={onRetry}>Try now</button></div> : null;
}

function LifeSyncBanner({ life }: { life: LifeOSController }) {
  if (!life.pendingSync && !life.syncError) return null;
  return <div className="life-sync-banner" role="status" aria-live="polite">
    <Cloud size={16} />
    <span>{life.syncError || `${life.pendingSync} change${life.pendingSync === 1 ? " is" : "s are"} syncing…`}</span>
    {life.syncError && <button type="button" disabled={life.working} onClick={() => void life.refresh()}>{life.working ? "Trying…" : "Try again"}</button>}
  </div>;
}

function DestinationFrame({
  label,
  active,
  sections,
  onNavigate,
  children,
}: {
  label: string;
  active: Page;
  sections: Array<{ page: Page; label: string }>;
  onNavigate: (page: Page) => void;
  children: ReactNode;
}) {
  return (
    <div className="destination-frame">
      <div className="destination-bar">
        <strong>{label}</strong>
        <nav aria-label={`${label} sections`}>
          {sections.map((section) => (
            <button
              className={active === section.page ? "active" : ""}
              type="button"
              key={section.page}
              aria-current={active === section.page ? "page" : undefined}
              onClick={() => onNavigate(section.page)}
            >
              {section.label}
            </button>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}

export function App() {
  const [route, setRoute] = useState<AppRoute>(() => routeFromHash());
  const { page, detailId } = route;
  const [captureOpen, setCaptureOpen] = useState(false);
  const captureReturnRef = useRef<HTMLElement | null>(null);
  const settingsReturnRef = useRef<Page>("home");
  const [authStatus, setAuthStatus] = useState<"loading" | "authenticated" | "anonymous">(apiConfig.authMode === "password" ? "loading" : "authenticated");
  const [session, setSession] = useState<AppSession | null>(null);
  const [imprints, setImprints] = useState<Imprint[]>(apiConfig.baseUrl ? [] : fixtureImprints);
  const [libraryLoading, setLibraryLoading] = useState(Boolean(apiConfig.baseUrl));
  const [librarySource, setLibrarySource] = useState<"unknown" | "api" | "local">("unknown");
  const [resurfaced, setResurfaced] = useState<ResurfacedMemory | null>(null);
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem("remember-theme");
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(preferredSystemTheme);
  const theme = themePreference === "system" ? systemTheme : themePreference;
  const life = useLifeOS(authStatus === "authenticated");
  const replaceImprint = useCallback((item: Imprint, previousId?: string) => {
    setImprints((current) => [item, ...current.filter((entry) => entry.id !== previousId && entry.id !== item.id && entry.url !== item.url)]);
  }, []);
  const refreshLibrary = useCallback(async (signal?: AbortSignal, showLoading = false) => {
    if (showLoading) setLibraryLoading(true);
    try {
      const { items, source } = await loadImprints(signal);
      setImprints(items);
      setLibrarySource(source);
    } finally {
      if (showLoading) setLibraryLoading(false);
    }
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("remember-theme", themePreference); }, [theme, themePreference]);
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!query) return;
    const update = (event: MediaQueryListEvent | MediaQueryList) => setSystemTheme(event.matches ? "light" : "dark");
    update(query);
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  useEffect(() => {
    const syncRoute = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);
  useEffect(() => { document.title = `${pageTitles[page]} · Remember`; }, [page]);
  useEffect(() => {
    if (apiConfig.authMode !== "password") return;
    let active = true;
    void loadSession().then((value) => {
      if (!active) return;
      setSession(value);
      setAuthStatus(value ? "authenticated" : "anonymous");
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const controller = new AbortController();
    refreshLibrary(controller.signal, true).catch(() => undefined);
    return () => controller.abort();
  }, [authStatus, refreshLibrary]);
  useEffect(() => {
    if (authStatus !== "authenticated" || !apiConfig.baseUrl || !imprints.some((item) => item.status === "processing")) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible" && navigator.onLine) void refreshLibrary(); }, 4_000);
    return () => window.clearInterval(timer);
  }, [authStatus, imprints, refreshLibrary]);
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const refresh = () => { if (navigator.onLine && document.visibilityState === "visible") void refreshLibrary(); };
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [authStatus, refreshLibrary]);
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const controller = new AbortController();
    loadResurfacedMemory(controller.signal).then(setResurfaced).catch(() => undefined);
    return () => controller.abort();
  }, [authStatus]);
  if (authStatus === "loading") return <AuthLoading />;
  if (authStatus === "anonymous") return <LoginPage onAuthenticated={(value) => { setSession(value); setAuthStatus("authenticated"); }} />;
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  const navigate = (next: Page) => {
    setRoute({ page: next, detailId: null });
    const nextHash = `#/${next}`;
    if (window.location.hash !== nextHash) window.location.hash = `/${next}`;
    scrollToTop();
  };
  const openDetail = (id: string) => {
    setRoute({ page: "library", detailId: id });
    const nextHash = `#/library/item/${encodeURIComponent(id)}`;
    if (window.location.hash !== nextHash) window.location.hash = `/library/item/${encodeURIComponent(id)}`;
    scrollToTop();
    void loadImprint(id).then(({ item }) => { if (item) replaceImprint(item); });
  };
  const openCapture = () => { captureReturnRef.current = document.activeElement as HTMLElement | null; setCaptureOpen(true); };
  const closeCapture = () => { setCaptureOpen(false); window.setTimeout(() => captureReturnRef.current?.focus(), 0); };
  const openSettings = () => { settingsReturnRef.current = page === "settings" ? "home" : page; navigate("settings"); };
  const activeImprint = detailId ? imprints.find((item) => item.id === detailId) : null;
  const primaryPage = primaryForPage(page);
  const planSection: Page = page === "goals" || page === "calendar" ? page : "tasks";
  const librarySection: Page = page === "evolution" ? "evolution" : "library";
  const youSection: Page = page === "money" || page === "files" ? page : "health";
  const signOut = () => { void logout().finally(() => { clearAskStorage(); setSession(null); setImprints([]); setAuthStatus("anonymous"); }); };
  const pageContent = activeImprint
    ? <DetailPage imprint={activeImprint} imprints={imprints} life={life} onBack={() => navigate("library")} onOpen={openDetail} onOpenPlan={() => navigate("tasks")} onUpdate={replaceImprint} />
    : page === "home" ? <HomePage imprints={imprints} resurfaced={resurfaced} onOpen={openDetail} onNavigate={navigate} life={life} libraryLoading={libraryLoading} />
    : page === "ask" ? <AskPage imprints={imprints} life={life} onOpen={openDetail} onOpenPlan={() => navigate("tasks")} onUpdate={replaceImprint} />
    : page === "settings" ? <SettingsPage imprints={imprints} life={life} theme={themePreference} onTheme={setThemePreference} session={session} onSignOut={signOut} onClose={() => navigate(settingsReturnRef.current)} />
    : primaryPage === "plan" ? <DestinationFrame label="Plan" active={planSection} sections={[{ page: "tasks", label: "Tasks" }, { page: "calendar", label: "Calendar" }, { page: "goals", label: "Goals" }]} onNavigate={navigate}><Suspense fallback={<FeatureLoading heading={pageTitles[planSection]} label={`Opening ${pageTitles[planSection].toLowerCase()}…`} />}>{planSection === "goals" ? <GoalsPage life={life} /> : planSection === "calendar" ? <CalendarPage life={life} /> : <TasksPage life={life} />}</Suspense></DestinationFrame>
    : primaryPage === "library" ? <DestinationFrame label="Library" active={librarySection} sections={[{ page: "library", label: "Saved" }, { page: "evolution", label: "Patterns" }]} onNavigate={navigate}>{librarySection === "evolution" ? <EvolutionPage imprints={imprints} life={life} onOpen={openDetail} onOpenPlan={() => navigate("tasks")} onExplore={(question) => { sessionStorage.setItem(ASK_SEED_STORAGE_KEY, question); navigate("ask"); }} /> : <LibraryPage imprints={imprints} onOpen={openDetail} loading={libraryLoading} />}</DestinationFrame>
    : <DestinationFrame label="Life" active={youSection} sections={[{ page: "health", label: "Health" }, { page: "money", label: "Money" }, { page: "files", label: "Files" }]} onNavigate={navigate}><Suspense fallback={<FeatureLoading heading={pageTitles[youSection]} label={`Opening ${pageTitles[youSection].toLowerCase()}…`} />}>{youSection === "money" ? <MoneyPage life={life} /> : youSection === "files" ? <FilesPage life={life} /> : <HealthPage life={life} />}</Suspense></DestinationFrame>;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <ConnectivityBanner remoteUnavailable={Boolean(apiConfig.baseUrl && librarySource === "local")} onRetry={() => void refreshLibrary(undefined, true)} />
      <aside className="sidebar" aria-hidden={captureOpen || undefined} inert={captureOpen}>
        <button className="brand" type="button" onClick={() => navigate("home")} aria-label="Remember home"><AppMark /><span>Remember</span></button>
        <button className="sidebar-save" type="button" onClick={openCapture}><Plus size={18} weight="bold" /> Save</button>
        <nav aria-label="Primary navigation">{navItems.map(({ page: itemPage, label, icon: Icon }) => { const active = primaryPage === itemPage; return <button className={cx(active && "active")} type="button" key={itemPage} onClick={() => navigate(itemPage)} aria-label={label} title={label} aria-current={active ? "page" : undefined}><Icon size={20} weight={active ? "fill" : "regular"} /><span>{label}</span></button>; })}</nav>
        <div className="sidebar-bottom"><button className="profile-button" type="button" onClick={openSettings} aria-label="Open settings"><span>L</span><span><strong>Luke</strong><small>Settings</small></span><CaretRight size={15} /></button></div>
      </aside>
      <header className="mobile-header" aria-hidden={captureOpen || undefined} inert={captureOpen}><button className="brand" type="button" onClick={() => navigate("home")}><AppMark /><span>Remember</span></button><div><IconButton label={theme === "light" ? "Use dark mode" : "Use light mode"} onClick={() => setThemePreference(theme === "light" ? "dark" : "light")}>{theme === "light" ? <Moon size={19} /> : <Sun size={19} />}</IconButton><button className="mobile-settings" type="button" onClick={openSettings} aria-label="Open settings"><GearSix size={19} /></button><button className="mobile-save" type="button" onClick={openCapture}><Plus size={18} weight="bold" /> Save</button></div></header>
      <main id="main-content" aria-hidden={captureOpen || undefined} inert={captureOpen}>
        <LifeSyncBanner life={life} />
        {pageContent}
      </main>
      <nav className="bottom-nav" aria-label="Mobile navigation" aria-hidden={captureOpen || undefined} inert={captureOpen}>{mobileNavItems.map(({ page: itemPage, label, icon: Icon }) => { const active = primaryPage === itemPage; return <button className={cx(active && "active")} type="button" key={itemPage} onClick={() => navigate(itemPage)} aria-current={active ? "page" : undefined}><Icon size={21} weight={active ? "fill" : "regular"} /><span>{label}</span></button>; })}</nav>
      <CaptureDialog open={captureOpen} imprints={imprints} onClose={closeCapture} onSaved={async (imprint) => {
        const { item, synced } = await saveImprint(imprint);
        replaceImprint(item, imprint.id);
        return synced ? "synced" : "local";
      }} />
    </div>
  );
}

export { pageTitles };

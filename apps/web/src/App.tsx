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
  Headphones,
  House,
  ListChecks,
  LockKey,
  MagnifyingGlass,
  Moon,
  Path,
  Play,
  Quotes,
  ShieldCheck,
  SquaresFour,
  Sun,
  Warning,
  WifiSlash,
  YoutubeLogo,
} from "@phosphor-icons/react";
import { imprints as fixtureImprints, suggestedQuestions } from "./fixtures";
import { AskAPIError, apiConfig, askLibrary, downloadLibraryExport, getApiToken, loadEvolution, loadImprint, loadImprints, loadResurfacedMemory, loadSession, login, logout, rateContextualReturn, reflectOnMemory, retryImprint, saveImprint, searchImprints, setApiToken, updatePrinciple, type AppSession, type EvolutionOverview, type MemoryReflectionResponse, type ResurfacedMemory } from "./services/api";
import { exportImprintsJson, exportImprintsMarkdown } from "./services/export";
import { buildCaptureDraft } from "./services/capture";
import { mergeMemoryFeedback, readMemoryFeedback } from "./services/memoryFeedback";
import { canReturnImprint, latestByItem } from "./product/returnEligibility";
import type { AskMessage, Imprint, Page, PrimaryPage, ReturnCue } from "./types";
import { JevStatusLine } from "./components/JevSheet";
import { LockInProvider } from "./life/lockInContext";
import { LockInHost } from "./life/LockIn";
import { BackgroundSection, RoutineNudger } from "./life/BackgroundRoutines";
import { Onboarding } from "./setup/Onboarding";
import { shouldShowSetup } from "./setup/setupState";
import { AboutMeSection, CommitmentSection, NudgesSection, YourDaySection } from "./setup/SetupSections";
import type { LifeTask } from "./life/types";
import { useLifeOS, type LifeOSController } from "./life/useLifeOS";
import { DailyBasics, NowCard, TaskAddBar, TaskSheet, UpNext } from "./life/TaskViews";
import { CarryForwardSection } from "./components/CarryForwardSection";
import { AskOutcomeActions } from "./components/AskOutcomeActions";
import { LivingThreadsSection } from "./components/LivingThreadsSection";
import { PersonalCompassSection } from "./components/PersonalCompassSection";
import { WeeklySynthesisCard } from "./components/WeeklySynthesisCard";
import { DecisionWorkspace } from "./components/DecisionWorkspace";
import { BringBackSection } from "./components/BringBackSection";
import { buildLivingThreads } from "./product/livingThreads";
import { contextualReturnLabel, findContextualReturn, type ContextualReturn } from "./product/contextualReturn";
import { buildWeeklySynthesis } from "./product/weeklySynthesis";
import { findReturnForMoment, returnCueChoices, returnCueLabel, returnCueQuestion, returnCueReason } from "./product/returnCues";
import { AddBar } from "./ui/AddBar";
import { ToastProvider, haptic, useToast } from "./ui/Toast";


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

const pageTitles: Record<Page, string> = {
  home: "Today",
  plan: "Plan",
  tasks: "Tasks",
  goals: "Goals",
  calendar: "Calendar",
  health: "Health",
  money: "Money",
  files: "Files",
  library: "Library",
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
        <strong>{imprint.sourceType === "Thought" ? imprint.noteText || imprint.title : imprint.title}</strong>
        <span className="imprint-meta"><span>{sourceLabel(imprint)} · {imprint.savedAt}</span><StatusBadge status={imprint.status} />{imprint.syncState === "local" && <span className="scope-badge local"><Cloud size={12} /> Waiting to sync</span>}</span>
      </span>
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

function IntentionalReturnFeature({ imprint, cue, onOpen, onExplore, onSeeCompass, onReflected }: { imprint: Imprint; cue: ReturnCue; onOpen: (id: string) => void; onExplore: (question: string) => void; onSeeCompass: () => void; onReflected: (response: MemoryReflectionResponse) => void }) {
  return <section className="card idea-card intentional-return" aria-labelledby="intentional-return-title">
    <span className="section-label">Kept for “{returnCueLabel(cue).toLowerCase()}”</span>
    <h2 id="intentional-return-title">{imprint.essence}</h2>
    <p>{imprint.title}</p>
    <MemoryCheckIn key={imprint.id} imprint={imprint} onSeeCompass={onSeeCompass} onRecorded={onReflected} />
    <div className="idea-actions">
      <button className="btn secondary" type="button" onClick={() => onOpen(imprint.id)}>Open</button>
      <button className="btn quiet" type="button" onClick={() => onExplore(returnCueQuestion(imprint, cue))}>Ask about this</button>
    </div>
  </section>;
}

type TodayIdea = { kind: "intentional"; imprint: Imprint; cue: ReturnCue }
  | { kind: "contextual"; imprint: Imprint; match: ContextualReturn }
  | { kind: "resurfaced"; imprint: Imprint };

/** The single "one idea for today" card: title, one line of why, one button. */
function IdeaCard({ idea, life, onOpen, onDismiss }: { idea: TodayIdea; life: LifeOSController; onOpen: (id: string) => void; onDismiss: () => void }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const { imprint } = idea;
  const kicker = idea.kind === "contextual" ? `For your ${contextualReturnLabel(idea.match.contextKind)}` : idea.kind === "intentional" ? "You kept this for today" : "From your library";
  const why = idea.kind === "contextual" ? idea.match.reason : idea.kind === "intentional" ? returnCueReason(idea.cue) : imprint.hypothesis || `Saved ${imprint.savedAt}.`;
  const action = idea.kind === "contextual" ? idea.match.suggestedAction : undefined;
  const tryIt = async () => {
    if (!action || adding || added || idea.kind !== "contextual") return;
    setAdding(true);
    try {
      await life.createTask({
        title: action.title, firstStep: action.firstStep,
        notes: `Returned for “${idea.match.contextTitle}” from “${imprint.title}”.\n${imprint.url}`,
        area: idea.match.contextArea, durationMinutes: action.durationMinutes, priority: "normal", energy: "any",
        status: "queued", source: "practice", sourceItemId: imprint.id,
      });
      setAdded(true); haptic([8, 30, 8]);
      toast.show({ message: "Added · Jev will fit it in" });
      void rateContextualReturn(imprint.id, "useful");
    } catch { toast.error("That wasn’t added. Try again."); }
    finally { setAdding(false); }
  };
  const notToday = async () => {
    if (idea.kind === "contextual" && !await rateContextualReturn(imprint.id, "not_today")) { toast.error("That preference wasn’t saved. Try again."); return; }
    onDismiss();
  };
  return <section className="card idea-card" aria-labelledby="idea-title">
    <span className="section-label">{kicker}</span>
    <h2 id="idea-title">{imprint.essence}</h2>
    <p>{why}</p>
    <div className="idea-actions">
      {action
        ? <button className="btn secondary" type="button" disabled={adding || added} onClick={() => void tryIt()}>{added ? <><Check size={17} weight="bold" /> Added</> : adding ? "Adding…" : "Try this today"}</button>
        : <button className="btn secondary" type="button" onClick={() => onOpen(imprint.id)}>Open</button>}
      <button className="btn quiet" type="button" onClick={() => void notToday()}>Not today</button>
    </div>
  </section>;
}

function HomePage({ imprints, resurfaced, onOpen, onNavigate, life }: { imprints: Imprint[]; resurfaced: ResurfacedMemory | null; onOpen: (id: string) => void; onNavigate: (p: Page) => void; life: LifeOSController }) {
  const [openTask, setOpenTask] = useState<LifeTask | null>(null);
  const [contextOverview, setContextOverview] = useState<EvolutionOverview | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const controller = new AbortController();
    loadEvolution(controller.signal).then(setContextOverview).catch(() => undefined);
    return () => controller.abort();
  }, []);
  const localRecentQuestion = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem(ASK_RECENT_QUESTION_STORAGE_KEY) ?? "null") as EvolutionOverview["recentQuestion"]; }
    catch { return null; }
  }, []);
  const history = useMemo(() => {
    const practiceResults = latestByItem(life.snapshot.tasks.flatMap((task) => task.source === "practice" && task.sourceItemId && task.practiceOutcome
      ? [{ itemId: task.sourceItemId, outcome: task.practiceOutcome, occurredAt: task.reflectedAt ?? task.updatedAt }] : []));
    const rejected = [...practiceResults.values()].filter((result) => result.outcome === "not_for_me").map((result) => result.itemId);
    return { ...mergeMemoryFeedback(readMemoryFeedback(apiConfig.baseUrl), contextOverview), excludingItemIds: new Set([...dismissed, ...rejected]) };
  }, [contextOverview, dismissed, life.snapshot.tasks]);
  const idea: TodayIdea | null = useMemo(() => {
    const due = findReturnForMoment(imprints, "date", new Date(), history);
    if (due) return { kind: "intentional", imprint: due, cue: "date" };
    const match = findContextualReturn(imprints, life.snapshot, { ...history, recentQuestion: contextOverview?.recentQuestion ?? localRecentQuestion });
    if (match) return { kind: "contextual", imprint: match.imprint, match };
    const surfaced = resurfaced ? imprints.find((item) => item.id === resurfaced.itemId && canReturnImprint(item, history)) : undefined;
    return surfaced ? { kind: "resurfaced", imprint: surfaced } : null;
  }, [contextOverview, history, imprints, life.snapshot, localRecentQuestion, resurfaced]);
  return (
    <div className="screen-body home-page">
      <BackgroundSection life={life} />
      <NowCard life={life} onOpenPlan={() => onNavigate("tasks")} />
      <UpNext life={life} onSeeAll={() => onNavigate("tasks")} onOpen={setOpenTask} />
      <DailyBasics life={life} />
      {idea && <IdeaCard key={idea.imprint.id} idea={idea} life={life} onOpen={onOpen} onDismiss={() => setDismissed((current) => new Set([...current, idea.imprint.id]))} />}
      {openTask && <TaskSheet key={openTask.id} task={openTask} life={life} onClose={() => setOpenTask(null)} />}
      <TaskAddBar life={life} />
    </div>
  );
}

/** Library's add bar: a link becomes a saved link (other words become your note); anything else is a thought. */
function LibraryAddBar({ imprints, onSaved, onOpen }: { imprints: Imprint[]; onSaved: (imprint: Imprint) => Promise<{ id: string; mode: "synced" | "local" }>; onOpen: (id: string) => void }) {
  const toast = useToast();
  const save = async (text: string) => {
    const result = buildCaptureDraft(text, imprints);
    if (result.kind === "error") { toast.error(result.message); return false; }
    try {
      const saved = await onSaved(result.draft);
      haptic([8, 30, 8]);
      toast.show({ message: saved.mode === "local" ? "Saved on this device" : result.kind === "thought" ? "Thought saved" : "Saved · Analyzing now", action: { label: "Open", onAction: () => onOpen(saved.id) } });
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "That wasn’t saved. Try again."); return false; }
  };
  return <AddBar label="Save a link or thought" placeholder="Save a link or thought…" sendLabel="Save" onSubmit={save} />;
}

const libraryFilters = ["All", "Thoughts", "Videos", "Articles", ...returnCueChoices.filter((choice) => choice.value !== "date").map((choice) => choice.shortLabel), "Analyzing", "Couldn’t analyze"];

function LibraryPage({ imprints, onOpen, loading, onSaved, onExplore, onSeeCompass }: { imprints: Imprint[]; onOpen: (id: string) => void; loading: boolean; onSaved: (imprint: Imprint) => Promise<{ id: string; mode: "synced" | "local" }>; onExplore: (question: string) => void; onSeeCompass: () => void }) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [oldestFirst, setOldestFirst] = useState(false);
  const [searchResults, setSearchResults] = useState<Imprint[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [released, setReleased] = useState<Set<string>>(() => new Set());
  const [answered, setAnswered] = useState<Set<string>>(() => new Set());
  const chooseFilter = (next: string) => { setReleased((current) => new Set([...current, ...answered])); setAnswered(new Set()); setFilter(next); };
  const searchRequest = useRef(0);
  const cue = returnCueChoices.find((choice) => choice.shortLabel === filter)?.value ?? null;
  useEffect(() => {
    const request = ++searchRequest.current;
    if (!query.trim()) { setSearchResults(null); setSearching(false); return; }
    const controller = new AbortController();
    setSearching(true);
    const timeout = window.setTimeout(() => {
      searchImprints(query, imprints, controller.signal).then(({ items }) => {
        if (searchRequest.current === request) setSearchResults(items);
      }).catch((error) => {
        if (searchRequest.current === request && !(error instanceof DOMException && error.name === "AbortError")) toast.error("Search isn’t working right now. Your library is still here.");
      }).finally(() => { if (searchRequest.current === request) setSearching(false); });
    }, 280);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [imprints, query, toast]);
  const moment = useMemo(() => cue ? findReturnForMoment(imprints, cue, new Date(), { ...mergeMemoryFeedback(readMemoryFeedback(apiConfig.baseUrl), null), excludingItemIds: released }) : null, [cue, imprints, released]);
  const visible = useMemo(() => {
    let items = searchResults ?? (query.trim() ? [] : imprints);
    if (filter === "Thoughts") items = items.filter((item) => item.sourceType === "Thought");
    if (filter === "Videos") items = items.filter(isVideoSource);
    if (filter === "Articles") items = items.filter((item) => !isVideoSource(item) && item.sourceType !== "Podcast" && item.sourceType !== "Thought");
    if (filter === "Analyzing") items = items.filter((item) => item.status === "processing");
    if (filter === "Couldn’t analyze") items = items.filter((item) => item.status === "partial" || item.status === "failed");
    if (cue) items = items.filter((item) => item.returnCue === cue && item.id !== moment?.id);
    return oldestFirst ? [...items].reverse() : items;
  }, [cue, filter, imprints, moment, oldestFirst, query, searchResults]);
  return (
    <div className="screen-body library-page">
      <label className="search-pill"><MagnifyingGlass size={18} aria-hidden="true" /><span className="sr-only">Search your library</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your library" /></label>
      <div className="chip-row scroll" role="group" aria-label="Filter library">
        {libraryFilters.map((item) => <button className={cx("chip", filter === item && "selected")} type="button" key={item} aria-pressed={filter === item} onClick={() => chooseFilter(filter === item && item !== "All" ? "All" : item)}>{item}</button>)}
        <button className={cx("chip", oldestFirst && "selected")} type="button" aria-pressed={oldestFirst} onClick={() => setOldestFirst(!oldestFirst)}>Oldest first</button>
      </div>
      {cue && moment && <IntentionalReturnFeature key={`${cue}:${moment.id}`} imprint={moment} cue={cue} onOpen={onOpen} onExplore={onExplore} onSeeCompass={onSeeCompass} onReflected={() => setAnswered((current) => new Set([...current, moment.id]))} />}
      {loading && imprints.length === 0 ? <FeatureLoading label="Loading your library…" />
        : visible.length ? <ul className="item-list" aria-busy={searching}>{visible.map((item) => <li key={item.id}><ImprintRow imprint={item} onOpen={onOpen} /></li>)}</ul>
        : cue && moment ? null
        : <EmptyState query={query || (filter !== "All" ? filter : undefined)} />}
      <LibraryAddBar imprints={imprints} onSaved={onSaved} onOpen={onOpen} />
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
  const inputRef = useRef<HTMLInputElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const threadIdRef = useRef<string | null>(sessionStorage.getItem(ASK_THREAD_STORAGE_KEY));
  const validationID = useId();
  useEffect(() => { sessionStorage.removeItem(ASK_SEED_STORAGE_KEY); }, []);
  useEffect(() => {
    if (messages.length) sessionStorage.setItem(ASK_MESSAGES_STORAGE_KEY, JSON.stringify(messages));
    else sessionStorage.removeItem(ASK_MESSAGES_STORAGE_KEY);
  }, [messages]);
  useEffect(() => {
    if (!messages.length && !thinking && !failure) return;
    conversationEndRef.current?.scrollIntoView?.({
      block: "end",
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth",
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
  const send = async (question: string, appendQuestion = true): Promise<boolean> => {
    const clean = question.trim();
    if (busyRef.current) return false;
    if (clean.length < ASK_MIN_LENGTH) {
      setValidationError("Use at least two characters so Remember has something to search for.");
      inputRef.current?.focus();
      return false;
    }
    if (clean.length > ASK_MAX_LENGTH) {
      setValidationError("Keep the question to 1,000 characters or fewer.");
      inputRef.current?.focus();
      return false;
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
    return true;
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
  return (
    <div className="screen-body ask-page">
      {decisionOpen ? (
        <DecisionWorkspace
          imprints={imprints}
          life={life}
          onBack={() => setDecisionOpen(false)}
          onOpen={onOpen}
          onOpenPlan={onOpenPlan}
          onContinue={(question) => { setDecisionOpen(false); void send(question); }}
        />
      ) : messages.length === 0 && !failure ? (
        <div className="ask-start">
          <h2>What are you looking for?</h2>
          <div className="chip-row wrap" role="group" aria-label="Suggested questions">{suggestedQuestions.slice(0, 3).map((question) => <button className="chip" type="button" key={question} onClick={() => void send(question)}>{question}</button>)}</div>
          <button className="btn secondary" type="button" onClick={() => setDecisionOpen(true)}><Path size={19} aria-hidden="true" /> Think through a decision</button>
        </div>
      ) : (
        <div className="conversation" aria-live="polite">
          <button className="btn quiet new-conversation" type="button" disabled={thinking} onClick={startNewConversation}>New conversation</button>
          {messages.map((message) => <article className={cx("message", message.role)} key={message.id}><div><p>{message.text}</p>{message.grounded !== undefined && <small className="composer-note"><ShieldCheck size={13} /> {message.grounded ? "From your saves" : "Not enough in your saves yet"}</small>}{message.citations && message.citations.length > 0 && <details className="citations"><summary><BookOpen size={15} /><span>Supporting saves</span><CaretDown size={14} /></summary><div>{message.citations.map((citation) => { const imprint = imprints.find((item) => item.id === citation.imprintId); const content = <>{citation.label}{citation.seconds !== undefined ? <small>{Math.floor(citation.seconds / 60)}:{String(citation.seconds % 60).padStart(2, "0")}</small> : null}</>; return imprint ? <button type="button" key={citation.imprintId} onClick={() => onOpen(citation.imprintId)}>{content}</button> : citation.url ? <a key={citation.imprintId} href={citation.url} target="_blank" rel="noreferrer">{content}<ArrowUpRight size={12} /></a> : null; })}</div></details>}{message.limitations?.slice(0, 1).map((limitation) => <small className="answer-caveat" key={limitation}>{limitation}</small>)}<AskOutcomeActions message={message} imprints={imprints} life={life} onOpenPlan={onOpenPlan} onUpdate={onUpdate} /></div></article>)}
          {thinking && <div className="message assistant"><div className="thinking"><span /><span /><span /><span className="sr-only">Thinking</span></div></div>}
          {failure && <section className="card ask-failure" role="alert"><strong>{failure.title}</strong><p>{failure.message}</p><button className="btn secondary" type="button" onClick={() => void send(failure.question, false)}>Try again</button></section>}
          <div ref={conversationEndRef} aria-hidden="true" />
        </div>
      )}
      {!decisionOpen && <AddBar
        label="Ask your library"
        placeholder="Ask your library…"
        sendLabel="Send question"
        value={input}
        onValueChange={(value) => { setInput(value); setValidationError(""); }}
        onSubmit={(text) => send(text)}
        busy={thinking}
        inputRef={inputRef}
        inputProps={{ minLength: ASK_MIN_LENGTH, maxLength: ASK_MAX_LENGTH, "aria-invalid": Boolean(validationError), "aria-describedby": validationError ? validationID : undefined }}
        notice={validationError ? <span id={validationID} role="alert">{validationError}</span> : undefined}
      />}
    </div>
  );
}

function EvolutionPage({ imprints, life, onOpen, onOpenPlan, onExplore, onSaved }: { imprints: Imprint[]; life: LifeOSController; onOpen: (id: string) => void; onOpenPlan: () => void; onExplore: (question: string) => void; onSaved: (imprint: Imprint) => Promise<{ id: string; mode: "synced" | "local" }> }) {
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
  const weeklySynthesis = useMemo(() => buildWeeklySynthesis(imprints, life.snapshot), [imprints, life.snapshot]);
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
    <div className="screen-body evolution-page">
      <div className="chip-row scroll" role="group" aria-label="Pattern views">{tabs.map((item) => <button className={cx("chip", tab === item && "selected")} aria-pressed={tab === item} type="button" key={item} onClick={() => setTab(item)}>{item}</button>)}</div>
      {loadFailed && <div className="partial-state" role="alert"><Warning size={20} /><span><strong>Couldn’t load patterns</strong><small>Your saved items are still available. Try again.</small></span></div>}
      {tab === "Compass" && weeklySynthesis && <WeeklySynthesisCard synthesis={weeklySynthesis} onCarryForward={async (task, revision) => { await retryPractice(task, revision); onOpenPlan(); }} onOpen={onOpen} />}
      {tab === "Compass" && <PersonalCompassSection overview={effectiveOverview} life={life.snapshot} imprints={imprints} onOpen={onOpen} onOpenPlan={onOpenPlan} onPrincipleChange={changePrinciple} onReflectPractice={life.reflectOnPractice} onRetryPractice={retryPractice} />}
      {tab === "Threads" && <LivingThreadsSection threads={threads} onOpen={onOpen} onExplore={onExplore} />}
      {tab === "Takeaways" && <section className="principles-section"><div className="section-heading-row"><div><h2>Takeaways</h2><p>Ideas pulled directly from individual saved items.</p></div></div>{principles.length ? <div className="principle-grid">{principles.map((principle) => <article key={`${principle.itemId}-${principle.text}`}><span>From one saved item</span><h3>{principle.text}</h3><button type="button" onClick={() => onOpen(principle.itemId)}>Open saved item <CaretRight size={15} /></button></article>)}</div> : <div className="partial-state"><Path size={20} /><span><strong>No takeaways yet</strong><small>Takeaways will appear when a saved item has a clear idea to keep.</small></span></div>}</section>}
      {tab === "Contrasts" && <section className="tension-section"><div className="tension-mark"><Path size={25} weight="light" /></div><div><span className="section-kicker">Compare two saves</span><h2>{tension ? "A useful contrast" : usesPreviewData ? "Example contrast" : "No contrasts yet"}</h2><p>{tension || (usesPreviewData ? "This preview shows where two saved items may take different approaches." : "Contrasts appear when two saves take different approaches to the same topic.")}</p>{tension && <div className="tension-sources"><button type="button" onClick={() => onOpen(overview!.tensions[0].fromItemId)}>First saved item</button><span>and</span><button type="button" onClick={() => onOpen(overview!.tensions[0].toItemId)}>Second saved item</button></div>}</div></section>}
      {tab === "History" && <section className="timeline-section"><div className="section-heading-row"><div><h2>Topics over time</h2><p>See which topics appeared in each month you saved something.</p></div></div>{timeline.length ? <div className="timeline">{timeline.map((entry, index) => <article className={index === timeline.length - 1 ? "current" : ""} key={`${entry.month}-${entry.title}`}><time>{entry.month}</time><div><strong>{entry.title}</strong><p>{entry.themes}</p></div></article>)}</div> : <div className="partial-state"><Clock size={20} /><span><strong>No history yet</strong><small>Months appear here after you save and process items.</small></span></div>}</section>}
      <LibraryAddBar imprints={imprints} onSaved={onSaved} onOpen={onOpen} />
    </div>
  );
}

function SettingsPage({ imprints, life, theme, onTheme, session, onSignOut, onClose, onRunSetup, focusSection }: { imprints: Imprint[]; life: LifeOSController; theme: ThemePreference; onTheme: (theme: ThemePreference) => void; session: AppSession | null; onSignOut: () => void; onClose: () => void; onRunSetup: () => void; focusSection?: "day" | null }) {
  useEffect(() => {
    if (focusSection !== "day") return;
    const frame = window.requestAnimationFrame(() => document.getElementById("settings-your-day")?.scrollIntoView?.({ block: "start" }));
    return () => window.cancelAnimationFrame(frame);
  }, [focusSection]);
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
    <div className="screen settings-page page-enter">
      <button className="btn quiet back-link" type="button" onClick={onClose}><ArrowLeft size={18} aria-hidden="true" /> Back</button>
      <header className="screen-header"><div className="screen-title-row"><h1>Settings</h1></div></header>
      <div className="setup-sections">
        <YourDaySection life={life} />
        <CommitmentSection life={life} kind="commitment" />
        <CommitmentSection life={life} kind="chore" />
        <NudgesSection />
        <AboutMeSection life={life} />
        <section className="setup-section" aria-label="Setup">
          <ul className="setup-list"><li><button className="setup-row" type="button" onClick={onRunSetup}><span><strong>Run setup again</strong></span><CaretRight size={16} aria-hidden="true" /></button></li></ul>
        </section>
      </div>
      <h2 className="section-label settings-more-label">Account and data</h2>
      <div className="settings-layout">
        <section className="settings-group"><div className="settings-title"><span><Moon size={19} /></span><div><h2>Appearance</h2><p>System follows your device automatically.</p></div></div><div className="segmented" role="group" aria-label="Color theme"><button type="button" aria-pressed={theme === "system"} className={theme === "system" ? "active" : ""} onClick={() => onTheme("system")}>System</button><button type="button" aria-pressed={theme === "light"} className={theme === "light" ? "active" : ""} onClick={() => onTheme("light")}><Sun size={16} /> Light</button><button type="button" aria-pressed={theme === "dark"} className={theme === "dark" ? "active" : ""} onClick={() => onTheme("dark")}><Moon size={16} /> Dark</button></div></section>
        <section className="settings-group"><div className="settings-title"><span><DownloadSimple size={19} /></span><div><h2>Your data</h2><p>Download a copy whenever you need one.</p></div></div><div className="export-actions"><button className="button secondary" type="button" disabled={exporting !== null} onClick={() => void download("md")}><BookOpen size={17} /> {exporting === "md" ? "Preparing..." : "Export Markdown"}</button><button className="button secondary" type="button" disabled={exporting !== null} onClick={() => void download("json")}><Database size={17} /> {exporting === "json" ? "Preparing..." : "Export JSON"}</button></div>{exportError && <p className="field-error" role="alert"><Warning size={15} /> {exportError}</p>}<div className="privacy-note"><ShieldCheck size={17} /><span><strong>Your saved items and personal records are included.</strong><small>Exports include saved item summaries, goals, tasks, calendar, health, finance, and file metadata. Download file contents separately.</small></span></div></section>
        {apiConfig.authMode === "token" && apiConfig.baseUrl && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/.test(apiConfig.baseUrl) && <section className="settings-group api-connection"><div className="settings-title"><span><Cloud size={19} /></span><div><h2>Private API connection</h2><p>Use a personal preview token for this browser only.</p></div></div><label className="token-field" htmlFor="api-token"><span>Bearer token</span><input id="api-token" type="password" value={apiToken} autoComplete="off" onChange={(event) => { setApiTokenValue(event.target.value); setApiToken(event.target.value); }} placeholder="Paste a private preview token" /></label><div className="privacy-note warning"><Warning size={17} /><span><strong>Private preview only.</strong><small>Browser tokens are not suitable for a public app. Add identity-provider authentication before launch.</small></span></div></section>}
        <section className="settings-group account"><div className="avatar">L</div><div><h2>Luke</h2><p>{session?.email || (apiConfig.authMode === "access" ? "Protected by Cloudflare Access" : "Local preview profile")}</p></div>{apiConfig.authMode === "access" ? <a className="button secondary" href="/cdn-cgi/access/logout">Sign out</a> : apiConfig.authMode === "password" ? <button className="button secondary" type="button" onClick={onSignOut}>Sign out</button> : <button className="button secondary" type="button" disabled aria-describedby="account-preview-note">Account sync coming soon</button>}{apiConfig.authMode === "token" && <span className="sr-only" id="account-preview-note">Account management is unavailable in this local preview.</span>}</section>
      </div>
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
  if (!apiConfig.baseUrl || (!life.pendingSync && !life.syncError)) return null;
  return <div className="life-sync-banner" role="status" aria-live="polite">
    <Cloud size={16} />
    <span>{life.syncError || `${life.pendingSync} change${life.pendingSync === 1 ? " is" : "s are"} syncing…`}</span>
    {life.syncError && <button type="button" disabled={life.working} onClick={() => void life.refresh()}>{life.working ? "Trying…" : "Try again"}</button>}
  </div>;
}

function AvatarButton({ onClick }: { onClick: () => void }) {
  return <button className="avatar-button" type="button" onClick={onClick} aria-label="Open settings" title="Profile and settings"><span aria-hidden="true">L</span></button>;
}

/** Large left-aligned title, the avatar, and (optionally) a pill segment control below it. */
function ScreenHeader({ title, onAvatar, sections, active, onNavigate, children }: {
  title: string;
  onAvatar: () => void;
  sections?: Array<{ page: Page; label: string }>;
  active?: Page;
  onNavigate?: (page: Page) => void;
  children?: ReactNode;
}) {
  return <header className="screen-header">
    <div className="screen-title-row"><h1>{title}</h1><AvatarButton onClick={onAvatar} /></div>
    {children}
    {sections && onNavigate && <nav className="segments" aria-label={`${title} sections`}>
      {sections.map((section) => <button className={active === section.page ? "active" : ""} type="button" key={section.page} aria-current={active === section.page ? "page" : undefined} onClick={() => onNavigate(section.page)}>{section.label}</button>)}
    </nav>}
  </header>;
}

const planSections: Array<{ page: Page; label: string }> = [{ page: "tasks", label: "Tasks" }, { page: "calendar", label: "Calendar" }, { page: "goals", label: "Goals" }];
const librarySections: Array<{ page: Page; label: string }> = [{ page: "library", label: "Saved" }, { page: "evolution", label: "Patterns" }];
const lifeSections: Array<{ page: Page; label: string }> = [{ page: "health", label: "Health" }, { page: "money", label: "Money" }, { page: "files", label: "Files" }];

export function App() {
  return <ToastProvider><LockInProvider><AppContent /></LockInProvider></ToastProvider>;
}

function AppContent() {
  const [route, setRoute] = useState<AppRoute>(() => routeFromHash());
  const { page, detailId } = route;
  const settingsReturnRef = useRef<Page>("home");
  const [settingsFocus, setSettingsFocus] = useState<"day" | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const setupChecked = useRef(false);
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
  // First run: once the real snapshot is in, offer setup if nothing is set up yet.
  useEffect(() => {
    if (setupChecked.current || authStatus !== "authenticated" || life.loading || !life.remote) return;
    setupChecked.current = true;
    if (shouldShowSetup({ remote: life.remote, loading: life.loading, commitments: life.snapshot.commitments.length })) setSetupOpen(true);
  }, [authStatus, life.loading, life.remote, life.snapshot.commitments.length]);
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
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth" });
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
  const openSettings = (focus: "day" | null = null) => { settingsReturnRef.current = page === "settings" ? "home" : page; setSettingsFocus(focus); navigate("settings"); };
  const explore = (question: string) => { sessionStorage.setItem(ASK_SEED_STORAGE_KEY, question); navigate("ask"); };
  const saveCapture = async (draft: Imprint) => {
    const { item, synced } = await saveImprint(draft);
    replaceImprint(item, draft.id);
    return { id: item.id, mode: synced ? "synced" as const : "local" as const };
  };
  const activeImprint = detailId ? imprints.find((item) => item.id === detailId) : null;
  const primaryPage = primaryForPage(page);
  const planSection: Page = page === "goals" || page === "calendar" ? page : "tasks";
  const librarySection: Page = page === "evolution" ? "evolution" : "library";
  const youSection: Page = page === "money" || page === "files" ? page : "health";
  const signOut = () => { void logout().finally(() => { clearAskStorage(); setSession(null); setImprints([]); setAuthStatus("anonymous"); }); };
  const loading = (label: string) => <FeatureLoading label={label} />;
  const screen = activeImprint
    ? <DetailPage imprint={activeImprint} imprints={imprints} life={life} onBack={() => navigate("library")} onOpen={openDetail} onOpenPlan={() => navigate("tasks")} onUpdate={replaceImprint} />
    : page === "settings" ? <SettingsPage imprints={imprints} life={life} theme={themePreference} onTheme={setThemePreference} session={session} onSignOut={signOut} onClose={() => navigate(settingsReturnRef.current)} onRunSetup={() => setSetupOpen(true)} focusSection={settingsFocus} />
    : <div className="screen page-enter" key={primaryPage}>
      {page === "home" ? <>
        <ScreenHeader title="Today" onAvatar={() => openSettings()}><JevStatusLine life={life} onOpen={() => openSettings("day")} /></ScreenHeader>
        <HomePage imprints={imprints} resurfaced={resurfaced} onOpen={openDetail} onNavigate={navigate} life={life} />
      </> : page === "ask" ? <>
        <ScreenHeader title="Ask" onAvatar={() => openSettings()} />
        <AskPage imprints={imprints} life={life} onOpen={openDetail} onOpenPlan={() => navigate("tasks")} onUpdate={replaceImprint} />
      </> : primaryPage === "plan" ? <>
        <ScreenHeader title="Plan" onAvatar={() => openSettings()} sections={planSections} active={planSection} onNavigate={navigate} />
        <Suspense fallback={loading("Opening your plan…")}>{planSection === "goals" ? <GoalsPage life={life} /> : planSection === "calendar" ? <CalendarPage life={life} /> : <TasksPage life={life} />}</Suspense>
      </> : primaryPage === "library" ? <>
        <ScreenHeader title="Library" onAvatar={() => openSettings()} sections={librarySections} active={librarySection} onNavigate={navigate} />
        {librarySection === "evolution"
          ? <EvolutionPage imprints={imprints} life={life} onOpen={openDetail} onOpenPlan={() => navigate("tasks")} onExplore={explore} onSaved={saveCapture} />
          : <LibraryPage imprints={imprints} onOpen={openDetail} loading={libraryLoading} onSaved={saveCapture} onExplore={explore} onSeeCompass={() => navigate("evolution")} />}
      </> : <>
        <ScreenHeader title="Life" onAvatar={() => openSettings()} sections={lifeSections} active={youSection} onNavigate={navigate} />
        <Suspense fallback={loading("Opening Life…")}>{youSection === "money" ? <MoneyPage life={life} /> : youSection === "files" ? <FilesPage life={life} /> : <HealthPage life={life} />}</Suspense>
      </>}
    </div>;
  return (
    <div className={cx("app-shell", youSection === "health" && primaryPage === "you" && "no-add-bar", (page === "settings" || activeImprint) && "no-add-bar")}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <ConnectivityBanner remoteUnavailable={Boolean(apiConfig.baseUrl && librarySource === "local")} onRetry={() => void refreshLibrary(undefined, true)} />
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => navigate("home")} aria-label="Remember home"><AppMark /><span>Remember</span></button>
        <nav aria-label="Primary navigation">{navItems.map(({ page: itemPage, label, icon: Icon }) => { const active = primaryPage === itemPage; return <button className={cx(active && "active")} type="button" key={itemPage} onClick={() => navigate(itemPage)} aria-label={label} title={label} aria-current={active ? "page" : undefined}><Icon size={22} weight={active ? "fill" : "regular"} /><span>{label}</span></button>; })}</nav>
      </aside>
      <main id="main-content">
        <LifeSyncBanner life={life} />
        {screen}
      </main>
      <LockInHost life={life} onFinished={() => navigate("home")} />
      <RoutineNudger life={life} />
      {setupOpen && <Onboarding life={life} onFinish={() => { setSetupOpen(false); navigate("home"); }} />}
      <nav className="bottom-nav" aria-label="Mobile navigation">{navItems.map(({ page: itemPage, label, icon: Icon }) => { const active = primaryPage === itemPage; return <button className={cx(active && "active")} type="button" key={itemPage} onClick={() => navigate(itemPage)} aria-current={active ? "page" : undefined}><Icon size={24} weight={active ? "fill" : "regular"} /><span>{label}</span></button>; })}</nav>
    </div>
  );
}


export { pageTitles };

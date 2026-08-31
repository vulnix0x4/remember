import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Article,
  BookOpen,
  Books,
  Brain,
  CalendarBlank,
  CaretDown,
  CaretRight,
  ChatCircleDots,
  Check,
  Clock,
  Cloud,
  Database,
  DownloadSimple,
  FolderOpen,
  GearSix,
  Headphones,
  Heartbeat,
  House,
  LinkSimple,
  ListChecks,
  LockKey,
  MagnifyingGlass,
  NotePencil,
  Moon,
  PaperPlaneRight,
  Path,
  Play,
  Plus,
  Quotes,
  ShieldCheck,
  SlidersHorizontal,
  Sparkle,
  Sun,
  Target,
  TreeStructure,
  Warning,
  WifiSlash,
  Wallet,
  X,
  YoutubeLogo,
} from "@phosphor-icons/react";
import { imprints as fixtureImprints, suggestedQuestions, themeData } from "./fixtures";
import { apiConfig, askLibrary, downloadLibraryExport, getApiToken, loadEvolution, loadImprint, loadImprints, loadResurfacedMemory, loadSession, login, logout, respondToResurfacing, retryImprint, saveImprint, searchImprints, setApiToken, updatePrinciple, type AppSession, type EvolutionOverview, type ResurfacedMemory } from "./services/api";
import { exportImprintsJson, exportImprintsMarkdown } from "./services/export";
import type { AskMessage, Imprint, Page } from "./types";
import { CalendarPage, FilesPage, GoalsPage, HealthPage, LifeOverview, MoneyPage, TasksPage } from "./life/LifeOS";
import { useLifeOS, type LifeOSController } from "./life/useLifeOS";

const navItems: { page: Page; label: string; icon: typeof House }[] = [
  { page: "home", label: "Today", icon: House },
  { page: "tasks", label: "Tasks", icon: ListChecks },
  { page: "goals", label: "Goals", icon: Target },
  { page: "calendar", label: "Calendar", icon: CalendarBlank },
  { page: "health", label: "Health", icon: Heartbeat },
  { page: "money", label: "Money", icon: Wallet },
  { page: "files", label: "Files", icon: FolderOpen },
  { page: "library", label: "Library", icon: Books },
  { page: "ask", label: "Ask", icon: ChatCircleDots },
  { page: "evolution", label: "Evolution", icon: TreeStructure },
];

const mobileNavItems: { page: Page; label: string; icon: typeof House }[] = [
  { page: "home", label: "Today", icon: House },
  { page: "tasks", label: "Tasks", icon: ListChecks },
  { page: "calendar", label: "Calendar", icon: CalendarBlank },
  { page: "library", label: "Memory", icon: Books },
  { page: "settings", label: "Settings", icon: GearSix },
];

const pageTitles: Record<Page, string> = {
  home: "Today",
  tasks: "Tasks",
  goals: "Goals",
  calendar: "Calendar",
  health: "Health",
  money: "Money",
  files: "Files",
  library: "Your library",
  ask: "Ask your memory",
  evolution: "Your evolution",
  settings: "Settings",
};

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
      <div className="login-ambient" aria-hidden="true"><span /><span /><span /></div>
      <section className="login-story" aria-label="About Remember">
        <button className="brand login-brand" type="button" aria-label="Remember"><AppMark /><span>Remember</span></button>
        <div className="login-story-copy">
          <p className="login-eyebrow"><Sparkle size={15} weight="fill" /> Your private Personal Life OS</p>
          <h1>Your life,<br /><em>back in view.</em></h1>
          <p>Knowledge, goals, one next move, calendar, health, money, and files—connected without turning your life into a feed.</p>
        </div>
        <p className="login-trust"><ShieldCheck size={17} /> Private by design. Your sources remain yours.</p>
      </section>
      <section className="login-panel">
        <form className="login-card page-enter" onSubmit={submit}>
          <span className="login-lock"><LockKey size={22} weight="duotone" /></span>
          <div><p className="login-kicker">Welcome back</p><h2>Enter Remember</h2><p className="login-intro">Sign in to continue to your private operating system.</p></div>
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

function EmptyState({ query, onCapture }: { query?: string; onCapture: () => void }) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-orbit"><MagnifyingGlass size={26} weight="light" /></span>
      <h2>{query ? "Nothing found" : "Your memory starts here"}</h2>
      <p>{query ? `No Imprints match “${query}”. Try a theme, creator, or idea.` : "Save something that stayed with you. The rest happens in the background."}</p>
      {!query && <button className="button primary" type="button" onClick={onCapture}><Plus size={17} /> Save a link</button>}
    </div>
  );
}

function ProcessingLine({ label = "Understanding this source" }: { label?: string }) {
  return (
    <div className="processing-line" role="status" aria-live="polite">
      <span className="processing-pulse" />
      <span>{label}</span>
      <span className="processing-shimmer" aria-hidden="true" />
    </div>
  );
}

function StatusBadge({ status }: { status: Imprint["status"] }) {
  if (status === "ready") return null;
  const labels = { processing: "Processing", partial: "Partial analysis", failed: "Needs attention" };
  return <span className={cx("status-badge", status)}>{status === "failed" ? <Warning size={13} /> : <span className="status-dot" />}{labels[status]}</span>;
}

function AnalysisScopeBadge({ imprint }: { imprint: Imprint }) {
  const label = imprint.status === "ready" ? analysisScopeLabel(imprint) : null;
  return label ? <span className="scope-badge"><ShieldCheck size={12} /> {label}</span> : null;
}

function ImprintArtwork({ imprint, large = false, showSourceAction = false }: { imprint: Imprint; large?: boolean; showSourceAction?: boolean }) {
  const SourceIcon = isVideoSource(imprint) ? Play : sourceIcon(imprint.sourceType);
  return (
    <div className={cx("imprint-art", `tone-${imprint.color}`, large && "large", imprint.thumbnailUrl && "has-source-image")} aria-hidden="true">
      {imprint.thumbnailUrl && <img src={imprint.thumbnailUrl} alt="" loading={large ? "eager" : "lazy"} decoding="async" />}
      <span className="art-arc arc-one" />
      <span className="art-arc arc-two" />
      <span className="art-grain" />
      <span className="art-source-mark"><SourceIcon size={large ? 31 : 23} weight="fill" /></span>
      {showSourceAction && <span className="source-image-cta">{isVideoSource(imprint) ? <Play size={13} weight="fill" /> : <ArrowUpRight size={13} />} {isVideoSource(imprint) ? "Watch original" : "Open original"}</span>}
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

function ResurfacedFeature({ imprint, onOpen, onReact }: { imprint: Imprint; onOpen: (id: string) => void; onReact: (reaction: "still" | "changed" | "unsure") => Promise<boolean> }) {
  const [reaction, setReaction] = useState<"still" | "changed" | "unsure" | null>(null);
  const [submittingReaction, setSubmittingReaction] = useState(false);
  const [reactionError, setReactionError] = useState(false);
  const chooseReaction = async (choice: "still" | "changed" | "unsure") => {
    setSubmittingReaction(true);
    setReactionError(false);
    const recorded = await onReact(choice);
    setSubmittingReaction(false);
    if (recorded) setReaction(choice);
    else setReactionError(true);
  };
  return (
    <section className="resurface-feature" aria-labelledby="resurface-title">
      <div className="resurface-art"><ImprintArtwork imprint={imprint} large /></div>
      <div className="resurface-content">
        <div className="section-kicker"><Sparkle size={15} weight="fill" /> Saved {imprint.savedAt}</div>
        <h2 id="resurface-title">{imprint.essence}</h2>
        <p>{imprint.hypothesis}</p>
        <div className="source-inline">{isVideoSource(imprint) ? <Play size={16} weight="fill" /> : <Article size={16} weight="fill" />}<span>{imprint.title}</span>{imprint.duration && <span>{imprint.duration}</span>}</div>
        {reaction ? (
          <div className="reaction-confirm" role="status"><Check size={17} weight="bold" /> Noted. Your response was saved.</div>
        ) : (
          <div className="reaction-row" aria-label="Does this still feel true?">
            <span>Still feel true?</span>
            <button type="button" disabled={submittingReaction} onClick={() => void chooseReaction("still")}>Yes</button>
            <button type="button" disabled={submittingReaction} onClick={() => void chooseReaction("changed")}>Not anymore</button>
            <button type="button" disabled={submittingReaction} onClick={() => void chooseReaction("unsure")}>Not sure</button>
          </div>
        )}
        {reactionError && <p className="login-error" role="alert"><Warning size={15} /> That response was not saved. Please try again.</p>}
        <button className="text-button" type="button" onClick={() => onOpen(imprint.id)}>Open Imprint <ArrowRight size={16} /></button>
      </div>
    </section>
  );
}

function HomePage({ imprints, resurfaced, onOpen, onCapture, onNavigate, life }: { imprints: Imprint[]; resurfaced: ResurfacedMemory | null; onOpen: (id: string) => void; onCapture: () => void; onNavigate: (p: Page) => void; life: LifeOSController }) {
  const surfaced = resurfaced ? imprints.find((item) => item.id === resurfaced.itemId) : undefined;
  const recent = imprints.filter((item) => item.id !== surfaced?.id).slice(0, 3);
  return (
    <div className="page home-page page-enter">
      <header className="page-heading home-heading">
        <div><p className="date-label">{todayLabel()}</p><h1>Your memory.</h1><p>{surfaced ? "Here is an older idea worth revisiting." : "Recent saves stay close until they are old enough to resurface."}</p></div>
        <button className="button primary desktop-action" type="button" onClick={onCapture}><Plus size={18} weight="bold" /> Save something</button>
      </header>
      <LifeOverview life={life} onNavigate={onNavigate} />
      {surfaced && resurfaced ? <ResurfacedFeature imprint={surfaced} onOpen={onOpen} onReact={(reaction) => respondToResurfacing(resurfaced.eventId, reaction === "still" ? "still_true" : reaction === "changed" ? "changed_mind" : "not_sure")} /> : imprints.length === 0 ? <EmptyState onCapture={onCapture} /> : <div className="partial-state" role="status"><Clock size={20} /><span><strong>Nothing old enough to resurface yet</strong><small>A Ready item becomes eligible after it has been saved for at least seven days.</small></span></div>}
      {recent.length > 0 && <section className="recent-section" aria-labelledby="recent-title">
        <div className="section-heading-row"><div><h2 id="recent-title">Recently saved</h2><p>New ideas are still settling into place.</p></div><button className="text-button" type="button" onClick={() => onNavigate("library")}>View library <ArrowRight size={16} /></button></div>
        <div className="recent-list">{recent.map((item) => <ImprintRow key={item.id} imprint={item} onOpen={onOpen} />)}</div>
      </section>}
      <button className="mobile-fab" type="button" onClick={onCapture}><Plus size={22} weight="bold" /><span>Save</span></button>
    </div>
  );
}

function LibraryPage({ imprints, onOpen, onCapture }: { imprints: Imprint[]; onOpen: (id: string) => void; onCapture: () => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [sortOpen, setSortOpen] = useState(false);
  const [sort, setSort] = useState<"Newest" | "Oldest">("Newest");
  const [searchResults, setSearchResults] = useState<Imprint[] | null>(null);
  const [searching, setSearching] = useState(false);
  const filters = ["All", "Videos", "Articles", "Processing", "Needs attention"];
  useEffect(() => {
    if (!query.trim()) { setSearchResults(null); setSearching(false); return; }
    const controller = new AbortController();
    setSearching(true);
    const timeout = window.setTimeout(() => {
      searchImprints(query, imprints, controller.signal).then(({ items }) => setSearchResults(items)).catch(() => undefined).finally(() => setSearching(false));
    }, 280);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [imprints, query]);
  const visible = useMemo(() => {
    let items = searchResults ?? (query.trim() ? [] : imprints);
    if (filter === "Videos") items = items.filter(isVideoSource);
    if (filter === "Articles") items = items.filter((item) => !isVideoSource(item) && item.sourceType !== "Podcast");
    if (filter === "Processing") items = items.filter((item) => item.status === "processing");
    if (filter === "Needs attention") items = items.filter((item) => item.status === "partial" || item.status === "failed");
    return sort === "Newest" ? items : [...items].reverse();
  }, [filter, imprints, query, searchResults, sort]);
  return (
    <div className="page page-enter">
      <header className="page-heading library-heading">
        <div><h1>Your library</h1><p>{imprints.length} things that have stayed with you.</p></div>
        <button className="button primary desktop-action" type="button" onClick={onCapture}><Plus size={18} weight="bold" /> Save something</button>
      </header>
      <div className="library-tools">
        <label className="search-field"><span className="sr-only">Search your library</span><MagnifyingGlass size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by idea, theme, or source" /></label>
        <div className="sort-wrap">
          <button className="button secondary icon-label" type="button" aria-expanded={sortOpen} onClick={() => setSortOpen(!sortOpen)}><SlidersHorizontal size={17} /> {sort} <CaretDown size={14} /></button>
          {sortOpen && <div className="popover" role="menu"><button role="menuitem" type="button" onClick={() => { setSort("Newest"); setSortOpen(false); }}>Newest first</button><button role="menuitem" type="button" onClick={() => { setSort("Oldest"); setSortOpen(false); }}>Oldest first</button></div>}
        </div>
      </div>
      <div className="filter-strip" role="group" aria-label="Filter library">{filters.map((item) => <button className={cx(filter === item && "active")} type="button" key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div>
      <div className="library-summary"><span>{searching ? "Searching by meaning..." : `${visible.length} Imprints`}</span><span>Auto-organized by meaning</span></div>
      {visible.length ? <div className="library-grid">{visible.map((item) => <ImprintRow key={item.id} imprint={item} onOpen={onOpen} />)}</div> : <EmptyState query={query || filter} onCapture={onCapture} />}
      <button className="mobile-fab" type="button" onClick={onCapture}><Plus size={22} weight="bold" /><span>Save</span></button>
    </div>
  );
}

function DetailPage({ imprint, imprints, onBack, onOpen, onUpdate }: { imprint: Imprint; imprints: Imprint[]; onBack: () => void; onOpen: (id: string) => void; onUpdate: (item: Imprint) => void }) {
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
      <header className="detail-hero">
        <a className="detail-art-link" href={imprint.url} target="_blank" rel="noreferrer" aria-label={`Open original source: ${imprint.title}`}>
          <ImprintArtwork imprint={imprint} large showSourceAction />
        </a>
        <div className="detail-title">
          <div className="source-inline"><span>{sourceLabel(imprint)}</span><span>{imprint.savedAt}</span><StatusBadge status={imprint.status} /><AnalysisScopeBadge imprint={imprint} /></div>
          <h1>{imprint.title}</h1>
          <p className="creator">{imprint.creator}</p>
          <a className="button secondary" href={imprint.url} target="_blank" rel="noreferrer">Open source <ArrowUpRight size={16} /></a>
        </div>
      </header>
      {imprint.status === "processing" && <ProcessingLine label="Finding moments, themes, and connections" />}
      {imprint.status === "failed" && <div className="partial-state" role="alert"><Warning size={20} /><span><strong>Analysis needs another try</strong><small>{imprint.summary}</small></span><button className="button primary" type="button" disabled={retrying} onClick={() => void retry()}>{retrying ? "Retrying..." : "Try again"}</button></div>}
      {actionError && <p className="login-error" role="alert"><Warning size={15} /> {actionError}</p>}
      <div className="detail-layout">
        <div className="detail-main">
          <section className="essence-section"><Quotes size={23} weight="fill" /><p>{imprint.essence}</p></section>
          <section className="content-section"><h2>What it says</h2><p>{imprint.summary}</p>{imprint.summary.length > 120 && <button className="text-button" type="button" aria-expanded={summaryOpen} onClick={() => setSummaryOpen(!summaryOpen)}>{summaryOpen ? "Show less" : "See analysis notes"} <CaretDown className={cx(summaryOpen && "rotate")} size={15} /></button>}{summaryOpen && <div className="analysis-note"><ShieldCheck size={18} /> This analysis is generated from the source. It does not include claims about why you personally saved it.</div>}</section>
          <section className="content-section"><h2>Ideas worth keeping</h2><ol className="idea-list">{imprint.keyIdeas.map((idea, index) => <li key={idea}><span>{String(index + 1).padStart(2, "0")}</span><p>{idea}</p></li>)}</ol></section>
          <section className="content-section"><h2>Key moments</h2>{imprint.moments.length ? <div className="moment-list">{imprint.moments.map((moment) => <a key={moment.time} href={secondsUrl(imprint, moment.seconds)} target="_blank" rel="noreferrer"><span className="moment-time"><Play size={12} weight="fill" /> {moment.time}</span><span><strong>{moment.title}</strong><small>{moment.note}</small></span><ArrowUpRight size={16} /></a>)}</div> : momentsEmpty}</section>
          {imprint.principle && <section className="carry-section"><div><span className="section-kicker"><Path size={15} /> A possible principle</span><h2>{imprint.principle}</h2><p>Suggested from this source. Keep it only if it feels true to you.</p></div>{imprint.principleId && <button className={cx("button", principleStatus === "active" ? "secondary success" : "primary")} type="button" onClick={() => void togglePrinciple()}>{principleStatus === "active" ? <><Check size={17} weight="bold" /> Kept</> : "Keep this principle"}</button>}</section>}
          {related.length > 0 && <section className="content-section"><h2>This connects to</h2><div className="connection-list">{related.map((item, index) => <button type="button" key={item.id} onClick={() => onOpen(item.id)}><span className="connection-type">{index === 0 ? "Extends" : "Same theme"}</span><strong>{item.essence}</strong><small>{item.title}</small><CaretRight size={17} /></button>)}</div></section>}
        </div>
        <aside className="detail-aside">
          <section><h2>When you saved this</h2><strong>{imprint.lifePeriod}</strong><span>{imprint.savedAt}</span></section>
          <section><h2>Themes</h2><div className="theme-list large">{imprint.themes.map((theme) => <span key={theme}>{theme}</span>)}</div></section>
          {imprint.hypothesis && <section className="hypothesis"><h2>Why this may have mattered</h2><p>{imprint.hypothesis}</p><span><Sparkle size={13} /> A possibility, not a fact</span></section>}
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

function AskPage({ imprints, onOpen }: { imprints: Imprint[]; onOpen: (id: string) => void }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadIdRef = useRef<string | null>(null);
  const send = async (question: string) => {
    const clean = question.trim();
    if (!clean || thinking) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: clean }]);
    setInput("");
    setThinking(true);
    const apiAnswer = await askLibrary(clean, undefined, undefined, undefined, threadIdRef.current ?? undefined);
    if (!apiAnswer) await new Promise((resolve) => window.setTimeout(resolve, 450));
    if (apiAnswer?.threadId) threadIdRef.current = apiAnswer.threadId;
    setMessages((current) => [...current, apiAnswer ?? answerFor(clean)]);
    setThinking(false);
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void send(input); };
  return (
    <div className="page ask-page page-enter">
      <header className="page-heading"><div><h1>Ask your memory</h1><p>Answers use only your saved material. When evidence is available, the answer cites the sources it used.</p></div></header>
      {messages.length === 0 ? (
        <div className="ask-start">
          <div className="ask-orbit" aria-hidden="true"><Brain size={42} weight="light" /><span /><span /></div>
          <h2>What do you want to remember?</h2>
          <p>Ask about an idea, a source you cannot find, or a pattern across everything you have saved.</p>
          <div className="question-grid">{suggestedQuestions.map((question) => <button type="button" key={question} onClick={() => void send(question)}><span>{question}</span><ArrowUpRight size={16} /></button>)}</div>
        </div>
      ) : (
        <div className="conversation" aria-live="polite">{messages.map((message) => <article className={cx("message", message.role)} key={message.id}>{message.role === "assistant" && <span className="assistant-mark"><AppMark /></span>}<div><p>{message.text}</p>{message.grounded !== undefined && <small className="composer-note"><ShieldCheck size={13} /> {message.grounded ? "Grounded in your library" : "Not enough supporting material"}</small>}{message.citations && message.citations.length > 0 && <div className="citations"><span>Sources</span>{message.citations.map((citation, index) => { const imprint = imprints.find((item) => item.id === citation.imprintId); const content = <><span>{index + 1}</span>{citation.label}{citation.seconds ? <small>{Math.floor(citation.seconds / 60)}:{String(citation.seconds % 60).padStart(2, "0")}</small> : null}</>; return imprint ? <button type="button" key={`${citation.imprintId}-${index}`} onClick={() => onOpen(citation.imprintId)}>{content}</button> : citation.url ? <a key={`${citation.imprintId}-${index}`} href={citation.url} target="_blank" rel="noreferrer">{content}<ArrowUpRight size={12} /></a> : null; })}</div>}{message.limitations?.map((limitation) => <small className="composer-note" key={limitation}>{limitation}</small>)}</div></article>)}{thinking && <div className="message assistant"><span className="assistant-mark"><AppMark /></span><div className="thinking"><span /><span /><span /><span className="sr-only">Thinking</span></div></div>}</div>
      )}
      <form className="ask-composer" onSubmit={submit}>
        <label htmlFor="ask-input" className="sr-only">Ask your library</label>
        <textarea ref={inputRef} id="ask-input" value={input} rows={1} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(input); } }} placeholder="Ask anything about what shaped you" />
        <button type="submit" aria-label="Send question" disabled={!input.trim() || thinking}><PaperPlaneRight size={19} weight="fill" /></button>
        <span className="composer-note"><ShieldCheck size={13} /> Grounded in {imprints.filter((item) => item.status === "ready").length} analyzed Imprints</span>
      </form>
    </div>
  );
}

function EvolutionPage({ onOpen }: { onOpen: (id: string) => void }) {
  const [tab, setTab] = useState("Overview");
  const [overview, setOverview] = useState<EvolutionOverview | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    loadEvolution(controller.signal).then((result) => { setOverview(result); setLoadFailed(Boolean(apiConfig.baseUrl && !result)); }).catch((error) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) setLoadFailed(true);
    });
    return () => controller.abort();
  }, []);
  const tabs = ["Overview", "Themes", "Principles", "Tensions", "Timeline"];
  const usesPreviewData = !apiConfig.baseUrl;
  const themes = overview?.themes.length ? overview.themes.slice(0, 4).map((theme, index) => ({ name: theme.name, count: theme.count, change: theme.lastSeenAt ? `Seen ${new Date(theme.lastSeenAt).toLocaleDateString("en-US", { month: "short" })}` : "From your saves", color: ["var(--accent)", "var(--ink-3)", "var(--ink-4)", "var(--accent-soft)"][index] })) : usesPreviewData ? themeData : [];
  const principles = overview ? overview.principles.slice(0, 2) : usesPreviewData ? [{ itemId: "worst-years", text: "Pain can become useful without being good." }, { itemId: "creative-life", text: "A meaningful life requires choosing what not to pursue." }] : [];
  const tension = overview?.tensions[0]?.explanation;
  const timeline = overview ? overview.timeline.slice(0, 3).map((entry) => ({ month: entry.month, title: entry.theme, themes: `${entry.theme}, ${entry.count} source${entry.count === 1 ? "" : "s"}` })) : usesPreviewData ? [{ month: "June 2026", title: "Learning to stay with uncertainty", themes: "Identity, uncertainty, patience" }, { month: "July 2026", title: "Learning to release without erasing", themes: "Relationships, acceptance, grief" }, { month: "August 2026", title: "Rebuilding through meaningful work", themes: "Purpose, building, independence" }] : [];
  const leadingTheme = overview?.themes[0];
  return (
    <div className="page evolution-page page-enter">
      <header className="page-heading"><div><h1>Your evolution</h1><p>Exact counts and source-backed interpretations from analyzed saves. This is not a profile or a prediction.</p></div></header>
      <div className="tab-strip" role="tablist" aria-label="Evolution views">{tabs.map((item) => <button role="tab" aria-selected={tab === item} type="button" key={item} onClick={() => setTab(item)}>{item}</button>)}</div>
      {loadFailed && <div className="partial-state" role="alert"><Warning size={20} /><span><strong>Evolution could not be loaded</strong><small>Your library is safe. Refresh to try this view again.</small></span></div>}
      {(tab === "Overview" || tab === "Themes") && <section className="theme-overview"><div className="theme-intro"><span className="section-kicker"><Sparkle size={15} /> Across analyzed sources</span><h2>{leadingTheme ? `${leadingTheme.name} is the most frequent theme so far.` : usesPreviewData ? "Themes from preview material." : "No supported themes yet."}</h2><p>{leadingTheme ? `${leadingTheme.name} appears in ${leadingTheme.count} analyzed source${leadingTheme.count === 1 ? "" : "s"}. This is a count, not a claim about how you are changing.` : usesPreviewData ? "Preview data demonstrates the layout only." : "Themes appear here only after an analyzed source supports them."}</p><button className="text-button" type="button" onClick={() => setTab("Themes")}>Explore themes <ArrowRight size={16} /></button></div><div className="theme-cloud">{themes.map((theme, index) => <button type="button" key={theme.name} onClick={() => setTab("Themes")} style={{ "--theme-color": theme.color, "--theme-index": index } as React.CSSProperties}><strong>{theme.name}</strong><span>{theme.count} source{theme.count === 1 ? "" : "s"}</span><small>{theme.change}</small></button>)}</div></section>}
      {(tab === "Overview" || tab === "Principles") && <section className="principles-section"><div className="section-heading-row"><div><h2>Ideas from analyzed sources</h2><p>Each statement belongs to the source beneath it. It is not treated as a repeated belief unless multiple sources support it.</p></div><button className="text-button" type="button" onClick={() => setTab("Principles")}>View all <ArrowRight size={16} /></button></div>{principles.length ? <div className="principle-grid">{principles.map((principle) => <article key={`${principle.itemId}-${principle.text}`}><span>From one analyzed source</span><h3>{principle.text}</h3><button type="button" onClick={() => onOpen(principle.itemId)}>Review source <CaretRight size={15} /></button></article>)}</div> : <div className="partial-state"><Path size={20} /><span><strong>No source-backed ideas yet</strong><small>Candidate principles appear only when an analyzed source contains one.</small></span></div>}</section>}
      {(tab === "Overview" || tab === "Tensions") && <section className="tension-section"><div className="tension-mark"><Path size={25} weight="light" /></div><div><span className="section-kicker">Across two sources</span><h2>{tension ? "A possible tension" : usesPreviewData ? "Preview tension" : "No possible tensions yet"}</h2><p>{tension || (usesPreviewData ? "Preview data demonstrates where a source-backed tension would appear." : "Remember will suggest a tension when two analyzed sources appear to pull in different directions. You decide whether the comparison is useful.")}</p>{tension && <div className="tension-sources"><button type="button" onClick={() => onOpen(overview!.tensions[0].fromItemId)}>First source</button><span>and</span><button type="button" onClick={() => onOpen(overview!.tensions[0].toItemId)}>Second source</button></div>}</div></section>}
      {(tab === "Overview" || tab === "Timeline") && <section className="timeline-section"><div className="section-heading-row"><div><h2>Themes by save month</h2><p>Exact theme counts grouped by when each source was saved.</p></div><button className="text-button" type="button" onClick={() => setTab("Timeline")}>Full timeline <ArrowRight size={16} /></button></div>{timeline.length ? <div className="timeline">{timeline.map((entry, index) => <article className={index === timeline.length - 1 ? "current" : ""} key={`${entry.month}-${entry.title}`}><time>{entry.month}</time><div><strong>{entry.title}</strong><p>{entry.themes}</p></div></article>)}</div> : <div className="partial-state"><Clock size={20} /><span><strong>No timeline data yet</strong><small>Analyzed themes will be grouped by save month here.</small></span></div>}</section>}
    </div>
  );
}

function SettingsPage({ imprints, life, theme, onTheme, session, onSignOut }: { imprints: Imprint[]; life: LifeOSController; theme: "light" | "dark"; onTheme: (theme: "light" | "dark") => void; session: AppSession | null; onSignOut: () => void }) {
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
      <header className="page-heading"><div><h1>Settings</h1><p>Control your appearance, account, and exported data.</p></div></header>
      <div className="settings-layout">
        <section className="settings-group"><div className="settings-title"><span><Moon size={19} /></span><div><h2>Appearance</h2><p>Your choice is saved in this browser.</p></div></div><div className="segmented" aria-label="Color theme"><button type="button" className={theme === "light" ? "active" : ""} onClick={() => onTheme("light")}><Sun size={16} /> Light</button><button type="button" className={theme === "dark" ? "active" : ""} onClick={() => onTheme("dark")}><Moon size={16} /> Dark</button></div></section>
        <section className="settings-group"><div className="settings-title"><span><DownloadSimple size={19} /></span><div><h2>Your data</h2><p>Your life should outlive any app.</p></div></div><div className="export-actions"><button className="button secondary" type="button" disabled={exporting !== null} onClick={() => void download("md")}><BookOpen size={17} /> {exporting === "md" ? "Preparing..." : "Export Markdown"}</button><button className="button secondary" type="button" disabled={exporting !== null} onClick={() => void download("json")}><Database size={17} /> {exporting === "json" ? "Preparing..." : "Export JSON"}</button></div>{exportError && <p className="field-error" role="alert"><Warning size={15} /> {exportError}</p>}<div className="privacy-note"><ShieldCheck size={17} /><span><strong>Your knowledge and Life OS records are included.</strong><small>Exports contain analyses, goals, tasks, calendar, health, finance, and vault metadata. Download vault file contents separately.</small></span></div></section>
        {apiConfig.authMode === "token" && apiConfig.baseUrl && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/.test(apiConfig.baseUrl) && <section className="settings-group api-connection"><div className="settings-title"><span><Cloud size={19} /></span><div><h2>Private API connection</h2><p>Use a personal preview token for this browser only.</p></div></div><label className="token-field" htmlFor="api-token"><span>Bearer token</span><input id="api-token" type="password" value={apiToken} autoComplete="off" onChange={(event) => { setApiTokenValue(event.target.value); setApiToken(event.target.value); }} placeholder="Paste a private preview token" /></label><div className="privacy-note warning"><Warning size={17} /><span><strong>Private preview only.</strong><small>Browser tokens are not suitable for a public app. Add identity-provider authentication before launch.</small></span></div></section>}
        <section className="settings-group account"><div className="avatar">L</div><div><h2>Luke</h2><p>{session?.email || (apiConfig.authMode === "access" ? "Protected by Cloudflare Access" : "Local preview profile")}</p></div>{apiConfig.authMode === "access" ? <a className="button secondary" href="/cdn-cgi/access/logout">Sign out</a> : apiConfig.authMode === "password" ? <button className="button secondary" type="button" onClick={onSignOut}>Sign out</button> : <button className="button secondary" type="button" disabled aria-describedby="account-preview-note">Account sync coming soon</button>}{apiConfig.authMode === "token" && <span className="sr-only" id="account-preview-note">Account management is unavailable in this local preview.</span>}</section>
      </div>
    </div>
  );
}

function CaptureDialog({ open, imprints, onClose, onSaved }: { open: boolean; imprints: Imprint[]; onClose: () => void; onSaved: (imprint: Imprint) => Promise<"synced" | "local"> }) {
  const [url, setUrl] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [savedMode, setSavedMode] = useState<"synced" | "local" | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => { if (open) { setSavedMode(null); setSaving(false); setError(""); window.setTimeout(() => inputRef.current?.focus(), 80); } }, [open]);
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
    let parsed: URL;
    try { parsed = new URL(url); if (parsed.protocol !== "https:") throw new Error(); } catch { setError("Enter a complete public link that starts with https://"); return; }
    const duplicate = imprints.find((item) => item.url === parsed.toString() || item.url === url);
    if (duplicate) { setError("You already saved this. Open it from your library instead."); return; }
    const normalizedHost = parsed.hostname.replace(/^www\./, "");
    const isYoutube = normalizedHost.includes("youtube.com") || normalizedHost.includes("youtu.be");
    const isTikTok = normalizedHost === "tiktok.com" || normalizedHost.endsWith(".tiktok.com");
    setSaving(true);
    setError("");
    const draft: Imprint = { id: crypto.randomUUID(), title: isYoutube ? "New YouTube Imprint" : isTikTok ? "New TikTok Imprint" : normalizedHost, creator: isTikTok ? "TikTok" : parsed.hostname, sourceType: isYoutube ? "YouTube" : "Article", url: parsed.toString(), savedAt: "Just now", lifePeriod: "Current chapter", essence: note || "Understanding what made this worth keeping.", summary: "This source is queued for analysis.", themes: [], keyIdeas: [], moments: [], personalReaction: note || undefined, status: "processing", color: "sage", connectionIds: [], analysisScope: "pending" };
    try {
      const mode = await onSaved(draft);
      setSavedMode(mode);
      window.setTimeout(() => { setUrl(""); setNote(""); setNoteOpen(false); onClose(); }, 1500);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This link could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="capture-dialog" role="dialog" aria-modal="true" aria-labelledby="capture-title">
        <IconButton label="Close" className="dialog-close" onClick={onClose}><X size={19} /></IconButton>
        {savedMode ? <div className="capture-success" role="status"><span><Check size={26} weight="bold" /></span><h2>{savedMode === "synced" ? "Saved to your memory" : "Saved on this device"}</h2><p>{savedMode === "synced" ? "Analysis is running in the background." : "Reconnect to upload it and begin analysis."}</p>{savedMode === "synced" && <ProcessingLine label="Creating your Imprint" />}</div> : <><div className="capture-heading"><span className="capture-mark"><LinkSimple size={22} /></span><h2 id="capture-title">Save something</h2><p>Paste a link. No folders, tags, or setup.</p></div><form onSubmit={(event) => void submit(event)}><label htmlFor="capture-url">Link</label><div className={cx("url-input", error && "has-error")}><LinkSimple size={19} /><input ref={inputRef} id="capture-url" value={url} disabled={saving} onChange={(event) => { setUrl(event.target.value); setError(""); }} placeholder="https://youtube.com/watch?v=..." inputMode="url" autoComplete="url" /></div>{error && <p className="field-error" role="alert"><Warning size={15} /> {error}</p>}{noteOpen ? <div className="note-field"><label htmlFor="capture-note">Why did this matter? <span>Optional</span></label><textarea id="capture-note" value={note} disabled={saving} onChange={(event) => setNote(event.target.value)} placeholder="A sentence or a quick thought is enough." rows={3} /></div> : <button className="reaction-prompt" type="button" disabled={saving} onClick={() => setNoteOpen(true)}><NotePencil size={18} /><span><strong>Add a personal reaction</strong><small>Optional. This makes future resurfacing more personal.</small></span><Plus size={16} /></button>}<button className="button primary full" type="submit" disabled={!url.trim() || saving}>{saving ? "Saving..." : <>Save now <ArrowRight size={17} /></>}</button><p className="save-note"><Cloud size={14} /> We confirm whether the link reached your private library.</p></form></>}
      </section>
    </div>
  );
}

function ConnectivityBanner() {
  const [offline, setOffline] = useState(() => !navigator.onLine);
  useEffect(() => { const update = () => setOffline(!navigator.onLine); window.addEventListener("online", update); window.addEventListener("offline", update); return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); }; }, []);
  return offline ? <div className="offline-banner" role="status"><WifiSlash size={16} /> You are offline. New saves stay on this device until you reconnect.</div> : null;
}

export function App() {
  const initialHash = window.location.hash.replace("#/", "") as Page;
  const [page, setPage] = useState<Page>(navItems.some((item) => item.page === initialHash) || initialHash === "settings" ? initialHash : "home");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const captureReturnRef = useRef<HTMLElement | null>(null);
  const [authStatus, setAuthStatus] = useState<"loading" | "authenticated" | "anonymous">(apiConfig.authMode === "password" ? "loading" : "authenticated");
  const [session, setSession] = useState<AppSession | null>(null);
  const [imprints, setImprints] = useState<Imprint[]>(apiConfig.baseUrl ? [] : fixtureImprints);
  const [resurfaced, setResurfaced] = useState<ResurfacedMemory | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => localStorage.getItem("remember-theme") === "light" ? "light" : "dark");
  const life = useLifeOS();
  const replaceImprint = useCallback((item: Imprint) => {
    setImprints((current) => [item, ...current.filter((entry) => entry.id !== item.id && entry.url !== item.url)]);
  }, []);
  const refreshLibrary = useCallback(async (signal?: AbortSignal) => {
    const { items } = await loadImprints(signal);
    setImprints(items);
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("remember-theme", theme); }, [theme]);
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
    refreshLibrary(controller.signal).catch(() => undefined);
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
  const navigate = (next: Page) => { setPage(next); setDetailId(null); window.location.hash = `/${next}`; window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openDetail = (id: string) => {
    setDetailId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
    void loadImprint(id).then(({ item }) => { if (item) replaceImprint(item); });
  };
  const openCapture = () => { captureReturnRef.current = document.activeElement as HTMLElement | null; setCaptureOpen(true); };
  const closeCapture = () => { setCaptureOpen(false); window.setTimeout(() => captureReturnRef.current?.focus(), 0); };
  const activeImprint = detailId ? imprints.find((item) => item.id === detailId) : null;
  const pageContent = activeImprint
    ? <DetailPage imprint={activeImprint} imprints={imprints} onBack={() => setDetailId(null)} onOpen={openDetail} onUpdate={replaceImprint} />
    : page === "home" ? <HomePage imprints={imprints} resurfaced={resurfaced} onOpen={openDetail} onCapture={openCapture} onNavigate={navigate} life={life} />
    : page === "tasks" ? <TasksPage life={life} />
    : page === "goals" ? <GoalsPage life={life} />
    : page === "calendar" ? <CalendarPage life={life} />
    : page === "health" ? <HealthPage life={life} />
    : page === "money" ? <MoneyPage life={life} />
    : page === "files" ? <FilesPage life={life} />
    : page === "library" ? <LibraryPage imprints={imprints} onOpen={openDetail} onCapture={openCapture} />
    : page === "ask" ? <AskPage imprints={imprints} onOpen={openDetail} />
    : page === "evolution" ? <EvolutionPage onOpen={openDetail} />
    : <SettingsPage imprints={imprints} life={life} theme={theme} onTheme={setTheme} session={session} onSignOut={() => { void logout().finally(() => { setSession(null); setImprints([]); setAuthStatus("anonymous"); }); }} />;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <ConnectivityBanner />
      <aside className="sidebar" aria-hidden={captureOpen || undefined} inert={captureOpen}>
        <button className="brand" type="button" onClick={() => navigate("home")} aria-label="Remember home"><AppMark /><span>Remember</span></button>
        <nav aria-label="Primary navigation">{navItems.map(({ page: itemPage, label, icon: Icon }) => <button className={cx(page === itemPage && !detailId && "active")} type="button" key={itemPage} onClick={() => navigate(itemPage)} aria-current={page === itemPage && !detailId ? "page" : undefined}><Icon size={20} weight={page === itemPage && !detailId ? "fill" : "regular"} /><span>{label}</span></button>)}</nav>
        <div className="sidebar-bottom"><button className={cx(page === "settings" && "active")} type="button" onClick={() => navigate("settings")}><GearSix size={20} /><span>Settings</span></button><button className="profile-button" type="button" onClick={() => navigate("settings")} aria-label="Open account settings"><span>L</span><span><strong>Luke</strong><small>Personal space</small></span><CaretRight size={15} /></button></div>
      </aside>
      <header className="mobile-header" aria-hidden={captureOpen || undefined} inert={captureOpen}><button className="brand" type="button" onClick={() => navigate("home")}><AppMark /><span>Remember</span></button><IconButton label={theme === "light" ? "Use dark mode" : "Use light mode"} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme === "light" ? <Moon size={19} /> : <Sun size={19} />}</IconButton></header>
      <main id="main-content" aria-hidden={captureOpen || undefined} inert={captureOpen}>
        {pageContent}
      </main>
      <nav className="bottom-nav" aria-label="Mobile navigation" aria-hidden={captureOpen || undefined} inert={captureOpen}>{mobileNavItems.map(({ page: itemPage, label, icon: Icon }) => <button className={cx(page === itemPage && !detailId && "active")} type="button" key={itemPage} onClick={() => navigate(itemPage)} aria-current={page === itemPage && !detailId ? "page" : undefined}><Icon size={21} weight={page === itemPage && !detailId ? "fill" : "regular"} /><span>{label}</span></button>)}</nav>
      <CaptureDialog open={captureOpen} imprints={imprints} onClose={closeCapture} onSaved={async (imprint) => {
        replaceImprint(imprint);
        const { item, synced } = await saveImprint(imprint);
        replaceImprint(item);
        return synced ? "synced" : "local";
      }} />
    </div>
  );
}

export { pageTitles };

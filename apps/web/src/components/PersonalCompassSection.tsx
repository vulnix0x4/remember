import { ArrowClockwise, ArrowRight, Check, Flask, Path, X } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import type { LifeSnapshot, LifeTask, PracticeOutcome, PracticeResult } from "../life/types";
import type { EvolutionOverview } from "../services/api";
import type { Imprint } from "../types";
import { buildPersonalCompass } from "../product/personalCompass";

interface PersonalCompassSectionProps {
  overview: EvolutionOverview;
  life: LifeSnapshot;
  imprints: Imprint[];
  onOpen: (id: string) => void;
  onOpenPlan: () => void;
  onPrincipleChange: (id: string, status: "candidate" | "active" | "dismissed") => Promise<void>;
  onReflectPractice: (taskId: string, result: PracticeResult) => Promise<unknown>;
  onRetryPractice: (task: LifeTask, revision: { title: string; firstStep: string }) => Promise<unknown>;
}

const outcomeChoices: Array<{ value: PracticeOutcome; label: string; result: string }> = [
  { value: "helped", label: "It helped", result: "This earned a place in your real life." },
  { value: "mixed", label: "Somewhat", result: "Some of this worked, and some still needs testing." },
  { value: "not_for_me", label: "Not for me", result: "Trying it gave you permission to let it go." },
];

function shortDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

export function PersonalCompassSection({ overview, life, imprints, onOpen, onOpenPlan, onPrincipleChange, onReflectPractice, onRetryPractice }: PersonalCompassSectionProps) {
  const compass = useMemo(() => buildPersonalCompass(overview, life, imprints), [overview, life, imprints]);
  const unreflectedExperiments = compass.completedExperiments.filter(({ task }) => !task.practiceOutcome);
  const [workingID, setWorkingID] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reflectingID, setReflectingID] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<PracticeOutcome | null>(null);
  const [reflection, setReflection] = useState("");
  const [retryingTask, setRetryingTask] = useState<LifeTask | null>(null);
  const [retryTitle, setRetryTitle] = useState("");
  const [retryFirstStep, setRetryFirstStep] = useState("");

  const changePrinciple = async (id: string, status: "candidate" | "active" | "dismissed") => {
    if (workingID) return;
    setWorkingID(id);
    setError("");
    try {
      await onPrincipleChange(id, status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That choice could not be saved. Try again.");
    } finally {
      setWorkingID(null);
    }
  };

  const saveReflection = async () => {
    if (!reflectingID || !outcome || workingID) return;
    setWorkingID(reflectingID);
    setError("");
    try {
      await onReflectPractice(reflectingID, { outcome, reflection: reflection.trim() });
      setReflectingID(null);
      setOutcome(null);
      setReflection("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That result could not be saved. Try again.");
    } finally {
      setWorkingID(null);
    }
  };

  const beginRetry = (task: LifeTask) => {
    setRetryingTask(task);
    setRetryTitle(task.title);
    setRetryFirstStep(task.firstStep);
    setError("");
  };

  const saveRetry = async () => {
    if (!retryingTask || !retryTitle.trim() || !retryFirstStep.trim() || workingID) return;
    setWorkingID(retryingTask.id);
    setError("");
    try {
      await onRetryPractice(retryingTask, { title: retryTitle.trim(), firstStep: retryFirstStep.trim() });
      setRetryingTask(null);
      onOpenPlan();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That new experiment could not be added. Try again.");
    } finally {
      setWorkingID(null);
    }
  };

  return (
    <section className="personal-compass" aria-labelledby="personal-compass-title">
      <header className="compass-intro">
        <span className="section-kicker"><Path size={16} /> Your compass</span>
        <h2 id="personal-compass-title">What you’re carrying now</h2>
        <p>This is shaped by choices you made, not a profile Remember assigned to you. Every idea stays connected to the save or real-life test behind it.</p>
      </header>

      {compass.guidance.length > 0 && <section className="compass-guidance" aria-labelledby="compass-guidance-title">
        <header><span>From real life</span><h3 id="compass-guidance-title">What your experiments are teaching you</h3><p>Remember uses what happened, not just what you saved.</p></header>
        <div className="compass-guidance-list">{compass.guidance.map(({ kind, experiment, principle }) => {
          const { task, imprint } = experiment;
          const isRetrying = retryingTask?.id === task.id;
          const copy = kind === "keep"
            ? { label: "Keep", detail: "This helped. Keep it available as a principle, not just a saved thought." }
            : kind === "adjust"
              ? { label: "Adjust", detail: "Part of this worked. Change one part before you decide whether it belongs." }
              : { label: "Release", detail: "This did not fit you. You can stop carrying it." };
          return <article className={`compass-guidance-item ${kind}`} key={task.id}>
            <div className="compass-guidance-kind">{kind === "adjust" ? <ArrowClockwise size={18} /> : kind === "keep" ? <Check size={18} weight="bold" /> : <X size={18} />}<span>{copy.label}</span></div>
            <h4>{task.title}</h4>
            <p>{copy.detail}</p>
            {task.practiceReflection && <blockquote>{task.practiceReflection}</blockquote>}
            <div className="compass-guidance-actions">
              {kind === "keep" && principle && principle.status !== "active" && <button className="guidance-primary" type="button" disabled={workingID === principle.id} onClick={() => void changePrinciple(principle.id, "active")}>Keep as a principle</button>}
              {kind === "keep" && principle?.status === "active" && <span>Already in your compass</span>}
              {kind === "adjust" && !isRetrying && <button className="guidance-primary" type="button" onClick={() => beginRetry(task)}>Adjust and try again</button>}
              {kind === "release" && principle && principle.status !== "dismissed" && <button className="guidance-primary" type="button" disabled={workingID === principle.id} onClick={() => void changePrinciple(principle.id, "dismissed")}>Release this idea</button>}
              {kind === "release" && principle?.status === "dismissed" && <span>Already released</span>}
              {imprint && <button type="button" onClick={() => onOpen(imprint.id)}>See what this came from</button>}
            </div>
            {isRetrying && <div className="practice-retry-form">
              <label><span>What will you try this time?</span><input value={retryTitle} maxLength={200} onChange={(event) => setRetryTitle(event.target.value)} /></label>
              <label><span>What is the first step?</span><input value={retryFirstStep} maxLength={500} onChange={(event) => setRetryFirstStep(event.target.value)} /></label>
              <div><button type="button" onClick={() => setRetryingTask(null)}>Not now</button><button className="guidance-primary" type="button" disabled={!retryTitle.trim() || !retryFirstStep.trim() || workingID === task.id} onClick={() => void saveRetry()}>{workingID === task.id ? "Adding…" : "Add to Plan"}</button></div>
            </div>}
          </article>;
        })}</div>
      </section>}

      <div className="compass-columns">
        <section className="compass-column" aria-labelledby="compass-true-title">
          <header><div><span>True for now</span><h3 id="compass-true-title">Ideas you chose to keep</h3></div><strong>{compass.truths.length}</strong></header>
          {compass.truths.length ? <div className="compass-list">{compass.truths.map((principle) => (
            <article className="compass-truth" key={principle.id}>
              <blockquote>{principle.text}</blockquote>
              <div>
                <button type="button" onClick={() => onOpen(principle.itemId)}>See what shaped this <ArrowRight size={14} /></button>
                <button className="quiet-action" type="button" disabled={workingID === principle.id} onClick={() => void changePrinciple(principle.id, "candidate")}>Release</button>
              </div>
            </article>
          ))}</div> : <p className="compass-empty">Nothing is fixed here. Keep a takeaway when it earns a place in how you want to live.</p>}
        </section>

        <section className="compass-column" aria-labelledby="compass-testing-title">
          <header><div><span>Testing in real life</span><h3 id="compass-testing-title">Ideas you’re trying</h3></div><Flask size={22} /></header>
          {compass.activeExperiments.length ? <div className="compass-list">{compass.activeExperiments.map(({ task, imprint }) => (
            <article className="compass-experiment" key={task.id}>
              <span>{task.status === "active" ? "Current experiment" : "Ready when you are"}</span>
              <strong>{task.title}</strong>
              {imprint && <button type="button" onClick={() => onOpen(imprint.id)}>From {imprint.title}</button>}
            </article>
          ))}<button className="compass-plan-link" type="button" onClick={onOpenPlan}>Open these in Plan <ArrowRight size={14} /></button></div> : <p className="compass-empty">When you turn a saved idea into an experiment, it will live here while you find out whether it works for you.</p>}
        </section>
      </div>

      {(unreflectedExperiments.length > 0 || compass.changes.length > 0) && <section className="compass-evidence" aria-labelledby="compass-changed-title">
        <header><span>What changed</span><h3 id="compass-changed-title">What experience taught you</h3></header>
        <div>
          {unreflectedExperiments.map(({ task, imprint }) => {
            const choice = outcomeChoices.find((item) => item.value === task.practiceOutcome);
            const isReflecting = reflectingID === task.id;
            return <article className="compass-result" key={task.id}><Check size={18} weight="bold" /><div><strong>{task.title}</strong>{choice ? <><p className="result-verdict">{choice.label}. {choice.result}</p>{task.practiceReflection && <blockquote>{task.practiceReflection}</blockquote>}</> : <><p>You tried this{shortDate(task.completedAt) ? ` and completed it ${shortDate(task.completedAt)}` : ""}. What did real life teach you?</p>{!isReflecting && <button className="record-result" type="button" onClick={() => { setReflectingID(task.id); setOutcome(null); setReflection(""); }}>Add what happened</button>}</>}{isReflecting && <div className="practice-result-form"><fieldset><legend>Did this help?</legend><div>{outcomeChoices.map((item) => <button className={outcome === item.value ? "selected" : ""} type="button" key={item.value} aria-pressed={outcome === item.value} onClick={() => setOutcome(item.value)}>{item.label}</button>)}</div></fieldset><label><span>What did you notice? <small>Optional</small></span><textarea value={reflection} maxLength={2000} onChange={(event) => setReflection(event.target.value)} placeholder="The part I want to remember is…" /></label><div className="practice-result-actions"><button type="button" onClick={() => { setReflectingID(null); setOutcome(null); setReflection(""); }}>Not now</button><button className="save-result" type="button" disabled={!outcome || workingID === task.id} onClick={() => void saveReflection()}>{workingID === task.id ? "Saving…" : "Remember this result"}</button></div></div>}{imprint && <button type="button" onClick={() => onOpen(imprint.id)}>See the idea it came from</button>}</div></article>;
          })}
          {compass.changes.map((reflection) => <article key={reflection.id}><Path size={18} /><div><strong>{reflection.imprint?.title ?? "A saved idea"}</strong><p>{reflection.statement}</p>{reflection.imprint && <button type="button" onClick={() => onOpen(reflection.imprint!.id)}>Revisit the evidence</button>}</div></article>)}
        </div>
      </section>}

      {compass.suggestions.length > 0 && <section className="compass-decisions" aria-labelledby="compass-decide-title">
        <header><span>Worth deciding</span><h3 id="compass-decide-title">Does this belong in your compass?</h3><p>Remember can notice an idea. Only you can decide whether it feels true.</p></header>
        <div>{compass.suggestions.map((principle) => <article key={principle.id}>
          <blockquote>{principle.text}</blockquote>
          <button type="button" onClick={() => onOpen(principle.itemId)}>Review the source</button>
          <div><button className="keep" type="button" disabled={workingID === principle.id} onClick={() => void changePrinciple(principle.id, "active")}><Check size={15} weight="bold" /> Keep</button><button type="button" disabled={workingID === principle.id} onClick={() => void changePrinciple(principle.id, "dismissed")}><X size={15} /> Not for me</button></div>
        </article>)}</div>
      </section>}

      {compass.tension && <section className="compass-tension" aria-labelledby="compass-tension-title">
        <span>Still unresolved</span>
        <h3 id="compass-tension-title">Two ideas worth holding together</h3>
        <p>{compass.tension.explanation}</p>
        <div><button type="button" onClick={() => onOpen(compass.tension!.fromItemId)}>First save</button><span>and</span><button type="button" onClick={() => onOpen(compass.tension!.toItemId)}>Second save</button></div>
      </section>}

      {error && <p className="field-error" role="alert">{error}</p>}
    </section>
  );
}

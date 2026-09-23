import { ArrowLeft, ArrowRight, BookOpen, Check, ShieldCheck, Signpost } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import type { LifeOSController } from "../life/useLifeOS";
import { buildLocalDecisionBrief } from "../product/decisionBrief";
import { AskAPIError, thinkThroughDecision } from "../services/api";
import type { DecisionBrief, Imprint } from "../types";

export function DecisionWorkspace({ imprints, life, onBack, onOpen, onOpenPlan, onContinue }: {
  imprints: Imprint[];
  life: LifeOSController;
  onBack: () => void;
  onOpen: (id: string) => void;
  onOpenPlan: () => void;
  onContinue: (question: string) => void;
}) {
  const [decision, setDecision] = useState("");
  const [context, setContext] = useState("");
  const [brief, setBrief] = useState<DecisionBrief | null>(null);
  const [thinking, setThinking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const clean = decision.trim();
    if (clean.length < 3 || thinking) return;
    setThinking(true);
    setError("");
    try {
      setBrief(await thinkThroughDecision(clean, context) ?? buildLocalDecisionBrief(clean, context, imprints));
    } catch (cause) {
      setError(cause instanceof AskAPIError ? cause.message : "Remember could not think this through right now. Try again.");
    } finally {
      setThinking(false);
    }
  };

  const trySmallTest = async () => {
    if (!brief || adding || added) return;
    setAdding(true);
    setError("");
    try {
      await life.createTask({
        title: brief.decision.replace(/[?.!]+$/, "").slice(0, 180),
        firstStep: brief.smallTest,
        notes: `A small test for this decision: ${brief.decision}`,
        area: "direction",
        durationMinutes: 15,
        status: "queued",
        source: "decision",
        sourceItemId: brief.citations[0]?.imprintId ?? null,
      });
      setAdded(true);
    } catch {
      setError("This test could not be added to Plan. Try again.");
    } finally {
      setAdding(false);
    }
  };

  if (!brief) return <section className="decision-workspace">
    <button className="decision-back" type="button" onClick={onBack}><ArrowLeft size={17} /> Back to Ask</button>
    <div className="decision-intro">
      <span className="decision-symbol" aria-hidden="true"><Signpost size={26} /></span>
      <h2>Think through a decision</h2>
      <p>Bring your own memory into the choice. Remember will show what fits, what pulls the other way, and what you could test before committing.</p>
    </div>
    <form className="decision-form" onSubmit={submit}>
      <label><span>What are you deciding?</span><textarea value={decision} minLength={3} maxLength={500} required autoFocus onChange={(event) => setDecision(event.target.value)} placeholder="Should I take the new role?" /></label>
      <label><span>What makes it hard? <small>Optional</small></span><textarea value={context} maxLength={1_000} onChange={(event) => setContext(event.target.value)} placeholder="What feels uncertain, costly, or important about it?" /></label>
      {error && <p className="field-error" role="alert">{error}</p>}
      <button className="button primary" type="submit" disabled={decision.trim().length < 3 || thinking}>{thinking ? "Looking through your saves…" : "Think it through"}<ArrowRight size={17} /></button>
      <small><ShieldCheck size={14} /> Uses only your saved material</small>
    </form>
  </section>;

  return <article className="decision-workspace decision-result">
    <button className="decision-back" type="button" onClick={() => { setBrief(null); setAdded(false); setError(""); }}><ArrowLeft size={17} /> Start over</button>
    <header>
      <span>Your decision</span>
      <h2>{brief.decision}</h2>
      <p>{brief.perspective}</p>
    </header>
    <section className="decision-matters"><span>What seems to matter</span><p>{brief.whatMatters}</p></section>
    <div className="decision-pulls">
      <section><span>What pulls you toward it</span><p>{brief.pullToward}</p></section>
      <section><span>What pulls the other way</span><p>{brief.pullAgainst}</p></section>
    </div>
    <section className="decision-test">
      <div><span>A small way to find out</span><h3>{brief.smallTest}</h3></div>
      {added
        ? <button className="button secondary" type="button" onClick={onOpenPlan}><Check size={17} weight="bold" /> Added to Plan <ArrowRight size={15} /></button>
        : <button className="button primary" type="button" disabled={adding} onClick={() => void trySmallTest()}>{adding ? "Adding…" : "Try this"}<ArrowRight size={15} /></button>}
    </section>
    <section className="decision-question"><span>One question worth answering</span><p>{brief.nextQuestion}</p><button type="button" onClick={() => onContinue(brief.nextQuestion)}>Take this to Ask <ArrowRight size={15} /></button></section>
    {brief.citations.length > 0 && <details className="decision-sources"><summary><BookOpen size={16} /> The saves that shaped this</summary><div>{brief.citations.map((citation) => <button type="button" key={citation.imprintId} onClick={() => onOpen(citation.imprintId)}>{citation.label}<ArrowRight size={14} /></button>)}</div></details>}
    {brief.limitations.slice(0, 1).map((limitation) => <small className="answer-caveat" key={limitation}>{limitation}</small>)}
    {error && <p className="field-error" role="alert">{error}</p>}
  </article>;
}

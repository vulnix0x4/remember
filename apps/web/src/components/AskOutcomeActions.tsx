import { ArrowRight, Check, Compass, Flask } from "@phosphor-icons/react";
import { useState } from "react";
import type { LifeOSController } from "../life/useLifeOS";
import { buildAskOutcome } from "../product/askOutcome";
import { carryForwardTask } from "../product/carryForward";
import { apiConfig, loadImprint, updatePrinciple } from "../services/api";
import type { AskMessage, Imprint } from "../types";

export function AskOutcomeActions({ message, imprints, life, onOpenPlan, onUpdate }: {
  message: AskMessage;
  imprints: Imprint[];
  life: LifeOSController;
  onOpenPlan: () => void;
  onUpdate: (imprint: Imprint) => void;
}) {
  const outcome = buildAskOutcome(message, imprints);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [keeping, setKeeping] = useState(false);
  const [kept, setKept] = useState(false);
  const [error, setError] = useState("");

  if (!outcome) return null;
  const principleIsKept = kept || outcome.imprint.principleStatus === "active";

  const tryExperiment = async () => {
    if (!outcome.experiment || adding || added) return;
    setAdding(true);
    setError("");
    try {
      await life.createTask(carryForwardTask(outcome.imprint, outcome.experiment));
      setAdded(true);
    } catch {
      setError("This experiment could not be added to Plan. Try again.");
    } finally {
      setAdding(false);
    }
  };

  const keepPrinciple = async () => {
    if (!outcome.principle || keeping || principleIsKept) return;
    setKeeping(true);
    setError("");
    try {
      let detailed = outcome.imprint;
      if (!detailed.principleId && apiConfig.baseUrl) {
        const loaded = await loadImprint(detailed.id);
        detailed = loaded.item ?? detailed;
      }
      if (detailed.principleId) await updatePrinciple(detailed.principleId, "active");
      else if (apiConfig.baseUrl) throw new Error("This principle is not ready to keep yet.");
      const updated = { ...detailed, principleStatus: "active" as const };
      onUpdate(updated);
      setKept(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This principle could not be kept. Try again.");
    } finally {
      setKeeping(false);
    }
  };

  return <section className="ask-outcomes" aria-label="Put this answer to work">
    <header><strong>Put this to work</strong><span>From {outcome.imprint.title}</span></header>
    {outcome.experiment && <div className="ask-outcome-row">
      <Flask size={18} aria-hidden="true" />
      <div><small>A small experiment</small><p>{outcome.experiment.text}</p></div>
      {added
        ? <button type="button" onClick={onOpenPlan}><Check size={16} weight="bold" /> Added to Plan <ArrowRight size={14} /></button>
        : <button type="button" disabled={adding} onClick={() => void tryExperiment()}>{adding ? "Adding…" : "Try this experiment"}</button>}
    </div>}
    {outcome.principle && <div className="ask-outcome-row">
      <Compass size={18} aria-hidden="true" />
      <div><small>A principle to consider</small><p>{outcome.principle}</p></div>
      <button type="button" disabled={keeping || principleIsKept} onClick={() => void keepPrinciple()}>{principleIsKept ? <><Check size={16} weight="bold" /> Kept</> : keeping ? "Keeping…" : "Keep this principle"}</button>
    </div>}
    {error && <p className="field-error" role="alert">{error}</p>}
  </section>;
}

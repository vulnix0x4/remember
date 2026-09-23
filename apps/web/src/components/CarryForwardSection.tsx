import { ArrowRight, Check, Flask, Plus } from "@phosphor-icons/react";
import { useState } from "react";
import type { LifeOSController } from "../life/useLifeOS";
import { carryForwardTask } from "../product/carryForward";
import type { Imprint } from "../types";

export function CarryForwardSection({ imprint, life, onOpenPlan }: { imprint: Imprint; life: LifeOSController; onOpenPlan: () => void }) {
  const [added, setAdded] = useState<string[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (!imprint.experiments.length) return null;

  const add = async (experiment: Imprint["experiments"][number]) => {
    if (adding) return;
    setAdding(experiment.text);
    setError("");
    try {
      await life.createTask(carryForwardTask(imprint, experiment));
      setAdded((current) => current.includes(experiment.text) ? current : [...current, experiment.text]);
    } catch {
      setError("This experiment could not be added to Plan. Try again.");
    } finally {
      setAdding(null);
    }
  };

  return <section className="carry-forward-section" aria-labelledby="carry-forward-title">
    <div className="carry-forward-intro">
      <span className="carry-forward-mark" aria-hidden="true"><Flask size={22} /></span>
      <div><span className="section-kicker">Carry it forward</span><h2 id="carry-forward-title">Don’t just save the idea. Try it.</h2><p>Remember found a small way to test this in your own life. Add it to Plan when you want the idea to become more than something you agreed with.</p></div>
    </div>
    <div className="experiment-list">{imprint.experiments.map((experiment) => {
      const isAdded = added.includes(experiment.text);
      return <article key={`${experiment.text}-${experiment.duration ?? ""}`}>
        <div><span>{experiment.duration || "A small experiment"}</span><h3>{experiment.text}</h3></div>
        {isAdded
          ? <button className="button secondary success" type="button" onClick={onOpenPlan}><Check size={17} weight="bold" /> Added to Plan <ArrowRight size={15} /></button>
          : <button className="button primary" type="button" disabled={Boolean(adding)} onClick={() => void add(experiment)}><Plus size={17} /> {adding === experiment.text ? "Adding…" : "Try this"}</button>}
      </article>;
    })}</div>
    {error && <p className="field-error" role="alert">{error}</p>}
  </section>;
}


import { ArrowRight, BookOpen, Check, Repeat } from "@phosphor-icons/react";
import { useState } from "react";
import type { LifeTask } from "../life/types";
import type { WeeklySynthesis } from "../product/weeklySynthesis";

interface WeeklySynthesisCardProps {
  synthesis: WeeklySynthesis;
  onCarryForward: (task: LifeTask, revision: { title: string; firstStep: string }) => Promise<unknown>;
  onOpen: (id: string) => void;
}

export function WeeklySynthesisCard({ synthesis, onCarryForward, onOpen }: WeeklySynthesisCardProps) {
  const task = synthesis.experiment?.task ?? null;
  const source = synthesis.experiment?.imprint;
  const [adjusting, setAdjusting] = useState(false);
  const [title, setTitle] = useState(task?.title ?? "");
  const [firstStep, setFirstStep] = useState(task?.firstStep ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const carryForward = async (revision: { title: string; firstStep: string }) => {
    if (!task || saving) return;
    setSaving(true);
    setError("");
    try {
      await onCarryForward(task, revision);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That could not be added to Plan. Try again.");
      setSaving(false);
    }
  };

  const beginAdjusting = () => {
    if (!task) return;
    setTitle(task.title);
    setFirstStep(task.firstStep);
    setError("");
    setAdjusting(true);
  };

  return (
    <section className="weekly-synthesis" aria-labelledby="weekly-synthesis-title">
      <header className="weekly-synthesis-intro">
        <span>This week, remembered</span>
        <h2 id="weekly-synthesis-title">{synthesis.headline}</h2>
      </header>

      <div className="weekly-synthesis-body">
        {synthesis.story && <p className="weekly-synthesis-story">{synthesis.story}</p>}
        {synthesis.reflection && <blockquote>
          <span>What you noticed</span>
          <p>{synthesis.reflection}</p>
        </blockquote>}

        {synthesis.outcome === "not_for_me" && (
          <p className="weekly-synthesis-note">Nothing to do. Knowing what not to carry is useful too.</p>
        )}

        {(synthesis.outcome === "helped" || synthesis.outcome === "mixed") && !synthesis.canCarryForward && (
          <p className="weekly-synthesis-note"><Check size={17} weight="bold" /> Already carried into Plan</p>
        )}

        {synthesis.canCarryForward && task && !adjusting && (
          <button
            className="button primary weekly-synthesis-primary"
            type="button"
            disabled={saving}
            onClick={() => synthesis.outcome === "mixed"
              ? beginAdjusting()
              : void carryForward({ title: task.title, firstStep: task.firstStep })}
          >
            <Repeat size={17} />
            {saving ? "Adding..." : synthesis.outcome === "mixed" ? "Try a smaller version" : "Repeat what worked"}
          </button>
        )}

        {adjusting && task && <div className="weekly-adjust-form">
          <label>
            <span>What will you try this time?</span>
            <input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>
            <span>What is the first step?</span>
            <input value={firstStep} maxLength={500} onChange={(event) => setFirstStep(event.target.value)} />
          </label>
          <div>
            <button className="button secondary" type="button" disabled={saving} onClick={() => setAdjusting(false)}>Not now</button>
            <button className="button primary" type="button" disabled={saving || !title.trim() || !firstStep.trim()} onClick={() => void carryForward({ title: title.trim(), firstStep: firstStep.trim() })}>{saving ? "Adding..." : "Add to Plan"}</button>
          </div>
        </div>}

        {source && <button className="text-button weekly-synthesis-source" type="button" onClick={() => onOpen(source.id)}>
          <BookOpen size={16} /> See what shaped this <ArrowRight size={15} />
        </button>}
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}

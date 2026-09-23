import { ArrowClockwise, ArrowRight, ChatCircleDots, CheckCircle, MinusCircle, Question } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { LivingThread } from "../product/livingThreads";

export function LivingThreadsSection({ threads, onOpen, onExplore }: {
  threads: LivingThread[];
  onOpen: (id: string) => void;
  onExplore: (question: string) => void;
}) {
  const [selectedID, setSelectedID] = useState(threads[0]?.id ?? "");

  useEffect(() => {
    if (!threads.some((thread) => thread.id === selectedID)) setSelectedID(threads[0]?.id ?? "");
  }, [selectedID, threads]);

  if (!threads.length) {
    return <section className="thread-empty">
      <h2>Living threads will form here</h2>
      <p>When an idea returns across more than one analyzed save, Remember will show how the thought is changing.</p>
    </section>;
  }

  const selected = threads.find((thread) => thread.id === selectedID) ?? threads[0]!;
  const middleSaves = selected.saves.slice(1, -1);
  const PulseIcon = selected.pulse.kind === "held"
    ? CheckCircle
    : selected.pulse.kind === "shifting"
      ? ArrowClockwise
      : selected.pulse.kind === "released"
        ? MinusCircle
        : Question;

  return <section className="living-threads" aria-labelledby="living-threads-title">
    <header>
      <h2 id="living-threads-title">Ideas that keep finding you</h2>
      <p>A thread is the path between related saves. Open one to see where the idea began, where it is now, and what remains worth asking.</p>
    </header>
    <div className="thread-layout">
      <div className="thread-switcher" role="tablist" aria-label="Living threads">
        {threads.map((thread) => <button
          key={thread.id}
          type="button"
          role="tab"
          aria-selected={thread.id === selected.id}
          aria-controls="selected-thread"
          onClick={() => setSelectedID(thread.id)}
        >
          <span>{thread.name}</span>
          <small>{thread.pulse.label} · {thread.saves.length} saves</small>
        </button>)}
      </div>
      <article id="selected-thread" className="thread-story" role="tabpanel">
        <div className="thread-story-heading">
          <div><span>Living thread</span><h3>{selected.name}</h3></div>
          <strong>{selected.saves.length} saves</strong>
        </div>
        <div className={`thread-pulse ${selected.pulse.kind}`}>
          <PulseIcon size={21} weight="regular" aria-hidden="true" />
          <div><strong>{selected.pulse.label}</strong><p>{selected.pulse.detail}</p></div>
        </div>
        <div className="thread-arc">
          <button type="button" onClick={() => onOpen(selected.earliest.id)}>
            <span>Where it started</span>
            <strong>{selected.earliest.essence}</strong>
            <small>{selected.earliest.title}</small>
          </button>
          {middleSaves.length > 0 && <div className="thread-middle" aria-label={`${middleSaves.length} saves between the first and latest`}>
            {middleSaves.map((save) => <button type="button" key={save.id} onClick={() => onOpen(save.id)}>{save.title}</button>)}
          </div>}
          <button type="button" onClick={() => onOpen(selected.latest.id)}>
            <span>Where it is now</span>
            <strong>{selected.latest.essence}</strong>
            <small>{selected.latest.title}</small>
          </button>
        </div>
        {selected.turningPoints.length > 0 && <div className="thread-turning-points">
          <div><span>Your turning points</span><p>What you decided when an idea came back.</p></div>
          <div>
            {selected.turningPoints.slice(-4).map((point) => <button type="button" key={point.id} onClick={() => onOpen(point.imprint.id)}>
              <span>{point.label}</span>
              <strong>{point.imprint.essence}</strong>
              <small>{point.detail}</small>
            </button>)}
          </div>
        </div>}
        <div className="thread-next">
          <div><span>The question now</span><p>{selected.question}</p></div>
          <button className="button primary" type="button" onClick={() => onExplore(selected.question)}><ChatCircleDots size={18} /> Explore in Ask <ArrowRight size={16} /></button>
        </div>
      </article>
    </div>
  </section>;
}

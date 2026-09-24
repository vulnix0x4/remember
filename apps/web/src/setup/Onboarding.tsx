import { useId, useState } from "react";
import { Check } from "@phosphor-icons/react";
import type { LifeOSController } from "../life/useLifeOS";
import { ModalBackdrop } from "../ui/Sheet";
import { haptic } from "../ui/Toast";
import { markSetupDone } from "./setupState";
import { CommitmentSection, NudgesSection, YourDaySection } from "./SetupSections";

type SetupLife = Pick<LifeOSController, "brain" | "brainError" | "brainWorking" | "refreshBrain" | "snapshot" | "createCommitment" | "updateCommitment" | "deleteCommitment">;

export const onboardingSteps = ["welcome", "day", "commitments", "chores", "nudges", "done"] as const;
type Step = typeof onboardingSteps[number];

const copy: Record<Step, { title: string; detail?: string }> = {
  welcome: { title: "Let’s set up your day", detail: "A few taps. Jev plans the rest." },
  day: { title: "When is your day?", detail: "Jev only plans inside these hours." },
  commitments: { title: "What do you do most days?", detail: "Study, gym, anything that must fit." },
  chores: { title: "What keeps life running?", detail: "Jev brings these back on their rhythm." },
  nudges: { title: "Gentle reminders?", detail: "One nudge when a wait is over." },
  done: { title: "Jev is planning your day" },
};

/**
 * First-run setup: the same sections as Settings, one per screen, each with one Next and a quiet Skip.
 * (Focus-mode app blocking is iPhone-only, so the web skips that step.)
 */
export function Onboarding({ life, onFinish }: { life: SetupLife; onFinish: () => void }) {
  const titleId = useId();
  const [index, setIndex] = useState(0);
  const step = onboardingSteps[index];
  const finish = () => { markSetupDone(); haptic([8, 30, 8]); onFinish(); };
  const next = () => { haptic(6); if (index >= onboardingSteps.length - 1) finish(); else setIndex(index + 1); };
  const skip = () => { if (step === "welcome") finish(); else next(); };
  const { title, detail } = copy[step];
  return <ModalBackdrop className="onboarding-backdrop" onClose={() => undefined} closeOnEscape={false} closeOnBackdrop={false}>
    <section className="onboarding" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="onboarding-head">
        <ol className="onboarding-progress" aria-label={`Step ${index + 1} of ${onboardingSteps.length}`}>
          {onboardingSteps.map((item, position) => <li key={item} className={position < index ? "done" : position === index ? "current" : ""} />)}
        </ol>
        {step !== "done" && <button className="btn quiet" type="button" onClick={skip}>{step === "welcome" ? "Not now" : "Skip"}</button>}
      </header>
      <div className="onboarding-body" key={step}>
        {step === "done" && <span className="win-check" aria-hidden="true"><Check size={44} weight="bold" /></span>}
        <h2 id={titleId} className="onboarding-title">{title}</h2>
        {detail && <p className="onboarding-detail">{detail}</p>}
        {step === "day" && <YourDaySection life={life} heading={false} />}
        {step === "commitments" && <CommitmentSection life={life} kind="commitment" heading={false} />}
        {step === "chores" && <CommitmentSection life={life} kind="chore" heading={false} />}
        {step === "nudges" && <NudgesSection heading={false} />}
      </div>
      <footer className="onboarding-foot">
        <button className="btn primary" type="button" data-auto-focus onClick={next}>{step === "welcome" ? "Start" : step === "done" ? "Go to Today" : "Next"}</button>
      </footer>
    </section>
  </ModalBackdrop>;
}

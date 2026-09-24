import type { LifeOSController } from "../life/useLifeOS";

type JevLife = Pick<LifeOSController, "brain">;

export function jevIsPlanning(life: JevLife) {
  const brain = life.brain;
  return Boolean(brain?.settings.enabled && brain.status !== "paused" && brain.status !== "unavailable");
}

/**
 * The small "Jev is planning your day" line under the Today title. Jev's hours and preferences
 * live in Settings (Your day), so this opens Settings there.
 */
export function JevStatusLine({ life, onOpen }: { life: JevLife; onOpen: () => void }) {
  const planning = jevIsPlanning(life);
  return <button className={`jev-line${planning ? "" : " paused"}`} type="button" onClick={onOpen}>
    <i aria-hidden="true" />{planning ? "Jev is planning your day" : "Jev is paused"}
  </button>;
}

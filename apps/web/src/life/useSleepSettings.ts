import { useCallback, useEffect, useRef, useState } from "react";
import { sleepSettingsSchema, type SleepSettings } from "@remember/domain";
import { useToast } from "../ui/Toast";
import type { LifeOSController } from "./useLifeOS";

export type SleepLife = Pick<LifeOSController, "brain" | "brainError" | "brainWorking" | "refreshBrain">;

const defaultSleep = sleepSettingsSchema.parse({});
export const SLEEP_OFFLINE_MESSAGE = "Connect your Remember server to use sleep.";

/**
 * Sleep is part of Jev's settings, so every save sends the rest of them back unchanged. Changes show
 * right away and save one after another; a failed save rolls back with an error toast.
 */
export function useSleepSettings(life: SleepLife) {
  const toast = useToast();
  const saved = life.brain?.settings.sleep ?? null;
  const [draft, setDraft] = useState<SleepSettings | null>(null);
  const latest = useRef(life);
  latest.current = life;
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);
  const generation = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  /** Returns whether it saved. Pass `optimistic: false` to wait for the server before showing it. */
  const save = useCallback(async (next: SleepSettings, options: { optimistic?: boolean } = {}) => {
    if (!latest.current.brain) { toast.error(latest.current.brainError || SLEEP_OFFLINE_MESSAGE); return false; }
    if (options.optimistic !== false) setDraft(next);
    pending.current += 1;
    const round = generation.current;
    const attempt = queue.current.then(async () => {
      // A save that failed before this one already rolled everything back.
      if (round !== generation.current) throw new Error("Cancelled");
      const brain = latest.current.brain;
      if (!brain) throw new Error(SLEEP_OFFLINE_MESSAGE);
      await latest.current.refreshBrain({ ...brain.settings, sleep: next });
    });
    queue.current = attempt.catch(() => undefined);
    try {
      await attempt;
      return true;
    } catch (reason) {
      if (round === generation.current) {
        generation.current += 1;
        if (mounted.current) setDraft(null);
        toast.error(reason instanceof Error && reason.message === SLEEP_OFFLINE_MESSAGE ? SLEEP_OFFLINE_MESSAGE : "Sleep settings didn’t save. Try again.");
      }
      return false;
    } finally {
      pending.current -= 1;
      // Jev's settings now hold the last save, so stop showing the local copy.
      if (pending.current === 0 && mounted.current) setDraft(null);
    }
  }, [toast]);

  return { sleep: draft ?? saved ?? defaultSleep, available: Boolean(life.brain), save };
}

import { useCallback, useEffect, useRef, useState } from "react";
import type { BrainSettings, BrainState } from "@remember/domain";
import { saveBrainSettings, syncBrain } from "../services/autopilot";
import * as lifeService from "../services/life";
import { emptyLifeSnapshot, type BlockerReason, type CalendarEvent, type FinanceAccount, type FinanceTransaction, type Goal, type HealthMetric, type LifeArea, type LifeSnapshot, type LifeTask, type PracticeResult } from "./types";

export function useLifeOS(enabled = true) {
  const [snapshot, setSnapshot] = useState<LifeSnapshot>(() => {
    try { return lifeService.readLocalLife(); } catch { return emptyLifeSnapshot(); }
  });
  const [loading, setLoading] = useState(enabled);
  const [remote, setRemote] = useState(false);
  const [working, setWorking] = useState(false);
  const [syncState, setSyncState] = useState(() => lifeService.getLifeSyncState());
  const [brain, setBrain] = useState<BrainState | null>(null);
  const [brainError, setBrainError] = useState("");
  const [brainWorking, setBrainWorking] = useState(false);
  const brainFlight = useRef(false);
  const brainGeneration = useRef(0);
  useEffect(() => {
    if (!enabled) { setBrain(null); setBrainError(""); }
    return () => { brainGeneration.current += 1; };
  }, [enabled]);

  const refreshBrain = useCallback(async (settings?: BrainSettings) => {
    if (!enabled || brainFlight.current || lifeService.getLifeSyncState().pendingCount > 0) {
      if (settings) throw new Error("Wait for your current changes to finish syncing.");
      return;
    }
    const generation = brainGeneration.current;
    brainFlight.current = true; setBrainWorking(true);
    try {
      const updated = settings ? await saveBrainSettings(settings) : await syncBrain();
      if (generation !== brainGeneration.current) return;
      setBrain(updated); setBrainError("");
      if (updated?.status === "ready") {
        const loaded = await lifeService.loadLife();
        if (generation !== brainGeneration.current) return;
        setSnapshot(loaded.snapshot); setRemote(loaded.remote); setSyncState(lifeService.getLifeSyncState());
      }
    } catch (error) {
      if (generation !== brainGeneration.current) return;
      setBrainError(error instanceof Error ? error.message : "Your automatic plan could not refresh.");
      if (settings) throw error;
    } finally { brainFlight.current = false; setBrainWorking(false); }
  }, [enabled]);

  const contextVersion = JSON.stringify([snapshot.tasks.map((task) => [task.id, task.updatedAt]), snapshot.goals.map((goal) => [goal.id, goal.updatedAt]), snapshot.events.map((event) => [event.id, event.updatedAt])]);
  useEffect(() => {
    if (!enabled || !remote) return;
    const timeout = window.setTimeout(() => { void refreshBrain(); }, 300);
    return () => window.clearTimeout(timeout);
  }, [enabled, remote, contextVersion, refreshBrain]);
  useEffect(() => {
    if (!enabled) return;
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void refreshBrain(); }, 60_000);
    return () => window.clearInterval(interval);
  }, [enabled, refreshBrain]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const loaded = await lifeService.loadLife();
    setSnapshot(loaded.snapshot); setRemote(loaded.remote);
    setSyncState(lifeService.getLifeSyncState());
    setLoading(false);
  }, [enabled]);

  useEffect(() => { if (enabled) void refresh(); }, [enabled, refresh]);
  useEffect(() => {
    if (!enabled) return;
    const retryPendingChanges = () => { if (navigator.onLine && document.visibilityState === "visible") void refresh(); };
    window.addEventListener("online", retryPendingChanges);
    document.addEventListener("visibilitychange", retryPendingChanges);
    return () => {
      window.removeEventListener("online", retryPendingChanges);
      document.removeEventListener("visibilitychange", retryPendingChanges);
    };
  }, [enabled, refresh]);

  const run = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    setWorking(true);
    try { return await operation(); }
    finally { setSnapshot(lifeService.readLocalLife()); setSyncState(lifeService.getLifeSyncState()); setWorking(false); }
  }, []);

  return {
    snapshot, loading, remote, working, refresh, brain, brainError, brainWorking, refreshBrain,
    pendingSync: syncState.pendingCount,
    syncError: syncState.error,
    createGoal: (input: { title: string; area: LifeArea; vision?: string; why?: string; targetDate?: string | null }) => run(() => lifeService.createGoal(input)),
    updateGoal: (goalId: string, patch: Partial<Pick<Goal, "title" | "area" | "vision" | "why" | "status" | "progress" | "targetDate">>) => run(() => lifeService.updateGoal(goalId, patch)),
    createTask: (input: Parameters<typeof lifeService.createTask>[0]) => run(() => lifeService.createTask(input)),
    updateTask: (taskId: string, patch: Partial<LifeTask>) => run(() => lifeService.updateTask(taskId, patch)),
    completeTask: (taskId: string, minutesSpent?: number, result?: PracticeResult) => run(() => lifeService.completeTask(taskId, minutesSpent, result)),
    reflectOnPractice: (taskId: string, result: PracticeResult) => run(() => lifeService.reflectOnPractice(taskId, result)),
    blockTask: (taskId: string, reason: BlockerReason) => run(() => lifeService.blockTask(taskId, reason)),
    createFloorItem: (input: { title: string; area: LifeArea; target: number; unit: string }) => run(() => lifeService.createFloorItem(input)),
    toggleFloorItem: (itemId: string, date: string) => run(() => lifeService.toggleFloorItem(itemId, date)),
    addCalendarEvent: (input: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">) => run(() => lifeService.addCalendarEvent(input)),
    syncHealth: (metrics: Array<Omit<HealthMetric, "id" | "createdAt">>) => run(() => lifeService.syncHealth(metrics)),
    addFinanceAccount: (input: Omit<FinanceAccount, "id" | "externalId" | "createdAt" | "updatedAt" | "lastSyncedAt">) => run(() => lifeService.addFinanceAccount(input)),
    addFinanceTransaction: (input: Omit<FinanceTransaction, "id" | "externalId" | "createdAt" | "updatedAt">) => run(() => lifeService.addFinanceTransaction(input)),
    uploadFile: (file: File, metadata: { folder?: string; tags?: string[]; summary?: string }) => run(() => lifeService.uploadVaultFile(file, metadata)),
    deleteFile: (fileId: string) => run(() => lifeService.deleteVaultFile(fileId)),
    downloadFile: (fileId: string) => lifeService.downloadVaultFile(fileId),
  };
}

export type LifeOSController = ReturnType<typeof useLifeOS>;

import { useCallback, useEffect, useState } from "react";
import * as lifeService from "../services/life";
import { emptyLifeSnapshot, type BlockerReason, type CalendarEvent, type FinanceAccount, type FinanceTransaction, type Goal, type HealthMetric, type LifeArea, type LifeSnapshot, type LifeTask } from "./types";

export function useLifeOS() {
  const [snapshot, setSnapshot] = useState<LifeSnapshot>(() => {
    try { return lifeService.readLocalLife(); } catch { return emptyLifeSnapshot(); }
  });
  const [loading, setLoading] = useState(true);
  const [remote, setRemote] = useState(false);
  const [working, setWorking] = useState(false);

  const refresh = useCallback(async () => {
    const loaded = await lifeService.loadLife();
    setSnapshot(loaded.snapshot); setRemote(loaded.remote); setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const run = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    setWorking(true);
    try { return await operation(); }
    finally { setSnapshot(lifeService.readLocalLife()); setWorking(false); }
  }, []);

  return {
    snapshot, loading, remote, working, refresh,
    createGoal: (input: { title: string; area: LifeArea; vision?: string; why?: string; targetDate?: string | null }) => run(() => lifeService.createGoal(input)),
    updateGoal: (goalId: string, patch: Partial<Pick<Goal, "title" | "area" | "vision" | "why" | "status" | "progress" | "targetDate">>) => run(() => lifeService.updateGoal(goalId, patch)),
    createTask: (input: Parameters<typeof lifeService.createTask>[0]) => run(() => lifeService.createTask(input)),
    updateTask: (taskId: string, patch: Partial<LifeTask>) => run(() => lifeService.updateTask(taskId, patch)),
    completeTask: (taskId: string, minutesSpent?: number) => run(() => lifeService.completeTask(taskId, minutesSpent)),
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

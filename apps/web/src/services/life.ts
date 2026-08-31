import { apiConfig, authHeaders } from "./api";
import { emptyLifeSnapshot, type BlockerReason, type CalendarEvent, type FinanceAccount, type FinanceTransaction, type Goal, type HealthMetric, type LifeArea, type LifeFloorItem, type LifeSnapshot, type LifeTask, type VaultFile } from "../life/types";

const LIFE_STORAGE_KEY = "remember-life-os-v1";
const baseUrl = apiConfig.baseUrl;

function now(): string { return new Date().toISOString(); }
function id(): string { return crypto.randomUUID(); }

export function readLocalLife(): LifeSnapshot {
  try {
    const value = localStorage.getItem(LIFE_STORAGE_KEY);
    if (!value) return emptyLifeSnapshot();
    const parsed = JSON.parse(value) as Partial<LifeSnapshot>;
    const empty = emptyLifeSnapshot();
    return Object.fromEntries(Object.keys(empty).map((key) => [key, Array.isArray(parsed[key as keyof LifeSnapshot]) ? parsed[key as keyof LifeSnapshot] : []])) as unknown as LifeSnapshot;
  } catch { return emptyLifeSnapshot(); }
}

export function saveLocalLife(snapshot: LifeSnapshot): LifeSnapshot {
  localStorage.setItem(LIFE_STORAGE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

async function jsonRequest<T>(path: string, init?: RequestInit, fetcher: typeof fetch = fetch): Promise<T | null> {
  if (!baseUrl) return null;
  try {
    const response = await fetcher(`${baseUrl}${path}`, {
      ...init,
      headers: { ...authHeaders(baseUrl), ...(init?.body ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
      credentials: "include",
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch { return null; }
}

export async function loadLife(fetcher: typeof fetch = fetch): Promise<{ snapshot: LifeSnapshot; remote: boolean }> {
  const remote = await jsonRequest<LifeSnapshot>("/api/life", undefined, fetcher);
  if (remote) return { snapshot: saveLocalLife(remote), remote: true };
  return { snapshot: readLocalLife(), remote: false };
}

export async function createGoal(input: { title: string; area: LifeArea; vision?: string; why?: string; targetDate?: string | null }): Promise<Goal> {
  const created = await jsonRequest<{ goal: Goal }>("/api/life/goals", { method: "POST", body: JSON.stringify(input) });
  const goal = created?.goal ?? { id: id(), title: input.title, area: input.area, vision: input.vision ?? "", why: input.why ?? "", status: "active", progress: 0, targetDate: input.targetDate ?? null, createdAt: now(), updatedAt: now() };
  const snapshot = readLocalLife(); snapshot.goals = [goal, ...snapshot.goals.filter((item) => item.id !== goal.id)]; saveLocalLife(snapshot);
  return goal;
}

export async function updateGoal(goalId: string, patch: Partial<Pick<Goal, "title" | "area" | "vision" | "why" | "status" | "progress" | "targetDate">>): Promise<Goal | null> {
  const updated = await jsonRequest<{ goal: Goal }>(`/api/life/goals/${goalId}`, { method: "PATCH", body: JSON.stringify(patch) });
  const snapshot = readLocalLife(); const current = snapshot.goals.find((goal) => goal.id === goalId);
  const goal = updated?.goal ?? (current ? { ...current, ...patch, updatedAt: now() } : null);
  if (goal) { snapshot.goals = snapshot.goals.map((item) => item.id === goalId ? goal : item); saveLocalLife(snapshot); }
  return goal;
}

export async function createTask(input: { title: string; firstStep?: string; notes?: string; area?: LifeArea; goalId?: string | null; durationMinutes?: number; priority?: LifeTask["priority"]; energy?: LifeTask["energy"]; dueAt?: string | null; status?: LifeTask["status"]; source?: LifeTask["source"] }): Promise<LifeTask> {
  const payload = { firstStep: "", notes: "", area: "direction", goalId: null, durationMinutes: 15, priority: "normal", energy: "any", dueAt: null, status: "queued", source: "manual", ...input };
  const created = await jsonRequest<{ task: LifeTask }>("/api/life/tasks", { method: "POST", body: JSON.stringify(payload) });
  const snapshot = readLocalLife();
  let status = payload.status as LifeTask["status"];
  if (status === "queued" && !snapshot.tasks.some((task) => task.status === "active")) status = "active";
  const task = created?.task ?? { id: id(), goalId: payload.goalId, title: payload.title, firstStep: payload.firstStep, notes: payload.notes, area: payload.area as LifeArea, status, priority: payload.priority as LifeTask["priority"], energy: payload.energy as LifeTask["energy"], durationMinutes: payload.durationMinutes, dueAt: payload.dueAt, scheduledStart: null, scheduledEnd: null, source: payload.source as LifeTask["source"], completedAt: null, createdAt: now(), updatedAt: now() };
  if (task.status === "active") snapshot.tasks = snapshot.tasks.map((item) => item.status === "active" ? { ...item, status: "queued" } : item);
  snapshot.tasks = [task, ...snapshot.tasks.filter((item) => item.id !== task.id)]; saveLocalLife(snapshot);
  return task;
}

export async function updateTask(taskId: string, patch: Partial<LifeTask>): Promise<LifeTask | null> {
  const safePatch = { ...patch } as Record<string, unknown>; delete safePatch.id; delete safePatch.createdAt; delete safePatch.updatedAt; delete safePatch.completedAt;
  const updated = await jsonRequest<{ task: LifeTask }>(`/api/life/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(safePatch) });
  const snapshot = readLocalLife(); const current = snapshot.tasks.find((task) => task.id === taskId);
  const task = updated?.task ?? (current ? { ...current, ...safePatch, updatedAt: now() } as LifeTask : null);
  if (task) {
    if (task.status === "active") snapshot.tasks = snapshot.tasks.map((item) => item.id !== taskId && item.status === "active" ? { ...item, status: "queued" } : item);
    snapshot.tasks = snapshot.tasks.map((item) => item.id === taskId ? task : item); saveLocalLife(snapshot);
  }
  return task;
}

function bestNext(tasks: LifeTask[]): LifeTask | null {
  const weight = { must: 4, high: 3, normal: 2, low: 1 };
  return [...tasks].filter((task) => task.status === "queued" || task.status === "inbox").sort((a, b) => {
    const nowMs = Date.now();
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const aScore = weight[a.priority] * 100 + (aDue <= nowMs ? 1_000 : 0);
    const bScore = weight[b.priority] * 100 + (bDue <= nowMs ? 1_000 : 0);
    return bScore - aScore || aDue - bDue || a.createdAt.localeCompare(b.createdAt);
  })[0] ?? null;
}

export async function completeTask(taskId: string, minutesSpent = 0): Promise<void> {
  const completed = await jsonRequest<{ task: LifeTask; next: LifeTask | null }>(`/api/life/tasks/${taskId}/complete`, { method: "POST", body: JSON.stringify({ minutesSpent }) });
  const snapshot = readLocalLife(); const completedAt = now();
  snapshot.tasks = snapshot.tasks.map((task) => task.id === taskId ? (completed?.task ?? { ...task, status: "done", completedAt, updatedAt: completedAt }) : task);
  if (completed?.next) snapshot.tasks = snapshot.tasks.map((task) => task.id === completed.next!.id ? completed.next! : task);
  else if (!snapshot.tasks.some((task) => task.status === "active")) {
    const next = bestNext(snapshot.tasks);
    if (next) snapshot.tasks = snapshot.tasks.map((task) => task.id === next.id ? { ...task, status: "active", updatedAt: completedAt } : task);
  }
  saveLocalLife(snapshot);
}

export async function blockTask(taskId: string, reason: BlockerReason): Promise<void> {
  const result = await jsonRequest<{ task: LifeTask; next: LifeTask | null }>(`/api/life/tasks/${taskId}/block`, { method: "POST", body: JSON.stringify({ reason }) });
  const snapshot = readLocalLife(); const current = snapshot.tasks.find((task) => task.id === taskId); if (!current) return;
  let task = current;
  if (result?.task) task = result.task;
  else if (reason === "big") task = { ...task, title: task.firstStep || task.title, firstStep: "Open what you need and begin for two minutes. Stopping after that still counts as starting.", durationMinutes: Math.max(2, Math.min(5, Math.ceil(task.durationMinutes / 3))) };
  else if (reason === "unclear") task = { ...task, firstStep: "Write the first visible physical action in one sentence. Then do only that sentence.", durationMinutes: Math.min(5, task.durationMinutes) };
  else if (reason === "time") task = { ...task, firstStep: "Set a five-minute boundary and finish the smallest useful piece before it ends.", durationMinutes: Math.min(5, task.durationMinutes) };
  else if (reason === "place") task = { ...task, firstStep: "Choose the smallest version that works where you are now.", durationMinutes: Math.min(10, task.durationMinutes) };
  else task = { ...task, status: "removed" };
  const event = { id: id(), taskId, taskTitle: current.title, reason, originalDuration: current.durationMinutes, createdAt: now() };
  snapshot.blockers = [event, ...snapshot.blockers]; snapshot.tasks = snapshot.tasks.map((item) => item.id === taskId ? task : item);
  if (result?.next) snapshot.tasks = snapshot.tasks.map((item) => item.id === result.next!.id ? result.next! : item);
  else if (task.status === "removed") { const next = bestNext(snapshot.tasks); if (next) snapshot.tasks = snapshot.tasks.map((item) => item.id === next.id ? { ...item, status: "active" } : item); }
  saveLocalLife(snapshot);
}

export async function createFloorItem(input: { title: string; area: LifeArea; target: number; unit: string }): Promise<LifeFloorItem> {
  const created = await jsonRequest<{ item: LifeFloorItem }>("/api/life/floor", { method: "POST", body: JSON.stringify(input) });
  const timestamp = now();
  const item = created?.item ?? { id: id(), ...input, completionDates: [], createdAt: timestamp, updatedAt: timestamp };
  const snapshot = readLocalLife(); snapshot.floor = [...snapshot.floor.filter((entry) => entry.id !== item.id), item]; saveLocalLife(snapshot);
  return item;
}

export async function toggleFloorItem(itemId: string, date: string): Promise<LifeFloorItem | null> {
  const updated = await jsonRequest<{ item: LifeFloorItem }>(`/api/life/floor/${itemId}/toggle`, { method: "POST", body: JSON.stringify({ date }) });
  const snapshot = readLocalLife(); const current = snapshot.floor.find((item) => item.id === itemId);
  if (!current && !updated?.item) return null;
  const localDates = new Set(current?.completionDates ?? []);
  if (!updated?.item) { if (localDates.has(date)) localDates.delete(date); else localDates.add(date); }
  const merged = updated?.item ?? { ...current!, completionDates: [...localDates].sort(), updatedAt: now() };
  snapshot.floor = snapshot.floor.map((entry) => entry.id === itemId ? merged : entry); saveLocalLife(snapshot);
  return merged;
}

export async function addCalendarEvent(input: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">): Promise<CalendarEvent> {
  await jsonRequest("/api/life/calendar/sync", { method: "POST", body: JSON.stringify({ events: [input] }) });
  const timestamp = now(); const event: CalendarEvent = { ...input, id: id(), createdAt: timestamp, updatedAt: timestamp };
  const snapshot = readLocalLife(); snapshot.events = [...snapshot.events, event].sort((a, b) => a.startAt.localeCompare(b.startAt)); saveLocalLife(snapshot); return event;
}

export async function syncHealth(metrics: Array<Omit<HealthMetric, "id" | "createdAt">>): Promise<number> {
  await jsonRequest("/api/life/health/sync", { method: "POST", body: JSON.stringify({ metrics }) });
  const createdAt = now(); const incoming = metrics.map((metric) => ({ ...metric, id: id(), createdAt })); const snapshot = readLocalLife();
  const keys = new Set(incoming.map((metric) => `${metric.source}:${metric.externalId}`)); snapshot.health = [...incoming, ...snapshot.health.filter((metric) => !keys.has(`${metric.source}:${metric.externalId}`))]; saveLocalLife(snapshot); return incoming.length;
}

export async function addFinanceAccount(input: Omit<FinanceAccount, "id" | "externalId" | "createdAt" | "updatedAt" | "lastSyncedAt">): Promise<FinanceAccount> {
  const payload = { ...input, externalId: id(), lastSyncedAt: now() }; const synced = await jsonRequest<{ accounts: FinanceAccount[] }>("/api/life/finance/accounts/sync", { method: "POST", body: JSON.stringify({ accounts: [payload] }) });
  const timestamp = now(); const account: FinanceAccount = synced?.accounts[0] ?? { ...payload, id: id(), createdAt: timestamp, updatedAt: timestamp };
  const snapshot = readLocalLife(); snapshot.accounts = [account, ...snapshot.accounts]; saveLocalLife(snapshot); return account;
}

export async function addFinanceTransaction(input: Omit<FinanceTransaction, "id" | "externalId" | "createdAt" | "updatedAt">): Promise<FinanceTransaction> {
  const payload = { ...input, externalId: id() }; await jsonRequest("/api/life/finance/transactions/sync", { method: "POST", body: JSON.stringify({ transactions: [payload] }) });
  const timestamp = now(); const transaction: FinanceTransaction = { ...payload, id: id(), createdAt: timestamp, updatedAt: timestamp };
  const snapshot = readLocalLife(); snapshot.transactions = [transaction, ...snapshot.transactions]; saveLocalLife(snapshot); return transaction;
}

export async function uploadVaultFile(file: File, metadata: { folder?: string; tags?: string[]; summary?: string }): Promise<VaultFile> {
  if (!baseUrl) throw new Error("Connect Remember before uploading files.");
  const form = new FormData(); form.set("file", file); form.set("folder", metadata.folder ?? ""); form.set("tags", (metadata.tags ?? []).join(",")); form.set("summary", metadata.summary ?? "");
  const response = await fetch(`${baseUrl}/api/life/files`, { method: "POST", headers: authHeaders(baseUrl), credentials: "include", body: form });
  if (!response.ok) throw new Error(response.status === 422 ? "That file could not be uploaded. Keep it under 25 MB." : "File upload failed.");
  const payload = await response.json() as { file: VaultFile }; const snapshot = readLocalLife(); snapshot.files = [payload.file, ...snapshot.files]; saveLocalLife(snapshot); return payload.file;
}

export async function deleteVaultFile(fileId: string): Promise<void> {
  if (baseUrl) {
    const response = await fetch(`${baseUrl}/api/life/files/${encodeURIComponent(fileId)}`, { method: "DELETE", headers: authHeaders(baseUrl), credentials: "include" });
    if (!response.ok) throw new Error("File deletion failed.");
  }
  const snapshot = readLocalLife(); snapshot.files = snapshot.files.filter((file) => file.id !== fileId); saveLocalLife(snapshot);
}

export async function downloadVaultFile(fileId: string): Promise<Blob> {
  if (!baseUrl) throw new Error("Connect Remember before downloading files.");
  const response = await fetch(`${baseUrl}/api/life/files/${encodeURIComponent(fileId)}/download`, { headers: authHeaders(baseUrl), credentials: "include" });
  if (!response.ok) throw new Error("File download failed.");
  return response.blob();
}

export const lifeStorageKey = LIFE_STORAGE_KEY;

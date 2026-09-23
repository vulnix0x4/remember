import { apiConfig, authHeaders } from "./api";
import { emptyLifeSnapshot, type BlockerReason, type CalendarEvent, type FinanceAccount, type FinanceTransaction, type Goal, type HealthMetric, type LifeArea, type LifeFloorItem, type LifeSnapshot, type LifeTask, type PracticeResult, type VaultFile } from "../life/types";

const LIFE_STORAGE_KEY = "remember-life-os-v1";
const LIFE_OUTBOX_KEY = "remember-life-os-outbox-v1";

type LifeCollection = keyof LifeSnapshot;
type MutationMethod = "POST" | "PATCH" | "DELETE";

interface LifeEntityReference {
  collection: LifeCollection;
  id: string;
}

interface LifeCreateMapping {
  collection: LifeCollection;
  localId: string;
  responseKey: "goal" | "task" | "item" | "accounts";
  responseIndex?: number;
}

interface LifeMutation {
  id: string;
  method: MutationMethod;
  path: string;
  body?: unknown;
  queuedAt: string;
  localEntities: LifeEntityReference[];
  createMapping?: LifeCreateMapping;
}

interface AcknowledgedLifeMutation extends LifeMutation {
  response?: unknown;
}

interface LifeOutbox {
  pending: LifeMutation[];
  acknowledged: AcknowledgedLifeMutation[];
  error: string | null;
}

export interface LifeSyncState {
  pendingCount: number;
  error: string | null;
}

interface RequestResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

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

function emptyOutbox(): LifeOutbox {
  return { pending: [], acknowledged: [], error: null };
}

function isLifeMutation(value: unknown): value is LifeMutation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LifeMutation>;
  return typeof candidate.id === "string"
    && (candidate.method === "POST" || candidate.method === "PATCH" || candidate.method === "DELETE")
    && typeof candidate.path === "string"
    && typeof candidate.queuedAt === "string"
    && Array.isArray(candidate.localEntities);
}

function readOutbox(): LifeOutbox {
  try {
    const value = localStorage.getItem(LIFE_OUTBOX_KEY);
    if (!value) return emptyOutbox();
    const parsed = JSON.parse(value) as Partial<LifeOutbox>;
    return {
      pending: Array.isArray(parsed.pending) ? parsed.pending.filter(isLifeMutation) : [],
      acknowledged: Array.isArray(parsed.acknowledged) ? parsed.acknowledged.filter(isLifeMutation) : [],
      error: typeof parsed.error === "string" ? parsed.error : null,
    };
  } catch {
    return emptyOutbox();
  }
}

function saveOutbox(outbox: LifeOutbox): LifeOutbox {
  if (outbox.pending.length === 0 && outbox.acknowledged.length === 0 && !outbox.error) {
    localStorage.removeItem(LIFE_OUTBOX_KEY);
  } else {
    localStorage.setItem(LIFE_OUTBOX_KEY, JSON.stringify(outbox));
  }
  return outbox;
}

export function getLifeSyncState(): LifeSyncState {
  const outbox = readOutbox();
  return { pendingCount: outbox.pending.length + outbox.acknowledged.length, error: outbox.error };
}

function requestError(status?: number): string {
  if (!status) return "Changes are saved on this device and will sync when Remember reconnects.";
  return `Remember could not sync your Life changes (server returned ${status}). They are still saved on this device.`;
}

async function requestJSON<T>(path: string, init?: RequestInit, fetcher: typeof fetch = fetch): Promise<RequestResult<T>> {
  const baseUrl = apiConfig.baseUrl;
  if (!baseUrl) return { ok: false, data: null, error: requestError() };
  try {
    const response = await fetcher(`${baseUrl}${path}`, {
      ...init,
      headers: { ...authHeaders(baseUrl), ...(init?.body ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
      credentials: "include",
    });
    if (!response.ok) return { ok: false, data: null, error: requestError(response.status) };
    if (response.status === 204) return { ok: true, data: null, error: null };
    return { ok: true, data: await response.json() as T, error: null };
  } catch {
    return { ok: false, data: null, error: requestError() };
  }
}

function timestamp(entity: { updatedAt?: unknown; createdAt?: unknown }): number | null {
  const value = typeof entity.updatedAt === "string"
    ? entity.updatedAt
    : typeof entity.createdAt === "string" ? entity.createdAt : null;
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function reconcileCollection<T extends { id: string; updatedAt?: unknown; createdAt?: unknown }>(remote: T[], local: T[], preferLocal: Set<string>, discardLocal: Set<string>): T[] {
  const localById = new Map(local.filter((item) => !discardLocal.has(item.id)).map((item) => [item.id, item]));
  const remoteIds = new Set(remote.map((item) => item.id));
  const reconciled = remote.map((remoteItem) => {
    const localItem = localById.get(remoteItem.id);
    if (!localItem) return remoteItem;
    if (preferLocal.has(remoteItem.id)) return localItem;
    const remoteTimestamp = timestamp(remoteItem);
    const localTimestamp = timestamp(localItem);
    if (remoteTimestamp !== null && localTimestamp !== null && localTimestamp > remoteTimestamp) return localItem;
    return remoteItem;
  });
  return [...reconciled, ...local.filter((item) => !remoteIds.has(item.id) && !discardLocal.has(item.id))];
}

function referencesByCollection(mutations: LifeMutation[]): Map<LifeCollection, Set<string>> {
  const references = new Map<LifeCollection, Set<string>>();
  for (const mutation of mutations) {
    for (const entity of mutation.localEntities) {
      const ids = references.get(entity.collection) ?? new Set<string>();
      ids.add(entity.id);
      references.set(entity.collection, ids);
    }
  }
  return references;
}

export function reconcileLifeSnapshots(remote: LifeSnapshot, local: LifeSnapshot): LifeSnapshot {
  const outbox = readOutbox();
  const preferred = referencesByCollection(outbox.pending);
  const acknowledged = referencesByCollection(outbox.acknowledged);
  const discarded = new Map<LifeCollection, Set<string>>();
  for (const [collection, ids] of acknowledged) {
    const pendingIds = preferred.get(collection) ?? new Set<string>();
    discarded.set(collection, new Set([...ids].filter((entityId) => !pendingIds.has(entityId))));
  }
  return {
    goals: reconcileCollection(remote.goals, local.goals, preferred.get("goals") ?? new Set(), discarded.get("goals") ?? new Set()),
    tasks: reconcileCollection(remote.tasks, local.tasks, preferred.get("tasks") ?? new Set(), discarded.get("tasks") ?? new Set()),
    blockers: reconcileCollection(remote.blockers, local.blockers, preferred.get("blockers") ?? new Set(), discarded.get("blockers") ?? new Set()),
    floor: reconcileCollection(remote.floor, local.floor, preferred.get("floor") ?? new Set(), discarded.get("floor") ?? new Set()),
    events: reconcileCollection(remote.events, local.events, preferred.get("events") ?? new Set(), discarded.get("events") ?? new Set()),
    health: reconcileCollection(remote.health, local.health, preferred.get("health") ?? new Set(), discarded.get("health") ?? new Set()),
    accounts: reconcileCollection(remote.accounts, local.accounts, preferred.get("accounts") ?? new Set(), discarded.get("accounts") ?? new Set()),
    transactions: reconcileCollection(remote.transactions, local.transactions, preferred.get("transactions") ?? new Set(), discarded.get("transactions") ?? new Set()),
    files: reconcileCollection(remote.files, local.files, preferred.get("files") ?? new Set(), discarded.get("files") ?? new Set()),
  };
}

function queueMutation(mutation: LifeMutation, error: string | null): void {
  const outbox = readOutbox();
  if (!outbox.pending.some((item) => item.id === mutation.id)) outbox.pending.push(mutation);
  outbox.error = error;
  saveOutbox(outbox);
}

function replaceId(value: unknown, fromId: string, toId: string): unknown {
  if (value === fromId) return toId;
  if (Array.isArray(value)) return value.map((item) => replaceId(item, fromId, toId));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceId(item, fromId, toId)]));
  }
  return value;
}

function remapMutations(mutations: LifeMutation[], fromId: string, toId: string): LifeMutation[] {
  const remapped = replaceId(mutations, fromId, toId) as LifeMutation[];
  const encodedFrom = encodeURIComponent(fromId);
  const encodedTo = encodeURIComponent(toId);
  return remapped.map((item) => ({ ...item, path: item.path.split(encodedFrom).join(encodedTo) }));
}

function responseEntity(receipt: AcknowledgedLifeMutation): { id: string } | null {
  const mapping = receipt.createMapping;
  if (!mapping || !receipt.response || typeof receipt.response !== "object") return null;
  const value = (receipt.response as Record<string, unknown>)[mapping.responseKey];
  const entity = Array.isArray(value) ? value[mapping.responseIndex ?? 0] : value;
  return entity && typeof entity === "object" && typeof (entity as { id?: unknown }).id === "string"
    ? entity as { id: string }
    : null;
}

function applyCreateMappings(outbox: LifeOutbox): LifeOutbox {
  let snapshot = readLocalLife();
  let changedSnapshot = false;
  let pending = outbox.pending;
  for (const receipt of outbox.acknowledged) {
    const mapping = receipt.createMapping;
    const remoteEntity = responseEntity(receipt);
    if (!mapping || !remoteEntity || mapping.localId === remoteEntity.id) continue;
    const collection = snapshot[mapping.collection] as Array<{ id: string }>;
    const localEntity = collection.find((item) => item.id === mapping.localId);
    pending = remapMutations(pending, mapping.localId, remoteEntity.id);
    if (!localEntity) continue;
    // Keep any client-only fields, but let the successful create response own
    // canonical values such as the permanent ID and server timestamps.
    const mergedEntity = { ...localEntity, ...remoteEntity, id: remoteEntity.id };
    snapshot = replaceId(snapshot, mapping.localId, remoteEntity.id) as LifeSnapshot;
    const collections = snapshot as unknown as Record<LifeCollection, Array<{ id: string }>>;
    let inserted = false;
    collections[mapping.collection] = collections[mapping.collection].flatMap((item) => {
      if (item.id !== remoteEntity.id) return [item];
      if (inserted) return [];
      inserted = true;
      return [mergedEntity];
    });
    changedSnapshot = true;
  }
  if (changedSnapshot) saveLocalLife(snapshot);
  return { ...outbox, pending };
}

async function sendOrQueue<T>(mutation: LifeMutation, fetcher: typeof fetch = fetch): Promise<T | null> {
  const result = await requestJSON<T>(mutation.path, {
    method: mutation.method,
    body: mutation.body === undefined ? undefined : JSON.stringify(mutation.body),
  }, fetcher);
  if (result.ok) return result.data;
  queueMutation(mutation, result.error);
  return null;
}

function acknowledgeForRefresh(mutation: LifeMutation, response?: unknown): void {
  const outbox = readOutbox();
  outbox.acknowledged.push({ ...mutation, response });
  if (outbox.pending.length === 0) outbox.error = null;
  saveOutbox(outbox);
}

async function flushLifeOutbox(fetcher: typeof fetch): Promise<LifeOutbox> {
  let outbox = applyCreateMappings(readOutbox());
  saveOutbox(outbox);
  while (outbox.pending.length > 0) {
    const mutation = outbox.pending[0];
    const result = await requestJSON<unknown>(mutation.path, {
      method: mutation.method,
      body: mutation.body === undefined ? undefined : JSON.stringify(mutation.body),
    }, fetcher);
    if (!result.ok) {
      outbox.error = result.error;
      saveOutbox(outbox);
      return outbox;
    }
    outbox.pending = outbox.pending.slice(1);
    outbox.acknowledged.push({ ...mutation, response: result.data ?? undefined });
    outbox.error = null;
    saveOutbox(outbox);
    outbox = applyCreateMappings(readOutbox());
    saveOutbox(outbox);
  }
  return outbox;
}

function mutation(input: Omit<LifeMutation, "id" | "queuedAt">): LifeMutation {
  return { ...input, id: id(), queuedAt: now() };
}

export async function loadLife(fetcher: typeof fetch = fetch): Promise<{ snapshot: LifeSnapshot; remote: boolean }> {
  let outbox = await flushLifeOutbox(fetcher);
  const local = readLocalLife();
  const result = await requestJSON<LifeSnapshot>("/api/life", undefined, fetcher);
  if (result.ok && result.data) {
    const snapshot = saveLocalLife(reconcileLifeSnapshots(result.data, local));
    outbox = saveOutbox({ pending: outbox.pending, acknowledged: [], error: outbox.pending.length ? outbox.error : null });
    return { snapshot, remote: true };
  }
  if (outbox.pending.length > 0 || outbox.acknowledged.length > 0) {
    outbox.error = result.error ?? outbox.error;
    saveOutbox(outbox);
  }
  return { snapshot: local, remote: false };
}

export async function createGoal(input: { title: string; area: LifeArea; vision?: string; why?: string; targetDate?: string | null }): Promise<Goal> {
  const localId = id();
  const timestamp = now();
  const pending = mutation({
    method: "POST", path: "/api/life/goals", body: input,
    localEntities: [{ collection: "goals", id: localId }],
    createMapping: { collection: "goals", localId, responseKey: "goal" },
  });
  const created = await sendOrQueue<{ goal: Goal }>(pending);
  const goal = created?.goal ?? { id: localId, title: input.title, area: input.area, vision: input.vision ?? "", why: input.why ?? "", status: "active", progress: 0, targetDate: input.targetDate ?? null, createdAt: timestamp, updatedAt: timestamp };
  const snapshot = readLocalLife(); snapshot.goals = [goal, ...snapshot.goals.filter((item) => item.id !== goal.id)]; saveLocalLife(snapshot);
  return goal;
}

export async function updateGoal(goalId: string, patch: Partial<Pick<Goal, "title" | "area" | "vision" | "why" | "status" | "progress" | "targetDate">>): Promise<Goal | null> {
  const updated = await sendOrQueue<{ goal: Goal }>(mutation({
    method: "PATCH", path: `/api/life/goals/${goalId}`, body: patch,
    localEntities: [{ collection: "goals", id: goalId }],
  }));
  const snapshot = readLocalLife(); const current = snapshot.goals.find((goal) => goal.id === goalId);
  const goal = updated?.goal ?? (current ? { ...current, ...patch, updatedAt: now() } : null);
  if (goal) { snapshot.goals = snapshot.goals.map((item) => item.id === goalId ? goal : item); saveLocalLife(snapshot); }
  return goal;
}

export async function createTask(input: { title: string; firstStep?: string; notes?: string; area?: LifeArea; goalId?: string | null; durationMinutes?: number; priority?: LifeTask["priority"]; energy?: LifeTask["energy"]; dueAt?: string | null; status?: LifeTask["status"]; source?: LifeTask["source"]; sourceItemId?: string | null; repeatEveryDays?: number | null; notBefore?: string | null }): Promise<LifeTask> {
  const payload = { firstStep: "", notes: "", area: "direction", goalId: null, durationMinutes: 15, priority: "normal", energy: "any", dueAt: null, status: "queued", source: "manual", ...input };
  const snapshot = readLocalLife();
  let status = payload.status as LifeTask["status"];
  const startsLater = Boolean(payload.notBefore && Date.parse(payload.notBefore) > Date.now());
  if (status === "queued" && !startsLater && !snapshot.tasks.some((task) => task.status === "active")) status = "active";
  const localId = id();
  const timestamp = now();
  const created = await sendOrQueue<{ task: LifeTask }>(mutation({
    method: "POST", path: "/api/life/tasks", body: payload,
    localEntities: [{ collection: "tasks", id: localId }],
    createMapping: { collection: "tasks", localId, responseKey: "task" },
  }));
  const task = created?.task ?? { id: localId, goalId: payload.goalId, title: payload.title, firstStep: payload.firstStep, notes: payload.notes, area: payload.area as LifeArea, status, priority: payload.priority as LifeTask["priority"], energy: payload.energy as LifeTask["energy"], durationMinutes: payload.durationMinutes, dueAt: payload.dueAt, scheduledStart: null, scheduledEnd: null, source: payload.source as LifeTask["source"], sourceItemId: payload.sourceItemId ?? null, practiceOutcome: null, practiceReflection: "", reflectedAt: null, completedAt: null, createdAt: timestamp, updatedAt: timestamp, repeatEveryDays: payload.repeatEveryDays ?? null, notBefore: payload.notBefore ?? null };
  if (task.status === "active") snapshot.tasks = snapshot.tasks.map((item) => item.status === "active" ? { ...item, status: "queued" } : item);
  snapshot.tasks = [task, ...snapshot.tasks.filter((item) => item.id !== task.id)]; saveLocalLife(snapshot);
  return task;
}

export async function updateTask(taskId: string, patch: Partial<LifeTask>): Promise<LifeTask | null> {
  const safePatch = { ...patch } as Record<string, unknown>; delete safePatch.id; delete safePatch.createdAt; delete safePatch.updatedAt; delete safePatch.completedAt;
  const updated = await sendOrQueue<{ task: LifeTask }>(mutation({
    method: "PATCH", path: `/api/life/tasks/${taskId}`, body: safePatch,
    localEntities: [{ collection: "tasks", id: taskId }],
  }));
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
  const nowMs = Date.now();
  return [...tasks].filter((task) => (task.status === "queued" || task.status === "inbox") && (!task.notBefore || Date.parse(task.notBefore) <= nowMs)).sort((a, b) => {
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const aScore = weight[a.priority] * 100 + (aDue <= nowMs ? 1_000 : 0);
    const bScore = weight[b.priority] * 100 + (bDue <= nowMs ? 1_000 : 0);
    return bScore - aScore || aDue - bDue || a.createdAt.localeCompare(b.createdAt);
  })[0] ?? null;
}

export async function completeTask(taskId: string, minutesSpent = 0, result?: PracticeResult): Promise<void> {
  const completed = await sendOrQueue<{ task: LifeTask; next: LifeTask | null }>(mutation({
    method: "POST", path: `/api/life/tasks/${taskId}/complete`, body: { minutesSpent, ...(result ? { result } : {}) },
    localEntities: [{ collection: "tasks", id: taskId }],
  }));
  const snapshot = readLocalLife(); const completedAt = now();
  snapshot.tasks = snapshot.tasks.map((task) => task.id === taskId ? (completed?.task ?? { ...task, status: "done", completedAt, updatedAt: completedAt, ...(result ? { practiceOutcome: result.outcome, practiceReflection: result.reflection, reflectedAt: completedAt } : {}) }) : task);
  if (completed?.next) snapshot.tasks = snapshot.tasks.map((task) => task.id === completed.next!.id ? completed.next! : task);
  else if (!completed && !snapshot.tasks.some((task) => task.status === "active")) {
    const next = bestNext(snapshot.tasks);
    if (next) snapshot.tasks = snapshot.tasks.map((task) => task.id === next.id ? { ...task, status: "active", updatedAt: completedAt } : task);
  }
  saveLocalLife(snapshot);
}

export async function reflectOnPractice(taskId: string, result: PracticeResult): Promise<LifeTask | null> {
  const reflected = await sendOrQueue<{ task: LifeTask }>(mutation({
    method: "POST", path: `/api/life/tasks/${taskId}/reflect`, body: result,
    localEntities: [{ collection: "tasks", id: taskId }],
  }));
  const snapshot = readLocalLife();
  const timestamp = now();
  const current = snapshot.tasks.find((task) => task.id === taskId);
  const task = reflected?.task ?? (current ? { ...current, practiceOutcome: result.outcome, practiceReflection: result.reflection, reflectedAt: timestamp, updatedAt: timestamp } : null);
  if (task) {
    snapshot.tasks = snapshot.tasks.map((item) => item.id === taskId ? task : item);
    saveLocalLife(snapshot);
  }
  return task;
}

export async function blockTask(taskId: string, reason: BlockerReason): Promise<void> {
  const eventId = id();
  const blockedMutation = mutation({
    method: "POST", path: `/api/life/tasks/${taskId}/block`, body: { reason },
    localEntities: [{ collection: "tasks", id: taskId }, { collection: "blockers", id: eventId }],
  });
  const result = await sendOrQueue<{ task: LifeTask; next: LifeTask | null }>(blockedMutation);
  const snapshot = readLocalLife(); const current = snapshot.tasks.find((task) => task.id === taskId); if (!current) return;
  let task = current;
  if (result?.task) task = result.task;
  else if (reason === "big") task = { ...task, title: task.firstStep || task.title, firstStep: "Open what you need and begin for two minutes. Stopping after that still counts as starting.", durationMinutes: Math.max(2, Math.min(5, Math.ceil(task.durationMinutes / 3))) };
  else if (reason === "unclear") task = { ...task, firstStep: "Write the first visible physical action in one sentence. Then do only that sentence.", durationMinutes: Math.min(5, task.durationMinutes) };
  else if (reason === "time") task = { ...task, firstStep: "Set a five-minute boundary and finish the smallest useful piece before it ends.", durationMinutes: Math.min(5, task.durationMinutes) };
  else if (reason === "place") task = { ...task, firstStep: "Choose the smallest version that works where you are now.", durationMinutes: Math.min(10, task.durationMinutes) };
  else if (reason === "different") {
    const aside = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    task = { ...task, status: "queued", notBefore: task.notBefore && task.notBefore > aside ? task.notBefore : aside };
  } else task = { ...task, status: "removed" };
  const event = { id: eventId, taskId, taskTitle: current.title, reason, originalDuration: current.durationMinutes, createdAt: now() };
  snapshot.blockers = [event, ...snapshot.blockers]; snapshot.tasks = snapshot.tasks.map((item) => item.id === taskId ? task : item);
  if (result?.next) snapshot.tasks = snapshot.tasks.map((item) => item.id === result.next!.id ? result.next! : item);
  else if (!result && current.status === "active" && task.status !== "active") { const next = bestNext(snapshot.tasks); if (next) snapshot.tasks = snapshot.tasks.map((item) => item.id === next.id ? { ...item, status: "active" } : item); }
  saveLocalLife(snapshot);
  if (result) acknowledgeForRefresh(blockedMutation, result);
}

export async function createFloorItem(input: { title: string; area: LifeArea; target: number; unit: string }): Promise<LifeFloorItem> {
  const timestamp = now();
  const localId = id();
  const created = await sendOrQueue<{ item: LifeFloorItem }>(mutation({
    method: "POST", path: "/api/life/floor", body: input,
    localEntities: [{ collection: "floor", id: localId }],
    createMapping: { collection: "floor", localId, responseKey: "item" },
  }));
  const item = created?.item ?? { id: localId, ...input, completionDates: [], createdAt: timestamp, updatedAt: timestamp };
  const snapshot = readLocalLife(); snapshot.floor = [...snapshot.floor.filter((entry) => entry.id !== item.id), item]; saveLocalLife(snapshot);
  return item;
}

export async function toggleFloorItem(itemId: string, date: string): Promise<LifeFloorItem | null> {
  const updated = await sendOrQueue<{ item: LifeFloorItem }>(mutation({
    method: "POST", path: `/api/life/floor/${itemId}/toggle`, body: { date },
    localEntities: [{ collection: "floor", id: itemId }],
  }));
  const snapshot = readLocalLife(); const current = snapshot.floor.find((item) => item.id === itemId);
  if (!current && !updated?.item) return null;
  const localDates = new Set(current?.completionDates ?? []);
  if (!updated?.item) { if (localDates.has(date)) localDates.delete(date); else localDates.add(date); }
  const merged = updated?.item ?? { ...current!, completionDates: [...localDates].sort(), updatedAt: now() };
  snapshot.floor = snapshot.floor.map((entry) => entry.id === itemId ? merged : entry); saveLocalLife(snapshot);
  return merged;
}

export async function addCalendarEvent(input: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">): Promise<CalendarEvent> {
  const timestamp = now(); const event: CalendarEvent = { ...input, id: id(), createdAt: timestamp, updatedAt: timestamp };
  const calendarMutation = mutation({
    method: "POST", path: "/api/life/calendar/sync", body: { events: [input] },
    localEntities: [{ collection: "events", id: event.id }],
  });
  const synced = await sendOrQueue<{ synced: number }>(calendarMutation);
  const snapshot = readLocalLife(); snapshot.events = [...snapshot.events, event].sort((a, b) => a.startAt.localeCompare(b.startAt)); saveLocalLife(snapshot);
  if (synced) acknowledgeForRefresh(calendarMutation, synced);
  return event;
}

export async function syncHealth(metrics: Array<Omit<HealthMetric, "id" | "createdAt">>): Promise<number> {
  const createdAt = now(); const incoming = metrics.map((metric) => ({ ...metric, id: id(), createdAt })); const snapshot = readLocalLife();
  const healthMutation = mutation({
    method: "POST", path: "/api/life/health/sync", body: { metrics },
    localEntities: incoming.map((metric) => ({ collection: "health" as const, id: metric.id })),
  });
  const synced = await sendOrQueue<{ synced: number }>(healthMutation);
  const keys = new Set(incoming.map((metric) => `${metric.source}:${metric.externalId}`)); snapshot.health = [...incoming, ...snapshot.health.filter((metric) => !keys.has(`${metric.source}:${metric.externalId}`))]; saveLocalLife(snapshot);
  if (synced) acknowledgeForRefresh(healthMutation, synced);
  return incoming.length;
}

export async function addFinanceAccount(input: Omit<FinanceAccount, "id" | "externalId" | "createdAt" | "updatedAt" | "lastSyncedAt">): Promise<FinanceAccount> {
  const localId = id();
  const payload = { ...input, externalId: id(), lastSyncedAt: now() };
  const synced = await sendOrQueue<{ accounts: FinanceAccount[] }>(mutation({
    method: "POST", path: "/api/life/finance/accounts/sync", body: { accounts: [payload] },
    localEntities: [{ collection: "accounts", id: localId }],
    createMapping: { collection: "accounts", localId, responseKey: "accounts", responseIndex: 0 },
  }));
  const timestamp = now(); const account: FinanceAccount = synced?.accounts[0] ?? { ...payload, id: localId, createdAt: timestamp, updatedAt: timestamp };
  const snapshot = readLocalLife(); snapshot.accounts = [account, ...snapshot.accounts]; saveLocalLife(snapshot); return account;
}

export async function addFinanceTransaction(input: Omit<FinanceTransaction, "id" | "externalId" | "createdAt" | "updatedAt">): Promise<FinanceTransaction> {
  const payload = { ...input, externalId: id() };
  const timestamp = now(); const transaction: FinanceTransaction = { ...payload, id: id(), createdAt: timestamp, updatedAt: timestamp };
  const transactionMutation = mutation({
    method: "POST", path: "/api/life/finance/transactions/sync", body: { transactions: [payload] },
    localEntities: [{ collection: "transactions", id: transaction.id }],
  });
  const synced = await sendOrQueue<{ synced: number }>(transactionMutation);
  const snapshot = readLocalLife(); snapshot.transactions = [transaction, ...snapshot.transactions]; saveLocalLife(snapshot);
  if (synced) acknowledgeForRefresh(transactionMutation, synced);
  return transaction;
}

export async function uploadVaultFile(file: File, metadata: { folder?: string; tags?: string[]; summary?: string }): Promise<VaultFile> {
  const baseUrl = apiConfig.baseUrl;
  if (!baseUrl) throw new Error("Connect Remember before uploading files.");
  const form = new FormData(); form.set("file", file); form.set("folder", metadata.folder ?? ""); form.set("tags", (metadata.tags ?? []).join(",")); form.set("summary", metadata.summary ?? "");
  const response = await fetch(`${baseUrl}/api/life/files`, { method: "POST", headers: authHeaders(baseUrl), credentials: "include", body: form });
  if (!response.ok) throw new Error(response.status === 422 ? "That file could not be uploaded. Keep it under 25 MB." : "File upload failed.");
  const payload = await response.json() as { file: VaultFile }; const snapshot = readLocalLife(); snapshot.files = [payload.file, ...snapshot.files]; saveLocalLife(snapshot); return payload.file;
}

export async function deleteVaultFile(fileId: string): Promise<void> {
  const baseUrl = apiConfig.baseUrl;
  if (baseUrl) {
    const response = await fetch(`${baseUrl}/api/life/files/${encodeURIComponent(fileId)}`, { method: "DELETE", headers: authHeaders(baseUrl), credentials: "include" });
    if (!response.ok) throw new Error("File deletion failed.");
  }
  const snapshot = readLocalLife(); snapshot.files = snapshot.files.filter((file) => file.id !== fileId); saveLocalLife(snapshot);
}

export async function downloadVaultFile(fileId: string): Promise<Blob> {
  const baseUrl = apiConfig.baseUrl;
  if (!baseUrl) throw new Error("Connect Remember before downloading files.");
  const response = await fetch(`${baseUrl}/api/life/files/${encodeURIComponent(fileId)}/download`, { headers: authHeaders(baseUrl), credentials: "include" });
  if (!response.ok) throw new Error("File download failed.");
  return response.blob();
}

export const lifeStorageKey = LIFE_STORAGE_KEY;

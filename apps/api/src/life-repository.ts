import type {
  BlockerReason,
  CreateGoal,
  CreateTask,
  LifeSnapshot,
} from "@remember/domain";
import { ApiError } from "./http";

type GoalRow = {
  id: string; title: string; area: string; vision: string; why: string; status: string;
  progress: number; target_date: string | null; created_at: string; updated_at: string;
};

type TaskRow = {
  id: string; goal_id: string | null; title: string; first_step: string; notes: string; area: string;
  status: string; priority: string; energy: string; duration_minutes: number; due_at: string | null;
  scheduled_start: string | null; scheduled_end: string | null; source: string; completed_at: string | null;
  source_item_id: string | null; practice_outcome: string | null; practice_reflection: string; reflected_at: string | null;
  created_at: string; updated_at: string;
  repeat_every_days: number | null; not_before: string | null;
};

type BlockerRow = {
  id: string; task_id: string; task_title: string; reason: string; original_duration: number; created_at: string;
};

type FloorRow = {
  id: string; title: string; area: string; target: number; unit: string; completion_dates_json: string;
  created_at: string; updated_at: string;
};

type EventRow = {
  id: string; external_id: string | null; source: string; calendar_name: string; title: string; notes: string;
  location: string; url: string | null; start_at: string; end_at: string; all_day: number; status: string;
  created_at: string; updated_at: string;
};

type HealthRow = {
  id: string; external_id: string | null; type: string; value: number; unit: string; start_at: string;
  end_at: string; source: string; metadata_json: string; created_at: string;
};

type AccountRow = {
  id: string; external_id: string | null; name: string; institution: string; type: string; balance: number;
  currency: string; source: string; last_synced_at: string | null; created_at: string; updated_at: string;
};

type TransactionRow = {
  id: string; account_id: string | null; external_id: string | null; name: string; merchant: string; amount: number;
  currency: string; category: string; occurred_at: string; status: string; notes: string; created_at: string; updated_at: string;
};

type FileRow = {
  id: string; object_key: string; name: string; mime_type: string; size_bytes: number; folder: string;
  tags_json: string; summary: string; created_at: string; updated_at: string;
};

function isoNow(): string { return new Date().toISOString(); }
function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}
function parseRecord(value: string): Record<string, string | number | boolean | null> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, string | number | boolean | null>
      : {};
  } catch { return {}; }
}

function publicGoal(row: GoalRow) {
  return { id: row.id, title: row.title, area: row.area, vision: row.vision, why: row.why, status: row.status, progress: row.progress, targetDate: row.target_date, createdAt: row.created_at, updatedAt: row.updated_at };
}
function publicTask(row: TaskRow) {
  return { id: row.id, goalId: row.goal_id, title: row.title, firstStep: row.first_step, notes: row.notes, area: row.area, status: row.status, priority: row.priority, energy: row.energy, durationMinutes: row.duration_minutes, dueAt: row.due_at, scheduledStart: row.scheduled_start, scheduledEnd: row.scheduled_end, source: row.source, sourceItemId: row.source_item_id, practiceOutcome: row.practice_outcome, practiceReflection: row.practice_reflection, reflectedAt: row.reflected_at, completedAt: row.completed_at, createdAt: row.created_at, updatedAt: row.updated_at, repeatEveryDays: row.repeat_every_days ?? null, notBefore: row.not_before ?? null };
}
function publicBlocker(row: BlockerRow) {
  return { id: row.id, taskId: row.task_id, taskTitle: row.task_title, reason: row.reason, originalDuration: row.original_duration, createdAt: row.created_at };
}
function publicFloor(row: FloorRow) {
  return { id: row.id, title: row.title, area: row.area, target: row.target, unit: row.unit, completionDates: parseStringArray(row.completion_dates_json), createdAt: row.created_at, updatedAt: row.updated_at };
}
function publicEvent(row: EventRow) {
  return { id: row.id, externalId: row.external_id, source: row.source, calendarName: row.calendar_name, title: row.title, notes: row.notes, location: row.location, url: row.url, startAt: row.start_at, endAt: row.end_at, allDay: row.all_day === 1, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
}
function publicHealth(row: HealthRow) {
  return { id: row.id, externalId: row.external_id, type: row.type, value: row.value, unit: row.unit, startAt: row.start_at, endAt: row.end_at, source: row.source, metadata: parseRecord(row.metadata_json), createdAt: row.created_at };
}
function publicAccount(row: AccountRow) {
  return { id: row.id, externalId: row.external_id, name: row.name, institution: row.institution, type: row.type, balance: row.balance, currency: row.currency, source: row.source, lastSyncedAt: row.last_synced_at, createdAt: row.created_at, updatedAt: row.updated_at };
}
function publicTransaction(row: TransactionRow) {
  return { id: row.id, accountId: row.account_id, externalId: row.external_id, name: row.name, merchant: row.merchant, amount: row.amount, currency: row.currency, category: row.category, occurredAt: row.occurred_at, status: row.status, notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at };
}
function publicFile(row: FileRow) {
  return { id: row.id, name: row.name, mimeType: row.mime_type, sizeBytes: row.size_bytes, folder: row.folder, tags: parseStringArray(row.tags_json), summary: row.summary, createdAt: row.created_at, updatedAt: row.updated_at };
}

async function requireChanged(result: D1Result, message: string): Promise<void> {
  if ((result.meta.changes ?? 0) < 1) throw new ApiError(404, "not_found", message);
}

export class LifeRepository {
  constructor(private readonly db: D1Database) {}

  private async brainEnabled(userId: string) {
    return Boolean(await this.db.prepare("SELECT user_id FROM life_brain WHERE user_id = ?1 AND json_extract(settings_json, '$.enabled') = 1").bind(userId).first());
  }

  async startAutopilotFocus(userId: string, taskId: string, expectedUpdatedAt: string, expectedActiveId: string | null) {
    // One atomic statement: either the observed plan still matches and the focus
    // changes, or no row changes. A stale model answer cannot resurrect a task.
    const result = await this.db.prepare(`WITH eligible AS MATERIALIZED (
      SELECT id FROM life_tasks WHERE user_id = ?1 AND id = ?2 AND updated_at = ?3
        AND status IN ('inbox','queued','active')
        AND COALESCE((SELECT id FROM life_tasks WHERE user_id = ?1 AND status = 'active' LIMIT 1), '') = COALESCE(?4, '')
      ) UPDATE life_tasks
      SET status = CASE WHEN id = ?2 THEN 'active' ELSE 'queued' END, updated_at = ?5
      WHERE user_id = ?1 AND (id = ?2 OR status = 'active')
        AND EXISTS (SELECT 1 FROM eligible)`)
      .bind(userId, taskId, expectedUpdatedAt, expectedActiveId, isoNow()).run();
    if ((result.meta.changes ?? 0) === 0) throw new ApiError(409, "plan_changed", "Your plan changed while Jev was deciding. Refresh and try again.");
  }

  async snapshot(userId: string, options: { allHistory?: boolean } = {}): Promise<LifeSnapshot> {
    const allHistory = options.allHistory === true;
    const [goals, tasks, blockers, floor, events, health, accounts, transactions, files] = await Promise.all([
      this.db.prepare("SELECT * FROM life_goals WHERE user_id = ?1 ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, updated_at DESC").bind(userId).all<GoalRow>(),
      this.db.prepare("SELECT * FROM life_tasks WHERE user_id = ?1 ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'queued' THEN 1 WHEN 'inbox' THEN 2 WHEN 'waiting' THEN 3 WHEN 'done' THEN 4 ELSE 5 END, COALESCE(due_at, '9999-12-31'), created_at").bind(userId).all<TaskRow>(),
      this.db.prepare(`SELECT * FROM life_task_blockers WHERE user_id = ?1 ORDER BY created_at DESC${allHistory ? "" : " LIMIT 200"}`).bind(userId).all<BlockerRow>(),
      this.db.prepare("SELECT * FROM life_floor_items WHERE user_id = ?1 ORDER BY created_at").bind(userId).all<FloorRow>(),
      allHistory
        ? this.db.prepare("SELECT * FROM calendar_events WHERE user_id = ?1 ORDER BY start_at").bind(userId).all<EventRow>()
        : this.db.prepare("SELECT * FROM calendar_events WHERE user_id = ?1 AND end_at >= ?2 ORDER BY start_at LIMIT 500").bind(userId, new Date(Date.now() - 7 * 86_400_000).toISOString()).all<EventRow>(),
      allHistory
        ? this.db.prepare("SELECT * FROM health_metrics WHERE user_id = ?1 ORDER BY start_at DESC").bind(userId).all<HealthRow>()
        : this.db.prepare(`
            WITH recent AS (
              SELECT * FROM health_metrics
              WHERE user_id = ?1 AND start_at >= ?2
              ORDER BY start_at DESC
              LIMIT 2000
            ), authoritative AS (
              SELECT * FROM health_metrics
              WHERE user_id = ?1 AND start_at >= ?2
                AND json_extract(metadata_json, '$.aggregation') IN ('healthkit_statistics', 'healthkit_sleep_union')
            )
            SELECT * FROM recent
            UNION
            SELECT * FROM authoritative
            ORDER BY start_at DESC
          `).bind(userId, new Date(Date.now() - 90 * 86_400_000).toISOString()).all<HealthRow>(),
      this.db.prepare("SELECT * FROM finance_accounts WHERE user_id = ?1 ORDER BY updated_at DESC").bind(userId).all<AccountRow>(),
      this.db.prepare(`SELECT * FROM finance_transactions WHERE user_id = ?1 ORDER BY occurred_at DESC${allHistory ? "" : " LIMIT 2000"}`).bind(userId).all<TransactionRow>(),
      this.db.prepare(`SELECT * FROM vault_files WHERE user_id = ?1 ORDER BY created_at DESC${allHistory ? "" : " LIMIT 1000"}`).bind(userId).all<FileRow>(),
    ]);
    return {
      goals: goals.results.map(publicGoal) as LifeSnapshot["goals"],
      tasks: tasks.results.map(publicTask) as LifeSnapshot["tasks"],
      blockers: blockers.results.map(publicBlocker) as LifeSnapshot["blockers"],
      floor: floor.results.map(publicFloor) as LifeSnapshot["floor"],
      events: events.results.map(publicEvent) as LifeSnapshot["events"],
      health: health.results.map(publicHealth) as LifeSnapshot["health"],
      accounts: accounts.results.map(publicAccount) as LifeSnapshot["accounts"],
      transactions: transactions.results.map(publicTransaction) as LifeSnapshot["transactions"],
      files: files.results.map(publicFile) as LifeSnapshot["files"],
    };
  }

  async createGoal(userId: string, input: CreateGoal) {
    const id = crypto.randomUUID(); const now = isoNow();
    await this.db.prepare("INSERT INTO life_goals (id,user_id,title,area,vision,why,status,progress,target_date,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,'active',0,?7,?8,?8)")
      .bind(id, userId, input.title, input.area, input.vision, input.why, input.targetDate ?? null, now).run();
    return this.requireGoal(userId, id);
  }

  async updateGoal(userId: string, id: string, input: Record<string, unknown>) {
    const columns: Record<string, string> = { title: "title", area: "area", vision: "vision", why: "why", status: "status", progress: "progress", targetDate: "target_date" };
    const entries = Object.entries(input).filter(([key]) => key in columns);
    const values = entries.map(([, value]) => value ?? null);
    const assignments = entries.map(([key], index) => `${columns[key]} = ?${index + 3}`);
    const result = await this.db.prepare(`UPDATE life_goals SET ${assignments.join(", ")}, updated_at = ?${entries.length + 3} WHERE user_id = ?1 AND id = ?2`)
      .bind(userId, id, ...values, isoNow()).run();
    await requireChanged(result, "Goal not found.");
    return this.requireGoal(userId, id);
  }

  async createTask(userId: string, input: CreateTask) {
    const id = crypto.randomUUID(); const now = isoNow();
    let status = input.status;
    if (status === "active") {
      await this.db.prepare("UPDATE life_tasks SET status = 'queued', updated_at = ?2 WHERE user_id = ?1 AND status = 'active'").bind(userId, now).run();
    }
    if (status === "queued" && (!input.notBefore || input.notBefore <= now) && (!input.scheduledStart || input.scheduledStart <= now) && !await this.brainEnabled(userId)) {
      const active = await this.db.prepare("SELECT id FROM life_tasks WHERE user_id = ?1 AND status = 'active'").bind(userId).first();
      if (!active) status = "active";
    }
    await this.db.prepare(`INSERT INTO life_tasks
      (id,user_id,goal_id,title,first_step,notes,area,status,priority,energy,duration_minutes,due_at,scheduled_start,scheduled_end,source,source_item_id,completed_at,created_at,updated_at,repeat_every_days,not_before)
      VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,NULL,?17,?17,?18,?19)`)
      .bind(id, userId, input.goalId ?? null, input.title, input.firstStep, input.notes, input.area, status, input.priority, input.energy, input.durationMinutes, input.dueAt ?? null, input.scheduledStart ?? null, input.scheduledEnd ?? null, input.source, input.sourceItemId ?? null, now, input.repeatEveryDays ?? null, input.notBefore ?? null).run();
    return this.requireTask(userId, id);
  }

  async updateTask(userId: string, id: string, input: Record<string, unknown>) {
    const columns: Record<string, string> = { goalId: "goal_id", title: "title", firstStep: "first_step", notes: "notes", area: "area", status: "status", priority: "priority", energy: "energy", durationMinutes: "duration_minutes", dueAt: "due_at", scheduledStart: "scheduled_start", scheduledEnd: "scheduled_end", source: "source", repeatEveryDays: "repeat_every_days", notBefore: "not_before" };
    if (input.status === "active") {
      await this.db.prepare("UPDATE life_tasks SET status = 'queued', updated_at = ?3 WHERE user_id = ?1 AND status = 'active' AND id <> ?2").bind(userId, id, isoNow()).run();
    }
    const entries = Object.entries(input).filter(([key]) => key in columns);
    const values = entries.map(([, value]) => value ?? null);
    const assignments = entries.map(([key], index) => `${columns[key]} = ?${index + 3}`);
    const result = await this.db.prepare(`UPDATE life_tasks SET ${assignments.join(", ")}, updated_at = ?${entries.length + 3} WHERE user_id = ?1 AND id = ?2`)
      .bind(userId, id, ...values, isoNow()).run();
    await requireChanged(result, "Task not found.");
    return this.requireTask(userId, id);
  }

  async completeTask(userId: string, id: string, minutesSpent = 0, result?: { outcome: "helped" | "mixed" | "not_for_me"; reflection: string }) {
    const task = await this.requireTask(userId, id);
    if (task.status === "done") return { task, next: await this.activeTask(userId) };
    if (result && task.source !== "practice") throw new ApiError(422, "not_a_practice", "Only a real-life experiment can record this kind of result.");
    const now = isoNow();
    const completion = this.db.prepare("UPDATE life_tasks SET status = 'done', completed_at = ?3, updated_at = ?3, notes = CASE WHEN ?4 > 0 THEN notes || CASE WHEN notes = '' THEN '' ELSE '\n' END || 'Completed in ' || ?4 || ' minutes.' ELSE notes END, practice_outcome = COALESCE(?5, practice_outcome), practice_reflection = CASE WHEN ?5 IS NULL THEN practice_reflection ELSE ?6 END, reflected_at = CASE WHEN ?5 IS NULL THEN reflected_at ELSE ?3 END WHERE user_id = ?1 AND id = ?2")
      .bind(userId, id, now, Math.max(0, Math.round(minutesSpent)), result?.outcome ?? null, result?.reflection ?? "");
    if (task.repeatEveryDays) {
      const notBefore = new Date(Date.parse(now) + task.repeatEveryDays * 86_400_000).toISOString();
      const recurrence = this.db.prepare(`INSERT INTO life_tasks
        (id,user_id,goal_id,title,first_step,notes,area,status,priority,energy,duration_minutes,due_at,source,source_item_id,created_at,updated_at,repeat_every_days,not_before,recurrence_parent_id)
        SELECT ?3,user_id,goal_id,title,first_step,notes,area,'queued',priority,energy,duration_minutes,?5,source,source_item_id,?6,?6,repeat_every_days,?4,id
        FROM life_tasks WHERE user_id = ?1 AND id = ?2 AND status = 'done'
        ON CONFLICT(user_id,recurrence_parent_id) WHERE recurrence_parent_id IS NOT NULL DO NOTHING`)
        .bind(userId, id, crypto.randomUUID(), notBefore, new Date(Date.parse(notBefore) + 86_400_000).toISOString(), now);
      await this.db.batch([completion, recurrence]);
    } else { await completion.run(); }
    if (task.status === "active" && !await this.brainEnabled(userId)) await this.activateBestTask(userId);
    return { task: await this.requireTask(userId, id), next: await this.activeTask(userId) };
  }

  async reflectOnPractice(userId: string, id: string, result: { outcome: "helped" | "mixed" | "not_for_me"; reflection: string }) {
    const task = await this.requireTask(userId, id);
    if (task.source !== "practice") throw new ApiError(422, "not_a_practice", "Only a real-life experiment can record this kind of result.");
    if (task.status !== "done") throw new ApiError(409, "practice_not_finished", "Finish the experiment before recording what happened.");
    const now = isoNow();
    await this.db.prepare("UPDATE life_tasks SET practice_outcome = ?3, practice_reflection = ?4, reflected_at = ?5, updated_at = ?5 WHERE user_id = ?1 AND id = ?2")
      .bind(userId, id, result.outcome, result.reflection, now).run();
    return this.requireTask(userId, id);
  }

  async blockTask(userId: string, id: string, reason: BlockerReason) {
    const task = await this.requireTask(userId, id); const now = isoNow();
    await this.db.prepare("INSERT INTO life_task_blockers (id,user_id,task_id,task_title,reason,original_duration,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)")
      .bind(crypto.randomUUID(), userId, id, task.title, reason, task.durationMinutes, now).run();
    const adaptations: Record<BlockerReason, { title?: string; firstStep: string; duration: number; remove?: boolean; moveAside?: boolean }> = {
      big: { title: task.firstStep || task.title, firstStep: "Open what you need and begin for two minutes. Stopping after that still counts as starting.", duration: Math.max(2, Math.min(5, Math.ceil(task.durationMinutes / 3))) },
      unclear: { firstStep: "Write the first visible physical action in one sentence. Then do only that sentence.", duration: Math.min(5, task.durationMinutes) },
      time: { firstStep: "Set a five-minute boundary and finish the smallest useful piece before it ends.", duration: Math.min(5, task.durationMinutes) },
      place: { firstStep: "Choose the smallest version that works where you are now.", duration: Math.min(10, task.durationMinutes) },
      irrelevant: { firstStep: task.firstStep, duration: task.durationMinutes, remove: true },
      different: { firstStep: task.firstStep, duration: task.durationMinutes, moveAside: true },
    };
    const adaptation = adaptations[reason];
    const deferredUntil = adaptation.moveAside ? new Date(Date.parse(now) + 60 * 60 * 1000).toISOString() : null;
    await this.db.prepare("UPDATE life_tasks SET title = ?3, first_step = ?4, duration_minutes = ?5, status = ?6, not_before = CASE WHEN ?8 IS NULL OR not_before > ?8 THEN not_before ELSE ?8 END, updated_at = ?7 WHERE user_id = ?1 AND id = ?2")
      .bind(userId, id, adaptation.title ?? task.title, adaptation.firstStep, adaptation.duration, adaptation.remove ? "removed" : adaptation.moveAside ? "queued" : task.status, now, deferredUntil).run();
    if ((adaptation.remove || adaptation.moveAside) && task.status === "active" && !await this.brainEnabled(userId)) await this.activateBestTask(userId);
    return { task: await this.requireTask(userId, id), next: await this.activeTask(userId) };
  }

  async createFloorItem(userId: string, input: { title: string; area: string; target: number; unit: string }) {
    const id = crypto.randomUUID(); const now = isoNow();
    await this.db.prepare("INSERT INTO life_floor_items (id,user_id,title,area,target,unit,completion_dates_json,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,'[]',?7,?7)")
      .bind(id, userId, input.title, input.area, input.target, input.unit, now).run();
    return this.db.prepare("SELECT * FROM life_floor_items WHERE user_id = ?1 AND id = ?2").bind(userId, id).first<FloorRow>().then((row) => publicFloor(row!));
  }

  async toggleFloor(userId: string, id: string, date: string) {
    const row = await this.db.prepare("SELECT * FROM life_floor_items WHERE user_id = ?1 AND id = ?2").bind(userId, id).first<FloorRow>();
    if (!row) throw new ApiError(404, "not_found", "Daily basic not found.");
    const values = new Set(parseStringArray(row.completion_dates_json));
    if (values.has(date)) values.delete(date); else values.add(date);
    await this.db.prepare("UPDATE life_floor_items SET completion_dates_json = ?3, updated_at = ?4 WHERE user_id = ?1 AND id = ?2")
      .bind(userId, id, JSON.stringify([...values].sort()), isoNow()).run();
    return { ...publicFloor(row), completionDates: [...values].sort(), updatedAt: isoNow() };
  }

  async upsertCalendarEvents(userId: string, events: Array<Record<string, unknown>>) {
    const now = isoNow();
    await this.db.batch(events.map((event) => {
      const id = crypto.randomUUID();
      return this.db.prepare(`INSERT INTO calendar_events (id,user_id,external_id,source,calendar_name,title,notes,location,url,start_at,end_at,all_day,status,created_at,updated_at)
        VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?14)
        ON CONFLICT(user_id,source,external_id) DO UPDATE SET calendar_name=excluded.calendar_name,title=excluded.title,notes=excluded.notes,location=excluded.location,url=excluded.url,start_at=excluded.start_at,end_at=excluded.end_at,all_day=excluded.all_day,status=excluded.status,updated_at=excluded.updated_at`)
        .bind(id, userId, event.externalId ?? null, event.source, event.calendarName, event.title, event.notes, event.location, event.url ?? null, event.startAt, event.endAt, event.allDay ? 1 : 0, event.status, now);
    }));
    return { synced: events.length };
  }

  async upsertHealthMetrics(userId: string, metrics: Array<Record<string, unknown>>) {
    const now = isoNow();
    await this.db.batch(metrics.map((metric) => this.db.prepare(`INSERT INTO health_metrics (id,user_id,external_id,type,value,unit,start_at,end_at,source,metadata_json,created_at)
      VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
      ON CONFLICT(user_id,source,external_id) DO UPDATE SET type=excluded.type,value=excluded.value,unit=excluded.unit,start_at=excluded.start_at,end_at=excluded.end_at,metadata_json=excluded.metadata_json`)
      .bind(crypto.randomUUID(), userId, metric.externalId ?? null, metric.type, metric.value, metric.unit, metric.startAt, metric.endAt, metric.source, JSON.stringify(metric.metadata ?? {}), now)));
    return { synced: metrics.length };
  }

  async upsertFinanceAccounts(userId: string, accounts: Array<Record<string, unknown>>) {
    const now = isoNow();
    const prepared: Array<Record<string, unknown> & { externalId: string }> = accounts.map((account) => ({
      ...account,
      externalId: typeof account.externalId === "string" ? account.externalId : crypto.randomUUID(),
    }));
    await this.db.batch(prepared.map((account) => {
      const id = crypto.randomUUID();
      return this.db.prepare(`INSERT INTO finance_accounts (id,user_id,external_id,name,institution,type,balance,currency,source,last_synced_at,created_at,updated_at)
        VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?11)
        ON CONFLICT(user_id,source,external_id) DO UPDATE SET name=excluded.name,institution=excluded.institution,type=excluded.type,balance=excluded.balance,currency=excluded.currency,last_synced_at=excluded.last_synced_at,updated_at=excluded.updated_at`)
        .bind(id, userId, account.externalId ?? null, account.name, account.institution, account.type, account.balance, account.currency, account.source, account.lastSyncedAt ?? null, now);
    }));
    const records = await Promise.all(prepared.map(async (account) => {
      const row = await this.db.prepare("SELECT * FROM finance_accounts WHERE user_id = ?1 AND source = ?2 AND external_id = ?3")
        .bind(userId, account.source, account.externalId).first<AccountRow>();
      if (!row) throw new ApiError(500, "sync_failed", "A synced finance account could not be read back.");
      return publicAccount(row);
    }));
    return { synced: accounts.length, accounts: records };
  }

  async upsertFinanceTransactions(userId: string, transactions: Array<Record<string, unknown>>) {
    const now = isoNow();
    await this.db.batch(transactions.map((transaction) => this.db.prepare(`INSERT INTO finance_transactions (id,user_id,account_id,external_id,name,merchant,amount,currency,category,occurred_at,status,notes,created_at,updated_at)
      VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?13)
      ON CONFLICT(user_id,external_id) DO UPDATE SET account_id=excluded.account_id,name=excluded.name,merchant=excluded.merchant,amount=excluded.amount,currency=excluded.currency,category=excluded.category,occurred_at=excluded.occurred_at,status=excluded.status,notes=excluded.notes,updated_at=excluded.updated_at`)
      .bind(crypto.randomUUID(), userId, transaction.accountId ?? null, transaction.externalId ?? crypto.randomUUID(), transaction.name, transaction.merchant, transaction.amount, transaction.currency, transaction.category, transaction.occurredAt, transaction.status, transaction.notes, now)));
    return { synced: transactions.length };
  }

  async addFile(userId: string, file: { name: string; mimeType: string; sizeBytes: number; objectKey: string; folder: string; tags: string[]; summary: string }) {
    const id = crypto.randomUUID(); const now = isoNow();
    await this.db.prepare("INSERT INTO vault_files (id,user_id,object_key,name,mime_type,size_bytes,folder,tags_json,summary,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10)")
      .bind(id, userId, file.objectKey, file.name, file.mimeType, file.sizeBytes, file.folder, JSON.stringify(file.tags), file.summary, now).run();
    return this.requireFile(userId, id);
  }

  async requireFile(userId: string, id: string) {
    const row = await this.db.prepare("SELECT * FROM vault_files WHERE user_id = ?1 AND id = ?2").bind(userId, id).first<FileRow>();
    if (!row) throw new ApiError(404, "not_found", "File not found.");
    return { record: publicFile(row), objectKey: row.object_key };
  }

  private async requireGoal(userId: string, id: string) {
    const row = await this.db.prepare("SELECT * FROM life_goals WHERE user_id = ?1 AND id = ?2").bind(userId, id).first<GoalRow>();
    if (!row) throw new ApiError(404, "not_found", "Goal not found.");
    return publicGoal(row);
  }

  private async requireTask(userId: string, id: string) {
    const row = await this.db.prepare("SELECT * FROM life_tasks WHERE user_id = ?1 AND id = ?2").bind(userId, id).first<TaskRow>();
    if (!row) throw new ApiError(404, "not_found", "Task not found.");
    return publicTask(row);
  }

  private async activeTask(userId: string) {
    const row = await this.db.prepare("SELECT * FROM life_tasks WHERE user_id = ?1 AND status = 'active' LIMIT 1").bind(userId).first<TaskRow>();
    return row ? publicTask(row) : null;
  }

  private async activateBestTask(userId: string) {
    const now = isoNow();
    const next = await this.db.prepare(`SELECT id FROM life_tasks WHERE user_id = ?1 AND status IN ('queued','inbox')
      AND (not_before IS NULL OR not_before <= ?2)
      AND (scheduled_start IS NULL OR scheduled_start <= ?2)
      ORDER BY
        CASE WHEN scheduled_start IS NOT NULL AND scheduled_start <= ?2 AND (scheduled_end IS NULL OR scheduled_end >= ?2) THEN 0 ELSE 1 END,
        CASE priority WHEN 'must' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
        CASE WHEN due_at IS NOT NULL AND due_at <= ?2 THEN 0 WHEN due_at IS NOT NULL THEN 1 ELSE 2 END,
        COALESCE(due_at, '9999-12-31'), created_at LIMIT 1`).bind(userId, now).first<{ id: string }>();
    if (next) await this.db.prepare("UPDATE life_tasks SET status = 'active', updated_at = ?3 WHERE user_id = ?1 AND id = ?2").bind(userId, next.id, now).run();
  }
}

import { brainSettingsSchema, brainStateSchema, type BrainSettings, type BrainState } from "@remember/domain";
import { ApiError } from "./http";
import { LifeRepository } from "./life-repository";
import { judgeTasks, scheduleTasks } from "./brain-planner";

interface BrainRow {
  user_id: string; settings_json: string; state_json: string | null;
  revision: number; dirty: number; next_check_at: string | null;
  lease_id: string | null; lease_until: string | null; committed_run: string | null;
}
type BrainEnv = Pick<Env, "DB" | "OPENROUTER_API_KEY">;

export class BrainService {
  constructor(private readonly env: BrainEnv, private readonly fetcher: typeof fetch = fetch) {}

  private row(userId: string) {
    return this.env.DB.prepare("SELECT * FROM life_brain WHERE user_id = ?1").bind(userId).first<BrainRow>();
  }

  async initialize(userId: string, timeZone: string) {
    const settings = brainSettingsSchema.parse({ timeZone });
    await this.env.DB.prepare(`INSERT INTO life_brain (user_id,settings_json,updated_at) VALUES (?1,?2,?3) ON CONFLICT(user_id) DO UPDATE SET
      settings_json = json_set(settings_json, '$.timeZone', json_extract(excluded.settings_json, '$.timeZone')),
      revision = revision + 1, dirty = 1, next_check_at = NULL
      WHERE json_extract(settings_json, '$.timeZone') != json_extract(excluded.settings_json, '$.timeZone')`)
      .bind(userId, JSON.stringify(settings), new Date().toISOString()).run();
  }

  async read(userId: string): Promise<BrainState | null> {
    const row = await this.row(userId); if (!row) return null;
    const settings = brainSettingsSchema.parse(JSON.parse(row.settings_json));
    const previous = row.state_json ? brainStateSchema.parse(JSON.parse(row.state_json)) : null;
    const state: BrainState = previous ?? { settings, status: "waiting", message: "Jev is getting your plan ready.", model: null, evaluatedAt: null, nextCheckAt: null, plan: [], contextUsed: [], unscheduledCount: 0 };
    state.settings = settings;
    state.nextCheckAt = row.next_check_at;
    if (!settings.enabled) { state.status = "paused"; state.message = "Automatic planning is paused. Your tasks are still here."; }
    else if (row.lease_until && Date.parse(row.lease_until) > Date.now()) { state.status = "planning"; state.message = "Jev is updating your plan."; }
    else if (row.dirty && state.status !== "unavailable") { state.status = "waiting"; state.message = "Your context changed. Jev will update your plan."; }
    return state;
  }

  async updateSettings(userId: string, settings: BrainSettings) {
    await this.env.DB.prepare(`INSERT INTO life_brain (user_id,settings_json,updated_at) VALUES (?1,?2,?3)
      ON CONFLICT(user_id) DO UPDATE SET settings_json = excluded.settings_json, revision = revision + 1,
      dirty = 1, next_check_at = NULL, updated_at = excluded.updated_at`)
      .bind(userId, JSON.stringify(settings), new Date().toISOString()).run();
    return this.read(userId);
  }

  async run(userId: string, now = new Date()): Promise<BrainState | null> {
    const row = await this.row(userId); if (!row) return null;
    const settings = brainSettingsSchema.parse(JSON.parse(row.settings_json));
    if (!settings.enabled) return this.read(userId);
    // Failed calls back off for five minutes, including after ordinary context changes.
    if (!row.dirty && row.next_check_at && row.next_check_at > now.toISOString()) return this.read(userId);
    if (row.state_json && JSON.parse(row.state_json).status === "unavailable" && row.next_check_at && row.next_check_at > now.toISOString()) return this.read(userId);
    const lease = crypto.randomUUID();
    const locked = await this.env.DB.prepare(`UPDATE life_brain SET lease_id = ?2, lease_until = ?3
      WHERE user_id = ?1 AND (lease_until IS NULL OR lease_until <= ?4)`)
      .bind(userId, lease, new Date(now.getTime() + 60_000).toISOString(), now.toISOString()).run();
    if (!locked.meta.changes) return this.read(userId);
    const captured = await this.row(userId);
    if (!captured) return null;
    if (captured.settings_json !== row.settings_json) {
      await this.env.DB.prepare("UPDATE life_brain SET lease_id = NULL, lease_until = NULL WHERE user_id = ?1 AND lease_id = ?2").bind(userId, lease).run();
      return this.read(userId);
    }
    try {
      if (!this.env.OPENROUTER_API_KEY?.trim()) throw new ApiError(503, "jev_not_configured", "Connect your server’s OpenRouter key to let Jev keep your tasks planned.");
      const snapshot = await new LifeRepository(this.env.DB).snapshot(userId);
      const [principles, thoughts] = await Promise.all([
        this.env.DB.prepare("SELECT text FROM candidate_principles WHERE user_id = ?1 AND status = 'active' ORDER BY updated_at DESC LIMIT 20").bind(userId).all<{ text: string }>(),
        this.env.DB.prepare("SELECT note_text FROM items WHERE user_id = ?1 AND memory_kind = 'thought' AND note_text IS NOT NULL ORDER BY saved_at DESC LIMIT 12").bind(userId).all<{ note_text: string }>(),
      ]);
      const { judgments, model } = await judgeTasks(snapshot, settings, { principles: principles.results.map((row) => row.text.slice(0, 400)), thoughts: thoughts.results.map((row) => row.note_text.slice(0, 400)) }, this.env.OPENROUTER_API_KEY, now, this.fetcher);
      const plan = scheduleTasks(snapshot, settings, judgments, now);
      const soonest = plan.find((block) => Date.parse(block.startAt) > now.getTime());
      const nextCheckAt = new Date(Math.max(now.getTime() + 60_000, Math.min(now.getTime() + 15 * 60_000, soonest ? Date.parse(soonest.startAt) : Infinity))).toISOString();
      const unscheduledCount = snapshot.tasks.filter((task) => ["queued", "inbox"].includes(task.status) && !plan.some((block) => block.taskId === task.id)).length;
      const state: BrainState = {
        settings, status: "ready", message: plan.length ? "Your next steps are in place. Jev will adjust when life changes." : unscheduledCount ? "Some tasks need more context or a longer opening. Your current focus is unchanged." : "Nothing else needs scheduling right now.",
        model, evaluatedAt: now.toISOString(), nextCheckAt, plan, unscheduledCount,
        contextUsed: ["Tasks and deadlines", "Calendar openings", ...(settings.preferences ? ["Your preferences"] : []), ...(snapshot.goals.length ? ["Active goals"] : []), ...(principles.results.length ? ["Kept principles"] : []), ...(thoughts.results.length ? ["Your saved thoughts"] : []), ...(snapshot.blockers.length ? ["Recent blockers"] : []), ...(snapshot.tasks.some((task) => task.completedAt) ? ["Completed tasks and outcomes"] : []), ...(snapshot.health.some((metric) => ["sleep", "exercise_minutes"].includes(metric.type) && Date.parse(metric.endAt) > now.getTime() - 2 * 86_400_000) ? ["Recent recovery context"] : [])],
      };
      const next = !snapshot.tasks.some((task) => task.status === "active")
        ? plan.find((block) => Date.parse(block.startAt) <= now.getTime() + 60_000 && Date.parse(block.endAt) > now.getTime() && block.confidence >= 0.8
          && !snapshot.events.some((event) => event.status !== "cancelled" && !event.allDay
            && Date.parse(event.startAt) - 300_000 < Date.parse(block.endAt) && Date.parse(event.endAt) + 300_000 > now.getTime())
          && !snapshot.tasks.some((task) => task.id === block.taskId && task.notBefore && Date.parse(task.notBefore) > now.getTime())) : undefined;
      // All changes are committed atomically. Database triggers invalidate a
      // decision if any task/calendar/context row changed during inference.
      await this.env.DB.batch([
        this.env.DB.prepare(`UPDATE life_brain SET state_json = ?4, next_check_at = ?5, committed_run = ?2, updated_at = ?6
          WHERE user_id = ?1 AND lease_id = ?2 AND revision = ?3 AND json_extract(settings_json,'$.enabled') = 1`)
          .bind(userId, lease, captured.revision, JSON.stringify(state), nextCheckAt, now.toISOString()),
        this.env.DB.prepare(`UPDATE life_tasks SET status = 'active', updated_at = ?4
          WHERE user_id = ?1 AND id = ?2 AND status IN ('queued','inbox')
            AND NOT EXISTS (SELECT 1 FROM life_tasks WHERE user_id = ?1 AND status = 'active')
            AND EXISTS (SELECT 1 FROM life_brain WHERE user_id = ?1 AND committed_run = ?3)`)
          .bind(userId, next?.taskId ?? "", lease, new Date().toISOString()),
        this.env.DB.prepare("UPDATE life_brain SET dirty = 0 WHERE user_id = ?1 AND committed_run = ?2").bind(userId, lease),
      ]);
    } catch (error) {
      const previous = row.state_json ? brainStateSchema.parse(JSON.parse(row.state_json)) : null;
      const state: BrainState = { settings, status: "unavailable", message: error instanceof ApiError ? error.message : "Your plan could not refresh. Jev will retry automatically.", model: previous?.model ?? null, evaluatedAt: previous?.evaluatedAt ?? null, nextCheckAt: new Date(now.getTime() + 5 * 60_000).toISOString(), plan: previous?.plan ?? [], contextUsed: previous?.contextUsed ?? [], unscheduledCount: previous?.unscheduledCount ?? 0 };
      await this.env.DB.prepare("UPDATE life_brain SET state_json = ?3, next_check_at = ?4 WHERE user_id = ?1 AND lease_id = ?2 AND revision = ?5")
        .bind(userId, lease, JSON.stringify(state), state.nextCheckAt, captured.revision).run();
    } finally {
      await this.env.DB.prepare("UPDATE life_brain SET lease_id = NULL, lease_until = NULL WHERE user_id = ?1 AND lease_id = ?2").bind(userId, lease).run();
    }
    return this.read(userId);
  }
}

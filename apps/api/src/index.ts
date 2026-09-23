import { app } from "./app";
import { DeletionService } from "./deletion";
import { EvolutionService } from "./evolution";
import { BrainService } from "./brain";
export { IngestionWorkflow } from "./workflow";

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (event.cron === "*/15 * * * *") {
      ctx.waitUntil((async () => {
        const users = await env.DB.prepare(`SELECT user_id FROM life_brain
          WHERE json_extract(settings_json,'$.enabled') = 1
            AND (dirty = 1 OR next_check_at IS NULL OR next_check_at <= ?1)
          ORDER BY COALESCE(next_check_at,'') LIMIT 100`).bind(new Date().toISOString()).all<{ user_id: string }>();
        const brain = new BrainService(env);
        for (let index = 0; index < users.results.length; index += 5) {
          await Promise.allSettled(users.results.slice(index, index + 5).map((user) => brain.run(user.user_id)));
        }
      })());
      return;
    }
    const work = (async () => {
      await new DeletionService(env).drain();
      const users = await env.DB.prepare("SELECT id FROM users ORDER BY id LIMIT 1000").all<{ id: string }>();
      const service = new EvolutionService(env.DB);
      for (const user of users.results) await service.createResurfacing(user.id);
      await env.DB.prepare("DELETE FROM rate_limits WHERE expires_at < ?1").bind(Math.floor(Date.now() / 1_000)).run();
      await env.DB.prepare("DELETE FROM login_sessions WHERE expires_at < ?1").bind(Math.floor(Date.now() / 1_000)).run();
    })();
    ctx.waitUntil(work);
  },
} satisfies ExportedHandler<Env>;

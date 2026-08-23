import { app } from "./app";
import { EvolutionService } from "./evolution";
export { IngestionWorkflow } from "./workflow";

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const work = (async () => {
      const users = await env.DB.prepare("SELECT id FROM users ORDER BY id LIMIT 1000").all<{ id: string }>();
      const service = new EvolutionService(env.DB);
      for (const user of users.results) await service.createResurfacing(user.id);
      await env.DB.prepare("DELETE FROM rate_limits WHERE expires_at < ?1").bind(Math.floor(Date.now() / 1_000)).run();
    })();
    ctx.waitUntil(work);
  },
} satisfies ExportedHandler<Env>;

import { autopilotResponseSchema, brainStateSchema, type AutopilotRequest, type BrainSettings } from "@remember/domain";
import { apiConfig, authHeaders } from "./api";

export async function decideNextMove(input: AutopilotRequest, baseUrl = apiConfig.baseUrl, fetcher: typeof fetch = fetch) {
  if (!baseUrl) throw new Error("Connect your Remember server and its OpenRouter key to let Jev decide. Your tasks are still available in Plan.");
  const response = await fetcher(`${baseUrl}/api/life/autopilot`, {
    method: "POST", credentials: "include",
    headers: { ...authHeaders(baseUrl), "content-type": "application/json" },
    body: JSON.stringify(input), signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(error?.error?.message ?? "Jev could not decide right now. Try again.");
  }
  return autopilotResponseSchema.parse(await response.json());
}

async function brainRequest(path: string, body: unknown, method = "POST") {
  const baseUrl = apiConfig.baseUrl;
  if (!baseUrl) return null;
  const response = await fetch(`${baseUrl}/api/life/brain${path}`, {
    method, credentials: "include", headers: { ...authHeaders(baseUrl), "content-type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("Your automatic plan could not sync. Your tasks are safe; it will retry.");
  const result = await response.json() as { brain: unknown };
  return result.brain === null ? null : brainStateSchema.parse(result.brain);
}

export const syncBrain = () => brainRequest("/sync", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
export const saveBrainSettings = (settings: BrainSettings) => brainRequest("", settings, "PATCH");

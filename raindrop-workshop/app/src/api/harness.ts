import { apiJson } from "./request";

export type FiringOutcome =
  | "suppressed_cooldown"
  | "suppressed_fingerprint"
  | "suppressed_inflight"
  | "dispatched"
  | "actuated"
  | "declined_llm"
  | "failed_llm";

export interface HarnessFiring {
  id: string;
  observed_run_id: string;
  subagent_span_id: string | null;
  subagent_label: string | null;
  pattern: string;
  scope: string;
  fingerprint: string;
  summary: string | null;
  evidence: string | null;
  outcome: FiringOutcome;
  outcome_reason: string | null;
  observer_run_id: string | null;
  steering_event_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface HarnessFiringBroadcast {
  op: "insert" | "update";
  observed_run_id: string;
  firing: HarnessFiring;
}

export interface RunHarnessFiringsData {
  firings: HarnessFiring[];
}

export async function getRunHarnessFirings(runId: string): Promise<RunHarnessFiringsData> {
  return apiJson<RunHarnessFiringsData>(`/api/runs/${encodeURIComponent(runId)}/harness-firings`);
}

import type { FiringFacts } from "./detection.ts";

export type FiringOutcome =
  | "suppressed_cooldown"
  | "suppressed_fingerprint"
  | "suppressed_inflight"
  | "dispatched"
  | "actuated"
  | "declined_llm"
  | "failed_llm";

export interface RecordFiringInput {
  workshopBase: string;
  observedRunId: string;
  facts: FiringFacts;
  fingerprint: string;
  outcome: FiringOutcome;
  outcomeReason?: string;
  observerRunId?: string;
  steeringEventId?: string;
}

interface FiringRow {
  id: string;
  observed_run_id: string;
  outcome: FiringOutcome;
}

async function postJson(url: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`[firings] POST ${url} failed:`, err);
    return null;
  }
}

export async function recordFiring(input: RecordFiringInput): Promise<FiringRow | null> {
  const res = await postJson(`${input.workshopBase}/api/harness/firings`, {
    observed_run_id: input.observedRunId,
    subagent_span_id: input.facts.subagentSpanId,
    subagent_label: input.facts.subagentLabel,
    pattern: input.facts.pattern,
    scope: input.facts.scope,
    fingerprint: input.fingerprint,
    summary: input.facts.summary,
    evidence: input.facts.evidence,
    outcome: input.outcome,
    outcome_reason: input.outcomeReason,
    observer_run_id: input.observerRunId,
    steering_event_id: input.steeringEventId,
  });
  if (!res || !res.ok) return null;
  try {
    const body = (await res.json()) as { firing: FiringRow };
    return body.firing;
  } catch {
    return null;
  }
}

export interface ResolveFiringInput {
  workshopBase: string;
  observedRunId: string;
  scope: string;
  pattern: string;
  fingerprint: string;
  outcome: FiringOutcome;
  outcomeReason?: string;
  observerRunId?: string;
  steeringEventId?: string;
}

export async function resolveFiring(input: ResolveFiringInput): Promise<FiringRow | null> {
  const res = await postJson(`${input.workshopBase}/api/harness/firings/resolve`, {
    observed_run_id: input.observedRunId,
    scope: input.scope,
    pattern: input.pattern,
    fingerprint: input.fingerprint,
    outcome: input.outcome,
    outcome_reason: input.outcomeReason,
    observer_run_id: input.observerRunId,
    steering_event_id: input.steeringEventId,
  });
  if (!res) return null;
  if (res.status === 404) return null;
  if (!res.ok) return null;
  try {
    const body = (await res.json()) as { firing: FiringRow };
    return body.firing;
  } catch {
    return null;
  }
}

export interface SteeringEventLite {
  id: string;
  observed_run_id: string;
  observer_run_id: string | null;
  source: string;
  created_at: number;
  action: string;
}

export async function fetchSteeringForRun(
  workshopBase: string,
  observedRunId: string,
): Promise<SteeringEventLite[]> {
  try {
    const res = await fetch(`${workshopBase}/api/runs/${encodeURIComponent(observedRunId)}/steering`);
    if (!res.ok) return [];
    const body = (await res.json()) as { events?: SteeringEventLite[] };
    return body.events ?? [];
  } catch {
    return [];
  }
}

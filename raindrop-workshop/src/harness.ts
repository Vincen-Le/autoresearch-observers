import { randomUUID } from "crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDrizzleDb } from "./db";
import { harness_firings } from "./db/schema";

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

export interface CreateFiringInput {
  observed_run_id: string;
  subagent_span_id?: string | null;
  subagent_label?: string | null;
  pattern: string;
  scope: string;
  fingerprint: string;
  summary?: string | null;
  evidence?: unknown;
  outcome: FiringOutcome;
  outcome_reason?: string | null;
  observer_run_id?: string | null;
  steering_event_id?: string | null;
}

export interface UpdateFiringInput {
  outcome?: FiringOutcome;
  outcome_reason?: string | null;
  observer_run_id?: string | null;
  steering_event_id?: string | null;
}

const OUTCOMES: ReadonlySet<FiringOutcome> = new Set([
  "suppressed_cooldown",
  "suppressed_fingerprint",
  "suppressed_inflight",
  "dispatched",
  "actuated",
  "declined_llm",
  "failed_llm",
]);

export class InvalidFiringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidFiringError";
  }
}

function optionalString(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function serializeEvidence(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export function createHarnessFiring(input: CreateFiringInput): HarnessFiring {
  const observedRunId = optionalString(input.observed_run_id);
  if (!observedRunId) throw new InvalidFiringError("observed_run_id is required");
  if (!OUTCOMES.has(input.outcome)) throw new InvalidFiringError(`invalid outcome: ${input.outcome}`);
  const pattern = optionalString(input.pattern);
  if (!pattern) throw new InvalidFiringError("pattern is required");
  const scope = optionalString(input.scope);
  if (!scope) throw new InvalidFiringError("scope is required");
  const fingerprint = optionalString(input.fingerprint);
  if (!fingerprint) throw new InvalidFiringError("fingerprint is required");
  const now = Date.now();
  const row: HarnessFiring = {
    id: randomUUID(),
    observed_run_id: observedRunId,
    subagent_span_id: optionalString(input.subagent_span_id ?? null),
    subagent_label: optionalString(input.subagent_label ?? null),
    pattern,
    scope,
    fingerprint,
    summary: optionalString(input.summary ?? null),
    evidence: serializeEvidence(input.evidence),
    outcome: input.outcome,
    outcome_reason: optionalString(input.outcome_reason ?? null),
    observer_run_id: optionalString(input.observer_run_id ?? null),
    steering_event_id: optionalString(input.steering_event_id ?? null),
    created_at: now,
    updated_at: now,
  };
  getDrizzleDb().insert(harness_firings).values(row).run();
  return row;
}

export function updateHarnessFiring(id: string, input: UpdateFiringInput): HarnessFiring | null {
  const trimmedId = optionalString(id);
  if (!trimmedId) throw new InvalidFiringError("id is required");
  if (input.outcome && !OUTCOMES.has(input.outcome)) {
    throw new InvalidFiringError(`invalid outcome: ${input.outcome}`);
  }
  const patch: Record<string, unknown> = { updated_at: Date.now() };
  if (input.outcome !== undefined) patch.outcome = input.outcome;
  if (input.outcome_reason !== undefined) patch.outcome_reason = optionalString(input.outcome_reason ?? null);
  if (input.observer_run_id !== undefined) patch.observer_run_id = optionalString(input.observer_run_id ?? null);
  if (input.steering_event_id !== undefined) patch.steering_event_id = optionalString(input.steering_event_id ?? null);
  getDrizzleDb()
    .update(harness_firings)
    .set(patch)
    .where(eq(harness_firings.id, trimmedId))
    .run();
  return getHarnessFiring(trimmedId);
}

export function getHarnessFiring(id: string): HarnessFiring | null {
  const row = getDrizzleDb()
    .select()
    .from(harness_firings)
    .where(eq(harness_firings.id, id))
    .get();
  return (row ?? null) as HarnessFiring | null;
}

export function listHarnessFiringsForRun(runId: string): HarnessFiring[] {
  return getDrizzleDb()
    .select()
    .from(harness_firings)
    .where(eq(harness_firings.observed_run_id, runId))
    .orderBy(desc(harness_firings.created_at))
    .all() as HarnessFiring[];
}

/**
 * Find the most recent dispatched firing for (observed_run_id, scope, pattern, fingerprint)
 * that has not yet been resolved to actuated/declined. Used by the observer harness to
 * reconcile the LLM pass result back onto the firing row when the harness only knows the
 * pattern key (not the firing id).
 */
export function findUnresolvedDispatched(opts: {
  observed_run_id: string;
  scope: string;
  pattern: string;
  fingerprint: string;
}): HarnessFiring | null {
  const row = getDrizzleDb()
    .select()
    .from(harness_firings)
    .where(
      and(
        eq(harness_firings.observed_run_id, opts.observed_run_id),
        eq(harness_firings.scope, opts.scope),
        eq(harness_firings.pattern, opts.pattern),
        eq(harness_firings.fingerprint, opts.fingerprint),
        eq(harness_firings.outcome, "dispatched"),
        isNull(harness_firings.steering_event_id),
      ),
    )
    .orderBy(desc(harness_firings.created_at))
    .get();
  return (row ?? null) as HarnessFiring | null;
}

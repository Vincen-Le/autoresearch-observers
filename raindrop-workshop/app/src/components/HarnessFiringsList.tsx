import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useHarnessFirings } from "../hooks/use-harness-firings";
import type { FiringOutcome, HarnessFiring } from "../api/harness";
import { C } from "../utils/colors";

type Bucket = "all" | "actuated" | "declined" | "suppressed";

const BUCKET_LABELS: Record<Bucket, string> = {
  all: "All",
  actuated: "Actuated",
  declined: "LLM declined",
  suppressed: "Harness suppressed",
};

const OUTCOME_LABELS: Record<FiringOutcome, string> = {
  suppressed_cooldown: "cooldown",
  suppressed_fingerprint: "duplicate fingerprint",
  suppressed_inflight: "in-flight",
  dispatched: "dispatched",
  actuated: "actuated",
  declined_llm: "LLM declined",
  failed_llm: "LLM failed",
};

function outcomeColor(outcome: FiringOutcome): { fg: string; bg: string } {
  switch (outcome) {
    case "actuated":
      return { fg: C.green, bg: "rgba(34,197,94,0.12)" };
    case "declined_llm":
      return { fg: C.fg3, bg: "rgba(255,255,255,0.06)" };
    case "dispatched":
      return { fg: "#60a5fa", bg: "rgba(96,165,250,0.12)" };
    case "suppressed_cooldown":
    case "suppressed_fingerprint":
    case "suppressed_inflight":
      return { fg: C.fg1, bg: "rgba(255,255,255,0.04)" };
    case "failed_llm":
      return { fg: C.red, bg: "rgba(235,20,20,0.12)" };
  }
}

function bucketOf(outcome: FiringOutcome): Bucket {
  if (outcome === "actuated") return "actuated";
  if (outcome === "declined_llm" || outcome === "failed_llm") return "declined";
  if (outcome.startsWith("suppressed_")) return "suppressed";
  if (outcome === "dispatched") return "actuated";
  return "all";
}

function relativeTime(now: number, ts: number): string {
  const diff = Math.max(0, now - ts);
  if (diff < 1000) return "just now";
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return `${Math.round(diff / 3_600_000)}h ago`;
}

export function HarnessFiringsList({ runId }: { runId: string }) {
  const { firings } = useHarnessFirings(runId);
  const [bucket, setBucket] = useState<Bucket>("all");
  const counts = useMemo(() => {
    const out = { all: firings.length, actuated: 0, declined: 0, suppressed: 0 };
    for (const f of firings) {
      const b = bucketOf(f.outcome);
      if (b === "actuated") out.actuated += 1;
      else if (b === "declined") out.declined += 1;
      else if (b === "suppressed") out.suppressed += 1;
    }
    return out;
  }, [firings]);
  const filtered = useMemo(() => {
    if (bucket === "all") return firings;
    return firings.filter((f) => bucketOf(f.outcome) === bucket);
  }, [firings, bucket]);

  return (
    <div className="rounded-lg p-4" style={{ background: "rgba(255,255,255,0.035)", border: `1px solid ${C.border}` }}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide font-medium mb-1" style={{ color: C.fg0 }}>Harness firings</div>
          <div className="text-[14px] font-semibold" style={{ color: C.fg4 }}>
            {firings.length} detector firing{firings.length === 1 ? "" : "s"}
          </div>
          <div className="text-[11px] mt-1 leading-relaxed" style={{ color: C.fg1 }}>
            Every detector trigger, including ones the harness suppressed and ones the LLM declined to actuate.
          </div>
        </div>
        <div className="text-right text-[10px] font-mono space-y-0.5" style={{ color: C.fg0 }}>
          <div><span style={{ color: C.green }}>{counts.actuated}</span> actuated</div>
          <div>{counts.declined} declined</div>
          <div>{counts.suppressed} suppressed</div>
        </div>
      </div>
      <div className="flex gap-2 mb-3">
        {(Object.keys(BUCKET_LABELS) as Bucket[]).map((key) => (
          <button
            key={key}
            onClick={() => setBucket(key)}
            className="rounded-md px-2.5 py-1 text-[11px] transition-colors"
            style={{
              color: bucket === key ? C.fg4 : C.fg1,
              background: bucket === key ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${bucket === key ? C.fg1 : C.border}`,
            }}
          >
            {BUCKET_LABELS[key]} <span style={{ color: C.fg0 }}>· {counts[key]}</span>
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-md p-6 text-center text-[11px]" style={{ color: C.fg1, border: `1px dashed ${C.border}` }}>
          {firings.length === 0 ? "No firings recorded for this run yet." : "No firings in this bucket."}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((firing) => (
            <FiringRow key={firing.id} firing={firing} />
          ))}
        </div>
      )}
    </div>
  );
}

function FiringRow({ firing }: { firing: HarnessFiring }) {
  const [open, setOpen] = useState(false);
  const colors = outcomeColor(firing.outcome);
  const target = firing.subagent_label ?? "main agent";
  const evidence = useMemo(() => {
    if (!firing.evidence) return null;
    try {
      return JSON.parse(firing.evidence) as Record<string, unknown>;
    } catch {
      return firing.evidence;
    }
  }, [firing.evidence]);

  return (
    <div className="rounded-md" style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${C.border}` }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-white/5"
      >
        <span style={{ color: C.fg0 }}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span
          className="rounded px-1.5 py-0.5 font-mono text-[10px]"
          style={{ color: colors.fg, background: colors.bg }}
        >
          {OUTCOME_LABELS[firing.outcome]}
        </span>
        <span className="font-mono text-[11px]" style={{ color: C.fg3 }}>
          {firing.pattern}
        </span>
        <span className="text-[11px] truncate flex-1" style={{ color: C.fg2 }}>
          {firing.summary ?? firing.scope}
        </span>
        <span className="font-mono text-[10px]" style={{ color: C.fg0 }}>
          {target}
        </span>
        <span className="font-mono text-[10px]" style={{ color: C.fg0 }}>
          {relativeTime(Date.now(), firing.created_at)}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 text-[11px] space-y-2" style={{ borderTop: `1px solid ${C.border}` }}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px]" style={{ color: C.fg1 }}>
            <div>scope: <span style={{ color: C.fg3 }}>{firing.scope}</span></div>
            <div>fingerprint: <span style={{ color: C.fg3 }}>{firing.fingerprint}</span></div>
            <div>subagent span: <span style={{ color: C.fg3 }}>{firing.subagent_span_id ?? "—"}</span></div>
            <div>observer run: <span style={{ color: C.fg3 }}>{firing.observer_run_id?.slice(0, 12) ?? "—"}</span></div>
            <div>steering event: <span style={{ color: C.fg3 }}>{firing.steering_event_id?.slice(0, 12) ?? "—"}</span></div>
            <div>created: <span style={{ color: C.fg3 }}>{new Date(firing.created_at).toLocaleTimeString()}</span></div>
          </div>
          {firing.outcome_reason && (
            <div className="text-[11px]" style={{ color: C.fg2 }}>
              <span style={{ color: C.fg0 }}>reason: </span>
              {firing.outcome_reason}
            </div>
          )}
          {evidence && (
            <pre
              className="rounded p-2 overflow-auto sb font-mono text-[10px]"
              style={{ background: "rgba(0,0,0,0.25)", color: C.fg3, maxHeight: 200 }}
            >
              {typeof evidence === "string" ? evidence : JSON.stringify(evidence, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

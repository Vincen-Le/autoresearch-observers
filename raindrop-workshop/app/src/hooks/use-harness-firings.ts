import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getRunHarnessFirings,
  type HarnessFiring,
  type HarnessFiringBroadcast,
  type RunHarnessFiringsData,
} from "../api/harness";
import { useWorkshopEvent } from "./use-workshop-ws";

const EMPTY: RunHarnessFiringsData = { firings: [] };

export function useHarnessFirings(runId: string | null | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["harness-firings", runId] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => getRunHarnessFirings(runId!),
    enabled: !!runId,
    initialData: EMPTY,
  });

  useWorkshopEvent("harness_firing", (data: HarnessFiringBroadcast) => {
    if (!data || data.observed_run_id !== runId) return;
    queryClient.setQueryData<RunHarnessFiringsData>(queryKey, (prev = EMPTY) => {
      const next = upsert(prev.firings, data.firing);
      return { firings: next };
    });
  });

  return query.data ?? EMPTY;
}

function upsert(firings: HarnessFiring[], next: HarnessFiring): HarnessFiring[] {
  const existing = firings.findIndex((f) => f.id === next.id);
  if (existing >= 0) {
    const out = firings.slice();
    out[existing] = next;
    return out.sort((a, b) => b.created_at - a.created_at);
  }
  return [next, ...firings].sort((a, b) => b.created_at - a.created_at);
}

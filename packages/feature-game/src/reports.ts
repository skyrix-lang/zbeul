import { useCallback, useEffect } from "react";
import { ApiError, useCreateReport } from "@zbeul/api";
import { usePrefs, type PendingReport } from "./store";

// Reports are the only thing the game ever sends: a card's reference and a
// few words, nothing about the players. Made offline, a report waits on the
// phone and leaves when the network is back.

const MAX_PENDING = 20;

function keep(report: PendingReport) {
  const { pendingReports, update } = usePrefs.getState();
  update({ pendingReports: [...pendingReports, report].slice(-MAX_PENDING) });
}

/**
 * Sends a report. Resolves to "sent", or to "kept" when there is no network:
 * the report is then sent later. A report the server refuses is dropped.
 */
export function useSendReport() {
  const { mutateAsync } = useCreateReport();
  return useCallback(
    async (report: PendingReport): Promise<"sent" | "kept" | "refused"> => {
      try {
        await mutateAsync({ data: report });
        return "sent";
      } catch (error) {
        if (error instanceof ApiError) return "refused";
        keep(report);
        return "kept";
      }
    },
    [mutateAsync],
  );
}

/** Sends the reports made offline, once, when the app opens with a network. */
export function useFlushReports() {
  const { mutateAsync } = useCreateReport();
  useEffect(() => {
    const { pendingReports, update } = usePrefs.getState();
    if (pendingReports.length === 0 || !navigator.onLine) return;
    update({ pendingReports: [] });
    void (async () => {
      for (const report of pendingReports) {
        try {
          await mutateAsync({ data: report });
        } catch (error) {
          if (!(error instanceof ApiError)) keep(report);
        }
      }
    })();
  }, [mutateAsync]);
}

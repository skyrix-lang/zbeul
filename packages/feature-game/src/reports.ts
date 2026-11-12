import { useCallback, useEffect } from "react";
import { ApiError, createReport, likeCards, useCreateReport } from "@zbeul/api";
import { MAX_PENDING, SENT_LIMIT, usePrefs, type PendingReport } from "./store";

// Reports and likes are the only things the game ever sends: a card's
// reference, what was ticked and a few words, nothing about the players.
// A thumb given during a game waits on the phone, where it can be taken back,
// and leaves when the game is paused or over. Without a network, everything
// waits and leaves at the next opening.

/**
 * The server said no (invalid, or too many): sending it again won't help.
 * Anything else (no network, a server error) is worth a retry.
 */
const isRefusal = (error: unknown) =>
  error instanceof ApiError && [400, 429].includes(error.status);

function keep(report: PendingReport) {
  const { pendingReports, update } = usePrefs.getState();
  update({ pendingReports: [...pendingReports, report].slice(-MAX_PENDING) });
}

/** What the server receives of a report: not how it was made. */
const toBody = ({ thumb: _thumb, ...report }: PendingReport) => report;

/**
 * Sends a report now. Resolves to "sent", or to "kept" when there is no
 * network or the server is down: the report is then sent later. A report the
 * server refuses is dropped.
 */
export function useSendReport() {
  const { mutateAsync } = useCreateReport();
  return useCallback(
    async (report: PendingReport): Promise<"sent" | "kept" | "refused"> => {
      try {
        await mutateAsync({ data: toBody(report) });
        return "sent";
      } catch (error) {
        if (isRefusal(error)) return "refused";
        keep(report);
        return "kept";
      }
    },
    [mutateAsync],
  );
}

let flushing: Promise<void> | null = null;

/**
 * Sends the thumbs and reports that wait on the phone. Called when a game is
 * left and when the app opens; does nothing offline. Each one leaves the
 * phone once the server has it (or has refused it as invalid): closing the
 * app midway loses nothing, and "too many" only delays the rest.
 */
export function flushFeedback(): Promise<void> {
  // One at a time: a second call while sending would send everything twice.
  flushing ??= send().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function send() {
  if (!navigator.onLine) return;
  const prefs = usePrefs.getState;
  for (const report of prefs().pendingReports) {
    try {
      await createReport(toBody(report));
    } catch (error) {
      // Invalid: it will never pass. Anything else: later, with the rest.
      if (!(error instanceof ApiError && error.status === 400)) return;
    }
    const { pendingReports, sentDislikes, update } = prefs();
    update({
      pendingReports: pendingReports.filter((other) => other !== report),
      ...(report.thumb &&
        report.cardId && {
          sentDislikes: [
            ...sentDislikes.filter((id) => id !== report.cardId),
            report.cardId,
          ].slice(-SENT_LIMIT),
        }),
    });
  }
  const cardIds = prefs().pendingLikes;
  if (cardIds.length === 0) return;
  try {
    await likeCards({ cardIds });
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 400)) return;
  }
  const { pendingLikes, sentLikes, update } = prefs();
  update({
    // A like given while these were leaving still waits.
    pendingLikes: pendingLikes.filter((id) => !cardIds.includes(id)),
    sentLikes: [...new Set([...sentLikes, ...cardIds])].slice(-SENT_LIMIT),
  });
}

/** Sends what waits on the phone, once, when the app opens. */
export function useFlushReports() {
  useEffect(() => void flushFeedback(), []);
}

/** Sends what waits on the phone when the screen is left. */
export function useFlushOnLeave() {
  useEffect(() => () => void flushFeedback(), []);
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "@zbeul/api/test-server";
import { useFlushReports, useSendReport } from "./reports";
import { usePrefs } from "./store";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={
      new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    }
  >
    {children}
  </QueryClientProvider>
);

const answer = (status: number) =>
  http.post("*/api/reports", () =>
    status === 0
      ? HttpResponse.error()
      : new HttpResponse(status === 204 ? null : "{}", {
          status,
          headers: { "content-type": "application/json" },
        }),
  );

const report = { cardId: "TP-001", message: "" };
const pending = () => usePrefs.getState().pendingReports;

beforeEach(() => usePrefs.setState({ pendingReports: [] }));

describe("useSendReport", () => {
  const send = (status: number) => {
    server.use(answer(status));
    return renderHook(() => useSendReport(), { wrapper }).result.current(
      report,
    );
  };

  it("sends a report", async () => {
    expect(await send(204)).toBe("sent");
    expect(pending()).toEqual([]);
  });

  it("keeps a report on the phone when there is no network", async () => {
    expect(await send(0)).toBe("kept");
    expect(pending()).toEqual([report]);
  });

  it("keeps a report when the server is down", async () => {
    expect(await send(500)).toBe("kept");
    expect(pending()).toEqual([report]);
  });

  it.each([400, 429])(
    "drops a report the server refuses (%i): sending it again won't help",
    async (status) => {
      expect(await send(status)).toBe("refused");
      expect(pending()).toEqual([]);
    },
  );
});

describe("useFlushReports", () => {
  it("sends what was kept, once the network is back", async () => {
    const received: unknown[] = [];
    server.use(
      http.post("*/api/reports", async ({ request }) => {
        received.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const kept = [report, { message: "Le bouton Joker boude." }];
    usePrefs.setState({ pendingReports: kept });

    renderHook(() => useFlushReports(), { wrapper });

    await waitFor(() => expect(received).toEqual(kept));
    expect(pending()).toEqual([]);
  });

  it("keeps them for next time when the network is still away", async () => {
    server.use(answer(0));
    usePrefs.setState({ pendingReports: [report] });

    renderHook(() => useFlushReports(), { wrapper });

    await waitFor(() => expect(pending()).toEqual([report]));
  });
});

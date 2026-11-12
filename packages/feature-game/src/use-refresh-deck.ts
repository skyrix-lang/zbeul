import { useEffect } from "react";
import { useGetDeck } from "@zbeul/api";
import { useDeckStore } from "./cards";

/**
 * Fetches the published deck and keeps it on the phone. Called by the home
 * screen only: a deck never changes in the middle of a game. Without a
 * connection nothing happens, and the game keeps the deck it has.
 */
export function useRefreshDeck() {
  const receive = useDeckStore((store) => store.receive);
  const { data } = useGetDeck({
    query: {
      // Not even tried without a connection: nothing to fetch, and a failed
      // request would only fill the console.
      enabled: typeof navigator === "undefined" || navigator.onLine,
      retry: false,
      staleTime: 5 * 60_000,
      throwOnError: false,
    },
  });
  useEffect(() => {
    if (data) receive(data);
  }, [data, receive]);
}

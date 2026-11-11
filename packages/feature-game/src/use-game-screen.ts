import { useEffect } from "react";

// What the phone itself does for the game screen. Each call is a request the
// browser may refuse, so every one is allowed to fail silently: the game
// plays the same without it.

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};

/**
 * Goes full screen and locks landscape, where the browser allows it (Android).
 * Call it from a tap: browsers only grant full screen on a user's action.
 * An iPhone refuses both: installed, the app has no browser bars anyway, and
 * the game screen suggests turning the phone.
 */
export function enterGameMode() {
  const root = document.documentElement;
  // A mouse means a desktop: nobody wants a party game to take over the screen.
  if (!window.matchMedia?.("(pointer: coarse)").matches) return;
  void (async () => {
    try {
      await root.requestFullscreen?.({ navigationUI: "hide" });
      await (screen.orientation as LockableOrientation).lock?.("landscape");
    } catch {
      // Refused: the game still plays, in the browser's own window.
    }
  })();
}

export function leaveGameMode() {
  try {
    screen.orientation?.unlock?.();
    if (document.fullscreenElement) void document.exitFullscreen();
  } catch {
    // Nothing to undo.
  }
}

/** Keeps the screen on while the game screen is shown. */
export function useScreenAwake() {
  useEffect(() => {
    const held: { lock?: WakeLockSentinel; stopped: boolean } = {
      stopped: false,
    };
    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const lock = await navigator.wakeLock?.request("screen");
        if (held.stopped) await lock?.release();
        else held.lock = lock;
      } catch {
        // Refused, such as in battery saver mode.
      }
    };
    const request = () => void acquire();
    request();
    // The browser releases the lock when the app goes to the background.
    document.addEventListener("visibilitychange", request);
    return () => {
      held.stopped = true;
      document.removeEventListener("visibilitychange", request);
      void held.lock?.release().catch(() => {});
    };
  }, []);
}

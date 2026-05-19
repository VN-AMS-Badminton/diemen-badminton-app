"use client";

import * as React from "react";

// Single visually-hidden aria-live region for transient state changes that
// otherwise update UI silently (e.g. "Marked paid", "Slot refunded"). Mounted
// once at root so any client component can call useAnnounce.
type Ctx = { announce: (msg: string) => void };
const LiveAnnouncerContext = React.createContext<Ctx | null>(null);

export function LiveAnnouncer({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = React.useState("");
  const clearTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = React.useCallback((msg: string) => {
    setMessage(""); // reset so identical consecutive messages still announce
    if (clearTimer.current) clearTimeout(clearTimer.current);
    // Microtask hop to ensure AT picks up the change.
    requestAnimationFrame(() => setMessage(msg));
    clearTimer.current = setTimeout(() => setMessage(""), 3000);
  }, []);

  React.useEffect(() => {
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  return (
    <LiveAnnouncerContext.Provider value={{ announce }}>
      {children}
      <div role="status" aria-live="polite" className="sr-only">
        {message}
      </div>
    </LiveAnnouncerContext.Provider>
  );
}

export function useAnnounce(): (msg: string) => void {
  const ctx = React.useContext(LiveAnnouncerContext);
  // Soft fallback: when LiveAnnouncer isn't mounted (e.g. tests), no-op so
  // call sites don't need conditional guards.
  return ctx?.announce ?? (() => {});
}

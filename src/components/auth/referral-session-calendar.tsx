"use client";

import * as React from "react";
import { MapPin, Zap } from "lucide-react";
import { formatDate, formatTime, formatWeekday } from "@/lib/format";
import { localDateFromStartAt } from "@/lib/amsterdam-time-utils";
import type { UpcomingSessionRow } from "@/lib/referrals/list-upcoming-sessions-for-referral";

interface Props {
  sessions: UpcomingSessionRow[];
  selectedSessionId: string | null;
  onSelect: (id: string) => void;
}

function ymd(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });
}
function monthLabel(d: Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    month: "long",
    year: "numeric",
  }).format(d);
}
// Mon=0..Sun=6 to align with the nl-NL Ma-Zo header order.
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

// Stable palette for location dots when ≥2 distinct venues are scheduled.
const LOCATION_DOT_COLORS = [
  "bg-brand",
  "bg-success",
  "bg-warning",
  "bg-destructive",
];

type Cell =
  | { kind: "empty"; key: string }
  | { kind: "past"; key: string; day: number }
  | { kind: "future-empty"; key: string; day: number }
  | {
      kind: "session";
      key: string;
      day: number;
      session: UpcomingSessionRow;
      capacityTone: "ok" | "filling" | "full";
    };

function capacityTone(s: UpcomingSessionRow): "ok" | "filling" | "full" {
  if (s.full) return "full";
  return s.confirmedCount / Math.max(1, s.capacity) >= 0.75 ? "filling" : "ok";
}

function buildMonthCells(
  monthAnchor: Date,
  sessionsByDate: Map<string, UpcomingSessionRow>,
  todayYmd: string,
): Cell[] {
  const year = monthAnchor.getFullYear();
  const month = monthAnchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = mondayIndex(firstOfMonth);

  const cells: Cell[] = [];
  for (let i = 0; i < leadingBlanks; i++) {
    cells.push({ kind: "empty", key: `lead-${i}` });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const iso = ymd(date);
    const session = sessionsByDate.get(iso);
    if (session) {
      cells.push({
        kind: "session",
        key: `s-${iso}`,
        day,
        session,
        capacityTone: capacityTone(session),
      });
    } else if (iso < todayYmd) {
      cells.push({ kind: "past", key: `p-${iso}`, day });
    } else {
      cells.push({ kind: "future-empty", key: `f-${iso}`, day });
    }
  }
  // Pad to a 6-row grid so height doesn't shift between months.
  while (cells.length < 42) {
    cells.push({ kind: "empty", key: `trail-${cells.length}` });
  }
  return cells;
}

export function ReferralSessionCalendar({
  sessions,
  selectedSessionId,
  onSelect,
}: Props) {
  const sessionsByDate = React.useMemo(() => {
    const m = new Map<string, UpcomingSessionRow>();
    for (const s of sessions) m.set(localDateFromStartAt(s.startAt), s);
    return m;
  }, [sessions]);

  // Distinct months that actually contain sessions — drives nav arrows.
  const monthsWithSessions = React.useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) {
      const d = new Date(s.startAt);
      set.add(`${d.getFullYear()}-${d.getMonth()}`);
    }
    return Array.from(set)
      .map((k) => {
        const [y, m] = k.split("-").map(Number);
        return new Date(y, m, 1);
      })
      .sort((a, b) => a.getTime() - b.getTime());
  }, [sessions]);

  // Default month = the one containing the earliest upcoming session, falling
  // back to the current month if there are no sessions at all.
  const initialIndex = monthsWithSessions.length > 0 ? 0 : 0;
  const [monthIndex, setMonthIndex] = React.useState(initialIndex);
  const activeMonth =
    monthsWithSessions[monthIndex] ??
    (() => {
      const n = new Date();
      return new Date(n.getFullYear(), n.getMonth(), 1);
    })();

  const todayYmd = ymd(new Date());
  const cells = React.useMemo(
    () => buildMonthCells(activeMonth, sessionsByDate, todayYmd),
    [activeMonth, sessionsByDate, todayYmd],
  );

  // Location-dot palette only kicks in when at least two distinct venues exist
  // across the entire window — otherwise the dot adds noise without info.
  const locationDotColor = React.useMemo(() => {
    const locs = new Set<string>();
    for (const s of sessions) if (s.location) locs.add(s.location);
    if (locs.size < 2) return null;
    const sorted = Array.from(locs).sort();
    const map = new Map<string, string>();
    sorted.forEach((loc, i) =>
      map.set(loc, LOCATION_DOT_COLORS[i % LOCATION_DOT_COLORS.length]),
    );
    return (loc: string | null) => (loc ? (map.get(loc) ?? null) : null);
  }, [sessions]);

  const selectedSession =
    sessions.find((s) => s.id === selectedSessionId) ?? null;

  const canPrev = monthIndex > 0;
  const canNext = monthIndex < monthsWithSessions.length - 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => canPrev && setMonthIndex(monthIndex - 1)}
          disabled={!canPrev}
          aria-label="Previous month"
          className="rounded-md px-2 py-1 text-sm font-semibold text-muted-foreground enabled:hover:bg-accent disabled:opacity-30"
        >
          ◀
        </button>
        <span className="text-sm font-bold uppercase tracking-wide">
          {monthLabel(activeMonth)}
        </span>
        <button
          type="button"
          onClick={() => canNext && setMonthIndex(monthIndex + 1)}
          disabled={!canNext}
          aria-label="Next month"
          className="rounded-md px-2 py-1 text-sm font-semibold text-muted-foreground enabled:hover:bg-accent disabled:opacity-30"
        >
          ▶
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map((d) => (
          <div
            key={d}
            className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {cells.map((cell) => {
          if (cell.kind === "empty") {
            return <div key={cell.key} className="aspect-square" />;
          }
          if (cell.kind === "past" || cell.kind === "future-empty") {
            return (
              <div
                key={cell.key}
                className="flex aspect-square items-center justify-center rounded-md text-sm text-muted-foreground/50"
                aria-hidden="true"
              >
                {cell.day}
              </div>
            );
          }
          const isSelected = cell.session.id === selectedSessionId;
          const isFull = cell.capacityTone === "full";
          const tone =
            cell.capacityTone === "ok"
              ? "bg-success-soft text-success-soft-foreground border-success/30"
              : cell.capacityTone === "filling"
                ? "bg-warning-soft text-warning-foreground border-warning/40"
                : "bg-destructive-soft text-destructive-soft-foreground border-destructive/30 line-through";
          const ring = isSelected ? "ring-2 ring-brand ring-offset-1" : "";
          const dotColor = locationDotColor?.(cell.session.location);
          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => !isFull && onSelect(cell.session.id)}
              disabled={isFull}
              aria-pressed={isSelected ? "true" : "false"}
              aria-label={`${formatWeekday(cell.session.startAt)} ${formatDate(
                cell.session.startAt,
              )}, ${cell.session.confirmedCount} of ${
                cell.session.capacity
              } confirmed${isFull ? ", full" : ""}`}
              className={`relative flex aspect-square items-center justify-center rounded-md border text-sm font-semibold transition ${tone} ${ring} ${
                isFull
                  ? "cursor-not-allowed opacity-60"
                  : "hover:brightness-105"
              }`}
            >
              {cell.day}
              {dotColor && (
                <span
                  className={`absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full ${dotColor}`}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="rounded-md border bg-muted/30 p-3 text-sm">
        {selectedSession ? (
          <div className="space-y-0.5">
            <div className="font-semibold">
              {formatWeekday(selectedSession.startAt)} ·{" "}
              {formatDate(selectedSession.startAt)}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatTime(selectedSession.startAt)}
              {selectedSession.location && (
                <>
                  {" · "}
                  <MapPin
                    className="inline h-3.5 w-3.5 align-text-bottom"
                    aria-hidden
                  />{" "}
                  {selectedSession.location}
                </>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {selectedSession.full
                ? "Full"
                : `${selectedSession.confirmedCount}/${selectedSession.capacity} confirmed`}
            </div>
            {selectedSession.subCutoff && !selectedSession.full && (
              <div className="inline-flex items-center gap-1 text-xs font-medium text-warning-foreground">
                <Zap className="h-3.5 w-3.5" aria-hidden />
                Tonight — final spot, no tentative window
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">
            Tap a highlighted day to pick a session.
          </p>
        )}
      </div>
    </div>
  );
}

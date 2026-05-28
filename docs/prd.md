# Project Brief: Smash Pro - Badminton Club Management System

## 1. Overview
Smash Pro is a high-performance management platform designed for local badminton clubs. It streamlines administrative tasks, enhances member engagement, and provides data-driven insights into club operations.

## 2. Brand Identity
**Design System:** High-Velocity Precision (Yonex-inspired)
- **Primary Color:** Royal Blue (#004185) - Represents stability and professionalism.
- **Accent Color:** Emerald Green - Used for primary CTAs and positive status indicators, capturing the energy of the sport.
- **Typography:** Montserrat (Modern, geometric sans-serif) for high legibility.
- **Visual Style:** High-contrast, clean lines, and professional athletic aesthetic.

## 3. Season & Session Model

A **season** spans an explicit date range (`from_date` → `to_date`) — usually
one calendar month, but multi-month ranges are supported. `year_month` is
derived from `from_date` and kept as a display label. A season carries
subscription/drop-in fees, a default venue, and a weekly schedule template
(`weekday`, `start_time`, `end_time`) used both to auto-generate sessions on
creation and to drive cascade edits later. Players opt in during the
poll window; admin then closes the season to seal the roster.

**Sessions are independently configurable.**
- Creating a season auto-generates one `scheduled` session per matching
  weekday between `from_date` and `to_date`. Default capacity per session
  is `court_count × 6` (6 players per court).
- After generation, **every session can be edited individually** — date,
  start/end time, capacity, location (free-text venue), and status.
- Admin can also **add ad-hoc sessions** to a poll-state season via the
  batch session creator (auto-creates RSVPs for existing subscribers) and
  **delete** sessions (cascade-removes attendance).
- **Editing a season cascades** the safe fields (location, capacity, fees,
  Tikkie URL, schedule timing) to every `scheduled` child session.
  Schedule edits that strand existing sessions (date outside new range or
  wrong weekday) trigger a 409 + admin confirm; on confirm, stranded
  sessions are marked `cancelled` and a push notification fans out.
- **Closing a season** also cancels every still-`scheduled` child session
  and pushes a cancellation notification to RSVP'd players.

This supports the real-world case where weekly cadence is roughly stable
but individual sessions move to different days, times, or venues.


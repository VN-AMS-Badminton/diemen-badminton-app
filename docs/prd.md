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

A **season** is one calendar month (`year_month`) with subscription/drop-in fees and a poll window. Players opt in during the poll window; admin then **books** the season to seal the roster and generate sessions.

**Sessions are independently configurable.**
- Booking a season runs a one-shot template generator (weekday + time + capacity) that inserts the planned sessions for that month.
- After generation, **every session can be edited individually** — date, display label, capacity, location (free-text venue), and status.
- Admin can also **add ad-hoc sessions** to an active season (auto-creates RSVPs for confirmed subscribers) and **delete** sessions (cascade-removes attendance).
- Re-running "Book season" is additive only: it never overwrites manual per-session edits, only inserts missing dates.

This supports the real-world case where weekly cadence is roughly stable but individual sessions move to different days, times, or venues.


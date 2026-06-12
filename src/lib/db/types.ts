// Hand-written types matching schema in supabase/migrations/0001_init.sql and
// later migrations. Keep enums and row shapes here so DB clients can
// type-check queries.

export type PlayerRole = "player" | "admin";
export type PlayerStatus = "pending" | "active" | "blocked";
export type SeasonStatus = "poll" | "closed";
export type SessionStatus = "scheduled" | "done" | "cancelled";
export type AttendanceSource = "subscription" | "drop_in" | "passed" | "referral";
export type RsvpStatus = "in" | "opted_out" | "cancelled" | "waitlisted" | "passed";
// refund_pending: player had (assumed) paid when an admin cancelled their
// booking; refund settles personally outside the app, admin clears the marker.
export type PaymentStatus =
  | "assumed_paid"
  | "flagged"
  | "unpaid"
  | "refund_pending";

export interface PlayerRow {
  id: string;
  username: string;
  display_name: string;
  // Null for referral guests who only provided a name on activation.
  whatsapp_number: string | null;
  // Null for guest accounts created via referral (no login).
  pin_hash: string | null;
  role: PlayerRole;
  status: PlayerStatus;
  // FK to the referring player (null for self-registered players).
  referred_by: string | null;
  // Flipped true when a referred player consumes their one free session.
  free_trial_used: boolean;
  created_at: string;
  updated_at: string;
}

export interface SeasonRow {
  id: string;
  year_month: string;
  court_count: number;
  subscription_fee_per_session_cents: number;
  drop_in_fee_per_session_cents: number;
  tikkie_url_override: string | null;
  // Default venue hint used by the session batch creator.
  location: string | null;
  // Default schedule used to pre-populate the batch creator and drive
  // auto-generation on season creation. weekday: 0=Sunday … 6=Saturday.
  // start_time / end_time are HH:MM (24h).
  weekday: number | null;
  start_time: string | null;
  end_time: string | null;
  // Season date range. `from_date` and `to_date` drive auto-generation of
  // child sessions and let a season span multiple calendar months.
  // `year_month` is kept as a display label derived from `from_date`.
  from_date: string;
  to_date: string;
  poll_opens_at: string;
  poll_closes_at: string;
  status: SeasonStatus;
  created_at: string;
  updated_at: string;
}

export interface SessionRow {
  id: string;
  season_id: string;
  capacity: number;
  tikkie_url: string | null;
  // Venue label. Mandatory on every session (DB NOT NULL).
  location: string;
  status: SessionStatus;
  // Real start timestamp (UTC). Used for cutoff queries.
  start_at: string;
  // Real end timestamp. Nullable for legacy rows; new sessions always set it.
  end_at: string | null;
  // Set when resolve_session_cutoff has run; idempotency marker.
  cutoff_resolved_at: string | null;
  // Max number of in-app trial guest slots per session. Default 4, admin-editable.
  trial_quota: number;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRow {
  id: string;
  session_id: string;
  player_id: string;
  source: AttendanceSource;
  rsvp_status: RsvpStatus;
  payment_status: PaymentStatus;
  // Deadline for the player to self-confirm payment. Set on drop-in
  // RSVP/waitlist promotion. Resolver auto-cancels expired unpaid rows.
  payment_due_at: string | null;
  marked_by: string | null;
  bunq_payment_id: string | null;
  // Referral lifecycle flags. Decoupled so cap accounting stays simple.
  is_tentative: boolean;
  bumped_at: string | null;
  cap_consumed: boolean;
  created_at: string;
  updated_at: string;
}

export interface InviteRow {
  id: string;
  code: string;
  created_by: string;
  expires_at: string;
  max_uses: number;
  uses_count: number;
  revoked: boolean;
  created_at: string;
}

export interface AuditLogRow {
  id: number;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string;
  before_json: unknown;
  after_json: unknown;
  created_at: string;
}

// Supabase Database type for typed client.
// We use a permissive shape; for production-grade typing use `supabase gen types`.
export interface Database {
  public: {
    Tables: {
      players: {
        Row: PlayerRow;
        Insert: Omit<PlayerRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<PlayerRow>;
      };
      seasons: {
        Row: SeasonRow;
        Insert: Omit<SeasonRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<SeasonRow>;
      };
      sessions: {
        Row: SessionRow;
        Insert: Omit<SessionRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<SessionRow>;
      };
      attendance: {
        Row: AttendanceRow;
        Insert: Omit<AttendanceRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<AttendanceRow>;
      };
      invites: {
        Row: InviteRow;
        Insert: Omit<InviteRow, "id" | "created_at"> & { id?: string };
        Update: Partial<InviteRow>;
      };
      audit_log: {
        Row: AuditLogRow;
        Insert: Omit<AuditLogRow, "id" | "created_at">;
        Update: Partial<AuditLogRow>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      resolve_session_cutoff: {
        Args: { p_session_id: string };
        Returns: void;
      };
    };
    Enums: {
      player_role: PlayerRole;
      player_status: PlayerStatus;
      season_status: SeasonStatus;
      session_status: SessionStatus;
      attendance_source: AttendanceSource;
      rsvp_status: RsvpStatus;
      payment_status: PaymentStatus;
    };
  };
}

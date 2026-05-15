// Hand-written types matching schema in supabase/migrations/0001_init.sql.
// Keep enums and row shapes here so DB clients can type-check queries.

export type PlayerRole = "player" | "admin";
export type PlayerStatus = "pending" | "active" | "blocked";
export type SeasonStatus = "poll" | "booked" | "active" | "closed";
export type SubscriptionStatus =
  | "opted_in"
  | "confirmed"
  | "paid"
  | "cancelled";
export type SessionStatus = "scheduled" | "done" | "cancelled";
export type AttendanceSource = "subscription" | "drop_in" | "passed";
export type RsvpStatus = "in" | "opted_out" | "cancelled";
export type PaymentStatus =
  | "n_a"
  | "owed"
  | "self_marked_paid"
  | "admin_confirmed";

export interface PlayerRow {
  id: string;
  username: string;
  display_name: string;
  whatsapp_number: string;
  pin_hash: string;
  role: PlayerRole;
  status: PlayerStatus;
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
  poll_opens_at: string;
  poll_closes_at: string;
  status: SeasonStatus;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionRow {
  id: string;
  season_id: string;
  player_id: string;
  status: SubscriptionStatus;
  paid_at: string | null;
  marked_by: string | null;
  bunq_payment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionRow {
  id: string;
  season_id: string;
  date: string;
  weekday_time: string;
  capacity: number;
  tikkie_url: string | null;
  location: string | null;
  status: SessionStatus;
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
  marked_by: string | null;
  bunq_payment_id: string | null;
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
      subscriptions: {
        Row: SubscriptionRow;
        Insert: Omit<SubscriptionRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<SubscriptionRow>;
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
    Functions: Record<string, never>;
    Enums: {
      player_role: PlayerRole;
      player_status: PlayerStatus;
      season_status: SeasonStatus;
      subscription_status: SubscriptionStatus;
      session_status: SessionStatus;
      attendance_source: AttendanceSource;
      rsvp_status: RsvpStatus;
      payment_status: PaymentStatus;
    };
  };
}

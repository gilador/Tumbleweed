// Shared types and interfaces for the Tumbleweed platform.
// Imported by: core (manager view), server, staff-view.

// --- User & Team Types ---

export type UserStatus = "ghost" | "invited" | "online";
export type UserRole = "manager" | "co-manager" | "staff";
export type SubscriptionTier = "free" | "pro" | "enterprise";
export type ScheduleState = "draft" | "open" | "closed" | "published";

export interface TeamInfo {
  id: string;
  name: string;
  tier: SubscriptionTier;
}

export interface StaffMember {
  id: string;
  teamId: string;
  name: string;
  email: string | null;
  role: UserRole;
  status: UserStatus;
}

// --- SSE Event Types ---

export type SSEEventType =
  | "availability-submitted"
  | "schedule-state-changed"
  | "schedule-published"
  | "user-claimed"
  | "user-updated";

export interface SSEEvent {
  type: SSEEventType;
  teamId: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

// --- API Types ---

export interface ApiError {
  code: string;
  message: string;
}

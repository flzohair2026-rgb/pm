// Types for the simplified audit tracking system

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';

export interface DeviceInfo {
  device_type: DeviceType;
  operating_system: string | null;
  browser: string | null;
  user_agent: string | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  hotel_id: string | null;
  event_type: string;
  event_name: string;
  session_id: string | null;
  ip_address: string | null;
  device_type: string | null;
  operating_system: string | null;
  browser: string | null;
  user_agent: string | null;
  metadata: any;
  success: boolean;
  error_code: string | null;
  created_at: string;
}

export const EVENT_TYPES = [
  'AUTH',
  'SESSION',
  'SECURITY',
  'USER',
  'BOOKING',
  'PAYMENT',
  'CONTRACT',
  'UNIT',
  'CLEANING',
  'MAINTENANCE',
  'SYSTEM',
] as const;

export const AUDIT_SESSION_COOKIE = 'audit_session_id';

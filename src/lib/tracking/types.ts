// Types for the simplified audit tracking system

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';

export interface DeviceInfo {
  device_type: DeviceType;
  operating_system: string | null;
  browser: string | null;
  user_agent: string | null;
}

export interface BrowserGeoCoords {
  lat: number;
  lon: number;
  accuracy_meters?: number | null;
  altitude_meters?: number | null;
  heading_deg?: number | null;
  speed_mps?: number | null;
  source?: 'browser_w3c';
  granted_at?: string | null;
}

export interface GeoLocation {
  country_code?: string | null;
  country_name?: string | null;
  city?: string | null;
  region?: string | null;
  isp?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  flag_emoji?: string | null;
  browser_geo?: BrowserGeoCoords | null;
}

export interface AuditLogMetadata {
  method?: string;
  location?: GeoLocation | null;
  [key: string]: any;
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
  metadata: AuditLogMetadata;
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

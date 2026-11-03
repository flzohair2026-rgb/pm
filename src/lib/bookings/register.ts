export type RegisterFilters = { status: string; type: string; arrival: string; departure: string; q: string; contract: string };
export type RegisterCursor = { id: string; created_at: string | null };
export type RegisterRow = {
  booking: { id: string; created_at: string; status: string; booking_type: string | null; check_in: string; check_out: string; total_price: number | null;
    customer: { full_name: string | null; phone: string | null } | null;
    unit: { unit_number: string | null; unit_type?: { name: string | null } | null } | null };
  amount: number; hasKey: boolean; hasEjarUpload: boolean; hasAdditionalServices: boolean;
  ejar: null | { status: 'pending_confirmation' | 'confirmed' | 'rejected'; supervisor_note: string | null; decided_at: string | null; updated_at: string | null; uploaded_at: string | null; created_at: string | null };
};
export type RegisterPage = { hotelId?: string; rows: RegisterRow[]; totalCount: number | null; hasNext: boolean; hasPrevious: boolean; nextCursor: RegisterCursor | null; previousCursor: RegisterCursor | null };
export function normalizeRegisterFilters(values: Partial<RegisterFilters>): RegisterFilters {
  const pick = (value: string | undefined, allowed: string[]) => value && allowed.includes(value) ? value : 'all';
  const date = (value?: string) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : '';
  };
  return { status: pick(values.status, ['all','active','draft','quoted','preliminary','pending','pending_deposit','deposit_paid','confirmed','checked_in','checked_out','cancelled','completed']),
    type: pick(values.type, ['all','daily','monthly','yearly']), contract: pick(values.contract, ['all','ejar_uploaded','additional_services','none']),
    q: (values.q || '').trim().slice(0, 200), arrival: date(values.arrival), departure: date(values.departure) };
}
export function registerUrl(filters: RegisterFilters) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value && value !== 'all') query.set(key, value);
  return `/bookings-list${query.size ? `?${query}` : ''}`;
}
export function parseRegisterPage(value: unknown): RegisterPage {
  const page = value as RegisterPage;
  if (!page || !Array.isArray(page.rows) || typeof page.hasNext !== 'boolean' || typeof page.hasPrevious !== 'boolean'
    || !(page.totalCount === null || (Number.isSafeInteger(page.totalCount) && page.totalCount >= 0))
    || page.rows.some(row => !row?.booking?.id || typeof row.amount !== 'number' || !Number.isFinite(row.amount)
      || typeof row.hasKey !== 'boolean' || typeof row.hasEjarUpload !== 'boolean' || typeof row.hasAdditionalServices !== 'boolean')) {
    throw new Error('تعذر التحقق من اكتمال نتائج سجل الحجوزات. أعد المحاولة.');
  }
  const validCursor = (cursor: RegisterCursor | null) => cursor === null || (typeof cursor?.id === 'string' && (cursor.created_at === null || typeof cursor.created_at === 'string'));
  if (!validCursor(page.nextCursor) || !validCursor(page.previousCursor) || (page.rows.length > 0 && (!page.nextCursor || !page.previousCursor))) throw new Error('تعذر التحقق من ترقيم سجل الحجوزات.');
  return page;
}

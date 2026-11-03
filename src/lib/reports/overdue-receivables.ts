import type { SupabaseClient } from '@supabase/supabase-js';

export interface ReceivableRow {
  customer_id: string;
  customer_name: string;
  invoices_count: number;
  total_invoiced: number;
  total_paid: number;
  total_remaining: number;
  oldest_due_date?: string;
  unit_numbers?: string[];
}
interface Booking {
  id: string; hotel_id?: string; check_in: string; check_out: string; nights?: number;
  booking_type?: string; booking_source?: string; additional_services?: { name?: string; title?: string; label?: string; amount?: number }[];
  unit?: { unit_number?: string } | null;
}
export interface DueInvoice {
  id: string; booking_id?: string | null; customer_id: string; invoice_date: string; due_date?: string | null;
  total_amount: number | string; paid_amount: number | string; status: string; additional_services_amount?: number | string;
  customer?: { full_name?: string } | null;
}
export const riyadhToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

// Calendar-month clamping matches addMonths used by the booking installment UI.
function monthDate(day: string, offset: number) {
  const [year, month, date] = day.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + offset, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date, lastDay));
  return target.toISOString().slice(0, 10);
}
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateOverdueReceivables(invoices: DueInvoice[], bookings: Booking[], today: string, hotelId: string | null): ReceivableRow[] {
  const bookingMap = new Map(bookings.map(b => [b.id, b]));
  const groups = new Map<string, DueInvoice[]>();
  for (const invoice of invoices) {
    if (!['posted', 'paid'].includes(invoice.status) || invoice.invoice_date > today) continue;
    const booking = invoice.booking_id ? bookingMap.get(invoice.booking_id) : undefined;
    if (hotelId && booking?.hotel_id !== hotelId) continue;
    const key = invoice.booking_id || `invoice:${invoice.id}`;
    const group = groups.get(key) || [];
    group.push(invoice); groups.set(key, group);
  }
  const customers = new Map<string, ReceivableRow>();
  const add = (invoice: DueInvoice, booking: Booking | undefined, due: string, amount: number, paid: number) => {
    // Exclude today's and future installments, fully paid amounts and the same
    // one-riyal rounding tolerance used by the dashboard payment alerts.
    if (!due || due >= today || amount - paid <= 1) return;
    const row = customers.get(invoice.customer_id) || {
      customer_id: invoice.customer_id, customer_name: invoice.customer?.full_name || 'عميل غير محدد',
      invoices_count: 0, total_invoiced: 0, total_paid: 0, total_remaining: 0, unit_numbers: [],
    };
    row.invoices_count++;
    row.total_invoiced += amount; row.total_paid += paid; row.total_remaining += amount - paid;
    if (!row.oldest_due_date || due < row.oldest_due_date) row.oldest_due_date = due;
    const unit = booking?.unit?.unit_number;
    if (unit && !row.unit_numbers?.includes(unit)) row.unit_numbers?.push(unit);
    customers.set(row.customer_id, row);
  };
  for (const group of groups.values()) {
    const first = group[0];
    const booking = first.booking_id ? bookingMap.get(first.booking_id) : undefined;
    const nights = Number(booking?.nights) || (booking ? Math.round((Date.parse(booking.check_out) - Date.parse(booking.check_in)) / 86400000) : 0);
    const longTerm = booking && (['monthly', 'yearly'].includes(booking.booking_type || '') || nights >= 28);
    if (longTerm && /^\d{4}-\d{2}-\d{2}$/.test(booking.check_in)) {
      const total = group.reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);
      const paid = group.reduce((sum, invoice) => sum + Number(invoice.paid_amount || 0), 0);
      const extrasFee = (Array.isArray(booking.additional_services) ? booking.additional_services : []).reduce((sum, extra) => {
        const name = String(extra.name ?? extra.title ?? extra.label ?? '').toLowerCase();
        const platform = name.includes('منصة') || name.includes('platform');
        const fee = ['إيجار', 'ايجار', 'اجار', 'رسوم', 'عمولة', 'ejar', 'fee', 'commission'].some(word => name.includes(word));
        return sum + (platform && fee ? Number(extra.amount || 0) : 0);
      }, 0);
      const platformFee = extrasFee > 0 ? extrasFee : booking.booking_source === 'platform' &&
        group.some(i => Number(i.additional_services_amount || 0) >= 250) ? 250 : 0;
      const net = Math.max(0, total - platformFee);
      const installmentCount = Math.max(1, Math.round(nights / 30));
      const installment = net / installmentCount;
      let availablePaid = Math.max(0, paid - platformFee);
      for (let i = 0; i < installmentCount; i++) {
        const due = monthDate(booking.check_in, i);
        if (due >= today) break;
        const allocated = Math.min(installment, Math.max(0, availablePaid));
        availablePaid -= installment;
        add(first, booking, due, installment, allocated);
      }
    } else {
      for (const invoice of group) {
        if (!invoice.due_date) continue; // Do not invent a due date.
        const total = Math.max(0, Number(invoice.total_amount || 0));
        add(invoice, booking, invoice.due_date, total, Math.min(total, Math.max(0, Number(invoice.paid_amount || 0))));
      }
    }
  }
  return [...customers.values()].map(row => ({ ...row, total_invoiced: cents(row.total_invoiced),
    total_paid: cents(row.total_paid), total_remaining: cents(row.total_remaining) }))
    .sort((a, b) => b.total_remaining - a.total_remaining);
}

export async function fetchOverdueReceivables(client: SupabaseClient, hotelId: string | null, signal: AbortSignal) {
  const today = riyadhToday();
  const invoices: DueInvoice[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from('invoices')
      .select('id,booking_id,customer_id,invoice_date,due_date,total_amount,paid_amount,status,additional_services_amount,customer:customers(full_name)')
      .in('status', ['posted', 'paid']).lte('invoice_date', today).order('id').range(offset, offset + 499).abortSignal(signal);
    if (error) throw error;
    invoices.push(...(data || []) as unknown as DueInvoice[]);
    if (!data || data.length < 500) break;
  }
  const ids = [...new Set(invoices.map(i => i.booking_id).filter((id): id is string => !!id))];
  const bookings: Booking[] = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await client.from('bookings')
      .select('id,hotel_id,check_in,check_out,nights,booking_type,booking_source,additional_services,unit:units(unit_number)')
      .in('id', ids.slice(offset, offset + 100)).abortSignal(signal);
    if (error) throw error;
    bookings.push(...(data || []) as unknown as Booking[]);
  }
  return { rows: calculateOverdueReceivables(invoices, bookings, today, hotelId), asOf: today };
}

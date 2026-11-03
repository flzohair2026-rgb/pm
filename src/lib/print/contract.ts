import 'server-only';
import { createClient } from '@/lib/supabase-server';
import { format, differenceInYears, differenceInMonths, differenceInCalendarDays, addMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { ContractBooking } from './contract-types';
const parseDbDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const dt = new Date(str);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

export class ContractLoadError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function loadContract(id: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new ContractLoadError('يلزم تسجيل الدخول', 401);
  const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profileError || !profile || !['admin','manager','receptionist','accountant'].includes(profile.role)) throw new ContractLoadError('صلاحيات غير كافية', 403);
  const { data: bookingData, error: bookingError } = await supabase
    .from('bookings')
    .select(`
      id, booking_type, check_in, check_out, subtotal, discount_amount, additional_services, total_price,
      customer:customers(full_name, national_id, nationality, phone, details),
      unit:units(
        unit_number, floor,
        unit_type:unit_types(name, description, annual_price, daily_price)
      )
    `)
    .eq('id', id)
    .maybeSingle();
  // These are to-one foreign keys; this client has no generated Database type.
  const booking = bookingData as unknown as ContractBooking | null;
  if (bookingError) throw new Error('تعذر تحميل بيانات العقد');
  if (!booking) throw new ContractLoadError('العقد غير موجود', 404);
  const [{ data: invoices, error: invoicesError }, { data: terminationEvent, error: terminationError }, ivRes, { data: sourceEvent }] = await Promise.all([
supabase
    .from('invoices')
    .select('id, invoice_number, status, invoice_date, subtotal, discount_amount, additional_services_amount, total_amount, created_at')
    .eq('booking_id', id)
    .order('created_at', { ascending: false }),
supabase
    .from('system_events')
    .select('payload, created_at')
    .eq('booking_id', id)
    .eq('event_type', 'contract_terminated')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle(),
Promise.resolve(supabase
      .from('insurance_vouchers')
      .select('amount')
      .eq('booking_id', id)
      .eq('voucher_type', 'deposit_receipt')).catch(() => ({ data: null, error: true })),
Promise.resolve(supabase
      .from('system_events')
      .select('payload')
      .eq('booking_id', id)
      .eq('event_type', 'booking_source')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()).catch(() => ({ data: null }))
  ]);
  if (invoicesError || terminationError) throw new Error('تعذر تحميل بيانات العقد');
  const today = format(new Date(), 'dd/MM/yyyy', { locale: ar });
  const nonVoidInvoices = (invoices || []).filter((inv: any) => String(inv?.status || '') !== 'void');
  const mainInvoice =
    nonVoidInvoices.find((inv: any) => !String(inv?.invoice_number || '').includes('-EXT-')) ||
    nonVoidInvoices[0] ||
    null;
  const invoiceNumber = mainInvoice?.invoice_number;
  const sumInvoiceField = (field: string) => nonVoidInvoices.reduce((acc: number, inv: any) => acc + (Number(inv?.[field]) || 0), 0);
  const sumSubtotal = sumInvoiceField('subtotal');
  const sumDiscount = sumInvoiceField('discount_amount');
  const sumExtras = sumInvoiceField('additional_services_amount');
  const sumTotal = sumInvoiceField('total_amount');
  const annualPrice = booking?.unit?.unit_type?.annual_price || 0;
  const dailyPrice = booking?.unit?.unit_type?.daily_price || 0;
  const monthlyRent = annualPrice ? Math.round(annualPrice / 12) : (dailyPrice ? Math.round(dailyPrice * 30) : null);
  const bookingAdditionalServices = Array.isArray(booking?.additional_services) ? booking.additional_services : [];
  const bookingAdditionalServicesTotal = bookingAdditionalServices.reduce((acc: number, s: any) => acc + Number(s?.amount || 0), 0);
  const invoiceSubtotal = nonVoidInvoices.length > 0 ? sumSubtotal : (mainInvoice?.subtotal ?? booking?.subtotal ?? null);
  const invoiceDiscount = nonVoidInvoices.length > 0 ? sumDiscount : (mainInvoice?.discount_amount ?? booking?.discount_amount ?? 0);
  const invoiceAdditionalServices =
    nonVoidInvoices.length > 0
      ? sumExtras
      : (mainInvoice?.additional_services_amount ?? bookingAdditionalServicesTotal ?? 0);
  const computedInvoiceTotal = (() => {
    if (nonVoidInvoices.length > 0) return Number(sumTotal);
    if (invoiceSubtotal == null) return null;
    const raw = Number(invoiceSubtotal) - Number(invoiceDiscount || 0) + Number(invoiceAdditionalServices || 0);
    return Math.max(0, Math.round(raw * 100) / 100);
  })();
  const hasDiscount = Number(invoiceDiscount || 0) > 0;
  const docType = (() => {
    const d = booking?.customer?.details || '';
    const m = d.match(/نوع الوثيقة[:\-]?\s*([^\n]+)/);
    return m ? m[1].trim() : null;
  })();
  const companionsCount = (() => {
    const d = booking?.customer?.details || '';
    const m = d.match(/عدد المرافقين[:\-]?\s*(\d+)/);
    return m ? Number(m[1]) : null;
  })();
  const startDateObj = parseDbDate(booking?.check_in);
  const endDateObj = parseDbDate(booking?.check_out);
  const periodStart = startDateObj ? format(startDateObj, 'dd/MM/yyyy', { locale: ar }) : null;
  const periodEnd = endDateObj ? format(endDateObj, 'dd/MM/yyyy', { locale: ar }) : null;
  const startDayName = startDateObj ? format(startDateObj, 'EEEE', { locale: ar }) : null;
  const isAnnualContract = (() => {
    if (!startDateObj || !endDateObj) return false;
    const monthsTotal = Math.max(0, differenceInMonths(endDateObj, startDateObj));
    return monthsTotal >= 12;
  })();
  const yearlyRent = booking?.unit?.unit_type?.annual_price
    ? Math.round(Number(booking.unit.unit_type.annual_price))
    : (monthlyRent != null ? monthlyRent * 12 : null);
  const daysTotalContract = (startDateObj && endDateObj) ? Math.max(0, differenceInCalendarDays(endDateObj, startDateObj)) : 0;
  const monthsTotalContract = (() => {
    if (!startDateObj || !endDateObj) return 0;
    if (booking?.booking_type === 'monthly' && !isAnnualContract) {
      return Math.max(1, Math.round(daysTotalContract / 30));
    }
    return Math.max(0, differenceInMonths(endDateObj, startDateObj));
  })();
  const rentUnitAmountFromInvoice = (() => {
    if (invoiceSubtotal == null) return null;
    if (booking?.booking_type === 'nightly' || booking?.booking_type === 'daily') {
      return daysTotalContract > 0 ? Math.round((Number(invoiceSubtotal) / daysTotalContract) * 100) / 100 : null;
    }
    if (isAnnualContract) {
      const yearsQty = monthsTotalContract >= 12 ? monthsTotalContract / 12 : 1;
      return yearsQty > 0 ? Math.round((Number(invoiceSubtotal) / yearsQty) * 100) / 100 : null;
    }
    return monthsTotalContract > 0 ? Math.round((Number(invoiceSubtotal) / monthsTotalContract) * 100) / 100 : null;
  })();
  const expectedSubtotal = (() => {
    if (invoiceSubtotal == null) return null;
    if (booking?.booking_type === 'nightly' || booking?.booking_type === 'daily') {
      if (!dailyPrice || daysTotalContract <= 0) return null;
      return Math.round(Number(dailyPrice) * daysTotalContract * 100) / 100;
    }
    if (isAnnualContract) {
      if (yearlyRent == null) return null;
      const yearsQty = monthsTotalContract >= 12 ? monthsTotalContract / 12 : 1;
      return Math.round(Number(yearlyRent) * yearsQty * 100) / 100;
    }
    if (monthlyRent == null || monthsTotalContract <= 0) return null;
    return Math.round(Number(monthlyRent) * monthsTotalContract * 100) / 100;
  })();
  const isCustomSubtotal = expectedSubtotal != null && invoiceSubtotal != null && Math.abs(Number(invoiceSubtotal) - expectedSubtotal) > 1;
  const totalRent = (() => {
    if (booking?.booking_type === 'nightly' || booking?.booking_type === 'daily') {
      if (computedInvoiceTotal != null) return Math.round(computedInvoiceTotal);
      return booking?.total_price != null
        ? Math.round(Number(booking.total_price))
        : (dailyPrice && daysTotalContract > 0 ? Math.round(Number(dailyPrice) * daysTotalContract) : null);
    }
    if (computedInvoiceTotal != null) return Math.round(computedInvoiceTotal);
    return isAnnualContract
      ? yearlyRent
      : (monthlyRent != null ? monthlyRent * monthsTotalContract : null);
  })();
  const depositFixed = 0;
  const isDailyBooking = booking?.booking_type === 'nightly' || booking?.booking_type === 'daily';
  const termLabel = isDailyBooking ? 'يومي' : (isAnnualContract ? 'سنوي' : 'شهري');
  const durationText = (() => {
    if (!startDateObj || !endDateObj) return null;
    const start = startDateObj;
    const end = endDateObj;
    const years = Math.max(0, differenceInYears(end, start));
    const monthsTotal = Math.max(0, differenceInMonths(end, start));
    const months = Math.max(0, monthsTotal - years * 12);
    const days = Math.max(0, differenceInCalendarDays(end, addMonths(start, years * 12 + months)));
    const parts: string[] = [];
    const yPart = years === 0 ? null : (years === 1 ? 'سنة واحدة' : years === 2 ? 'سنتان' : `${years} سنوات`);
    const mPart = months === 0 ? null : (months === 1 ? 'شهر واحد' : months === 2 ? 'شهران' : `${months} أشهر`);
    const dPart = days === 0 ? null : (days === 1 ? 'يوم واحد' : days === 2 ? 'يومان' : `${days} أيام`);
    if (yPart) parts.push(yPart);
    if (mPart) parts.push(mPart);
    if (dPart) parts.push(dPart);
    return parts.length > 0 ? parts.join(' و ') : null;
  })();
  let depositAmountFromVouchers: number | null = null;
  try {
    if (!ivRes.error) {
      const amounts = (ivRes.data || []).map((r: any) => Number(r?.amount || 0)).filter((n: number) => n > 0);
      if (amounts.length > 0) {
        depositAmountFromVouchers = Math.round(amounts.reduce((sum: number, n: number) => sum + n, 0));
      }
    }
  } catch {}
  if (depositAmountFromVouchers == null) {
    try {
      const { data: insuranceEvents } = await supabase
        .from('system_events')
        .select('payload, created_at')
        .eq('booking_id', id)
        .eq('event_type', 'insurance_voucher')
        .order('created_at', { ascending: false });
      const receipts = (insuranceEvents || [])
        .map((e: any) => (e?.payload?.voucher_type === 'deposit_receipt' ? Number(e?.payload?.amount || 0) : 0))
        .filter((n: number) => n > 0);
      if (receipts.length > 0) {
        depositAmountFromVouchers = Math.round(receipts.reduce((sum: number, n: number) => sum + n, 0));
      }
    } catch {}
  }
  const depositAmount = depositAmountFromVouchers ?? depositFixed;

  // Booking Source
  let bookingSourceLabel: string = '_';
  try {
    const src = sourceEvent?.payload as any;
    if (src?.booking_source === 'reception') bookingSourceLabel = 'استقبال';
    else if (src?.booking_source === 'platform') bookingSourceLabel = `منصة حجز: ${src?.platform_name || '—'}`;
    else if (src?.booking_source === 'broker') bookingSourceLabel = `وسيط: ${src?.broker_name || '—'}${src?.broker_id ? ` (${src?.broker_id})` : ''}`;
  } catch {}

  return { id, booking, terminationEvent, today, invoiceNumber, monthlyRent, dailyPrice, invoiceSubtotal, invoiceDiscount, invoiceAdditionalServices, computedInvoiceTotal, hasDiscount, docType, companionsCount, periodStart, periodEnd, startDayName, isAnnualContract, yearlyRent, monthsTotalContract, rentUnitAmountFromInvoice, isCustomSubtotal, totalRent, isDailyBooking, termLabel, durationText, depositAmountFromVouchers, depositAmount, bookingSourceLabel };
}

import 'server-only';
import { createClient } from '@/lib/supabase-server';
import { format } from 'date-fns';
import type { ReceiptDocumentData } from './receipt-types';

export class ReceiptLoadError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

function toArabicWords(n: number): string {
  const units = ['صفر','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة','عشرة','أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر'];
  const tens = ['','عشرة','عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون'];
  const hundreds = ['','مئة','مئتان','ثلاثمئة','أربعمئة','خمسمئة','ستمئة','سبعمئة','ثمانمئة','تسعمئة'];
  const seg = (x: number): string => {
    if (x === 0) return '';
    if (x < 20) return units[x];
    if (x < 100) {
      const t = Math.floor(x / 10);
      const r = x % 10;
      return r ? `${units[r]} و ${tens[t]}` : tens[t];
    }
    const h = Math.floor(x / 100);
    const r = x % 100;
    const hword = hundreds[h];
    const rword = seg(r);
    return r ? `${rword} و ${hword}` : hword;
  };
  const scale = (part: number, singular: string, dual: string, plural: string): string => {
    if (part === 0) return '';
    if (part === 1) return singular;
    if (part === 2) return dual;
    if (part >= 3 && part <= 10) return `${seg(part)} ${plural}`;
    return `${seg(part)} ${singular}`;
  };
  const b = Math.floor(n / 1_000_000_000);
  const m = Math.floor((n % 1_000_000_000) / 1_000_000);
  const th = Math.floor((n % 1_000_000) / 1000);
  const h = n % 1000;
  const parts = [scale(b, 'مليار', 'ملياران', 'مليارات'), scale(m, 'مليون', 'مليونان', 'ملايين'), scale(th, 'ألف', 'ألفان', 'آلاف'), seg(h)].filter(Boolean);
  if (parts.length === 0) return units[0];
  return parts.join(' و ');
}

export async function loadReceipt(id: string): Promise<ReceiptDocumentData> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new ReceiptLoadError('يلزم تسجيل الدخول', 401);
  const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profileError || !profile || !['admin', 'manager', 'receptionist', 'accountant'].includes(profile.role)) {
    throw new ReceiptLoadError('صلاحيات غير كافية', 403);
  }
  const { data: payment, error } = await supabase
    .from('payments')
    .select(`
      *,
      customer:customers(*),
      payment_method:payment_methods(name),
      invoice:invoices(
        invoice_number,
        booking:bookings(
          *,
          unit:units(
            *,
            unit_type:unit_types(
              *,
              hotel:hotels(*)
            )
          )
        )
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error('تعذر تحميل بيانات السند');
  if (!payment) throw new ReceiptLoadError('السند غير موجود', 404);

  const voucherNumber =
    payment.payment_number || payment.id.slice(0, 8).toUpperCase();

  const paymentDate = payment.payment_date
    ? new Date(payment.payment_date)
    : new Date(payment.created_at);

  const amount = Number(payment.amount) || 0;
  const qrData = `NID:${payment.customer?.national_id || ''};VID:${voucherNumber};DATE:${format(paymentDate, 'dd/MM/yyyy')};INV:${payment.invoice?.invoice_number || ''};AMT:${amount}`;
  const integerAmount = Math.floor(amount);
  const fraction = Math.round((amount - integerAmount) * 100);
  const amountWords = `${toArabicWords(integerAmount)} ريال سعودي${fraction ? ` و ${toArabicWords(fraction)} هللة` : ''}`;
  const docType = (() => {
    const d = payment.customer?.details || '';
    const m = d.match(/نوع الوثيقة[:\-]?\s*([^\n]+)/);
    return m ? m[1].trim() : null;
  })();

  const normalizeName = (s: string) => {
    if (!s) return s;
    let r = s;
    r = r.replace(/فندق\s*الصفا/gi, 'مساكن الصفا');
    r = r.replace(/مساكن\s*الصفا/gi, 'مساكن الصفا');
    return r;
  };
  const hotelRaw =
    payment.invoice?.booking?.unit?.unit_type?.hotel || ({
      name: 'مساكن الصفى',
      address: 'المملكة العربية السعودية',
      phone: '0538159915',
      cr_number: '7073421299'
    } as any);
  const hotel = { ...hotelRaw, name: normalizeName((hotelRaw as any)?.name) };

  const isAdvance =
    typeof payment.description === 'string' &&
    (payment.description.includes('عربون') ||
      payment.description.includes('دفعة مقدمة'));

  const operationType = isAdvance
    ? 'عربون / دفعة مقدمة'
    : payment.invoice_id != null
    ? 'سداد فاتورة'
    : 'سند قبض / دفعة مقدمة';
  return {
    id: payment.id, voucherNumber, date: format(paymentDate, 'dd/MM/yyyy'),
    invoiceNumber: payment.invoice?.invoice_number || '', amount, amountWords, operationType,
    paymentMethod: payment.payment_method?.name || 'غير محدد',
    description: payment.description || 'سند قبض نقدي',
    customer: { name: payment.customer?.full_name || '-', phone: payment.customer?.phone || '-',
      nationalId: payment.customer?.national_id || '', nationality: payment.customer?.nationality || '', docType: docType || '' },
    hotel: { name: hotel.name, address: hotel.address || '', cr: hotel.cr_number || '7037421299' },
    qrData, printedAt: format(new Date(), 'dd/MM/yyyy HH:mm')
  };
}

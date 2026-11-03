'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { englishDigits, reportDate, ReportQr, revenuePrintStyles } from './RevenueReportPrint';

type EventRow = { id: string; event_type: string; created_at: string; booking_id?: string | null; message?: string };
type InvoiceRow = { id: string; invoice_number?: string | null; invoice_date?: string | null; created_at?: string; total_amount?: number | string; status?: string };
type PaymentRow = { id: string; created_at: string; amount?: number | string; description?: string | null; payment_method?: { name?: string } | null };
type RemainingRow = { booking_id: string; unit_number: string; customer_name: string; remaining: number };
type BookingMeta = { unit: string; customer: string; check_in: string; check_out: string };
const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const count = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const styles = revenuePrintStyles.replaceAll('revenue-print', 'daily-print').replaceAll('revenue-report', 'daily-report');
const cssText = (value: string) => JSON.stringify(englishDigits(value).replace(/[\r\n\f<>]/g, ' '));
const labels: Record<string, string> = { booking_created: 'حجز جديد', check_in: 'تسجيل دخول', check_out: 'تسجيل خروج', payment_settled: 'سداد', invoice_issued: 'إصدار فاتورة' };
const time = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
};
function Section({ title, columns, children }: { title: string; columns: string[]; children: ReactNode }) {
  return <section className="dp-section"><h2 className="rp-section-title">{title}</h2><table className="rp-table"><thead><tr>{columns.map(column => <th key={column}>{column}</th>)}</tr></thead>{children}</table></section>;
}
const empty = (columns: number, message: string) => <tr><td colSpan={columns} className="rp-empty">{message}</td></tr>;

export default function DailyReportPrint({ companyName, companyLogo, date, hotelLabel, events, invoices, payments, remainingRows, totals, bookingMeta }: {
  companyName: string; companyLogo: string | null; date: string; hotelLabel: string;
  events: EventRow[]; invoices: InvoiceRow[]; payments: PaymentRow[]; remainingRows: RemainingRow[];
  totals: { invoices: number; payments: number; remaining: number }; bookingMeta: Map<string, BookingMeta>;
}) {
  const [issuedAt, setIssuedAt] = useState<Date | null>(null);
  useEffect(() => {
    const beforePrint = () => flushSync(() => setIssuedAt(new Date()));
    window.addEventListener('beforeprint', beforePrint);
    return () => window.removeEventListener('beforeprint', beforePrint);
  }, []);
  const content = JSON.stringify([date, hotelLabel, totals, events.map(e => e.id).sort(), invoices.map(i => [i.id, i.total_amount]).sort(), payments.map(p => [p.id, p.amount]).sort(), remainingRows]);
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) hash = Math.imul(hash ^ content.charCodeAt(i), 16777619);
  const reference = `DAY-${englishDigits(date).replace(/\D/g, '')}-${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
  const stamp = issuedAt ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', numberingSystem: 'latn', calendar: 'gregory', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(issuedAt) : '—';
  const countType = (type: string) => events.filter(event => event.event_type === type).length;
  return <div className="daily-print" dir="rtl">
    <style>{styles}</style>
    <style>{`@media print {
      @page daily-report { @bottom-left { content: ${cssText(reference)}; } @bottom-right { content: ${cssText(companyName.slice(0, 48))}; } }
      .daily-report-screen { display: none !important; }
      .daily-report-page { padding: 0 !important; margin: 0 !important; max-width: none !important; }
      .dp-section { margin-bottom: 14px; }
      .daily-print { font-family: Arial, sans-serif; }
    }`}</style>
    <div className="rp-heading">
      <div><div className="rp-brand">{companyLogo && <img src={companyLogo} alt="شعار المنشأة" />}<div><p className="rp-company">{englishDigits(companyName)}</p><h1 className="rp-title">تقرير اليوم — الملخص المالي والتشغيلي</h1></div></div>
        <div className="rp-period">التاريخ: <bdi dir="ltr">{reportDate(date)}</bdi></div>
        <div className="rp-reference-label">مرجع التقرير: <bdi dir="ltr" className="rp-document-reference">{reference}</bdi></div>
      </div>
      <div className="rp-controls"><div className="rp-meta"><div>النطاق: {englishDigits(hotelLabel)}</div><div>تاريخ الطباعة: <bdi dir="ltr">{stamp}</bdi></div><div>جميع المبالغ بالريال السعودي</div></div>
        <div className="rp-qr"><ReportQr payload={`REPORT:${reference}\nDATE:${englishDigits(date)}\nMODE:DAILY_REPORT`} /><div className="rp-qr-caption">مرجع التقرير والتاريخ</div></div>
      </div>
    </div>
    <div className="rp-kpis rp-four">{[
      ['حجوزات جديدة', count.format(countType('booking_created'))], ['تسجيل دخول', count.format(countType('check_in'))], ['مقبوض اليوم', money.format(totals.payments)], ['تسجيل خروج', count.format(countType('check_out'))],
    ].map(([label, value]) => <div key={label} className="rp-kpi"><span className="rp-kpi-label">{label}</span><bdi dir="ltr" className="rp-kpi-value">{value}</bdi></div>)}</div>
    <Section title="الملخص المالي" columns={['فواتير اليوم', 'مقبوض اليوم', 'المتبقي على النزلاء الحاليين']}><tbody><tr><td className="rp-num">{money.format(totals.invoices)}</td><td className="rp-num">{money.format(totals.payments)}</td><td className="rp-num">{money.format(totals.remaining)}</td></tr></tbody></Section>
    <Section title="سجل العمليات اليومية" columns={['الوقت', 'العملية', 'الوحدة', 'العميل', 'الوصول', 'المغادرة', 'البيان']}>
      <tbody>{events.map(event => { const meta = event.booking_id ? bookingMeta.get(event.booking_id) : undefined; return <tr key={event.id}>
        <td><bdi dir="ltr">{time(event.created_at)}</bdi></td><td>{labels[event.event_type] || englishDigits(event.event_type)}</td><td className="rp-center">{englishDigits(meta?.unit || '—')}</td><td>{englishDigits(meta?.customer || '—')}</td>
        <td><bdi dir="ltr">{reportDate(meta?.check_in)}</bdi></td><td><bdi dir="ltr">{reportDate(meta?.check_out)}</bdi></td><td>{englishDigits(event.message || '—')}</td>
      </tr>; })}{!events.length && empty(7, 'لا توجد عمليات لهذا اليوم')}</tbody>
    </Section>
    <Section title="المتبقي على الحجوزات الحالية" columns={['الوحدة', 'العميل', 'المبلغ المتبقي']}><tbody>{remainingRows.map(row => <tr key={row.booking_id}><td className="rp-center">{englishDigits(row.unit_number)}</td><td>{englishDigits(row.customer_name)}</td><td className="rp-num">{money.format(row.remaining)}</td></tr>)}{!remainingRows.length && empty(3, 'لا توجد مبالغ متبقية على النزلاء الحاليين')}</tbody><tfoot><tr className="rp-total"><td colSpan={2}>إجمالي المتبقي المعروض</td><td className="rp-num">{money.format(totals.remaining)}</td></tr></tfoot></Section>
    <Section title="فواتير اليوم" columns={['رقم الفاتورة', 'التاريخ', 'المبلغ', 'الحالة']}><tbody>{invoices.map(invoice => <tr key={invoice.id}><td className="rp-reference">{englishDigits(invoice.invoice_number || '—')}</td><td><bdi dir="ltr">{reportDate(invoice.invoice_date || invoice.created_at)}</bdi></td><td className="rp-num">{money.format(Number(invoice.total_amount) || 0)}</td><td>{({ draft: 'مسودة', posted: 'مرحلة', paid: 'مدفوعة', partially_paid: 'مدفوعة جزئيًا', unpaid: 'غير مدفوعة' } as Record<string, string>)[invoice.status || ''] || englishDigits(invoice.status || '—')}</td></tr>)}{!invoices.length && empty(4, 'لا توجد فواتير لهذا اليوم')}</tbody><tfoot><tr className="rp-total"><td colSpan={2}>إجمالي الفواتير</td><td className="rp-num">{money.format(totals.invoices)}</td><td /></tr></tfoot></Section>
    <Section title="سندات اليوم — المقبوضات" columns={['الوقت', 'المبلغ', 'طريقة الدفع', 'البيان']}><tbody>{payments.map(payment => <tr key={payment.id}><td><bdi dir="ltr">{time(payment.created_at)}</bdi></td><td className="rp-num">{money.format(Number(payment.amount) || 0)}</td><td>{englishDigits(payment.payment_method?.name || '—')}</td><td>{englishDigits(payment.description || '—')}</td></tr>)}{!payments.length && empty(4, 'لا توجد سندات قبض مرحلة لهذا اليوم')}</tbody><tfoot><tr className="rp-total"><td>إجمالي المقبوضات</td><td className="rp-num">{money.format(totals.payments)}</td><td colSpan={2} /></tr></tfoot></Section>
    <p className="rp-footnote">يعرض التقرير العمليات والفواتير والمقبوضات المسجلة في التاريخ المحدد. كشف المتبقي يعرض أعلى {count.format(20)} حجزًا من الحجوزات الحالية وفق بيانات التقرير.</p>
    <div className="rp-approval"><div className="rp-system-origin">صادر آليًا من نظام إدارة الفنادق</div><div className="rp-signatures"><div className="rp-signature">اعتماد المحاسب<div className="rp-signature-line" /></div><div className="rp-signature">اعتماد المدير<div className="rp-signature-line" /></div></div></div>
  </div>;
}

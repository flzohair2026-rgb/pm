'use client';

import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { englishDigits, reportDate, ReportQr, revenuePrintStyles } from './RevenueReportPrint';
import type { ReceivableRow } from '@/lib/reports/overdue-receivables';

const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const count = new Intl.NumberFormat('en-US');
const styles = revenuePrintStyles.replaceAll('revenue-print', 'receivables-print').replaceAll('revenue-report', 'receivables-report');
const cssText = (value: string) => JSON.stringify(englishDigits(value).replace(/[\r\n\f<>]/g, ' '));

export default function ReceivablesReportPrint({ companyName, companyLogo, startDate, endDate, hotelLabel, rows, overdue, asOf, searchText }: {
  companyName: string; companyLogo: string | null; startDate: string; endDate: string; hotelLabel: string;
  rows: ReceivableRow[]; overdue: boolean; asOf: string; searchText: string;
}) {
  const [issuedAt, setIssuedAt] = useState<Date | null>(null);
  useEffect(() => {
    const beforePrint = () => flushSync(() => setIssuedAt(new Date()));
    window.addEventListener('beforeprint', beforePrint);
    return () => window.removeEventListener('beforeprint', beforePrint);
  }, []);
  const totals = rows.reduce((sum, row) => ({ invoiced: sum.invoiced + row.total_invoiced,
    paid: sum.paid + row.total_paid, remaining: sum.remaining + row.total_remaining }), { invoiced: 0, paid: 0, remaining: 0 });
  const content = JSON.stringify([startDate, endDate, hotelLabel, overdue, asOf,
    rows.map(r => [r.customer_id, r.invoices_count, r.total_invoiced, r.total_paid, r.total_remaining, r.oldest_due_date])]);
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) hash = Math.imul(hash ^ content.charCodeAt(i), 16777619);
  const reference = `${overdue ? 'OD' : 'AR'}-${(overdue ? asOf : endDate).replace(/\D/g, '')}-${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
  const title = overdue ? 'تقرير المتأخرين عن السداد' : 'تقرير المديونية';
  const stamp = issuedAt ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', numberingSystem: 'latn', calendar: 'gregory',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(issuedAt) : '—';
  const columns = overdue ? 6 : 5;
  return <div className="receivables-print" dir="rtl">
    <style>{styles}</style>
    <style>{`@media print { @page receivables-report {
      @bottom-left { content: ${cssText(reference)}; }
      @bottom-right { content: ${cssText(companyName.slice(0, 48))}; }
    } }`}</style>
    <div className="rp-heading">
      <div><div className="rp-brand">
        {companyLogo && <img src={companyLogo} alt="شعار المنشأة" />}
        <div><p className="rp-company">{englishDigits(companyName)}</p><h1 className="rp-title">{title}</h1></div>
      </div>
        <div className="rp-period">{overdue ? <>الاستحقاقات المتأخرة قبل <bdi dir="ltr">{reportDate(asOf)}</bdi></> :
          <>الفترة: <bdi dir="ltr">{reportDate(startDate)}</bdi> إلى <bdi dir="ltr">{reportDate(endDate)}</bdi></>}</div>
        <div className="rp-reference-label">مرجع التقرير: <bdi dir="ltr">{reference}</bdi></div>
        {searchText.trim() && <div className="rp-note">بحث العميل: {englishDigits(searchText)}</div>}
      </div>
      <div className="rp-controls"><div className="rp-meta">
        <div>النطاق: {englishDigits(hotelLabel)}</div><div>تاريخ الطباعة: <bdi dir="ltr">{stamp}</bdi></div>
        <div>جميع المبالغ بالريال السعودي</div>
      </div><div className="rp-qr"><ReportQr payload={`REPORT:${reference}\nMODE:${overdue ? 'OVERDUE' : 'RECEIVABLES'}\n${overdue ? `AS_OF:${asOf}` : `FROM:${startDate}\nTO:${endDate}`}`} />
        <div className="rp-qr-caption">مرجع التقرير ونطاقه</div></div></div>
    </div>
    <div className="rp-kpis rp-four">
      <div className="rp-kpi"><span className="rp-kpi-label">{overdue ? 'المستحق للدفعات المتأخرة' : 'إجمالي المدين'}</span><bdi className="rp-kpi-value" dir="ltr">{money.format(totals.invoiced)}</bdi></div>
      <div className="rp-kpi"><span className="rp-kpi-label">{overdue ? 'المسدد منها' : 'إجمالي الدائن'}</span><bdi className="rp-kpi-value" dir="ltr">{money.format(totals.paid)}</bdi></div>
      <div className="rp-kpi"><span className="rp-kpi-label">{overdue ? 'المبلغ المتأخر فقط' : 'إجمالي الرصيد'}</span><bdi className="rp-kpi-value" dir="ltr">{money.format(totals.remaining)}</bdi></div>
      <div className="rp-kpi"><span className="rp-kpi-label">عدد العملاء</span><bdi className="rp-kpi-value" dir="ltr">{count.format(rows.length)}</bdi></div>
    </div>
    <h2 className="rp-section-title">{overdue ? 'تفاصيل المبالغ المتأخرة' : 'أرصدة العملاء'}</h2>
    <table className="rp-table">
      <colgroup>{(overdue ? [29, 9, 14, 16, 16, 16] : [34, 12, 18, 18, 18]).map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
      <thead><tr><th>العميل</th><th className="rp-center">{overdue ? 'الدفعات المتأخرة' : 'العمليات'}</th>
        {overdue && <th>أقدم استحقاق</th>}<th className="rp-num">{overdue ? 'المستحق' : 'المدين'}</th><th className="rp-num">{overdue ? 'المسدد منه' : 'الدائن'}</th><th className="rp-num">{overdue ? 'المتأخر' : 'الرصيد'}</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.customer_id}>
        <td><div className="rp-customer">{englishDigits(row.customer_name)}</div>
          {!!row.unit_numbers?.length && <div className="rp-note">الوحدة: <bdi dir="ltr">{englishDigits(row.unit_numbers.join(' / '))}</bdi></div>}</td>
        <td className="rp-center"><bdi dir="ltr">{count.format(row.invoices_count)}</bdi></td>
        {overdue && <td><bdi dir="ltr">{reportDate(row.oldest_due_date)}</bdi></td>}
        <td className="rp-num">{money.format(row.total_invoiced)}</td><td className="rp-num">{money.format(row.total_paid)}</td><td className="rp-num">{money.format(row.total_remaining)}</td>
      </tr>)}{!rows.length && <tr><td colSpan={columns} className="rp-empty">{overdue ? 'لا يوجد عملاء متأخرون عن السداد ضمن النطاق المحدد.' : 'لا توجد بيانات ضمن الفترة المحددة.'}</td></tr>}</tbody>
      <tfoot><tr className="rp-total"><td colSpan={columns - 3}>الإجمالي العام</td><td className="rp-num">{money.format(totals.invoiced)}</td><td className="rp-num">{money.format(totals.paid)}</td><td className="rp-num">{money.format(totals.remaining)}</td></tr></tfoot>
    </table>
    <p className="rp-footnote">{overdue ? 'يعرض الجزء غير المسدد من الأقساط أو الفواتير التي سبق موعد استحقاقها تاريخ التقرير. لا يشمل المستحق اليوم أو القادم. السداد محسوب بحسب المدفوعات الحالية المرتبطة بالفواتير؛ هامش فروق التقريب ريال واحد للدفعة.' : 'يعرض التقرير حركة أرصدة العملاء خلال الفترة المحددة بحسب القيود المحاسبية؛ الرصيد المتبقي وحده لا يعني التأخر عن السداد.'}</p>
    <div className="rp-approval"><div className="rp-system-origin">صادر آليًا من نظام إدارة الفنادق</div>
      <div className="rp-signatures"><div className="rp-signature">اعتماد المحاسب<div className="rp-signature-line" /></div><div className="rp-signature">اعتماد المدير<div className="rp-signature-line" /></div></div>
    </div>
  </div>;
}

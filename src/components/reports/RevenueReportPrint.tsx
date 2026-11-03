'use client';

import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import qrcode from 'qrcode-generator';

export interface RevenuePrintRow {
  id: string;
  date?: string;
  hotel_id?: string | null;
  hotel_name?: string | null;
  account_id?: string;
  account_name?: string;
  unit_number?: string;
  customer_name?: string;
  description?: string;
  debit?: number | string;
  credit?: number | string;
  amount: number | string;
  journal_entries?: { voucher_number?: string; description?: string };
}

// Normalize embedded digits too (room numbers, references and free-text notes).
export function englishDigits(value: unknown): string {
  return String(value ?? '').replace(/[٠-٩۰-۹]/g, digit => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

export function reportDate(value?: string): string {
  const normalized = englishDigits(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalized);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : normalized || '—';
}

const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const count = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const amount = (value: unknown) => Number(value || 0);

export function reportReference(start: string, end: string, scope: string, accounting: boolean, rows: RevenuePrintRow[], total: number): string {
  // A reproducible document reference, not a signature or proof of approval.
  const content = JSON.stringify([start, end, scope, accounting, total,
    rows.map(row => [row.id, row.date, row.amount, row.debit, row.credit]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))]);
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) hash = Math.imul(hash ^ content.charCodeAt(i), 16777619);
  return `${accounting ? 'MOV' : 'REC'}-${englishDigits(start).replace(/\D/g, '')}-${englishDigits(end).replace(/\D/g, '')}-${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}

export function reportQrPayload(reference: string, start: string, end: string, accounting: boolean): string {
  return `REPORT:${reference}\nFROM:${englishDigits(start)}\nTO:${englishDigits(end)}\nMODE:${accounting ? 'CASH_MOVEMENT' : 'CASH_RECEIPTS'}`;
}

export function ReportQr({ payload }: { payload: string }) {
  const code = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(payload, 'Byte');
    qr.make();
    const count = qr.getModuleCount();
    const modules: string[] = [];
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) modules.push(`M${col + 4},${row + 4}h1v1h-1z`);
      }
    }
    return { size: count + 8, path: modules.join('') };
  }, [payload]);
  return <svg viewBox={`0 0 ${code.size} ${code.size}`} role="img" aria-label="رمز مرجع التقرير" shapeRendering="crispEdges">
    <rect width={code.size} height={code.size} fill="white" />
    <path d={code.path} fill="black" />
  </svg>;
}

const cssText = (value: string) => JSON.stringify(englishDigits(value).replace(/[\r\n\f<>]/g, ' '));

export const revenuePrintStyles = `
  .revenue-print { display: none; }
  @media print {
    @page revenue-report {
      size: A4 portrait;
      margin: 12mm 9mm 18mm;
      @bottom-center {
        content: "صفحة " counter(page, decimal) " من " counter(pages, decimal);
        font-family: Arial, sans-serif; font-size: 8px; color: #304c3b;
        direction: rtl; text-align: center; vertical-align: top;
        border-top: 1px solid #bfcfc3; padding-top: 3mm; width: 25%;
      }
      @bottom-left {
        font-family: Arial, sans-serif; font-size: 7px; color: #495c50;
        direction: ltr; text-align: left; vertical-align: top;
        border-top: 1px solid #bfcfc3; padding-top: 3mm; width: 40%;
      }
      @bottom-right {
        font-family: Arial, sans-serif; font-size: 8px; color: #304c3b;
        direction: rtl; text-align: right; vertical-align: top;
        border-top: 1px solid #bfcfc3; padding-top: 3mm; width: 35%;
      }
    }
    body:has(.revenue-print) { background: white !important; color: #202523 !important; }
    body:has(.revenue-print) header,
    body:has(.revenue-print) aside,
    body:has(.revenue-print) nav,
    body:has(.revenue-print) .sticky,
    body:has(.revenue-print) .fixed,
    body:has(.revenue-print) .screen-only { display: none !important; }
    body:has(.revenue-print) main { padding: 0 !important; }
    body:has(.revenue-print) main > div { max-width: none !important; }
    .revenue-print { display: block !important; page: revenue-report; width: 100%; font-size: 10px; line-height: 1.55; color: #202523; }
    .revenue-print * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .rp-heading { display: flex; justify-content: space-between; align-items: start; gap: 16px; border: 1px solid #cedbd3; border-top: 5px solid #204d3b; background: #f4f7f5; padding: 12px; margin-bottom: 12px; break-inside: avoid; }
    .rp-brand { display: flex; align-items: center; gap: 10px; }
    .rp-brand img { width: 42px; height: 42px; object-fit: contain; }
    .rp-controls { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    .rp-qr { width: 24mm; text-align: center; }
    .rp-qr svg { display: block; width: 24mm; height: 24mm; background: white; border: 1px solid #cedbd3; }
    .rp-qr-caption { font-size: 7px; color: #495c50; margin-top: 2px; }
    .rp-reference-label { margin-top: 4px; font-size: 8px; color: #495c50; }
    .rp-document-reference { font-family: Arial, sans-serif; font-size: 8px; font-weight: 700; color: #173d2e; }
    .rp-company { margin: 0 0 3px; font-size: 17px; font-weight: 800; color: #173d2e; }
    .rp-title { margin: 0; font-size: 12px; font-weight: 700; color: #263d32; }
    .rp-meta { font-size: 9px; line-height: 1.9; color: #36483e; text-align: left; border-inline-start: 1px solid #cedbd3; padding-inline-start: 12px; }
    .rp-period { margin-top: 6px; font-size: 10px; font-weight: 600; color: #3d5145; }
    .rp-kpis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px; break-inside: avoid; }
    .rp-kpis.rp-four { grid-template-columns: repeat(4, 1fr); }
    .rp-kpi { border: 1px solid #bfcfc3; border-radius: 5px; padding: 8px 10px; background: #f9fbf9; }
    .rp-kpi-label { font-size: 9px; font-weight: 600; color: #425748; }
    .rp-kpi-value { display: block; margin-top: 3px; font-size: 17px; font-weight: 800; color: #183e2d; }
    .rp-kpi:nth-last-child(2) { background: #204d3b; border-color: #204d3b; }
    .rp-kpi:nth-last-child(2) .rp-kpi-label { color: #e4eee8; }
    .rp-kpi:nth-last-child(2) .rp-kpi-value { color: #fff; }
    .rp-summaries { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
    .rp-summaries.rp-single { grid-template-columns: 1fr; }
    .rp-section-title { margin: 0 0 6px; padding-inline-start: 7px; border-inline-start: 3px solid #204d3b; font-size: 11px; font-weight: 800; color: #183e2d; break-after: avoid; }
    .rp-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .rp-table th, .rp-table td { padding: 6px 5px; border-bottom: 1px solid #d4ded7; vertical-align: top; text-align: right; overflow-wrap: anywhere; }
    .rp-table th { background: #204d3b; color: #fff; border-top: 1px solid #204d3b; font-size: 9px; font-weight: 700; }
    .rp-table td { font-size: 9px; color: #202e25; }
    .rp-table tbody tr:nth-child(even) td { background: #f4f7f4; }
    .rp-table thead { display: table-header-group; }
    .rp-table tfoot { display: table-row-group; }
    .rp-table tr { break-inside: avoid; page-break-inside: avoid; }
    .rp-table .rp-num { text-align: left; white-space: nowrap; direction: ltr; font-variant-numeric: tabular-nums; font-weight: 600; }
    .rp-table .rp-center { text-align: center; }
    .rp-reference { font-size: 8px !important; direction: ltr; unicode-bidi: isolate; }
    .rp-hotel-row { break-after: avoid; page-break-after: avoid; }
    .rp-hotel-row th { background: #e2ece5; border-top: 1px solid #b9cdbf; color: #173d2e; padding-top: 8px; padding-bottom: 7px; }
    .rp-hotel-count { color: #435d4c; font-size: 8px; font-weight: 500; margin-inline-start: 8px; }
    .rp-customer { font-weight: 700; }
    .rp-note { margin-top: 2px; color: #47594d; font-size: 8px; line-height: 1.6; white-space: pre-line; }
    .rp-table .rp-subtotal td { border-top: 1px solid #9fb6a6; font-weight: 700; color: #173d2e; background: #eaf0eb; }
    .rp-table .rp-total td { border-top: 2px solid #173d2e; background: #204d3b; color: #fff; font-weight: 800; font-size: 11px; padding-top: 9px; padding-bottom: 9px; }
    .rp-empty { text-align: center !important; padding: 20px !important; color: #68706b; }
    .rp-footnote { margin-top: 10px; padding: 6px 8px; border-inline-start: 2px solid #9fb6a6; background: #f4f7f5; font-size: 8px; color: #495c50; }
    .rp-signatures { display: flex; gap: 40px; margin-top: 24px; break-inside: avoid; }
    .rp-approval { break-inside: avoid; }
    .rp-system-origin { margin-top: 16px; padding: 7px 10px; border: 1px solid #bfcfc3; border-inline-start: 3px solid #204d3b; color: #204d3b; font-size: 9px; font-weight: 700; }
    .rp-signature { flex: 1; font-size: 9px; font-weight: 600; color: #304c3b; }
    .rp-signature-line { margin-top: 25px; border-top: 1px solid #73907d; }
  }
`;

export default function RevenueReportPrint({ companyName, companyLogo, startDate, endDate, hotelLabel, rows, total, accounting }: {
  companyName: string;
  companyLogo: string | null;
  startDate: string;
  endDate: string;
  hotelLabel: string;
  rows: RevenuePrintRow[];
  total: number;
  accounting: boolean;
}) {
  const [issuedAt, setIssuedAt] = useState<Date | null>(null);
  useEffect(() => {
    const beforePrint = () => flushSync(() => setIssuedAt(new Date()));
    window.addEventListener('beforeprint', beforePrint);
    return () => window.removeEventListener('beforeprint', beforePrint);
  }, []);

  const hotels = new Map<string, { name: string; rows: RevenuePrintRow[]; total: number; debit: number; credit: number }>();
  const accounts = new Map<string, { name: string; total: number }>();
  let debit = 0, credit = 0;
  for (const row of rows) {
    const key = row.hotel_id || row.hotel_name?.trim() || 'unassigned';
    const hotel = hotels.get(key) || { name: row.hotel_name?.trim() || 'غير محدد', rows: [], total: 0, debit: 0, credit: 0 };
    hotel.rows.push(row);
    hotel.total += amount(row.amount); hotel.debit += amount(row.debit); hotel.credit += amount(row.credit);
    hotels.set(key, hotel);
    const accountKey = row.account_id || row.account_name || 'unassigned';
    const account = accounts.get(accountKey) || { name: row.account_name || 'غير محدد', total: 0 };
    account.total += amount(row.amount);
    accounts.set(accountKey, account);
    debit += amount(row.debit); credit += amount(row.credit);
  }
  const groups = [...hotels.values()];
  const columns = accounting ? 8 : 6;
  const totalLabel = accounting ? 'صافي الحركة' : 'إجمالي المقبوضات';
  const stamp = issuedAt ? new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh', numberingSystem: 'latn', calendar: 'gregory',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(issuedAt) : '—';
  const reference = useMemo(() => reportReference(startDate, endDate, hotelLabel, accounting, rows, total),
    [startDate, endDate, hotelLabel, accounting, rows, total]);
  const qrPayload = reportQrPayload(reference, startDate, endDate, accounting);
  const footerStyles = `@media print { @page revenue-report {
    @bottom-left { content: ${cssText(reference)}; }
    @bottom-right { content: ${cssText(companyName.slice(0, 48))}; }
  } }`;

  return (
    <div className="revenue-print" dir="rtl">
      <style>{revenuePrintStyles}</style>
      <style>{footerStyles}</style>
      <div className="rp-heading">
        <div>
          <div className="rp-brand">
            {companyLogo && <img src={companyLogo} alt="شعار المنشأة" />}
            <div>
              <p className="rp-company">{englishDigits(companyName)}</p>
              <h1 className="rp-title">{accounting ? 'كشف حركة الصناديق' : 'تقرير الإيرادات — المقبوضات النقدية'}</h1>
            </div>
          </div>
          <div className="rp-period">الفترة: <bdi dir="ltr">{reportDate(startDate)}</bdi> إلى <bdi dir="ltr">{reportDate(endDate)}</bdi></div>
          <div className="rp-reference-label">مرجع التقرير: <bdi dir="ltr" className="rp-document-reference">{reference}</bdi></div>
        </div>
        <div className="rp-controls">
        <div className="rp-meta">
          <div>النطاق: {englishDigits(hotelLabel)}</div>
          <div>تاريخ الطباعة: <bdi dir="ltr">{stamp}</bdi></div>
          <div>جميع المبالغ بالريال السعودي</div>
        </div>
        <div className="rp-qr"><ReportQr payload={qrPayload} /><div className="rp-qr-caption">مرجع التقرير والفترة</div></div>
        </div>
      </div>

      <div className={`rp-kpis${accounting ? ' rp-four' : ''}`}>
        {accounting && <><div className="rp-kpi"><span className="rp-kpi-label">إجمالي القبض</span><bdi dir="ltr" className="rp-kpi-value">{money.format(debit)}</bdi></div>
          <div className="rp-kpi"><span className="rp-kpi-label">إجمالي الصرف</span><bdi dir="ltr" className="rp-kpi-value">{money.format(credit)}</bdi></div></>}
        <div className="rp-kpi"><span className="rp-kpi-label">{totalLabel}</span><bdi dir="ltr" className="rp-kpi-value">{money.format(total)}</bdi></div>
        <div className="rp-kpi"><span className="rp-kpi-label">عدد العمليات</span><bdi dir="ltr" className="rp-kpi-value">{count.format(rows.length)}</bdi></div>
      </div>

      {rows.length > 0 && <div className={`rp-summaries${groups.length <= 1 ? ' rp-single' : ''}`}>
        {groups.length > 1 && <div><h2 className="rp-section-title">الملخص حسب الفندق</h2>
          <table className="rp-table"><thead><tr><th>الفندق</th><th className="rp-num">{totalLabel}</th></tr></thead>
            <tbody>{groups.map((hotel, index) => <tr key={index}><td>{englishDigits(hotel.name)}</td><td className="rp-num">{money.format(hotel.total)}</td></tr>)}</tbody></table>
        </div>}
        <div><h2 className="rp-section-title">الملخص حسب الصندوق / الحساب</h2>
          <table className="rp-table"><thead><tr><th>الصندوق / الحساب</th><th className="rp-num">{totalLabel}</th></tr></thead>
            <tbody>{[...accounts.values()].map((account, index) => <tr key={index}><td>{englishDigits(account.name)}</td><td className="rp-num">{money.format(account.total)}</td></tr>)}</tbody></table>
        </div>
      </div>}

      <h2 className="rp-section-title">{accounting ? 'تفاصيل حركة الصناديق' : 'تفاصيل عمليات القبض'}</h2>
      <table className="rp-table">
        <colgroup>{(accounting ? [10, 12, 6, 28, 14, 10, 10, 10] : [12, 14, 7, 33, 18, 16]).map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
        <thead><tr><th>التاريخ</th><th>رقم القيد</th><th className="rp-center">الوحدة</th><th>العميل والبيان</th><th>الصندوق / الحساب</th>
          {accounting && <><th className="rp-num">قبض</th><th className="rp-num">صرف</th></>}<th className="rp-num">{accounting ? 'الصافي' : 'المبلغ'}</th></tr></thead>
        {groups.map((hotel, index) => <tbody key={index}>
          <tr className="rp-hotel-row"><th colSpan={columns}>{englishDigits(hotel.name)}<span className="rp-hotel-count">{count.format(hotel.rows.length)} عملية</span></th></tr>
          {hotel.rows.map(row => <tr key={row.id}>
            <td><bdi dir="ltr">{reportDate(row.date)}</bdi></td>
            <td className="rp-reference">{englishDigits(row.journal_entries?.voucher_number || '—')}</td>
            <td className="rp-center"><bdi>{englishDigits(row.unit_number || '—')}</bdi></td>
            <td><div className="rp-customer">{englishDigits(row.customer_name || '—')}</div><div className="rp-note">{englishDigits(row.journal_entries?.description?.trim() || row.description || '—')}</div></td>
            <td>{englishDigits(row.account_name || '—')}</td>
            {accounting && <><td className="rp-num">{money.format(amount(row.debit))}</td><td className="rp-num">{money.format(amount(row.credit))}</td></>}
            <td className="rp-num">{money.format(amount(row.amount))}</td>
          </tr>)}
          <tr className="rp-subtotal"><td colSpan={5}>إجمالي {englishDigits(hotel.name)}</td>
            {accounting && <><td className="rp-num">{money.format(hotel.debit)}</td><td className="rp-num">{money.format(hotel.credit)}</td></>}
            <td className="rp-num">{money.format(hotel.total)}</td></tr>
        </tbody>)}
        {rows.length === 0 && <tbody><tr><td colSpan={columns} className="rp-empty">لا توجد عمليات خلال الفترة المحددة.</td></tr></tbody>}
        <tfoot><tr className="rp-total"><td colSpan={5}>الإجمالي العام</td>
          {accounting && <><td className="rp-num">{money.format(debit)}</td><td className="rp-num">{money.format(credit)}</td></>}
          <td className="rp-num">{money.format(total)}</td></tr></tfoot>
      </table>
      <p className="rp-footnote">{accounting ? 'يعرض الكشف القبض والصرف وصافي الحركة للصناديق والحسابات المشمولة بالفترة.' : 'يعرض التقرير المقبوضات النقدية المسجلة للصناديق المشمولة بالفترة، ولا يمثل إجمالي الفواتير أو الإيراد المستحق.'}</p>
      <div className="rp-approval">
        <div className="rp-system-origin">صادر آليًا من نظام إدارة الفنادق</div>
        <div className="rp-signatures"><div className="rp-signature">اعتماد المحاسب<div className="rp-signature-line" /></div><div className="rp-signature">اعتماد المدير<div className="rp-signature-line" /></div></div>
      </div>
    </div>
  );
}

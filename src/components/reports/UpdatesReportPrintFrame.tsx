'use client';

/* eslint-disable @next/next/no-img-element -- Print branding may use a local data URL and must render without image optimization. */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// Fit the complete report, including the last summary, without hiding any rows.
// CSS zoom participates in print layout; transform alone still fragments the
// unscaled content into extra pages in Chromium.
export function fitUpdatesPrint(sheet: HTMLElement, content: HTMLElement) {
  sheet.dataset.measuring = 'true';
  const width = sheet.clientWidth;
  const height = sheet.clientHeight - 2;
  const apply = (value: number) => {
    content.style.zoom = String(value);
    content.style.width = `${width / value}px`;
    return content.getBoundingClientRect().height <= height && content.scrollWidth * value <= width + 1;
  };
  let scale = 1;
  if (!apply(1)) {
    let low = 0.01, high = 1;
    for (let i = 0; i < 18; i++) {
      const middle = (low + high) / 2;
      if (apply(middle)) low = middle;
      else high = middle;
    }
    scale = low;
    apply(scale);
  }
  sheet.dataset.printScale = String(scale);
  delete sheet.dataset.measuring;
  return scale;
}

export const updatesPrintStyles = `
  .updates-sheet { display: none; }
  .updates-sheet, .updates-sheet * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .updates-sheet { position: relative; width: 281mm; height: 193mm; font-family: Arial, sans-serif; font-size: 10px; line-height: 1.4; color: #202523; }
  .updates-content { position: relative; width: 100%; }
  .updates-sheet[data-measuring='true'] { display: block !important; position: absolute !important; left: -20000px !important; top: 0 !important; visibility: hidden !important; }
  .updates-sheet .up-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 12px; margin-bottom: 8px; border: 1px solid #cedbd3; border-top: 4px solid #204d3b; background: #f4f7f5; }
  .updates-sheet .up-brand { display: flex; align-items: center; gap: 9px; }
  .updates-sheet .up-brand img { width: 34px; height: 34px; object-fit: contain; }
  .updates-sheet .up-company { margin: 0 0 2px; color: #173d2e; font-size: 15px; font-weight: 800; }
  .updates-sheet .print-title { margin: 0; color: #263d32; font-size: 12px; font-weight: 700; }
  .updates-sheet .up-meta { padding-inline-start: 12px; border-inline-start: 1px solid #cedbd3; color: #495c50; font-size: 9px; line-height: 1.8; text-align: left; }
  .updates-sheet .p-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 5px; }
  .updates-sheet .p-filters { flex-shrink: 0; font-size: 9px; color: #36483e; line-height: 1.7; }
  .updates-sheet .p-legend { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; color: #36483e; font-size: 9px; }
  .updates-sheet .p-leg { display: inline-flex; align-items: center; gap: 4px; border: 1px solid #d4ded7; border-radius: 5px; background: #f9fbf9; padding: 3px 6px; }
  .updates-sheet .p-dot { width: 7px; height: 7px; border-radius: 50%; }
  .updates-sheet .p-dot-overdue { background: #92400e; }
  .updates-sheet .p-dot-booked { background: #ef4444; }
  .updates-sheet .p-dot-future { background: #fde047; }
  .updates-sheet .p-dot-temp { background: #f59e0b; }
  .updates-sheet .p-dot-avail { background: #22c55e; }
  .updates-sheet .p-dot-clean { background: #86efac; }
  .updates-sheet .p-dot-maint { background: #9ca3af; }
  .updates-sheet .print-sub { margin-bottom: 7px; padding-inline-start: 7px; border-inline-start: 2px solid #9fb6a6; color: #495c50; font-size: 8px; }
  .updates-sheet .p-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 5px; }
  .updates-sheet .p-card { min-width: 0; min-height: 52px; padding: 6px; border: 1px solid rgba(0,0,0,.07); border-radius: 6px; break-inside: avoid; }
  .updates-sheet .p-card-overdue { background: #92400e; color: #fff; }
  .updates-sheet .p-card-booked { background: #ef4444; color: #fff; }
  .updates-sheet .p-card-future { background: #fde047; color: #111827; }
  .updates-sheet .p-card-temp { background: #f59e0b; color: #111827; }
  .updates-sheet .p-card-available { background: #22c55e; color: #fff; }
  .updates-sheet .p-card-cleaning { background: #bbf7d0; color: #111827; }
  .updates-sheet .p-card-maint { background: #6b7280; color: #fff; }
  .updates-sheet .p-row1 { display: flex; align-items: baseline; justify-content: space-between; gap: 5px; }
  .updates-sheet .p-unit { min-width: 0; overflow-wrap: anywhere; font-size: 17px; font-weight: 800; line-height: 1.2; }
  .updates-sheet .p-out { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 1px; font-size: 7px; font-weight: 700; white-space: nowrap; }
  .updates-sheet .p-out-label { font-size: 6px; opacity: .9; }
  .updates-sheet .p-out-date { font-size: 7px; font-weight: 800; }
  .updates-sheet .p-type-line { margin-top: 3px; font-size: 8px; overflow-wrap: anywhere; line-height: 1.3; }
  .updates-sheet .p-flags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }
  .updates-sheet .p-flag { padding: 0 4px; border-radius: 3px; background: rgba(255,255,255,.3); font-size: 7px; line-height: 1.3; }
  .updates-sheet .p-note { margin-top: 3px; color: inherit; font-size: 7px; line-height: 1.3; overflow-wrap: anywhere; }
  .updates-sheet .p-summary { margin-top: 9px; }
  .updates-sheet .p-summary-title { margin-bottom: 5px; border-inline-start: 3px solid #204d3b; padding-inline-start: 7px; color: #183e2d; font-size: 10px; font-weight: 800; }
  .updates-sheet .p-summary-lines { display: flex; flex-wrap: wrap; gap: 5px; }
  .updates-sheet .p-summary-line { padding: 4px 7px; border: 1px solid #bfcfc3; border-radius: 4px; background: #f4f7f5; color: #173d2e; font-size: 9px; font-weight: 700; }
  .updates-sheet .up-footer { display: flex; justify-content: space-between; gap: 10px; margin-top: 9px; border-top: 1px solid #bfcfc3; padding-top: 5px; color: #495c50; font-size: 8px; }
  @media print {
    @page updates-report { size: A4 landscape; margin: 8mm; }
    body:has(.updates-sheet) { margin: 0 !important; background: #fff !important; }
    body:has(.updates-sheet) header, body:has(.updates-sheet) aside, body:has(.updates-sheet) nav,
    body:has(.updates-sheet) .sticky, body:has(.updates-sheet) .fixed, body:has(.updates-sheet) .screen-only { display: none !important; }
    body:has(.updates-sheet) main { padding: 0 !important; }
    body:has(.updates-sheet) main > div { max-width: none !important; }
    body:has(.updates-sheet) main, body:has(.updates-sheet) main > div { margin: 0 !important; }
    .updates-sheet { display: block !important; page: updates-report; break-inside: avoid; }
  }
`;

export default function UpdatesReportPrintFrame({ date, children }: { date: string; children: ReactNode }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [brand, setBrand] = useState({ name: 'شموخ الرفاهية', logo: null as string | null });
  useEffect(() => {
    try { setBrand({ name: localStorage.getItem('companyName') || 'شموخ الرفاهية', logo: localStorage.getItem('companyLogo') }); } catch { /* Default branding remains available. */ }
  }, []);
  useLayoutEffect(() => {
    let active = true;
    const fit = () => { if (active && sheetRef.current && contentRef.current) fitUpdatesPrint(sheetRef.current, contentRef.current); };
    fit();
    void document.fonts?.ready.then(fit);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    if (contentRef.current) observer?.observe(contentRef.current);
    window.addEventListener('beforeprint', fit);
    return () => { active = false; observer?.disconnect(); window.removeEventListener('beforeprint', fit); };
  }, [children, brand]);
  return <div className="updates-sheet" ref={sheetRef} dir="rtl">
    <style>{updatesPrintStyles}</style>
    <div className="updates-content" ref={contentRef}>
      <div className="up-heading"><div className="up-brand">{brand.logo && <img src={brand.logo} alt="شعار المنشأة" />}<div><p className="up-company">{brand.name}</p><h1 className="print-title">تقرير التحديثيات</h1></div></div><div className="up-meta"><div>التاريخ: <bdi dir="ltr">{date}</bdi></div><div>تقرير حالة الوحدات</div></div></div>
      {children}
      <div className="up-footer"><span>صادر آليًا من نظام إدارة الفنادق</span><span>صفحة <bdi>1</bdi> من <bdi>1</bdi></span></div>
    </div>
  </div>;
}

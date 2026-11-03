'use client';

import { useMemo } from 'react';
import qrcode from 'qrcode-generator';
import Logo from '@/components/Logo';
import ElectronicSignatureField from './ElectronicSignatureField';
import type { ReceiptDocumentData } from '@/lib/print/receipt-types';

export const receiptPrintStyles = `
.receipt-paper,.receipt-paper *{box-sizing:border-box}
.receipt-paper{width:194mm;min-height:270mm;margin:0 auto;padding:7mm;background:#fff;color:#243b30;font-size:12px;line-height:1.8;direction:rtl;overflow-wrap:anywhere}
.receipt-paper h1,.receipt-paper h2,.receipt-paper h3,.receipt-paper p{margin:0}
.receipt-head{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:16px;border:1px solid #cedbd3;border-top:5px solid #204d3b;background:#f4f7f5}
.receipt-brand{display:flex;align-items:center;gap:12px;min-width:0}.receipt-brand img{width:54px;height:54px;object-fit:contain}
.receipt-brand h2{font-size:19px;font-weight:700}.receipt-brand p{font-size:10px;color:#52665b}.receipt-title{flex-shrink:0;text-align:left}.receipt-title h1{font-size:25px;font-weight:700}.receipt-title p{font-size:9px;letter-spacing:1px}
.receipt-ref{display:flex;justify-content:space-between;gap:15px;padding:10px 3px;margin-bottom:16px;border-bottom:1px solid #dce5df;font-size:11px}
.receipt-info{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}.receipt-box{border:1px solid #d5dfd8;border-radius:8px;padding:14px;break-inside:avoid}.receipt-box h3{font-size:13px;font-weight:700;padding-bottom:8px;margin-bottom:10px;border-bottom:1px solid #e2e8e4}
.receipt-field{display:grid;grid-template-columns:90px minmax(0,1fr);gap:8px;margin:7px 0;align-items:start}.receipt-field dt{color:#607267}.receipt-field dd{margin:0;font-weight:600}
.receipt-num{font-variant-numeric:tabular-nums;direction:ltr;unicode-bidi:isolate;display:inline-block}
.receipt-amount{border:1px solid #b7cdbf;background:#f1f7f3;border-radius:8px;padding:16px;display:flex;justify-content:space-between;align-items:center;gap:16px;margin:18px 0;break-inside:avoid}.receipt-amount strong{font-size:30px;font-weight:700;line-height:1.5}.receipt-amount small{font-size:13px}.receipt-words{margin-bottom:18px!important;padding:0 4px}
.receipt-description{border:1px solid #d5dfd8;border-radius:8px;padding:16px;white-space:pre-wrap;break-inside:avoid}.receipt-description h3{font-weight:700;margin-bottom:8px}.receipt-description p{color:#41594b}
.receipt-sign{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:26px;align-items:center;break-inside:avoid}.receipt-sign p{font-size:11px;line-height:2}.receipt-note{white-space:pre-wrap;margin-top:14px!important}
.receipt-footer{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-top:28px;padding-top:14px;border-top:1px solid #d5dfd8;color:#607267;font-size:9px;break-inside:avoid}.receipt-footer svg{width:76px;height:76px;flex-shrink:0}
@media print{
 @page{size:A4 portrait;margin:8mm}
 html,body{margin:0!important;padding:0!important;background:#fff!important}
 .receipt-paper{width:194mm!important;min-height:0!important;margin:0!important;padding:7mm!important;box-shadow:none!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
 .receipt-paper .print\\:hidden{display:none!important}
}
`;

export default function ReceiptDocument({ data, note }: { data: ReceiptDocumentData; note?: string }) {
  const qr = useMemo(() => {
    const code = qrcode(0, 'M');
    // ASCII reference payload; customer identity is not sent to a third party.
    code.addData(`RECEIPT:${data.id};NO:${data.voucherNumber};DATE:${data.date};AMT:${data.amount}`, 'Byte');
    code.make();
    return code.createSvgTag({ cellSize: 2, margin: 8, scalable: true });
  }, [data.id, data.voucherNumber, data.date, data.amount]);
  const field = (label: string, value: string, number = false) => <div className="receipt-field" key={label}><dt>{label}</dt><dd>{number ? <bdi className="receipt-num">{value}</bdi> : value}</dd></div>;
  return <article className="receipt-paper" dir="rtl" aria-label="سند قبض">
    <style>{receiptPrintStyles}</style>
    <header className="receipt-head">
      <div className="receipt-brand"><Logo alt="شعار المنشأة" /><div><h2>{data.hotel.name}</h2><p>{data.hotel.address}</p><p>السجل التجاري: <bdi className="receipt-num">{data.hotel.cr}</bdi></p></div></div>
      <div className="receipt-title"><h1>سند قبض</h1><p>RECEIPT VOUCHER</p></div>
    </header>
    <div className="receipt-ref"><span>رقم السند: <bdi className="receipt-num">{data.voucherNumber}</bdi></span><span>تاريخ السند: <bdi className="receipt-num">{data.date}</bdi></span></div>
    <div className="receipt-info">
      <section className="receipt-box"><h3>بيانات العميل</h3><dl>{field('الاسم', data.customer.name)}{field('رقم الهاتف', data.customer.phone, true)}{data.customer.nationalId && field('رقم الهوية', data.customer.nationalId, true)}{data.customer.nationality && field('الجنسية', data.customer.nationality)}{data.customer.docType && field('نوع الوثيقة', data.customer.docType)}</dl></section>
      <section className="receipt-box"><h3>بيانات العملية</h3><dl>{field('نوع العملية', data.operationType)}{field('طريقة الدفع', data.paymentMethod)}{data.invoiceNumber && field('رقم الفاتورة', data.invoiceNumber, true)}</dl></section>
    </div>
    <section className="receipt-amount"><div>المبلغ المستلم<p>ريال سعودي</p></div><div><strong className="receipt-num">{data.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> <small>ر.س</small></div></section>
    <p className="receipt-words">المبلغ كتابة: <strong>{data.amountWords}</strong></p>
    <section className="receipt-description"><h3>البيان</h3><p>{data.description}</p></section>
    {note && <p className="receipt-note">ملاحظة: {note}</p>}
    <div className="receipt-sign"><ElectronicSignatureField portalPad label="المستلم" secondaryLabel={`ممثل ${data.hotel.name}`} /><p>أقر أنا ممثل {data.hotel.name} باستلام المبلغ الموضح أعلاه من العميل المذكور.</p></div>
    <footer className="receipt-footer"><div><p>نظام مساكن فندقية — سند إلكتروني آلي</p><p>تاريخ تجهيز المستند: <bdi className="receipt-num">{data.printedAt}</bdi></p></div><div role="img" aria-label="رمز مرجع السند" dangerouslySetInnerHTML={{ __html: qr }} /></footer>
  </article>;
}

// Run with: node --test scripts/test-revenue-print.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const context = { exports: {}, require };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/reports/RevenueReportPrint.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2017, esModuleInterop: true },
}).outputText, context);
const report = context.exports;
const props = {
  companyName: 'منشأة ١٢', companyLogo: null, startDate: '2026-11-01', endDate: '2026-11-02',
  hotelLabel: 'كل الفنادق', accounting: false, total: 1500,
  rows: [
    { id: '1', date: '2026-11-01', hotel_id: 'h1', hotel_name: 'الفندق ١', account_id: 'cash', account_name: 'الصندوق ١',
      unit_number: '١٠١', customer_name: 'عميل تجريبي ١', description: 'سداد ١٠٠٠ ريال عن الحجز ۱۲۳', amount: 1000, debit: 1000, credit: 0,
      journal_entries: { voucher_number: 'REC-٢٠٢٦-۰۰۱' } },
    { id: '2', date: '2026-11-02', hotel_id: 'h2', hotel_name: 'الفندق ٢', account_id: 'cash', account_name: 'الصندوق ١',
      unit_number: '٢٠٢', customer_name: 'عميل تجريبي ٢', description: 'سداد ٥٠٠ ريال', amount: 500, debit: 500, credit: 0,
      journal_entries: { voucher_number: 'REC-٢٠٢٦-۰۰۲' } },
  ],
};
const render = values => renderToStaticMarkup(React.createElement(report.default, values));

test('operation description takes precedence over generic ledger line without changing totals', () => {
  const rows = [{ ...props.rows[0], description: 'سداد فاتورة',
    journal_entries: { voucher_number: 'REC-1', description: 'تم استلامها من قبل حمادة مباشرة' } }];
  const html = render({ ...props, rows, total: 1000 });
  assert(html.includes('تم استلامها من قبل حمادة مباشرة'));
  assert(!html.includes('سداد فاتورة'));
  assert(html.includes('1,000.00'));
  const fallback = render({ ...props, rows: [{ ...rows[0], journal_entries: { description: '   ' } }] });
  assert(fallback.includes('سداد فاتورة'));
  assert.equal(rows[0].amount, 1000);
});

test('all visible numbers use English digits, including references, dates, units, and notes', () => {
  const html = render(props);
  const text = html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '');
  assert(!/[٠-٩۰-۹]/.test(text));
  for (const expected of ['REC-2026-001', '01/11/2026', '1,500.00', '101', 'سداد 1000 ريال عن الحجز 123']) assert(html.includes(expected), expected);
  assert.equal(report.englishDigits('٠١٢٣٤٥٦٧٨٩ ۰۱۲۳۴۵۶۷۸۹'), '0123456789 0123456789');
});

test('cash report groups hotels, keeps full detail, and omits accounting columns', () => {
  const html = render(props);
  assert.equal((html.match(/class="rp-subtotal"/g) || []).length, 2);
  assert(html.includes('الملخص حسب الصندوق / الحساب'));
  assert(html.includes('العميل والبيان'));
  assert(html.includes('الإجمالي العام'));
  assert(!html.includes('<th class="rp-num">صرف</th>'));
  assert(html.includes('1,000.00'));
  assert(html.includes('500.00'));
});

test('accounting mode includes debit, credit, and net without changing supplied amounts', () => {
  const html = render({ ...props, accounting: true, total: 1300,
    rows: [props.rows[0], { ...props.rows[1], amount: 300, debit: 500, credit: 200 }] });
  assert(html.includes('كشف حركة الصناديق'));
  assert(html.includes('<th class="rp-num">صرف</th>'));
  assert(html.includes('1,300.00'));
  assert(html.includes('200.00'));
});

test('empty report prints an explicit empty state and a zero total', () => {
  const html = render({ ...props, rows: [], total: 0 });
  assert(html.includes('لا توجد عمليات'));
  assert(html.includes('0.00'));
});

test('document reference is reproducible and changes with report scope or amounts', () => {
  const make = (rows = props.rows, scope = props.hotelLabel, total = props.total) =>
    report.reportReference(props.startDate, props.endDate, scope, false, rows, total);
  assert.equal(make(), make([...props.rows].reverse()));
  assert.notEqual(make(), make(props.rows, 'فندق محدد'));
  assert.notEqual(make(), make(props.rows, props.hotelLabel, 1700));
  assert.match(make(), /^REC-20261101-20261102-[0-9A-F]{8}$/);
});

test('QR is a local vector with a quiet zone and carries only reference, dates and report type', () => {
  const reference = report.reportReference(props.startDate, props.endDate, props.hotelLabel, false, props.rows, props.total);
  const payload = report.reportQrPayload(reference, props.startDate, props.endDate, false);
  assert(payload.includes(reference));
  assert(payload.includes('FROM:2026-11-01'));
  assert(payload.includes('TO:2026-11-02'));
  assert(!payload.includes('1500'));
  assert(!payload.includes('عميل'));
  assert(!payload.includes('http'));
  const html = render(props);
  assert(html.includes('aria-label="رمز مرجع التقرير"'));
  assert(html.includes('shape-rendering="crispEdges"'));
  assert(/<path d="M\d+,\d+h1v1h-1z/.test(html));
  const qrSize = Number(/viewBox="0 0 (\d+) \d+"/.exec(html)[1]);
  const modules = [...html.matchAll(/M(\d+),(\d+)h1v1h-1z/g)];
  assert(modules.length > 100);
  assert(modules.every(([, x, y]) => Number(x) >= 4 && Number(y) >= 4 && Number(x) < qrSize - 4 && Number(y) < qrSize - 4));
});

test('page numbering uses the browser page counters in a named print page', () => {
  assert(report.revenuePrintStyles.includes('@page revenue-report'));
  assert(report.revenuePrintStyles.includes('counter(page, decimal)'));
  assert(report.revenuePrintStyles.includes('counter(pages, decimal)'));
  const html = render(props);
  assert(html.includes('@bottom-left { content: "REC-'));
  assert(html.includes('@bottom-right { content: "منشأة 12"; }'));
});

// Optional synthetic-data preview; never reads customer or financial records.
if (process.env.REVENUE_PRINT_PREVIEW_PATH) {
  const style = report.revenuePrintStyles.replace('@media print', '@media all');
  const html = '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>معاينة تجريبية لتقرير الإيرادات</title>' +
    '<style>body{width:192mm;margin:24px auto;font-family:Tahoma,Arial,sans-serif;background:white}' + style + '</style><body>' + render(props) + '</body></html>';
  fs.writeFileSync(process.env.REVENUE_PRINT_PREVIEW_PATH, html);
}

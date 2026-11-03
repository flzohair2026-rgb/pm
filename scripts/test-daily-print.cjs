const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(name) {
  const context = { exports: {}, require: id => id === './RevenueReportPrint' ? load('RevenueReportPrint') : require(id) };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`src/components/reports/${name}.tsx`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
  }).outputText, context);
  return context.exports;
}
const Daily = load('DailyReportPrint').default;
const props = { companyName: 'منشأة ١٢', companyLogo: null, date: '2026-11-03', hotelLabel: 'فندق ٢',
  events: [{ id: 'ev1', event_type: 'check_in', created_at: '2026-11-03T10:00:00Z', booking_id: 'b1', message: 'حجز ١٢٣' }],
  invoices: [{ id: 'i1', invoice_number: 'INV-١٢', invoice_date: '2026-11-03', total_amount: 1234.56, status: 'posted' }],
  payments: [{ id: 'p1', created_at: '2026-11-03T10:00:00Z', amount: 234.55, payment_method: { name: 'صندوق ١' }, description: 'سداد ٢٣٤' }],
  remainingRows: [{ booking_id: 'b1', unit_number: '١٠١', customer_name: 'عميل ٢', remaining: 1000.01 }],
  totals: { invoices: 1234.56, payments: 234.55, remaining: 1000.01 },
  bookingMeta: new Map([['b1', { unit: '١٠١', customer: 'عميل ٢', check_in: '2026-11-03', check_out: '2026-12-03' }]]) };
const render = p => renderToStaticMarkup(React.createElement(Daily, p));
test('daily print preserves fractional amounts and normalizes all visible digits', () => {
  const html = render(props);
  const visible = html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '');
  assert(!/[٠-٩۰-۹]/.test(visible));
  for (const value of ['1,234.56', '234.55', '1,000.01', '03/11/2026', '13:00', 'INV-12', '101']) assert(html.includes(value), value);
});
test('daily print includes all loaded invoices and payments beyond screen limits', () => {
  const invoices = Array.from({ length: 65 }, (_, i) => ({ ...props.invoices[0], id: `i${i}`, invoice_number: `FULL-${i}` }));
  const html = render({ ...props, invoices });
  assert(html.includes('FULL-64'));
  assert(html.includes('@page daily-report'));
  assert(html.includes('counter(pages, decimal)'));
  assert(html.includes('aria-label="رمز مرجع التقرير"'));
  assert(html.includes('اعتماد المحاسب'));
});
test('empty daily report prints explicit empty sections and zero totals', () => {
  const html = render({ ...props, events: [], invoices: [], payments: [], remainingRows: [], totals: { invoices: 0, payments: 0, remaining: 0 } });
  assert(html.includes('لا توجد عمليات لهذا اليوم'));
  assert(html.includes('لا توجد فواتير لهذا اليوم'));
  assert(html.includes('0.00'));
});

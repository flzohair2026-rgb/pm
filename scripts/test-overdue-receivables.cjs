const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
function compile(path, overrides = {}) {
  const m = new Module(__filename); m.paths = module.paths;
  m.require = id => id in overrides ? overrides[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, __filename);
  return m.exports;
}
const { calculateOverdueReceivables: calc, fetchOverdueReceivables } = compile('src/lib/reports/overdue-receivables.ts');
const invoice = { id: 'i1', booking_id: 'b1', customer_id: 'c1', invoice_date: '2026-10-01', due_date: '2026-10-01',
  total_amount: 9000, paid_amount: 4000, status: 'posted', customer: { full_name: 'عميل ١' } };
const booking = { id: 'b1', hotel_id: 'h1', check_in: '2026-10-01', check_out: '2026-12-30', nights: 90,
  booking_type: 'monthly', unit: { unit_number: 'F/١' } };

test('long-term customer owes only the unpaid overdue installment, excluding future rent', () => {
  const before = JSON.stringify([invoice, booking]);
  const rows = calc([invoice], [booking], '2026-11-02', null);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].total_remaining, 2000); // Remaining contract balance is 5000.
  assert.equal(rows[0].total_invoiced, 3000);
  assert.equal(rows[0].total_paid, 1000);
  assert.equal(rows[0].invoices_count, 1);
  assert.equal(rows[0].oldest_due_date, '2026-11-01');
  assert.equal(JSON.stringify([invoice, booking]), before);
  assert.equal(calc([{ ...invoice, paid_amount: 6000 }], [booking], '2026-11-02', null).length, 0);
  assert.equal(calc([{ ...invoice, paid_amount: 9000 }], [booking], '2026-11-02', null).length, 0);
});

test('today, future, draft, void, missing due dates and rounding-only balances are excluded', () => {
  const daily = { ...booking, booking_type: 'daily', nights: 2 };
  for (const changes of [{ due_date: '2026-11-02' }, { due_date: '2026-11-03' }, { due_date: null },
    { status: 'draft' }, { status: 'void' }, { invoice_date: '2026-11-03' }, { paid_amount: 8999 }]) {
    assert.equal(calc([{ ...invoice, ...changes }], [daily], '2026-11-02', null).length, 0, JSON.stringify(changes));
  }
  assert.equal(calc([invoice], [booking], '2026-11-01', null).length, 0);
});

test('daily invoices use explicit maturity, monthly dates clamp at month end and platform fees follow existing installment rules', () => {
  const daily = calc([invoice], [{ ...booking, booking_type: 'daily', nights: 2 }], '2026-11-02', null);
  assert.equal(daily[0].total_remaining, 5000);
  const clamped = calc([{ ...invoice, invoice_date: '2026-01-31', paid_amount: 3000 }],
    [{ ...booking, check_in: '2026-01-31', check_out: '2026-05-01' }], '2026-03-01', null);
  assert.equal(clamped[0].oldest_due_date, '2026-02-28');
  const platform = calc([{ ...invoice, total_amount: 9250, paid_amount: 4250, additional_services_amount: 250 }],
    [{ ...booking, booking_source: 'platform' }], '2026-11-02', null);
  assert.equal(platform[0].total_remaining, 2000);
});

test('hotel scope and independent booking payment allocation do not hide or duplicate overdue debt', () => {
  const invoices = [invoice, { ...invoice, id: 'i2', booking_id: 'b2', total_amount: 3000, paid_amount: 3000 }];
  const bookings = [booking, { ...booking, id: 'b2', hotel_id: 'h2' }];
  assert.equal(calc(invoices, bookings, '2026-11-02', 'h2').length, 0);
  assert.equal(calc(invoices, bookings, '2026-11-02', 'h1')[0].total_remaining, 2000);
  assert.equal(calc(invoices, bookings, '2026-11-02', null)[0].total_remaining, 2000);
  const unlinked = { ...invoice, id: 'u1', booking_id: null };
  assert.equal(calc([unlinked], [], '2026-11-02', 'h1').length, 0);
  assert.equal(calc([unlinked], [], '2026-11-02', null)[0].total_remaining, 5000);
});

test('fetcher traverses all invoice pages and batches booking IDs', async () => {
  const invoices = Array.from({ length: 501 }, (_, i) => ({ ...invoice, id: `i${i}`, booking_id: `b${i}` }));
  const calls = [];
  const client = { from(table) {
    const query = { table, from: 0, to: 499, ids: [] }; const b = {};
    for (const name of ['select', 'lte', 'order', 'abortSignal']) b[name] = () => b;
    b.in = (column, ids) => { if (column === 'id') query.ids = ids; return b; };
    b.range = (from, to) => { query.from = from; query.to = to; return b; };
    b.then = (resolve, reject) => {
      calls.push(query);
      return Promise.resolve({ error: null, data: table === 'invoices' ? invoices.slice(query.from, query.to + 1) :
        query.ids.map(id => ({ ...booking, id })) }).then(resolve, reject);
    };
    return b;
  } };
  const result = await fetchOverdueReceivables(client, 'h1', new AbortController().signal);
  assert.equal(calls.filter(c => c.table === 'invoices').length, 2);
  assert.equal(calls.filter(c => c.table === 'bookings').length, 6);
  assert.equal(result.rows.length, 1);
});

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const revenue = compile('src/components/reports/RevenueReportPrint.tsx');
const Print = compile('src/components/reports/ReceivablesReportPrint.tsx', { './RevenueReportPrint': revenue }).default;
const props = { companyName: 'المنشأة ١', companyLogo: null, startDate: '2026-10-01', endDate: '2026-11-02',
  hotelLabel: 'الفندق ١', overdue: true, asOf: '2026-11-02', searchText: '',
  rows: calc([invoice], [booking], '2026-11-02', null) };

test('formal print uses English digits, overdue totals, reference, QR, page counters and approvals', () => {
  const html = renderToStaticMarkup(React.createElement(Print, props));
  const visible = html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '');
  assert(!/[٠-٩۰-۹]/.test(visible));
  assert(visible.includes('تقرير المتأخرين عن السداد'));
  assert(visible.includes('2,000.00'));
  assert(!visible.includes('5,000.00'));
  assert(visible.includes('01/11/2026'));
  for (const expected of ['اعتماد المحاسب', 'اعتماد المدير', 'صادر آليًا', 'OD-20261102', 'counter(page, decimal)', 'counter(pages, decimal)', '<svg', 'receivables-report']) assert(html.includes(expected), expected);
});

test('normal report preserves supplied ledger balances and empty overdue print is explicit', () => {
  const html = renderToStaticMarkup(React.createElement(Print, { ...props, overdue: false,
    rows: [{ customer_id: 'c1', customer_name: 'عميل', invoices_count: 3, total_invoiced: 100, total_paid: 150, total_remaining: -50 }] }));
  assert(html.includes('-50.00'));
  assert(html.includes('AR-20261102'));
  assert(html.includes('01/10/2026'));
  const empty = renderToStaticMarkup(React.createElement(Print, { ...props, rows: [] }));
  assert(empty.includes('لا يوجد عملاء متأخرون'));
});

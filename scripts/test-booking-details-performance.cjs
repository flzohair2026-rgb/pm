const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function compile(source) {
  const context = { exports: {}, require };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context);
  return context.exports;
}
const { createInvoiceFinancialsLookup } = compile(fs.readFileSync('src/lib/bookings/invoice-financials.ts', 'utf8'));
const baseline = JSON.parse(fs.readFileSync('scripts/fixtures/booking-invoice-financials-baseline.json', 'utf8').replace(/^\uFEFF/, ''));
const original = compile(`export function original(invoices: any[], allocations: any[], directPayments: any[], paidAmount: number) { ${baseline.source}; return getInvoiceFinancials; }`).original;
const plain = value => JSON.parse(JSON.stringify(value));
const invoices = [
  { id: 'base', status: 'posted', total_amount: 1000.55, created_at: '2026-01-01' },
  { id: 'ext', status: 'posted', total_amount: 500.25, created_at: '2026-02-01' },
  { id: 'draft', status: 'draft', total_amount: 30.51, created_at: '2026-03-01' },
  { id: 'void', status: 'void', total_amount: 999, created_at: '2026-04-01' },
];
function compare(inv, alloc, pays, paid) {
  const before = original(inv, alloc, pays, paid);
  const after = createInvoiceFinancialsLookup(inv, alloc, pays, paid);
  for (const id of [...inv.map(i => i.id), 'missing']) assert.deepEqual(plain(after(id)), plain(before(id)), id);
}
test('balances match the frozen implementation for direct, allocated, unallocated and fractional payments', () => {
  for (const paid of [0, 0.01, 500.25, 1000.55, 1500.8, 3000, -25]) {
    compare(invoices, [], [], paid);
    compare(invoices, [], [{ id: 'p1', invoice_id: 'base', amount: 400.15 }], paid);
    compare(invoices, [{ payment_id: 'p1', invoice_id: 'base', amount: 200.05 }, { payment_id: 'p1', invoice_id: 'ext', amount: 100.1 }], [{ id: 'p1', invoice_id: 'base', amount: 400.15 }], paid);
  }
});
test('500 deterministic mixed booking snapshots keep identical financial results', () => {
  let seed = 417;
  const rand = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  for (let sample = 0; sample < 500; sample++) {
    const inv = Array.from({ length: 1 + rand(18) }, (_, i) => ({ id: `i${i}`, status: ['draft', 'posted', 'paid', 'void'][rand(4)], total_amount: rand(200000) / 100, created_at: `2026-01-${String(1 + rand(28)).padStart(2, '0')}` }));
    const pays = Array.from({ length: rand(25) }, (_, i) => ({ id: `p${i}`, invoice_id: inv[rand(inv.length)].id, amount: rand(100000) / 100 }));
    const alloc = pays.filter(() => rand(3) === 0).map(p => ({ payment_id: p.id, invoice_id: inv[rand(inv.length)].id, amount: rand(100000) / 100 }));
    compare(inv, alloc, pays, rand(1000000) / 100);
  }
});
test('unchanged snapshot reuses results; a new snapshot recomputes after payment changes', () => {
  const first = createInvoiceFinancialsLookup(invoices, [], [], 100);
  assert.equal(first('base'), first('base'));
  const next = createInvoiceFinancialsLookup(invoices, [], [], 400);
  assert.notEqual(next('base'), first('base'));
  assert.equal(next('base').paid, 400);
  assert.equal(first('base').paid, 100);
});
test('calculations leave invoice and payment input data unchanged', () => {
  const inv = invoices.map(i => Object.freeze({ ...i }));
  const allocation = Object.freeze({ invoice_id: 'base', payment_id: 'p1', amount: 15.15 });
  const payment = Object.freeze({ id: 'p1', invoice_id: 'base', amount: 15.15 });
  const snapshot = JSON.stringify([inv, allocation, payment]);
  const lookup = createInvoiceFinancialsLookup(inv, [allocation], [payment], 15.15);
  inv.forEach(i => lookup(i.id));
  assert.equal(JSON.stringify([inv, allocation, payment]), snapshot);
});
test('extension query appears once and recurring help timer is outside the booking page', () => {
  const page = fs.readFileSync('src/components/bookings/BookingDetails.tsx', 'utf8');
  assert.equal((page.match(/\.eq\('event_type', 'booking_extension_invoice_period'\)/g) || []).length, 1);
  assert(!page.includes('setHelpHintIndex'));
  assert(!page.includes('setInterval('));
  assert.equal((page.match(/<BookingHelpHint hints=\{helpHints\} \/>/g) || []).length, 2);
});

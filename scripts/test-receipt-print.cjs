const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/lib/print/receipt.ts', 'utf8');
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
function loader({ user = { id: 'user' }, profile = { role: 'receptionist' }, payment, error = null } = {}) {
  const calls = [];
  const client = { auth: { getUser: async () => ({ data: { user } }) }, from(table) {
    calls.push(table);
    const query = { select() { return query; }, eq(field, value) { calls.push([field, value]); return query; },
      async maybeSingle() { return table === 'profiles' ? { data: profile } : { data: payment, error }; } };
    return query;
  } };
  const context = { exports: {}, require(name) {
    if (name === 'server-only') return {};
    if (name === '@/lib/supabase-server') return { createClient: async () => client };
    return require(name);
  } };
  vm.runInNewContext(compile(source), context);
  return { ...context.exports, calls };
}
const payment = { id: 'receipt-id', payment_number: 'REC-0042', amount: 1234.56, payment_date: '2026-11-03T12:00:00Z',
  description: 'سداد فاتورة', invoice_id: 'invoice-id', payment_method: { name: 'تحويل بنكي' },
  customer: { full_name: 'عميل تجريبي', national_id: '1000000000', phone: '0500000000', nationality: 'السعودية' },
  invoice: { invoice_number: 'INV-42', booking: { unit: { unit_type: { hotel: { name: 'فندق تجريبي', address: 'الرياض', cr_number: '1234567890' } } } } } };

test('receipt keeps the exact payment, identity, invoice, amount and method', async () => {
  const api = loader({ payment });
  const result = await api.loadReceipt('receipt-id');
  assert.equal(result.amount, 1234.56);
  assert.equal(result.voucherNumber, payment.payment_number);
  assert.equal(result.invoiceNumber, 'INV-42');
  assert.equal(result.customer.nationalId, payment.customer.national_id);
  assert.equal(result.paymentMethod, 'تحويل بنكي');
  assert.equal(result.hotel.cr, '1234567890');
  assert.ok(api.calls.some(call => Array.isArray(call) && call[0] === 'id' && call[1] === 'receipt-id'));
});
test('unauthenticated, missing profiles and disallowed roles cannot load payments', async () => {
  for (const config of [{ user: null }, { profile: null }, { profile: { role: 'housekeeping' } }]) {
    const api = loader({ ...config, payment });
    await assert.rejects(api.loadReceipt('receipt-id'));
    assert.ok(!api.calls.includes('payments'));
  }
});
test('missing and failed payment queries do not produce a fabricated receipt', async () => {
  await assert.rejects(loader({ payment: null }).loadReceipt('missing'), error => error.status === 404);
  await assert.rejects(loader({ payment: null, error: { message: 'database unavailable' } }).loadReceipt('failed'));
});
test('advance receipt and zero/halala payments preserve existing values', async () => {
  for (const amount of [0, 0.01, 99.99, 3500, 1000000.25]) {
    const result = await loader({ payment: { ...payment, amount, invoice: null, invoice_id: null, description: 'عربون' } }).loadReceipt(payment.id);
    assert.equal(result.amount, amount);
    assert.equal(result.operationType, 'عربون / دفعة مقدمة');
    assert.ok(result.amountWords.includes('ريال سعودي'));
    assert.equal(result.invoiceNumber, '');
  }
});

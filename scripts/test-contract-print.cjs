const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { createLoader, booking, invoices, compile } = require('./helpers/contract-print-fixtures.cjs');
const fixture = JSON.parse(fs.readFileSync('scripts/fixtures/contract-print-baseline.json', 'utf8'));
const loaderSource = fs.readFileSync('src/lib/print/contract.ts', 'utf8');
const documentSource = fs.readFileSync('src/components/print/ContractDocument.tsx', 'utf8');
const normalize = text => {
  const source = ts.createSourceFile('source.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return ts.createPrinter({ removeComments: true }).printFile(source);
};
test('all original contract conditions and financial markup are preserved', () => {
  assert.deepEqual(Array.from(documentSource.matchAll(/<li>(.*?)<\/li>/gs), match => match[1]), fixture.terms);
  assert.ok(documentSource.replace(/\r\n/g, '\n').includes(fixture.financialMarkup.replace(/\r\n/g, '\n')));
});
test('calculation statements are identical to the frozen contract implementation', () => {
  const current = loaderSource.slice(loaderSource.indexOf('  const today ='), loaderSource.indexOf('  let depositAmountFromVouchers:'));
  const old = fixture.calculations.split('\n').filter(line => !line.includes('const extensionInvoices =') && !line.includes('const extensionInvoiceNumbers =')).join('\n');
  assert.equal(normalize(current), normalize(old));
});
test('daily, monthly and annual data preserve calculated financial and duration results', async () => {
  const helper = loaderSource.slice(loaderSource.indexOf('const parseDbDate'), loaderSource.indexOf('export class ContractLoadError'));
  const fields = ['monthlyRent','invoiceSubtotal','invoiceDiscount','invoiceAdditionalServices','computedInvoiceTotal','periodStart','periodEnd','isAnnualContract','yearlyRent','monthsTotalContract','rentUnitAmountFromInvoice','isCustomSubtotal','totalRent','termLabel','durationText'];
  const context = { exports: {}, require };
  vm.runInNewContext(compile(`import {format,differenceInYears,differenceInMonths,differenceInCalendarDays,addMonths} from 'date-fns';import {ar} from 'date-fns/locale';${helper}\nexport function original(booking:any,invoices:any[]){${fixture.calculations}; return {${fields.join(',')}};}`), context);
  for (const [kind, end] of [['daily','2026-11-08'],['monthly','2026-12-03'],['yearly','2027-11-03']]) {
    for (const discount of [0, 50.25, 3500]) {
      const row = { ...booking, booking_type: kind, check_out: end };
      const inv = [{ ...invoices[0], discount_amount: discount, total_amount: 3500 - discount + 25 },
        { ...invoices[0], id: 'extension', invoice_number: 'INV-EXT-1', subtotal: 125.55, discount_amount: 0, total_amount: 150.55 },
        { ...invoices[0], id: 'void', status: 'void', total_amount: 999999 }];
      const result = await createLoader({ booking: row, invoices: inv }).loadContract(row.id);
      const expected = context.exports.original(row, inv);
      for (const field of fields) assert.equal(result[field], expected[field], `${kind}: ${field}`);
    }
  }
});
test('deposit receipts and legacy fallback retain insurance amounts and source', async () => {
  const result = await createLoader({ booking, invoices, deposits: [{ amount: 500 }, { amount: 200.5 }, { amount: -1 }],
    source: { payload: { booking_source: 'platform', platform_name: 'منصة تجريبية' } } }).loadContract(booking.id);
  assert.equal(result.depositAmount, 701);
  assert.equal(result.bookingSourceLabel, 'منصة حجز: منصة تجريبية');
  const legacy = await createLoader({ booking, insuranceError: true, insuranceEvents: [{ payload: { voucher_type: 'deposit_receipt', amount: 400 } }, { payload: { voucher_type: 'deposit_refund', amount: 150 } }] }).loadContract(booking.id);
  assert.equal(legacy.depositAmount, 400);
});
test('unauthenticated and disallowed users cannot load contract data', async () => {
  for (const config of [{ noUser: true }, { noProfile: true }, { role: 'housekeeping' }]) {
    const api = createLoader({ ...config, booking });
    await assert.rejects(api.loadContract(booking.id));
    assert.ok(!api.calls.includes('bookings'));
  }
});
test('missing booking and failed required queries do not generate incomplete contracts', async () => {
  await assert.rejects(createLoader().loadContract('missing'), error => error.status === 404);
  await assert.rejects(createLoader({ booking, invoicesError: true }).loadContract(booking.id));
});

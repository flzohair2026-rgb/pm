const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
function createLoader(config = {}) {
  const calls = [];
  const client = { auth: { getUser: async () => ({ data: { user: config.noUser ? null : { id: 'user-id' } } }) }, from(table) {
    calls.push(table);
    const filters = {};
    const result = () => {
      if (table === 'profiles') return { data: config.noProfile ? null : { role: config.role || 'receptionist' } };
      if (table === 'bookings') return { data: config.booking || null, error: config.bookingError || null };
      if (table === 'invoices') return { data: config.invoices || [], error: config.invoicesError || null };
      if (table === 'insurance_vouchers') return { data: config.deposits || [], error: config.insuranceError || null };
      if (filters.event_type === 'contract_terminated') return { data: config.terminationEvent || null };
      if (filters.event_type === 'booking_source') return { data: config.source || null };
      if (filters.event_type === 'insurance_voucher') return { data: config.insuranceEvents || [] };
      throw new Error(`Unexpected query: ${table}`);
    };
    const query = { select() { return query; }, eq(key, value) { filters[key] = value; return query; },
      order() { return query; }, limit() { return query; }, maybeSingle: async () => result(),
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); } };
    return query;
  } };
  const context = { exports: {}, require(name) {
    if (name === 'server-only') return {};
    if (name === '@/lib/supabase-server') return { createClient: async () => client };
    return require(name);
  } };
  vm.runInNewContext(compile(fs.readFileSync('src/lib/print/contract.ts', 'utf8')), context);
  return { ...context.exports, calls };
}
const booking = { id: '00000000-0000-0000-0000-000000000042', booking_type: 'monthly', check_in: '2026-11-03', check_out: '2026-12-03',
  subtotal: 3500, discount_amount: 50, additional_services: [{ amount: 25 }], total_price: 3475,
  customer: { full_name: 'عميل تجريبي لفحص طباعة العقد', national_id: '1000000000', nationality: 'السعودية', phone: '0500000000', details: 'نوع الوثيقة: هوية وطنية\nعدد المرافقين: 2' },
  unit: { unit_number: 'D2/#3', floor: 2, unit_type: { name: 'غرفة وصالة', annual_price: 42000, daily_price: 150, description: 'وحدة سكنية مفروشة' } } };
const invoices = [{ id: 'invoice-id', invoice_number: 'INV-0042', status: 'posted', subtotal: 3500, discount_amount: 50, additional_services_amount: 25, total_amount: 3475 }];
module.exports = { createLoader, booking, invoices, compile };

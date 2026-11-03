const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
const registerContext = { exports: {}, URLSearchParams, Date, Number };
vm.runInNewContext(compile(fs.readFileSync('src/lib/bookings/register.ts', 'utf8')), registerContext);
const register = registerContext.exports;
const compiled = compile(fs.readFileSync('src/components/bookings/BookingsListTable.tsx', 'utf8'));
const plain = value => JSON.parse(JSON.stringify(value));
function page(id = 'b1', total = 12) {
  return { rows: [{ booking: { id, created_at: '2026-11-03T10:00:00Z', status: 'confirmed', booking_type: 'monthly', check_in: '2026-11-01', check_out: '2026-12-01', total_price: 123.45, customer: { full_name: id, phone: '0500000000' }, unit: { unit_number: '101', unit_type: { name: 'Studio' } } }, amount: 123.45, hasKey: false, hasEjarUpload: false, hasAdditionalServices: false, ejar: null }], totalCount: total, hasNext: true, hasPrevious: false, nextCursor: { id, created_at: '2026-11-03T10:00:00Z' }, previousCursor: { id, created_at: '2026-11-03T10:00:00Z' } };
}
function harness(initial = {}) {
  const hooks = [], requests = [], timers = new Map();
  let cursor = 0, pending = [], dirty = false, tree, disposed = false, timerId = 0, clock = 0, lateWrites = 0;
  let props = { selectedHotelId: 'hotel-a', pageSize: 5, ...initial };
  const changed = (a,b) => !a || !b || a.length !== b.length || a.some((v,i) => !Object.is(v,b[i]));
  const react = {
    useState(initial) { const i = cursor++; if (!hooks[i]) hooks[i] = { value: typeof initial === 'function' ? initial() : initial }; return [hooks[i].value, value => { if (disposed) { lateWrites++; return; } const next = typeof value === 'function' ? value(hooks[i].value) : value; if (!Object.is(next,hooks[i].value)) { hooks[i].value = next; dirty = true; } }]; },
    useRef(initial) { return hooks[cursor++] ||= { current: initial }; },
    useMemo(fn,deps) { const i = cursor++; if (!hooks[i] || changed(hooks[i].deps,deps)) hooks[i] = { value: fn(), deps }; return hooks[i].value; },
    useCallback(fn,deps) { return react.useMemo(() => fn, deps); },
    useEffect(create,deps) { const i = cursor++; if (!hooks[i] || changed(hooks[i].deps,deps)) { const old = hooks[i]; hooks[i] = { deps, create, cleanup: old?.cleanup, effect: true }; pending.push(hooks[i]); } },
  };
  const noop = () => {};
  const jsx = (type,props,key) => ({ type, props: props || {}, key });
  const location = { pathname: '/bookings-list', search: '' };
  const listeners = {};
  const window = { location, history: { state: {}, replaceState(state,title,url) { const parsed = new URL(url,'https://example.test'); location.pathname = parsed.pathname; location.search = parsed.search; } }, addEventListener: (event,fn) => { listeners[event] = fn; }, removeEventListener: event => { delete listeners[event]; }, setTimeout(fn,delay) { const id = ++timerId; timers.set(id,{ fn, at: clock + delay }); return id; }, clearTimeout(id) { timers.delete(id); } };
  const context = { exports: {}, AbortController, URLSearchParams, Date, Map, Set, Number, Math, Promise, window,
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
      if (name === '@/lib/bookings/register') return register;
      if (name === '@/lib/supabase') return { supabase: { rpc(name,args) { assert.equal(name,'get_bookings_register_page'); const request = { args }; const promise = new Promise(resolve => { request.resolve = resolve; }); requests.push(request); return { abortSignal(signal) { request.signal = signal; return promise; } }; } } };
      if (name === 'next/link') return 'Link';
      if (name.includes('BookingQuickView')) return 'BookingQuickView';
      if (name.includes('ConfirmBookingButton')) return 'ConfirmBookingButton';
      if (name === 'lucide-react') return new Proxy({}, { get: (_,name) => name });
      return require(name);
    },
  };
  vm.runInNewContext(compiled, context);
  function flush() { let count = 0; do { if (++count > 30) throw new Error('Render loop'); dirty = false; cursor = 0; tree = context.exports.default(props); const effects = pending; pending = []; effects.forEach(e => { e.cleanup?.(); e.cleanup = e.create(); }); } while (dirty); }
  async function settle() { for (let i = 0; i < 12; i++) { await Promise.resolve(); if (dirty) flush(); } }
  function nodes() { const result = []; const walk = n => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) { n.forEach(walk); return; } if ('type' in n) { result.push(n); walk(n.props.children); } }; walk(tree); return result; }
  const text = () => { const walk = n => typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(walk).join(' ') : n && typeof n === 'object' ? walk(n.props?.children) : ''; return walk(tree); };
  const button = label => nodes().find(n => n.type === 'button' && n.props.children === label);
  flush();
  return { requests, nodes, text, window, button, settle,
    busy: () => nodes().some(n => n.props['aria-busy'] === true),
    query: value => nodes().find(n => n.type === 'input').props.onChange({ target: { value } }),
    status: value => nodes().find(n => n.type === 'select' && n.props.children?.some?.(o => o?.props?.value === 'active')).props.onChange({ target: { value } }),
    async advance(ms) { const end = clock + ms; while (true) { const next = [...timers].filter(([,t]) => t.at <= end).sort((a,b) => a[1].at-b[1].at)[0]; if (!next) break; clock = next[1].at; timers.delete(next[0]); next[1].fn(); await settle(); } clock = end; await settle(); },
    flush, update(next) { props = { ...props, ...next }; flush(); },
    unmount() { disposed = true; hooks.filter(h => h?.effect).forEach(h => h.cleanup?.()); },
    get lateWrites() { return lateWrites; },
  };
}
test('server-supplied first page needs no hydration request; selecting the current filter cannot leave loading stuck', async () => {
  const h = harness({ initialPage: page() });
  assert.equal(h.requests.length,0);
  h.button('الكل').props.onClick(); await h.settle();
  assert.equal(h.requests.length,0); assert.equal(h.busy(),false);
  h.unmount();
});
test('initial client load is one RPC and preserves invoice totals', async () => {
  const h = harness(); assert.equal(h.requests.length,1);
  h.requests[0].resolve({ data: page(), error: null }); await h.settle();
  assert(h.text().includes((123.45).toLocaleString())); assert.equal(h.busy(),false);
  h.unmount();
});
test('typing is debounced and stale responses cannot replace newer search results', async () => {
  const h = harness();
  h.query('a'); await h.settle(); h.query('ab'); await h.settle(); await h.advance(299);
  assert.equal(h.requests.length,1); assert.equal(h.requests[0].signal.aborted,true);
  await h.advance(1); assert.equal(h.requests.length,2); assert.equal(h.requests[1].args.p_filters.q,'ab');
  h.requests[1].resolve({ data: page('new-result'), error: null }); await h.settle();
  h.requests[0].resolve({ data: page('old-result'), error: null }); await h.settle();
  assert(h.text().includes('new-result')); assert(!h.text().includes('old-result')); assert.equal(h.busy(),false);
  h.unmount();
});
test('filter state, URL and RPC use the same values; special characters are parameters', async () => {
  const h = harness({ initialPage: page() });
  h.status('checked_in'); await h.settle();
  assert.equal(h.requests[0].args.p_filters.status,'checked_in');
  assert(h.window.location.search.includes('status=checked_in'));
  h.query('name,(x)%_'); await h.settle(); await h.advance(300);
  assert.equal(h.requests.at(-1).args.p_filters.q,'name,(x)%_');
  h.unmount();
});
test('next and previous use cursors and skip repeated exact counts', async () => {
  const h = harness({ initialPage: page() });
  h.button('التالي').props.onClick(); await h.settle();
  assert.deepEqual(plain(h.requests[0].args.p_cursor),page().nextCursor); assert.equal(h.requests[0].args.p_include_count,false);
  h.requests[0].resolve({ data: { ...page('b2',null), hasPrevious: true }, error: null }); await h.settle();
  h.button('السابق').props.onClick(); await h.settle();
  assert.equal(h.requests[1].args.p_direction,'previous'); assert.equal(h.requests[1].args.p_include_count,false);
  h.unmount();
});
test('timeout ends loading and retry starts a fresh request', async () => {
  const h = harness(); await h.advance(15000);
  assert.equal(h.busy(),false); assert(h.text().includes('أطول من المعتاد'));
  h.button('إعادة المحاولة').props.onClick(); await h.settle();
  assert.equal(h.requests.length,2);
  h.requests[1].resolve({ data: page('recovered'), error: null }); await h.settle();
  assert(h.text().includes('recovered')); h.unmount();
});
test('incomplete metadata produces an explicit error, never a false empty result', async () => {
  const h = harness(); h.requests[0].resolve({ data: { rows: [] }, error: null }); await h.settle();
  assert(h.text().includes('تعذر تحميل')); assert(!h.text().includes('لا توجد حجوزات مطابقة')); h.unmount();
});
test('a hotel change immediately hides prior hotel results and stale responses are discarded', async () => {
  const h = harness(); h.update({ selectedHotelId: 'hotel-b' });
  assert.equal(h.requests.length,2); assert.equal(h.requests[1].args.p_filters.hotel,'hotel-b');
  h.requests[1].resolve({ data: page('hotel-b-guest'), error: null }); await h.settle();
  h.requests[0].resolve({ data: page('hotel-a-guest'), error: null }); await h.settle();
  assert(h.text().includes('hotel-b-guest')); assert(!h.text().includes('hotel-a-guest')); h.unmount();
});
test('unmount cancels the request and never writes later state', async () => {
  const h = harness(); h.unmount(); assert.equal(h.requests[0].signal.aborted,true);
  h.requests[0].resolve({ data: page(), error: null }); await h.settle(); assert.equal(h.lateWrites,0);
});
test('filter normalization validates dates and preserves Unicode searches', () => {
  const filters = register.normalizeRegisterFilters({ status:'invalid', type:'monthly', arrival:'2026-02-30', departure:'2026-11-03', q:'  فندق، ١٢  ', contract:'none' });
  assert.equal(filters.status,'all'); assert.equal(filters.type,'monthly'); assert.equal(filters.arrival,''); assert.equal(filters.q,'فندق، ١٢');
  assert.equal(register.normalizeRegisterFilters({q:'x'.repeat(300)}).q.length,200);
});

test('an emptied cursor page recovers to the first page with a fresh count', async () => {
  const h = harness({ initialPage: page() });
  h.button('التالي').props.onClick(); await h.settle();
  h.requests[0].resolve({ data: { rows: [], totalCount: null, hasNext: false, hasPrevious: true, nextCursor: null, previousCursor: null }, error: null }); await h.settle();
  assert.equal(h.requests.length,2);
  assert.equal(h.requests[1].args.p_cursor,null);
  assert.equal(h.requests[1].args.p_include_count,true);
  h.requests[1].resolve({ data: page('recovered-first'), error: null }); await h.settle();
  assert(h.text().includes('recovered-first')); assert.equal(h.busy(),false); h.unmount();
});

test('clearing a search before debounce completes cannot leave the table loading forever', async () => {
  const h = harness({ initialPage: page() });
  h.query('temporary'); await h.settle(); h.query(''); await h.settle();
  await h.advance(300);
  assert.equal(h.requests.length,1); assert.equal(h.requests[0].args.p_filters.q,'');
  h.requests[0].resolve({ data: page('restored'), error: null }); await h.settle();
  assert.equal(h.busy(),false); assert(h.text().includes('restored')); h.unmount();
});

test('first load uses one authenticated RPC without redundant identity/profile requests', () => {
  const source = fs.readFileSync('src/app/(app)/(main)/bookings-list/page.tsx','utf8');
  assert.equal((source.match(/supabase\.rpc\(/g) || []).length,1);
  assert(!source.includes('supabase.auth.getUser'));
  assert(!source.includes(".from('profiles')"));
  assert(source.includes('initialPage={initialPage}'));
});

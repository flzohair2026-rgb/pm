// Run with: node --test scripts/test-room-status-loading.cjs
// Exercises the actual component with controlled hooks, deferred RPC responses,
// and fake timers. No server, credentials, browser, or database writes required.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const filename = 'src/components/dashboard/RoomStatusWithDate.tsx';
const source = fs.readFileSync(filename, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;

function snapshot(date, guest = 'Complete guest') {
  const checkout = new Date(`${date}T12:00:00`);
  checkout.setDate(checkout.getDate() + 5);
  const checkOut = `${checkout.getFullYear()}-${String(checkout.getMonth() + 1).padStart(2, '0')}-${String(checkout.getDate()).padStart(2, '0')}`;
  return {
    ok: true,
    units: [{ id: 'u1', unit_number: '101', unit_type_id: 't1', status: 'occupied' }],
    unit_types: [{ id: 't1', name: 'Studio', annual_price: 12000 }],
    active: [{ id: 'b1', unit_id: 'u1', status: 'checked_in', check_in: date, check_out: checkOut,
      booking_type: 'yearly', nights: 360, total_price: 12000, customers: { full_name: guest, phone: '0500000000' } }],
    arrivals: [], departures: [], overdue: [], upcoming: [], checked_out: [], temporary_reservations: [],
    unpaid_invoices: [], invoice_totals: [{ booking_id: 'b1', total_invoiced: 12000, total_paid: 200 }],
  };
}

function harness() {
  const hooks = [], requests = [], timers = new Map();
  let props = { initialUnits: [{ id: 'u1', unit_number: '101', status: 'occupied', booking_id: 'b1', guest_name: 'Summary guest' }], hotelId: 'hotel-a' };
  let cursor = 0, dirty = false, pending = [], tree, timerId = 0, disposed = false, writesAfterUnmount = 0;
  const changed = (a, b) => !a || !b || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!hooks[i]) hooks[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [hooks[i].value, value => {
        if (disposed) { writesAfterUnmount++; return; }
        const next = typeof value === 'function' ? value(hooks[i].value) : value;
        if (!Object.is(next, hooks[i].value)) { hooks[i].value = next; dirty = true; }
      }];
    },
    useRef(initial) { const i = cursor++; return (hooks[i] ||= { current: initial }); },
    useMemo(fn, deps) {
      const i = cursor++;
      if (!hooks[i] || changed(hooks[i].deps, deps)) hooks[i] = { value: fn(), deps };
      return hooks[i].value;
    },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(create, deps) {
      const i = cursor++;
      if (!hooks[i] || changed(hooks[i].deps, deps)) {
        const previous = hooks[i];
        hooks[i] = { deps, create, cleanup: previous?.cleanup, effect: true };
        pending.push(hooks[i]);
      }
    },
  };
  const channel = { on() { return this; }, subscribe() { return this; } };
  const db = {
    rpc(name, args) {
      assert.equal(name, 'get_room_status_snapshot');
      const request = { args };
      const promise = new Promise(resolve => { request.resolve = resolve; });
      requests.push(request);
      return { abortSignal(signal) { request.signal = signal; return promise; } };
    },
    channel() { return channel; }, removeChannel() {},
    from() {
      const query = { select() { return this; }, gte() { return this; }, lte() { return this; },
        then(resolve, reject) { return Promise.resolve({ data: [] }).then(resolve, reject); } };
      return query;
    },
  };
  const noop = () => {};
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const context = {
    exports: {}, AbortController, Date, Map, Set, URL, Number, Math,
    console: { error: noop, info: noop },
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    document: { addEventListener: noop, removeEventListener: noop, visibilityState: 'hidden' },
    window: { addEventListener: noop, removeEventListener: noop },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
      if (name === '@/lib/supabase') return { supabase: db };
      if (name === '@/lib/utils') return { cn: (...args) => args.filter(Boolean).join(' ') };
      if (name === '@/lib/dashboard-performance') return { measureDashboard: () => ({ mark: noop, finish: noop }) };
      if (name === './RoomStatusGrid') return { RoomStatusGrid: 'RoomStatusGrid' };
      if (name === 'html2canvas') return noop;
      if (name === 'jspdf') return { jsPDF: noop };
      return require(name);
    },
  };
  vm.runInNewContext(compiled, context, { filename });
  function flush() {
    let count = 0;
    do {
      if (++count > 30) throw new Error('Render loop');
      dirty = false; cursor = 0; pending = [];
      tree = context.exports.default(props);
      for (const effect of pending) effect.cleanup?.();
      for (const effect of pending) effect.cleanup = effect.create();
    } while (dirty);
  }
  function nodes() {
    const found = [];
    function walk(node) {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (node?.props) { found.push(node); walk(node.props.children); }
    }
    walk(tree); return found;
  }
  async function settle() {
    for (let i = 0; i < 8; i++) { await new Promise(setImmediate); if (dirty) flush(); }
  }
  flush();
  return {
    requests, nodes, settle,
    grid: () => nodes().find(n => n.type === 'RoomStatusGrid').props,
    busy: () => nodes().find(n => 'aria-busy' in n.props).props['aria-busy'],
    update(next) { props = { ...props, ...next }; flush(); },
    chooseDate(date) { nodes().find(n => n.props['data-date'] === date).props.onClick(); flush(); },
    retry() { nodes().find(n => n.type === 'button' && n.props.children?.[1] === 'إعادة المحاولة').props.onClick(); flush(); },
    timeout() { const timer = [...timers.values()].find(t => t.delay === 20000); assert(timer); timer.fn(); },
    replayEffects() {
      const effects = hooks.filter(h => h?.effect);
      for (const effect of effects) effect.cleanup?.();
      for (const effect of effects) effect.cleanup = effect.create();
      if (dirty) flush();
    },
    unmount() { for (const h of hooks) if (h?.effect) h.cleanup?.(); disposed = true; },
    writesAfterUnmount: () => writesAfterUnmount,
  };
}

test('first mount loads complete fields even when server summary already has a booking and guest', async () => {
  const h = harness();
  assert.equal(h.requests.length, 1);
  assert.equal(h.grid().units.length, 0);
  assert.equal(h.busy(), true);
  h.requests[0].resolve({ data: snapshot(h.requests[0].args.p_date), error: null });
  await h.settle();
  const room = h.grid().units[0];
  assert.equal(room.guest_name, 'Complete guest');
  assert.equal(room.remaining_days, 5);
  assert.equal(room.payment_invoice_total, 12000);
  assert.equal(room.payment_invoice_paid, 200);
  assert.equal(room.payment_invoice_remaining, 11800);
  assert(room.booking_check_out);
  assert.equal(h.busy(), false);
  h.unmount();
});

test('late response cannot overwrite a newer date or clear its loading state', async () => {
  const h = harness(), first = h.requests[0];
  const date = h.nodes().filter(n => n.props['data-date']).map(n => n.props['data-date']).find(d => d !== first.args.p_date);
  h.chooseDate(date);
  const second = h.requests[1];
  assert(first.signal.aborted);
  first.resolve({ data: snapshot(first.args.p_date, 'Old response'), error: null });
  await h.settle();
  assert.equal(h.grid().units.length, 0);
  assert.equal(h.busy(), true);
  second.resolve({ data: snapshot(date, 'Selected date'), error: null });
  await h.settle();
  assert.equal(h.grid().units[0].guest_name, 'Selected date');
  assert.equal(h.grid().units[0].remaining_days, 5);
  assert.equal(h.grid().selectedDate, date);
  h.unmount();
});

test('server refresh with unchanged first ID and row count cannot replace detailed rooms with summary data', async () => {
  const h = harness();
  h.requests[0].resolve({ data: snapshot(h.requests[0].args.p_date), error: null });
  await h.settle();
  h.update({ initialUnits: [{ id: 'u1', unit_number: '101', status: 'occupied', guest_name: 'Summary again' }] });
  assert.equal(h.grid().units[0].guest_name, 'Complete guest');
  assert.equal(h.grid().units[0].remaining_days, 5);
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve({ data: snapshot(h.requests[1].args.p_date, 'Refreshed details'), error: null });
  await h.settle();
  assert.equal(h.grid().units[0].guest_name, 'Refreshed details');
  h.unmount();
});

test('switching hotels hides previous rooms and accepts a valid empty snapshot', async () => {
  const h = harness();
  h.requests[0].resolve({ data: snapshot(h.requests[0].args.p_date), error: null });
  await h.settle();
  h.update({ hotelId: 'hotel-b' });
  assert.equal(h.grid().units.length, 0);
  assert.equal(h.requests[1].args.p_hotel_id, 'hotel-b');
  const empty = snapshot(h.requests[1].args.p_date); empty.units = [];
  h.requests[1].resolve({ data: empty, error: null });
  await h.settle();
  assert.equal(h.grid().units.length, 0);
  assert.equal(h.busy(), false);
  h.unmount();
});

test('transient failure retries once; persistent failure exposes retry and recovers', async () => {
  const h = harness();
  h.requests[0].resolve({ data: null, error: { message: 'Network unavailable' } });
  await h.settle();
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve({ data: null, error: { message: 'Still unavailable' } });
  await h.settle();
  assert.equal(h.busy(), false);
  assert.equal(h.grid().units.length, 0);
  h.retry();
  assert.equal(h.requests.length, 3);
  h.requests[2].resolve({ data: snapshot(h.requests[2].args.p_date), error: null });
  await h.settle();
  assert.equal(h.grid().units[0].guest_name, 'Complete guest');
  h.unmount();
});

test('an incomplete snapshot is rejected instead of silently displaying partial details', async () => {
  const h = harness();
  const incomplete = snapshot(h.requests[0].args.p_date); delete incomplete.invoice_totals;
  h.requests[0].resolve({ data: incomplete, error: null });
  await h.settle();
  assert.equal(h.grid().units.length, 0);
  assert.equal(h.busy(), false);
  h.retry();
  assert.equal(h.requests.length, 2);
  h.unmount();
});

test('React Strict Mode effect replay cancels the first request and starts a working replacement', async () => {
  const h = harness(), first = h.requests[0];
  h.replayEffects();
  assert(first.signal.aborted);
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve({ data: snapshot(h.requests[1].args.p_date), error: null });
  await h.settle();
  first.resolve({ data: snapshot(first.args.p_date, 'Cancelled'), error: null });
  await h.settle();
  assert.equal(h.grid().units[0].guest_name, 'Complete guest');
  h.unmount();
});

test('unmount cancels pending requests and prevents later state writes', async () => {
  const h = harness(), request = h.requests[0];
  h.unmount();
  assert(request.signal.aborted);
  request.resolve({ data: snapshot(request.args.p_date), error: null });
  await h.settle();
  assert.equal(h.writesAfterUnmount(), 0);
});

test('timeout ends loading and allows a manual retry', async () => {
  const h = harness(), request = h.requests[0];
  h.timeout();
  assert(request.signal.aborted);
  request.resolve({ data: null, error: { message: 'Aborted' } });
  await h.settle();
  assert.equal(h.busy(), false);
  h.retry();
  assert.equal(h.requests.length, 2);
  h.unmount();
});

test('the automatic retry can recover a transient failure without user interaction', async () => {
  const h = harness();
  h.requests[0].resolve({ data: null, error: { message: 'Temporary network failure' } });
  await h.settle();
  h.requests[1].resolve({ data: snapshot(h.requests[1].args.p_date), error: null });
  await h.settle();
  assert.equal(h.grid().units[0].remaining_days, 5);
  assert.equal(h.busy(), false);
  h.unmount();
});

test('changing display filters does not reload or discard complete fields', async () => {
  const h = harness();
  h.requests[0].resolve({ data: snapshot(h.requests[0].args.p_date), error: null });
  await h.settle();
  const typeSelect = h.nodes().find(n => n.type === 'select' && n.props.value === 'all');
  typeSelect.props.onChange({ target: { value: 't1' } });
  await h.settle();
  assert.equal(h.grid().units[0].remaining_days, 5);
  assert.equal(h.grid().units[0].payment_invoice_remaining, 11800);
  const grace = h.nodes().find(n => n.type === 'button' && n.props.title?.startsWith('مهلة التمديد'));
  grace.props.onClick();
  await h.settle();
  assert.equal(h.grid().units.length, 1);
  assert.equal(h.requests.length, 1);
  h.unmount();
});

test('failed same-date refresh preserves complete data and makes its failure explicit', async () => {
  const h = harness();
  h.requests[0].resolve({ data: snapshot(h.requests[0].args.p_date), error: null });
  await h.settle();
  h.update({ initialUnits: [{ id: 'u1', unit_number: '101', status: 'occupied', guest_name: 'Incomplete' }] });
  h.requests[1].resolve({ data: null, error: { message: 'Offline' } });
  await h.settle();
  h.requests[2].resolve({ data: null, error: { message: 'Offline' } });
  await h.settle();
  assert.equal(h.grid().units[0].guest_name, 'Complete guest');
  assert.equal(h.grid().units[0].remaining_days, 5);
  assert(h.nodes().some(n => n.type === 'button' && n.props.children?.[1] === 'إعادة المحاولة'));
  assert.equal(h.busy(), false);
  h.unmount();
});

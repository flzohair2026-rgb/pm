// Run with: node --test scripts/test-dashboard-revenue-period.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/app/(app)/(main)/page.tsx', 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map();
let calculation;
function visit(node) {
  if (ts.isVariableDeclaration(node) && ['todayStr', 'startOfMonthStr', 'endOfMonthExclusiveStr'].includes(node.name.getText(ast))) {
    declarations.set(node.name.getText(ast), node.getText(ast));
  }
  if (ts.isBinaryExpression(node) && node.left.getText(ast) === 'totalRevenue' && node.right.getText(ast).startsWith('(hotelRevenueRes.monthData')) {
    calculation = node.getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.equal(declarations.size, 3);
assert(calculation);

test('Riyadh month boundaries survive timezone differences, midnight, leap years, and year rollover', () => {
  const originalTimezone = process.env.TZ;
  try {
    for (const timezone of ['UTC', 'Asia/Riyadh', 'America/Los_Angeles']) {
      process.env.TZ = timezone;
      for (const [instant, start, end] of [
        ['2026-11-02T12:00:00+03:00', '2026-11-01', '2026-12-01'],
        ['2026-10-31T20:59:59Z', '2026-10-01', '2026-11-01'],
        ['2026-10-31T21:00:00Z', '2026-11-01', '2026-12-01'],
        ['2026-12-31T22:00:00Z', '2027-01-01', '2027-02-01'],
        ['2026-12-15T12:00:00Z', '2026-12-01', '2027-01-01'],
        ['2024-02-29T12:00:00Z', '2024-02-01', '2024-03-01'],
      ]) {
        class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [instant])); } }
        const context = { Date: FixedDate };
        const code = [...declarations.values()].map(value => `const ${value};`).join('\n');
        vm.runInNewContext(ts.transpile(`${code}\nglobalThis.bounds = [startOfMonthStr, endOfMonthExclusiveStr];`, { target: ts.ScriptTarget.ES2020 }), context);
        assert.equal(context.bounds[0], start, `${timezone}: ${instant}`);
        assert.equal(context.bounds[1], end, `${timezone}: ${instant}`);
      }
    }
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test('monthly card excludes both previous-month and next-month payments returned by the RPC', () => {
  const context = {
    startOfMonthStr: '2026-11-01', endOfMonthExclusiveStr: '2026-12-01',
    hotelRevenueRes: { monthData: [
      { payment_date: '2026-10-31', amount: 10000 },
      { payment_date: '2026-11-01', amount: '9600' },
      { payment_date: '2026-12-01', amount: 20000 },
    ] },
  };
  vm.runInNewContext(ts.transpile(`let totalRevenue; ${calculation}; globalThis.total = totalRevenue;`, { target: ts.ScriptTarget.ES2020 }), context);
  assert.equal(context.total, 9600);
});

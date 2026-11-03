const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const ExcelJS = require('exceljs');
const compiled = new Module(__filename);
compiled._compile(ts.transpileModule(fs.readFileSync('src/lib/reports/revenue-excel.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText, __filename);
const populate = compiled.exports.populateRevenueWorkbook;
const fixture = {
  companyName: 'منشأة ١٢', startDate: '2026-10-01', endDate: '2026-10-31', hotelLabel: 'كل الفنادق', accounting: false,
  rows: [
    { id: 'line-1', date: '2026-10-25', hotel_name: 'فندق ١', unit_number: 'F/١', unit_account_code: '٠٠٤٥٠٠٠٦',
      customer_name: 'عميل ١', description: 'سداد فاتورة', account_name: 'صندوق النقد', debit: 40, credit: 0, amount: 40,
      journal_entries: { voucher_number: 'RECEIPT-2026-00000001', description: 'تم استلامها من قبل حمادة مباشرة' } },
    { id: 'line-2', date: '2026-10-10', hotel_name: 'فندق ٢', unit_number: 'C/٥', customer_name: '=1+1',
      description: 'عملية ٢', debit: 3460, credit: 0, amount: 3460 },
  ],
};
const make = options => populate(new ExcelJS.Workbook(), options || fixture);

test('export preserves exact financial records, full references and detailed descriptions', () => {
  const before = JSON.stringify(fixture);
  const ws = make().worksheets[0];
  assert.equal(ws.getCell('H8').value, 'RECEIPT-2026-00000001');
  assert.equal(ws.getCell('B8').value, 'عميل 1\nتم استلامها من قبل حمادة مباشرة');
  assert.equal(ws.getCell('A8').value, '00450006');
  assert.equal(ws.getCell('B9').value, '=1+1\nعملية 2'); // Plain text, never a formula.
  assert.equal(ws.getCell('B9').type, ExcelJS.ValueType.String);
  assert.equal(ws.getCell('C8').value, 40);
  assert.equal(ws.getCell('K9').value, 3460);
  assert.equal(ws.getCell('G5').value.result, 3500);
  assert.equal(ws.getCell('E5').value.result, 2);
  assert.equal(JSON.stringify(fixture), before);
});

test('saved workbook retains editable workflow, filters, panes, dates and conditional formatting', async () => {
  const wb = make();
  const buffer = await wb.xlsx.writeBuffer();
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(buffer);
  const ws = reopened.worksheets[0];
  assert.equal(ws.getCell('B8').font.size, 13);
  assert.equal(ws.getCell('B9').fill.fgColor.argb, 'FFFFF1F2');
  assert.equal(ws.getCell('B8').fill.fgColor.argb, 'FFFFFFFF');
  assert(ws.getRow(8).height >= 62);
  assert.equal(ws.autoFilter, 'A7:M9');
  assert.equal(ws.views[0].ySplit, 7);
  assert.equal(ws.views[0].rightToLeft, true);
  assert.equal(ws.getCell('F8').value, 'لم يُدخل');
  assert.equal(ws.getCell('F8').dataValidation.type, 'list');
  assert.equal(ws.getCell('F8').dataValidation.formulae[0], '"لم يُدخل,تم الإدخال,1"');
  assert(ws.getCell('G8').value instanceof Date);
  assert.equal(ws.getCell('G8').value.toISOString().slice(0, 10), '2026-10-25');
  for (const address of ['A5', 'C5', 'E5', 'G5', 'I5', 'G8', 'H8', 'J8', 'A8', 'C8', 'D8', 'K8', 'L8']) {
    assert.equal(ws.getCell(address).alignment.readingOrder, 'ltr', address);
  }
  for (const address of ['A5', 'G5', 'G8', 'C8', 'D8', 'K8']) {
    assert(ws.getCell(address).numFmt.includes('[$-0409]'), address);
  }
  assert.equal(ws.getCell('B8').alignment.readingOrder, 'rtl');
  const rule = ws.conditionalFormattings[0];
  assert.equal(rule.ref, 'A8:M9');
  assert.equal(rule.rules[0].formulae[0], 'OR($F8="تم الإدخال",$F8=1,$F8="1")');
  assert.equal(rule.rules[0].style.fill.fgColor.argb, 'FFE7F4EB');
  assert.equal(rule.rules[0].style.fill.bgColor.argb, 'FFE7F4EB');
  assert.equal(ws.getCell('C5').formula, 'COUNTIFS(F8:F9,"تم الإدخال")+COUNTIFS(F8:F9,1)');
  assert.equal(ws.getCell('F8').numFmt, '[=1]"تم الإدخال";General');
  assert.equal(ws.getCell('I5').formula, 'SUBTOTAL(109,K8:K9)');
  for (const address of ['J4', 'J5', 'K4', 'K5', 'L4', 'L5', 'M4', 'M5']) {
    assert.equal(ws.getCell(address).value, null, address);
  }
  ws.getCell('F8').value = 'تم الإدخال';
  ws.getCell('L8').value = 'ACC-100';
  ws.getCell('M8').value = 'تمت المراجعة';
  const saved = new ExcelJS.Workbook();
  await saved.xlsx.load(await reopened.xlsx.writeBuffer());
  assert.equal(saved.worksheets[0].getCell('F8').value, 'تم الإدخال');
  assert.equal(saved.worksheets[0].getCell('L8').value, 'ACC-100');
  assert.equal(saved.worksheets[0].getCell('K8').value, 40);
});

test('empty and accounting exports remain valid without invented financial rows', async () => {
  const wb = make({ ...fixture, accounting: true, rows: [] });
  const ws = wb.worksheets[0];
  assert.equal(ws.getCell('A5').result, 0);
  assert.equal(ws.getCell('G5').result, 0);
  assert.equal(ws.autoFilter, 'A7:M7');
  assert.equal(ws.conditionalFormattings.length, 0);
  assert(ws.getCell('A1').value.includes('حركة الصناديق'));
  assert(ws.getCell('A8').value.includes('لا توجد عمليات'));
  await wb.xlsx.writeBuffer();
});

test('browser distribution generates the same workbook without server APIs', async () => {
  const BrowserExcelJS = require('exceljs/dist/exceljs.min.js');
  const buffer = await populate(new BrowserExcelJS.Workbook(), fixture).xlsx.writeBuffer();
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(buffer);
  assert.equal(reopened.worksheets[0].getCell('B8').value, 'عميل 1\nتم استلامها من قبل حمادة مباشرة');
  assert.equal(reopened.worksheets[0].getCell('K9').value, 3460);
});

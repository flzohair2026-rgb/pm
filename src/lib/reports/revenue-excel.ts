import type { Workbook } from 'exceljs';

interface RevenueExcelRow {
  id: string;
  date?: string;
  hotel_name?: string;
  unit_number?: string;
  unit_account_code?: string;
  customer_name?: string;
  description?: string;
  account_name?: string;
  debit?: number | string;
  credit?: number | string;
  amount?: number | string;
  journal_entries?: { voucher_number?: string; description?: string };
}

const text = (value: unknown) => String(value ?? '').replace(/[٠-٩۰-۹]/g, digit => {
  const code = digit.charCodeAt(0);
  return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
});
const moneyFormat = '[$-0409]#,##0.00;[Red][$-0409](#,##0.00);[$-0409]0.00';

// Called only by the export action. Status and accountant notes belong to the
// downloaded workbook; source financial records are never updated here.
export function populateRevenueWorkbook(wb: Workbook, options: {
  rows: RevenueExcelRow[]; companyName: string; startDate: string; endDate: string;
  hotelLabel: string; accounting: boolean;
}) {
  const { rows, companyName, startDate, endDate, hotelLabel, accounting } = options;
  wb.creator = text(companyName);
  wb.calcProperties.fullCalcOnLoad = true;
  const ws = wb.addWorksheet('متابعة الإيرادات', {
    views: [{ state: 'frozen', ySplit: 7, xSplit: 2, topLeftCell: 'C8', rightToLeft: true, showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      printTitlesRow: '1:7', margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.15, footer: 0.15 } },
    headerFooter: { oddFooter: '&Rصفحة &P من &N&Lتقرير الإيرادات' },
  });
  const widths = [17, 38, 17, 17, 23, 18, 14, 26, 21, 11, 17, 24, 30];
  widths.forEach((width, index) => { ws.getColumn(index + 1).width = width; });
  const band = (range: string, value: string, color: string, size = 13) => {
    ws.mergeCells(range);
    const cell = ws.getCell(range.split(':')[0]);
    cell.value = value;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    cell.font = { name: 'Arial', size, bold: true, color: { argb: color === 'FF065F46' ? 'FFFFFFFF' : 'FF164E3E' } };
    cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true, readingOrder: 'rtl' };
  };
  band('A1:M1', `${text(companyName)} — ${accounting ? 'متابعة حركة الصناديق' : 'متابعة إدخال الإيرادات'}`, 'FF065F46', 18);
  ws.getRow(1).height = 38;
  band('A2:M2', `الفترة: ${text(startDate)} إلى ${text(endDate)}     النطاق: ${text(hotelLabel)}`, 'FFE8F4EE');
  ws.getRow(2).height = 32;
  band('A3:M3', 'ابحث بـ Ctrl+F أو فلاتر الأعمدة. بعد النقل اكتب 1 في الحالة ثم Enter، أو اختر «تم الإدخال». احفظ الملف للاحتفاظ بمتابعتك؛ التصدير الجديد يبدأ متابعة جديدة.', 'FFF1F5F4');
  ws.getRow(3).height = 42;
  const last = 7 + rows.length;
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const metrics = [
    { label: 'عدد العمليات', from: 'A', to: 'B', formula: rows.length ? `COUNTA(H8:H${last})` : '0', result: rows.length, money: false },
    { label: 'تم الإدخال', from: 'C', to: 'D', formula: rows.length ? `COUNTIFS(F8:F${last},"تم الإدخال")+COUNTIFS(F8:F${last},1)` : '0', result: 0, money: false },
    { label: 'المتبقي', from: 'E', to: 'F', formula: 'A5-C5', result: rows.length, money: false },
    { label: 'إجمالي الصافي (ر.س)', from: 'G', to: 'H', formula: rows.length ? `SUM(K8:K${last})` : '0', result: total, money: true },
    { label: 'صافي الصفوف الظاهرة (ر.س)', from: 'I', to: 'I', formula: rows.length ? `SUBTOTAL(109,K8:K${last})` : '0', result: total, money: true },
  ];
  for (const metric of metrics) {
    band(`${metric.from}4:${metric.to}4`, metric.label, 'FFE8F4EE');
    band(`${metric.from}5:${metric.to}5`, '', 'FFF6FAF8', 16);
    const cell = ws.getCell(`${metric.from}5`);
    cell.value = { formula: metric.formula, result: metric.result };
    cell.numFmt = metric.money ? moneyFormat : '[$-0409]0';
    cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'ltr' };
  }
  ws.getRow(4).height = 46;
  ws.getRow(5).height = 32;
  const headers = ['رمز حساب الوحدة', 'العميل والبيان', 'مدين (قبض)', 'دائن (صرف)', 'الصندوق / الحساب', 'حالة الإدخال', 'التاريخ', 'مرجع السند الكامل', 'الفندق', 'الوحدة', 'الصافي (ر.س)', 'مرجع النظام المحاسبي', 'ملاحظات المحاسب'];
  ws.getRow(7).values = headers;
  ws.getRow(7).height = 42;
  ws.getRow(7).eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    cell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  rows.forEach((item, index) => {
    const dateText = text(item.date).slice(0, 10);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateText) ? new Date(`${dateText}T00:00:00Z`) : null;
    const row = ws.getRow(index + 8);
    const customerAndDescription = [text(item.customer_name), text(item.journal_entries?.description?.trim() || item.description)]
      .filter(Boolean).join('\n');
    row.values = [text(item.unit_account_code), customerAndDescription, Number(item.debit || 0), Number(item.credit || 0),
      text(item.account_name), 'لم يُدخل', date && !Number.isNaN(date.getTime()) ? date : dateText,
      text(item.journal_entries?.voucher_number || item.id), text(item.hotel_name), text(item.unit_number), Number(item.amount || 0), '', ''];
    // Account for both explicit line breaks and wrapping within the compact column.
    const lines = customerAndDescription.split('\n').reduce((count, line) => count + Math.max(1, Math.ceil(line.length / 25)), 0);
    row.height = Math.max(62, lines * 22 + 14);
    for (let col = 1; col <= 13; col++) {
      const cell = row.getCell(col);
      cell.font = { name: 'Arial', size: 13, color: { argb: [6, 12, 13].includes(col) ? 'FF1D4ED8' : 'FF1F2937' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 ? 'FFFFF1F2' : 'FFFFFFFF' } };
      // Keep Arabic labels RTL, but give dates, identifiers and amounts an
      // explicit English context so Excel does not shape them as Arabic digits.
      cell.alignment = { horizontal: [2, 13].includes(col) ? 'right' : 'center', vertical: 'middle', wrapText: true,
        readingOrder: [1, 3, 4, 7, 8, 10, 11, 12].includes(col) ? 'ltr' : 'rtl' };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFDCE6E1' } } };
      if ([1, 8, 10, 12].includes(col)) cell.numFmt = '@';
      if ([3, 4, 11].includes(col)) cell.numFmt = moneyFormat;
    }
    row.getCell(7).numFmt = '[$-0409]dd/mm/yyyy';
    row.getCell(6).dataValidation = { type: 'list', allowBlank: false, formulae: ['"لم يُدخل,تم الإدخال,1"'],
      showErrorMessage: true, errorStyle: 'stop', errorTitle: 'حالة الإدخال', error: 'اكتب 1 للعملية المدخلة أو اختر الحالة من القائمة.' };
    row.getCell(6).numFmt = '[=1]"تم الإدخال";General';
    row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, readingOrder: 'ltr' };
  });
  ws.autoFilter = `A7:M${Math.max(7, last)}`;
  if (rows.length) {
    ws.addConditionalFormatting({ ref: `A8:M${last}`, rules: [{ type: 'expression', priority: 1,
      formulae: ['OR($F8="تم الإدخال",$F8=1,$F8="1")'], style: { fill: { type: 'pattern', pattern: 'solid',
        fgColor: { argb: 'FFE7F4EB' }, bgColor: { argb: 'FFE7F4EB' } },
        font: { color: { argb: 'FF166534' } } } }] });
    ws.addConditionalFormatting({ ref: `F8:F${last}`, rules: [{ type: 'expression', priority: 2,
      formulae: ['$F8="لم يُدخل"'], style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } },
        font: { color: { argb: 'FF92400E' } } } }] });
  } else {
    band('A8:M8', 'لا توجد عمليات ضمن الفترة والنطاق المحددين.', 'FFF1F5F4');
    ws.getRow(8).height = 32;
  }
  ws.pageSetup.printArea = `A1:M${Math.max(8, last)}`;
  return wb;
}

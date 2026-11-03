// Browser QA uses synthetic receipt data and the real React dialog/template.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const assert = require('node:assert/strict');
const output = process.env.RECEIPT_QA_OUTPUT;
if (!output) throw new Error('Set RECEIPT_QA_OUTPUT to an absolute QA directory');
fs.mkdirSync(output, { recursive: true });
const modules = [], ids = new Map();
function bundle(file) {
  if (ids.has(file)) return ids.get(file);
  const id = modules.length;
  ids.set(file, id); modules.push('');
  let source = fs.readFileSync(file, 'utf8');
  if (/\.tsx?$/.test(file)) source = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
  source = source.replace(/process\.env\.NODE_ENV/g, '"production"');
  source = source.replace(/require\(["']([^"']+)["']\)/g, (_, name) => {
    if (name === '@/lib/supabase') return '({supabase:window.mockSupabase})';
    const target = name.startsWith('@/') ? require.resolve(path.resolve('src', name.slice(2))) : require.resolve(name, { paths: [path.dirname(file)] });
    return `req(${bundle(target)})`;
  });
  modules[id] = `function(module,exports,req){${source}\n}`;
  return id;
}
// Resolve TypeScript aliases without adding a runtime dependency.
const originalExtensions = { ...require.extensions };
require.extensions['.tsx'] = require.extensions['.js'];
require.extensions['.ts'] = require.extensions['.js'];
const react = bundle(require.resolve('react'));
const dom = bundle(require.resolve('react-dom/client'));
const dialog = bundle(path.resolve('src/components/print/ReceiptPrintDialog.tsx'));
Object.assign(require.extensions, originalExtensions);
const script = `(function(){const modules=[${modules.join(',')}],cache={};function req(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,req);return m.exports;}const R=req(${react});req(${dom}).createRoot(document.getElementById('app')).render(R.createElement(req(${dialog}).default,{paymentId:'00000000-0000-0000-0000-000000000042',onClose:()=>window.closedReceipt=true}));})();`;
const data = { id: '00000000-0000-0000-0000-000000000042', voucherNumber: 'REC-0042', date: '03/11/2026', invoiceNumber: 'INV-0042', amount: 1234.56,
  amountWords: 'ألف وأربعة وثلاثون ومئتان ريال سعودي وستة وخمسون هللة', operationType: 'سداد فاتورة', paymentMethod: 'تحويل بنكي',
  description: 'سداد مستحقات الإقامة للوحدة D2/#3', customer: { name: 'عميل تجريبي لفحص الطباعة', phone: '0500000000', nationalId: '1000000000', nationality: 'السعودية', docType: 'هوية وطنية' },
  hotel: { name: 'مساكن تجريبية', address: 'المملكة العربية السعودية — الرياض', cr: '1234567890' }, printedAt: '03/11/2026 12:30' };
const font = fs.readFileSync('src/app/fonts/IBMPlexSansArabic-Regular.ttf').toString('base64');
const css = fs.readdirSync('.next/static/chunks').filter(name => name.endsWith('.css')).map(name => fs.readFileSync(path.join('.next/static/chunks', name), 'utf8')).join('\n');
const { chromium } = require('C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1026-487-0_26.1026.487.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const errors = [];
    for (const width of [360, 390, 430, 768, 1440]) {
      const page = await browser.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/print/receipt/**', route => route.fulfill({ json: data }));
      await page.route('**/logo.png', route => route.fulfill({ path: path.resolve('public/logo.png'), contentType: 'image/png' }));
      await page.setViewportSize({ width, height: 900 });
      await page.setContent(`<html dir="rtl"><head><style>${css}\n@font-face{font-family:qa;src:url(data:font/ttf;base64,${font})}body{font-family:qa}</style></head><body><div id="app">Booking background</div><script>window.mockSupabase={auth:{getUser:()=>new Promise(()=>{})}};window.print=()=>{window.printCalls=(window.printCalls||0)+1};</script></body></html>`);
      // Give fetch a same-origin base without contacting the app.
      await page.evaluate(() => { const base = document.createElement('base'); base.href = 'http://receipt.test/'; document.head.append(base); });
      await page.addScriptTag({ content: script });
      const button = page.getByRole('button', { name: 'طباعة', exact: true });
      await button.waitFor();
      await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'طباعة')?.disabled);
      const screen = await page.locator('.receipt-paper').boundingBox();
      assert.ok(screen.x >= -1 && screen.x + screen.width <= width + 1, JSON.stringify({ width, screen }));
      if (width === 390) {
        await page.getByRole('button', { name: 'توقيع', exact: true }).click();
        const canvas = page.locator('[data-receipt-signature] canvas');
        await canvas.waitFor();
        await page.locator('[data-receipt-signature]').evaluate(el => el.getAnimations({ subtree: true }).forEach(animation => animation.finish()));
        const box = await canvas.boundingBox();
        assert.ok(box.width > 250 && box.x >= 0 && box.x + box.width <= width);
        await page.mouse.move(box.x + 30, box.y + 50); await page.mouse.down();
        await page.mouse.move(box.x + 100, box.y + 100, { steps: 10 }); await page.mouse.up();
        await page.getByRole('button', { name: 'تم، إدراج التوقيع' }).click();
        await page.locator('img[alt="Signature"]').waitFor();
      }
      await button.click();
      assert.equal(await page.evaluate(() => window.printCalls), 1, 'pending audit must not delay print');
      await page.emulateMedia({ media: 'print' });
      const metrics = await page.evaluate(() => ({ width: document.querySelector('.receipt-paper').getBoundingClientRect().width,
        transform: getComputedStyle(document.querySelector('.document-preview-content')).transform,
        hidden: getComputedStyle(document.getElementById('app')).display,
        amount: document.querySelector('.receipt-amount strong').textContent }));
      assert.ok(Math.abs(metrics.width - 194 * 96 / 25.4) < 1);
      assert.equal(metrics.transform, 'none'); assert.equal(metrics.hidden, 'none'); assert.equal(metrics.amount, '1,234.56');
      if (width === 390) await page.pdf({ path: path.join(output, 'receipt-a4.pdf'), preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
      await page.emulateMedia({ media: 'screen' });
      if (width === 390) await page.screenshot({ path: path.join(output, 'receipt-mobile.png'), fullPage: true });
      assert.equal(await button.isVisible(), true);
      console.log(JSON.stringify({ viewportWidth: width, ...metrics }));
      await page.getByRole('button', { name: 'إغلاق المعاينة' }).click();
      assert.equal(await page.evaluate(() => window.closedReceipt), true);
      await page.close();
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

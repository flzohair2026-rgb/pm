// Browser QA uses synthetic contract data and the real React dialog/template.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const assert = require('node:assert/strict');
const output = process.env.CONTRACT_QA_OUTPUT;
if (!output) throw new Error('Set CONTRACT_QA_OUTPUT to an absolute QA directory');
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
    if (name === 'next/font/local') return '({__esModule:true,default:()=>({className:"contract-local-font"})})';
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
const dialog = bundle(path.resolve('src/components/print/ContractPrintDialog.tsx'));
Object.assign(require.extensions, originalExtensions);
const script = `(function(){const modules=[${modules.join(',')}],cache={};function req(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,req);return m.exports;}const R=req(${react});req(${dom}).createRoot(document.getElementById('app')).render(R.createElement(req(${dialog}).default,{bookingId:'00000000-0000-0000-0000-000000000042',onClose:()=>window.closedReceipt=true}));})();`;
const { createLoader, booking, invoices } = require('./helpers/contract-print-fixtures.cjs');
const font = fs.readFileSync('src/app/fonts/IBMPlexSansArabic-Regular.ttf').toString('base64');
const fontWeights = [['Medium', 500], ['SemiBold', 600], ['Bold', 700]].map(([name, weight]) => `@font-face{font-family:qa;src:url(data:font/ttf;base64,${fs.readFileSync(`src/app/fonts/IBMPlexSansArabic-${name}.ttf`).toString('base64')});font-weight:${weight}}`).join('');
const css = fs.readdirSync('.next/static/chunks').filter(name => name.endsWith('.css')).map(name => fs.readFileSync(path.join('.next/static/chunks', name), 'utf8')).join('\n');
const { chromium } = require('C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1026-487-0_26.1026.487.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const data = await createLoader({ booking, invoices, deposits: [{ amount: 500 }], source: { payload: { booking_source: 'reception' } } }).loadContract(booking.id);
    const errors = [];
    for (const width of [360, 390, 430, 768, 1440]) {
      const page = await browser.newPage();
      page.on('pageerror', error => errors.push(error.message));
      const payload = structuredClone(data);
      if (width === 1440) {
        payload.booking.customer.full_name = 'اسم عميل طويل لفحص التفاف النص داخل العقد '.repeat(4);
        payload.booking.unit.unit_type.description = 'وصف وحدة طويل لفحص استمرار المحتوى دون قص أو فقدان '.repeat(25) + 'نهاية الوصف الطويل';
      }
      await page.route('**/api/print/contract/**', route => route.fulfill({ json: payload }));
      await page.route('**/*.png', route => route.fulfill({ path: path.resolve('public', new URL(route.request().url()).pathname.slice(1)), contentType: 'image/png' }));
      await page.setViewportSize({ width, height: 900 });
      await page.setContent(`<html dir="rtl"><head><style>${css}\n@font-face{font-family:qa;src:url(data:font/ttf;base64,${font})}${fontWeights}body{font-family:qa}</style></head><body><div id="app">Booking background</div><script>window.mockSupabase={auth:{getUser:()=>new Promise(()=>{})}};window.print=()=>{window.printCalls=(window.printCalls||0)+1};window.open=()=>{throw Error('Unexpected new tab')};</script></body></html>`);
      // Give fetch a same-origin base without contacting the app.
      await page.evaluate(() => { const base = document.createElement('base'); base.href = 'http://receipt.test/'; document.head.append(base); });
      await page.addScriptTag({ content: script });
      const button = page.getByRole('button', { name: 'طباعة', exact: true });
      await button.waitFor();
      await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'طباعة')?.disabled);
      const screen = await page.locator('.contract-paper').boundingBox();
      assert.ok(screen.x >= -1 && screen.x + screen.width <= width + 1, JSON.stringify({ width, screen }));
      if (width === 390) {
        await page.getByRole('button', { name: 'توقيع إلكتروني', exact: true }).click();
        const canvas = page.locator('[data-document-signature] canvas');
        await canvas.waitFor();
        await page.locator('[data-document-signature]').evaluate(el => el.getAnimations({ subtree: true }).forEach(animation => animation.finish()));
        const box = await canvas.boundingBox();
        assert.ok(box.width > 250 && box.x >= 0 && box.x + box.width <= width);
        await page.mouse.move(box.x + 30, box.y + 50); await page.mouse.down();
        await page.mouse.move(box.x + 100, box.y + 100, { steps: 10 }); await page.mouse.up();
        await page.getByRole('button', { name: 'تم، إدراج التوقيع' }).click();
        await page.locator('img[alt="Signature"]').waitFor();
        await page.getByRole('button', { name: 'خيارات العقد والموقّع' }).click();
        await page.getByLabel('اسم الوكيل / المفوّض').fill('وكيل تجريبي');
        await page.getByLabel('صفة الموقّع (الافتراضي: وكيل)').fill('مفوّض');
        await page.getByLabel('ملاحظة المدة').fill('ملاحظة تجريبية للمدة');
        await page.getByLabel('نص الأجرة المخصص').fill('نص أجرة تجريبي');
        assert.ok(await page.locator('.contract-paper').textContent().then(text => text.includes('نص أجرة تجريبي')));
        await page.getByLabel('نص الأجرة المخصص').fill('');
        assert.equal(await page.locator('img[alt="Signature"]').count(), 1);
        await page.getByRole('button', { name: 'إخفاء خيارات العقد' }).click();
      }
      await button.click();
      assert.equal(await page.evaluate(() => window.printCalls), 1, 'pending audit must not delay print');
      await page.emulateMedia({ media: 'print' });
      const metrics = await page.evaluate(() => ({ width: document.querySelector('.contract-paper').getBoundingClientRect().width,
        transform: getComputedStyle(document.querySelector('.document-preview-content')).transform,
        hidden: getComputedStyle(document.getElementById('app')).display,
        hasAmount: document.querySelector('.contract-paper').textContent.includes('3,475'), terms: document.querySelectorAll('.contract-conditions li').length }));
      assert.ok(Math.abs(metrics.width - 194 * 96 / 25.4) < 1);
      if (width === 390) {
        const signatureSizing = await page.evaluate(() => {
          const card = document.querySelector('.contract-signature-card');
          const marks = document.querySelector('.contract-signature-marks');
          const current = card.offsetHeight;
          const size = marks.querySelector('[role="img"]').offsetWidth;
          const oldStyle = document.createElement('style');
          oldStyle.textContent = `.contract-paper .contract-signature-card{padding:8px;gap:16px}.contract-paper .contract-signature-details{padding:0}.contract-paper .contract-signature-marks{margin:0;display:flex;flex-direction:column;gap:4px}.contract-paper .contract-signature-marks img,.contract-paper .contract-signature-marks [role='img']{width:48px;height:48px}.contract-paper .contract-signature-marks>div{gap:4px}`;
          document.head.append(oldStyle);
          const label = document.createElement('span'); label.textContent = 'مرجع العقد'; label.style.fontSize = '7px'; marks.append(label);
          const previous = card.offsetHeight;
          label.remove(); oldStyle.remove();
          return { current, previous, size };
        });
        assert.ok(signatureSizing.current <= signatureSizing.previous, JSON.stringify(signatureSizing));
        assert.equal(signatureSizing.size, 76);
        console.log(JSON.stringify({ signatureSizing }));
      }
      if (width === 1440) {
        const complete = await page.evaluate(() => {
          const paper = document.querySelector('.contract-paper');
          const signature = document.querySelector('.contract-signature');
          return paper.textContent.includes('نهاية الوصف الطويل') && paper.scrollWidth <= paper.clientWidth + 1 && signature.getBoundingClientRect().bottom <= paper.getBoundingClientRect().bottom;
        });
        assert.equal(complete, true, 'long contracts must retain all content without clipping');
      }
      assert.equal(metrics.transform, 'none'); assert.equal(metrics.hidden, 'none'); assert.equal(metrics.hasAmount, true); assert.equal(metrics.terms, 15);
      if (width === 390) await page.pdf({ path: path.join(output, 'contract-a4.pdf'), preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
      await page.emulateMedia({ media: 'screen' });
      if (width === 390) await page.screenshot({ path: path.join(output, 'contract-mobile.png'), fullPage: true });
      assert.equal(await button.isVisible(), true);
      console.log(JSON.stringify({ viewportWidth: width, ...metrics }));
      await page.getByRole('button', { name: 'إغلاق المعاينة' }).click();
      assert.equal(await page.evaluate(() => window.closedReceipt), true);
      await page.close();
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

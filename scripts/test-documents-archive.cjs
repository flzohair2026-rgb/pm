const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const JSZip = require('jszip');
function compile(path, overrides = {}) {
  const m = new Module(__filename);
  m.paths = module.paths;
  m.require = id => id in overrides ? overrides[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, __filename);
  return m.exports;
}
const archive = compile('src/lib/documents/archive-download.ts');
const doc = { id: '1', customer_full_name: 'عميل ١', unit_number: 'F/١', doc_type: 'contract',
  doc_date: '2026-10-25T12:00:00Z', uploaded_at: '2026-11-02', storage_path: 'F/1/original.jpg',
  content_type: 'application/pdf', public_url: 'https://storage.example/file' };

test('names group by document month, preserve Arabic and English digits, and sanitize paths', () => {
  assert.equal(archive.archiveFilePath(doc), 'أرشيف الوثائق/2026-10/عميل 1__وحدة-F-1__2026-10-25__عقد.pdf');
  const unsafe = archive.archiveFilePath({ ...doc, customer_full_name: '../../اسم\\غير صالح:*?', unit_number: '../..' });
  assert.equal(unsafe.split('/').length, 3);
  assert(!unsafe.includes('..'));
  assert(!unsafe.includes('\\'));
  assert(archive.archiveFilePath({ ...doc, doc_date: '2026-10-31T22:00:00Z' }).includes('/2026-11/'));
  assert(archive.archiveFilePath({ ...doc, doc_date: 'invalid' }).includes('/بدون تاريخ/'));
});

test('complete filtered export crosses empty filtered pages and deduplicates repeated files', async t => {
  const requests = [];
  const pages = [
    { ok: true, documents: [], next_offset: 300 },
    { ok: true, documents: [doc], next_offset: 600 },
    { ok: true, documents: [doc, { ...doc, id: '2', storage_path: 'different.pdf' }], next_offset: null },
  ];
  t.mock.method(global, 'fetch', async (url, options) => {
    requests.push(JSON.parse(options.body));
    return Response.json(pages.shift());
  });
  const result = await archive.fetchAllArchiveDocuments({ customer_name: 'عميل', date_to: '2026-10-31T12:30:59' }, new AbortController().signal, () => {});
  assert.equal(result.length, 2);
  assert.deepEqual(requests.map(r => r.offset), [0, 300, 600]);
  assert(requests.every(r => r.customer_name === 'عميل' && r.date_to === '2026-10-31T12:30:59'));
});

test('ZIP retains all file bytes, disambiguates identical names and reports individual failures', async t => {
  t.mock.method(global, 'fetch', async url => url.endsWith('bad') ? new Response('', { status: 404 }) : new Response('original-file-bytes'));
  const progress = [];
  const result = await archive.buildArchiveZip([doc, { ...doc, id: '2' }, { ...doc, id: '3', public_url: 'https://storage.example/bad' }],
    new AbortController().signal, p => progress.push(p));
  assert.equal(result.succeeded, 2);
  assert.equal(result.failed, 1);
  const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
  const files = Object.values(zip.files).filter(f => !f.dir);
  assert.equal(files.length, 3);
  const pdfs = files.filter(f => f.name.endsWith('.pdf'));
  assert.equal(pdfs.length, 2);
  assert(pdfs.some(f => f.name.endsWith('__2.pdf')));
  for (const file of pdfs) assert.equal(await file.async('string'), 'original-file-bytes');
  const report = zip.file('أرشيف الوثائق/ملفات لم يتم تنزيلها.txt');
  assert((await report.async('string')).includes('404'));
  assert(progress.some(p => p.stage === 'packing'));
});

test('cancellation and total failure never produce a misleading empty archive', async t => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(archive.buildArchiveZip([doc], controller.signal, () => {}), { name: 'AbortError' });
  t.mock.method(global, 'fetch', async () => new Response('', { status: 500 }));
  await assert.rejects(archive.buildArchiveZip([doc], new AbortController().signal, () => {}), /لم يتم تحميل أي ملف/);
});

test('list API paginates before post-filters, preserves date/time and resolves booking through upload events', async () => {
  const calls = [];
  const rows = Array.from({ length: 301 }, (_, index) => ({ ...doc, id: String(index), storage_path: `path-${index}.pdf`,
    customer: { full_name: index === 300 ? 'العميل المطلوب' : 'آخر' } }));
  const client = {
    storage: { from: () => ({ getPublicUrl: path => ({ data: { publicUrl: `https://storage.example/${path}` } }) }) },
    from(table) {
      const query = { table, filters: [], from: 0, to: 299 };
      const builder = {};
      for (const name of ['select', 'order', 'eq', 'ilike', 'gte', 'lte', 'in']) builder[name] = (...args) => {
        query.filters.push([name, ...args]); return builder;
      };
      builder.range = (from, to) => { query.from = from; query.to = to; return builder; };
      builder.then = (resolve, reject) => {
        calls.push(query);
        return Promise.resolve({ error: null, data: table === 'documents' ? rows.slice(query.from, query.to + 1) : [
          { payload: { path: 'path-300.pdf', booking_id: 'booking-1' }, created_at: '2026-11-02' },
        ] }).then(resolve, reject);
      };
      return builder;
    },
  };
  const { POST } = compile('src/app/api/documents/list/route.ts', {
    '@/lib/supabase-server': { createClient: async () => client },
    'next/server': { NextResponse: { json: (data, options) => Response.json(data, options) } },
  });
  const request = offset => new Request('https://app.example/api/documents/list', { method: 'POST', body: JSON.stringify({
    offset, customer_name: 'العميل المطلوب', booking_id: 'booking-1', date_to: '2026-10-31T12:30:59',
  }) });
  const first = await (await POST(request(0))).json();
  assert.equal(first.next_offset, 300);
  assert.equal(first.documents.length, 0);
  const second = await (await POST(request(300))).json();
  assert.equal(second.next_offset, null);
  assert.equal(second.documents.length, 1);
  assert.equal(second.documents[0].booking_id, 'booking-1');
  const documentCalls = calls.filter(q => q.table === 'documents');
  assert(documentCalls.every(q => q.filters.some(f => f[0] === 'lte' && f[2] === '2026-10-31T12:30:59')));
  assert(documentCalls.every(q => !q.filters.some(f => f[0] === 'eq' && f[1] === 'booking_id')));
  assert.equal((await POST(request(-1))).status, 400);
});

import JSZip from 'jszip';

export interface ArchiveDocument {
  id: string;
  customer_full_name?: string | null;
  unit_number?: string | null;
  doc_date?: string | null;
  uploaded_at?: string | null;
  doc_type?: string | null;
  storage_path?: string | null;
  content_type?: string | null;
  public_url?: string | null;
}

export interface ArchiveProgress {
  stage: 'listing' | 'downloading' | 'packing';
  done: number;
  total: number;
  percent?: number;
}

const digits = (value: string) => value.replace(/[٠-٩۰-۹]/g, d => String(d.charCodeAt(0) - (d >= '۰' ? 0x06f0 : 0x0660)));
const safeName = (value: string, fallback: string, limit = 80) => {
  const cleaned = digits(value).normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '-')
    .replace(/\.{2,}/g, '-').replace(/\s+/g, ' ').replace(/^[. ]+|[. ]+$/g, '').slice(0, limit).replace(/[. ]+$/g, '');
  return cleaned || fallback;
};
const types: Record<string, string> = {
  voucher: 'سند', invoice: 'فاتورة', statement: 'كشف حساب', contract: 'عقد', handover: 'استلام', return: 'تسليم',
};
const extensions: Record<string, string> = {
  'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/heic': 'heic', 'image/tiff': 'tiff', 'text/plain': 'txt',
};

export function archiveFilePath(doc: ArchiveDocument): string {
  const sourceDate = doc.doc_date || doc.uploaded_at || '';
  const date = new Date(sourceDate);
  const day = Number.isNaN(date.getTime()) ? 'بدون تاريخ' :
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  const month = /^\d{4}-\d{2}-\d{2}$/.test(day) ? day.slice(0, 7) : 'بدون تاريخ';
  const pathExtension = doc.storage_path?.match(/\.([a-zA-Z0-9]{1,10})$/)?.[1]?.toLowerCase();
  const ext = extensions[String(doc.content_type || '').split(';')[0]] || pathExtension || 'bin';
  return `أرشيف الوثائق/${month}/${safeName(doc.customer_full_name || '', 'عميل غير مسجل')}__وحدة-${safeName(doc.unit_number || '', 'غير مسجلة', 24)}__${day}__${types[doc.doc_type || ''] || 'وثيقة'}.${ext}`;
}

// Paginate raw results even when a page is empty after name/query/booking filters.
export async function fetchAllArchiveDocuments(filters: Record<string, unknown>, signal: AbortSignal,
  onProgress: (value: ArchiveProgress) => void): Promise<ArchiveDocument[]> {
  const documents = new Map<string, ArchiveDocument>();
  let offset = 0;
  for (;;) {
    signal.throwIfAborted();
    const response = await fetch('/api/documents/list', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...filters, offset }), signal,
    });
    if (!response.ok) throw new Error('تعذر جلب قائمة الوثائق. حاول مجددًا.');
    const data = await response.json();
    if (!data?.ok || !Array.isArray(data.documents)) throw new Error('تعذر قراءة قائمة الوثائق.');
    for (const doc of data.documents as ArchiveDocument[]) {
      const key = doc.storage_path || doc.id;
      if (!documents.has(key)) documents.set(key, doc);
    }
    onProgress({ stage: 'listing', done: documents.size, total: documents.size });
    if (data.next_offset == null) break;
    if (!Number.isSafeInteger(data.next_offset) || data.next_offset <= offset) throw new Error('تعذر استكمال قائمة الوثائق.');
    offset = data.next_offset;
  }
  return [...documents.values()];
}

export async function buildArchiveZip(documents: ArchiveDocument[], signal: AbortSignal,
  onProgress: (value: ArchiveProgress) => void) {
  const zip = new JSZip();
  const used = new Set<string>();
  const entries = documents.map(doc => {
    const original = archiveFilePath(doc);
    let path = original;
    let copy = 1;
    while (used.has(path.toLowerCase())) path = original.replace(/(\.[^.]+)$/, `__${++copy}$1`);
    used.add(path.toLowerCase());
    return { doc, path };
  });
  const failures: string[] = [];
  let cursor = 0;
  let done = 0;
  let succeeded = 0;
  onProgress({ stage: 'downloading', done, total: entries.length });
  const worker = async () => {
    while (cursor < entries.length) {
      signal.throwIfAborted();
      const { doc, path } = entries[cursor++];
      try {
        if (!doc.public_url) throw new Error('رابط الملف غير متوفر');
        // Three concurrent requests keep the archive download responsive without
        // flooding storage. Timeout failures are reported, never silently skipped.
        const response = await fetch(doc.public_url, { signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]) });
        if (!response.ok) throw new Error(`تعذر تحميل الملف (${response.status})`);
        const bytes = await response.arrayBuffer();
        signal.throwIfAborted();
        zip.file(path, bytes);
        succeeded++;
      } catch (error) {
        signal.throwIfAborted();
        failures.push(`${path}\n${error instanceof Error ? error.message : 'تعذر تحميل الملف'}`);
      }
      done++;
      onProgress({ stage: 'downloading', done, total: entries.length });
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, entries.length) }, worker));
  signal.throwIfAborted();
  if (!succeeded) throw new Error('لم يتم تحميل أي ملف. تحقق من الاتصال وروابط الوثائق ثم حاول مجددًا.');
  if (failures.length) zip.file('أرشيف الوثائق/ملفات لم يتم تنزيلها.txt', '\uFEFF' + failures.join('\n\n'));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE', streamFiles: true }, metadata => {
    signal.throwIfAborted();
    onProgress({ stage: 'packing', done, total: entries.length, percent: Math.round(metadata.percent) });
  });
  signal.throwIfAborted();
  return { blob, succeeded, failed: failures.length };
}

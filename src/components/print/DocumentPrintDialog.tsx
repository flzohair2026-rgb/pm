'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Loader2, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function DocumentPrintDialog<T extends { id: string }>({ sourceId, kind, title, renderDocument, controls, onClose }: {
  sourceId: string; kind: 'receipt' | 'contract'; title: string;
  renderDocument: (data: T) => ReactNode; controls?: ReactNode; onClose: () => void;
}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(1050);
  const viewport = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 20000);
    let active = true;
    setData(null); setError(''); setReady(false);
    fetch(`/api/print/${kind}/${encodeURIComponent(sourceId)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'تعذر تحميل المستند');
        if (active) setData(result);
      })
      .catch(error => { if (active) setError(error.name === 'AbortError' ? 'استغرق تحميل المستند وقتًا طويلًا. أعد المحاولة.' : error.message); })
      .finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [sourceId, kind, attempt]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.dataset.documentPrint = 'true';
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector('[data-document-signature], [data-receipt-signature]')) return;
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key === 'Tab') {
        const root = closeButton.current?.closest('[data-document-portal]');
        const focusable = root?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, [tabindex="0"]');
        if (!focusable?.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      delete document.body.dataset.documentPrint;
      document.removeEventListener('keydown', onKey);
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    if (!data || !paper.current || !viewport.current) return;
    let active = true;
    const content = paper.current;
    const container = viewport.current;
    const resize = () => {
      const next = Math.min(1, (container.clientWidth - 24) / content.offsetWidth);
      setScale(Math.max(0.1, next));
      setHeight(content.offsetHeight * Math.max(0.1, next));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(content); observer.observe(container); resize();
    // Signatures can add images after the initial document has become ready.
    const imageObserver = new MutationObserver(() => {
      const images = Array.from(content.querySelectorAll('img'));
      if (!images.some(image => !image.complete || image.naturalWidth === 0)) return;
      setReady(false);
      Promise.all(images.map(image => image.decode()))
        .then(() => { if (active) { resize(); setReady(true); } })
        .catch(() => { if (active) setError('تعذر تجهيز صورة التوقيع. أعد المحاولة.'); });
    });
    imageObserver.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    const timer = window.setTimeout(() => { if (active) setError('تعذر تجهيز خطوط أو صور المستند. أعد المحاولة.'); }, 15000);
    Promise.all([document.fonts.ready, ...Array.from(content.querySelectorAll('img')).map(img => img.decode())])
      .then(() => { if (active) { clearTimeout(timer); resize(); setReady(true); } })
      .catch(() => { if (active) { clearTimeout(timer); setError('تعذر تحميل صورة المستند. أعد المحاولة.'); } });
    return () => { active = false; clearTimeout(timer); observer.disconnect(); imageObserver.disconnect(); };
  }, [data]);

  const print = () => {
    if (!data || !ready || error) return;
    // Preserve the audit event without putting auth and logging on the dialog's critical path.
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('system_events').insert({ event_type: 'document_printed', message: `طباعة مستند ${kind}`,
        payload: { path: `/print/${kind}/${data.id}`, doc_type: kind, source_id: data.id, note: null,
          actor_id: user?.id || null, actor_email: user?.email || null, action: 'print_requested' } });
      if (error) console.warn('تعذر تسجيل طلب طباعة المستند', error.code);
    })().catch(() => console.warn('تعذر تسجيل طلب طباعة المستند'));
    window.print();
  };

  return createPortal(<div data-document-portal role="dialog" aria-modal="true" aria-label={`معاينة ${title}`} dir="rtl" className="fixed inset-0 z-[150] bg-slate-100 flex flex-col">
    <div data-document-toolbar className="flex items-center justify-between gap-3 border-b border-emerald-100 bg-white px-4 py-3 shadow-sm">
      <div><h2 className="font-bold text-emerald-950">{title}</h2><p className="text-xs text-slate-500">معاينة A4 · طباعة مباشرة</p></div>
      <div className="flex items-center gap-2"><button type="button" onClick={print} disabled={!ready || !!error} className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"><Printer size={17} />طباعة</button><button ref={closeButton} type="button" onClick={onClose} aria-label="إغلاق المعاينة" className="rounded-xl border border-slate-200 p-2 text-slate-600"><X size={20} /></button></div>
    </div>
    {controls && <div data-document-toolbar className="max-h-[35vh] overflow-auto border-b bg-white px-4 py-3">{controls}</div>}
    {error ? <div role="alert" className="m-auto p-6 text-center"><p className="mb-4 text-red-700">{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-white"><RotateCcw size={16} />إعادة المحاولة</button></div> : !data ? <div role="status" className="m-auto flex gap-2 text-emerald-900"><Loader2 className="animate-spin" />جارٍ تجهيز المستند…</div> :
      <div ref={viewport} data-document-viewport className="flex-1 overflow-auto p-3 sm:p-6">
        {!ready && <p data-document-toolbar role="status" className="mb-3 text-center text-sm text-emerald-900">جارٍ تجهيز الخطوط والصور…</p>}
        <div data-document-scale style={{ position: 'relative', width: `${194 * 96 / 25.4 * scale}px`, height, margin: '0 auto' }}>
          <div ref={paper} style={{ position: 'absolute', right: 0, width: '194mm', transform: `scale(${scale})`, transformOrigin: 'top right' }} className="document-preview-content shadow-lg">{renderDocument(data)}</div>
        </div>
      </div>}
    <style>{`@media print {
      body[data-document-print] > :not([data-document-portal]) { display:none!important; }
      body[data-document-print] [data-document-toolbar] { display:none!important; }
      body[data-document-print] [data-document-portal] { position:static!important;display:block!important;overflow:visible!important;background:white!important; }
      body[data-document-print] [data-document-viewport] { padding:0!important;overflow:visible!important;display:block!important; }
      body[data-document-print] [data-document-scale] { width:auto!important;height:auto!important;transform:none!important; }
 body[data-document-print] .document-preview-content { position:static!important;transform:none!important;box-shadow:none!important; } }`}</style>
  </div>, document.body);
}

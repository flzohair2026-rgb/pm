'use client';

import type { ReactNode } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { Loader2, X } from 'lucide-react';

export default function SearchResultsDialog({ open, onOpenChange, title, loading, language, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  loading: boolean;
  language: string;
  children: ReactNode;
}) {
  return (
    <ModalOverlay isOpen={open} onOpenChange={onOpenChange} isDismissable
      className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/40 p-3 backdrop-blur-sm sm:p-6">
      <Modal className="max-h-[85dvh] w-full max-w-2xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl">
        <Dialog dir={language === 'en' ? 'ltr' : 'rtl'} className="flex max-h-[85dvh] flex-col outline-none">
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-stone-100 px-5 py-4 sm:px-6">
            <div>
              <Heading slot="title" className="text-base font-bold text-stone-900">{title}</Heading>
              <p className="mt-1 text-xs text-stone-500">{language === 'en' ? 'Search results and details' : 'نتائج البحث والتفاصيل'}</p>
            </div>
            <Button slot="close" aria-label={language === 'en' ? 'Close results' : 'إغلاق النتائج'}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500 transition-colors hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-emerald-700"><X size={18} /></Button>
          </header>
          <div aria-busy={loading} aria-live="polite" className="min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6">
            {loading ? <div role="status" className="flex min-h-52 flex-col items-center justify-center gap-4 text-sm text-stone-500">
              <Loader2 size={28} className="animate-spin text-emerald-800" />
              {language === 'en' ? 'Loading results…' : 'جاري تحميل النتائج…'}
            </div> : children}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { GripVertical, Menu, X } from 'lucide-react';
import { SidebarContent } from './Sidebar';
import { useAppLanguage } from '@/hooks/useAppLanguage';

export default function FloatingSidebar() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const gesture = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const { language } = useAppLanguage();
  const english = language === 'en';
  const t = (ar: string, en: string) => english ? en : ar;

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1536) setOpen(false);
      setPosition(previous => previous ? {
        x: Math.max(12, Math.min(previous.x, window.innerWidth - 124)),
        y: Math.max(12, Math.min(previous.y, window.innerHeight - 68)),
      } : null);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return <>
    <button type="button" aria-label={t('فتح قائمة التنقل؛ يمكن سحب الزر لتغيير مكانه', 'Open navigation; drag to reposition')}
      aria-haspopup="dialog" aria-expanded={open} onClick={() => {
        if (suppressClick.current) { suppressClick.current = false; return; }
        setOpen(true);
      }}
      onPointerDown={event => {
        if (event.button !== 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        suppressClick.current = false;
        gesture.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const start = gesture.current;
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (!start.moved && Math.hypot(dx, dy) < 6) return;
        start.moved = true;
        suppressClick.current = true;
        const rect = event.currentTarget.getBoundingClientRect();
        setPosition({ x: Math.max(12, Math.min(start.left + dx, window.innerWidth - rect.width - 12)),
          y: Math.max(12, Math.min(start.top + dy, window.innerHeight - rect.height - 12)) });
      }}
      onPointerUp={() => { gesture.current = null; }}
      onPointerCancel={() => { gesture.current = null; suppressClick.current = false; }}
      style={position ? { left: position.x, top: position.y } : { insetInlineEnd: '1.25rem', bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      className="fixed z-40 flex h-14 touch-none select-none items-center gap-2 rounded-2xl border border-emerald-700 bg-emerald-950 px-4 text-white shadow-xl shadow-emerald-950/25 transition-[background-color,box-shadow] hover:bg-emerald-900 hover:shadow-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 motion-reduce:transition-none 2xl:hidden print:hidden">
      <Menu size={21} strokeWidth={1.8} /><span className="text-xs font-semibold">{t('القائمة', 'Menu')}</span><GripVertical size={13} className="text-emerald-400/70" />
    </button>
    <ModalOverlay isOpen={open} onOpenChange={setOpen} isDismissable
      className="fixed inset-0 z-[100] flex bg-stone-950/40 backdrop-blur-sm motion-safe:data-entering:animate-in motion-safe:data-entering:fade-in motion-safe:data-exiting:animate-out motion-safe:data-exiting:fade-out motion-safe:duration-200">
      <Modal dir={english ? 'ltr' : 'rtl'} className={`h-dvh w-[min(21rem,calc(100vw-1.5rem))] rounded-e-3xl bg-white shadow-2xl outline-none motion-safe:data-entering:animate-in motion-safe:data-exiting:animate-out motion-safe:duration-200 ${english ? 'mr-auto motion-safe:data-entering:slide-in-from-left-4' : 'ml-auto motion-safe:data-entering:slide-in-from-right-4'}`}>
        <Dialog dir={english ? 'ltr' : 'rtl'} className="flex h-full min-h-0 flex-col outline-none">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
            <div><Heading slot="title" className="text-sm font-bold text-stone-900">{t('مساحة العمل', 'Workspace')}</Heading><p className="mt-1 text-[11px] text-stone-400">{t('كل ما تحتاجه، في مكان واحد', 'Everything you need in one place')}</p></div>
            <Button slot="close" aria-label={t('إغلاق القائمة', 'Close navigation')} className="flex size-10 items-center justify-center rounded-xl bg-stone-100 text-stone-500 hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-emerald-700"><X size={18} /></Button>
          </div>
          <SidebarContent onNavigate={() => setOpen(false)} hideBrand />
        </Dialog>
      </Modal>
    </ModalOverlay>
  </>;
}

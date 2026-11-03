'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown, SlidersHorizontal } from 'lucide-react';

export interface MobileRoomFilterOption {
  value: string;
  label: string;
  count: number;
  group: string;
  tone: 'stone' | 'emerald' | 'rose' | 'orange' | 'sky' | 'amber';
}

const tones = {
  stone: 'bg-stone-100 text-stone-600',
  emerald: 'bg-emerald-50 text-emerald-700',
  rose: 'bg-rose-50 text-rose-700',
  orange: 'bg-orange-50 text-orange-700',
  sky: 'bg-sky-50 text-sky-700',
  amber: 'bg-amber-50 text-amber-700',
};

export default function MobileRoomFilters({ value, options, onChange, label, temporary }: {
  value: string;
  options: MobileRoomFilterOption[];
  onChange: (value: string) => void;
  label: string;
  temporary?: { label: string; count: number; onClick: () => void };
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const selected = options.find(option => option.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const resize = () => { if (window.innerWidth >= 640) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', resize);
    };
  }, [open]);

  const close = () => { setOpen(false); trigger.current?.focus(); };

  return (
    <div ref={root} className="min-w-0 border-t border-stone-200/80 pt-2.5 sm:hidden">
      <button ref={trigger} type="button" aria-expanded={open} aria-controls={panelId}
        onClick={() => setOpen(previous => !previous)}
        className={`flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-xl border bg-white px-3 py-2 text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${open ? 'border-emerald-600 ring-2 ring-emerald-600/10' : 'border-stone-200'}`}>
        <SlidersHorizontal size={16} aria-hidden="true" className="shrink-0 text-emerald-800" />
        <span className="min-w-0 flex-1 text-xs leading-5">
          <span className="text-[10px] font-medium text-stone-400">{label}<span className="px-1.5 text-stone-300">/</span></span>
          <span className="font-semibold text-stone-800">{selected?.label}</span>
        </span>
        <span className={`inline-flex min-w-6 shrink-0 items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${tones[selected?.tone || 'stone']}`}>{selected?.count ?? 0}</span>
        <ChevronDown size={15} aria-hidden="true" className={`shrink-0 text-stone-400 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div id={panelId} role="region" aria-label={label}
        className="mt-2 max-h-[min(52dvh,340px)] overflow-y-auto overscroll-contain rounded-xl border border-stone-200 bg-white p-1.5 shadow-sm">
        {options.map((option, index) => (
          <div key={option.value}>
            {(index === 0 || options[index - 1].group !== option.group) && <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold text-stone-400">{option.group}</p>}
            <button type="button" aria-pressed={value === option.value}
              onClick={() => { onChange(option.value); close(); }}
              className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-xs transition-colors focus-visible:outline-2 focus-visible:outline-emerald-700 ${value === option.value ? 'bg-emerald-50 font-bold text-emerald-900' : 'text-stone-600 hover:bg-stone-50'}`}>
              <span className="min-w-0 flex-1">{option.label}</span>
              <span className={`min-w-6 rounded-md px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums ${tones[option.tone]}`}>{option.count}</span>
              <span className="w-3.5 shrink-0">{value === option.value && <Check size={14} aria-hidden="true" className="text-emerald-700" />}</span>
            </button>
          </div>
        ))}
        {temporary && <button type="button" onClick={() => { temporary.onClick(); close(); }}
          className="mt-1 flex min-h-10 w-full items-center gap-2 rounded-lg border-t border-stone-100 px-2.5 py-2 text-start text-xs font-semibold text-amber-800 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-amber-600">
          <CalendarDays size={14} aria-hidden="true" /><span className="flex-1">{temporary.label}</span>
          <span className="min-w-6 rounded-md bg-amber-50 px-1.5 py-0.5 text-center text-[10px] tabular-nums">{temporary.count}</span>
        </button>}
      </div>}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Building2, Check, ChevronDown, Layers, Search } from 'lucide-react';
import { Button, Dialog, DialogTrigger, Heading, Input, ListBox, ListBoxItem, Popover, SearchField } from 'react-aria-components';
import type { HotelInfo } from '@/hooks/useAuthContext';

export default function HotelSwitcher({ hotels, value, isAdmin, loading, english, onChange }: {
  hotels: HotelInfo[];
  value: string;
  isAdmin: boolean;
  loading: boolean;
  english: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const t = (ar: string, en: string) => english ? en : ar;
  const options = [
    ...(isAdmin ? [{ id: 'all', name: t('كل الفنادق', 'All properties') }] : []),
    ...hotels.map(hotel => ({ id: hotel.id, name: hotel.name })),
  ];
  const current = options.find(option => option.id === value);
  const filtered = options.filter(option => option.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const disabled = loading || options.length === 0;

  return (
    <DialogTrigger isOpen={open} onOpenChange={next => { setOpen(next); if (!next) setQuery(''); }}>
      <Button isDisabled={disabled} aria-label={`${t('تغيير الفندق', 'Switch property')}: ${current?.name || t('اختر الفندق', 'Select property')}`}
        className="group flex min-h-14 w-full items-center gap-3 rounded-2xl border border-stone-200 bg-white px-3 py-2 text-start shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50 md:w-60">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
          {value === 'all' ? <Layers size={18} /> : <Building2 size={18} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="mb-1 block text-[10px] font-medium text-stone-400">{t('مساحة الفندق', 'Property workspace')}</span>
          <span className="block truncate text-xs font-bold text-stone-800">{loading ? t('جاري التحميل…', 'Loading…') : current?.name || t('لا توجد فنادق متاحة', 'No properties available')}</span>
        </span>
        <ChevronDown size={15} className={`shrink-0 text-stone-400 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </Button>
      <Popover placement="bottom" offset={10} className="z-50 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl shadow-stone-900/10 outline-none motion-safe:data-entering:animate-in motion-safe:data-entering:fade-in motion-safe:data-entering:slide-in-from-top-1 motion-safe:data-exiting:animate-out motion-safe:data-exiting:fade-out motion-safe:duration-150">
        <Dialog dir={english ? 'ltr' : 'rtl'} className="outline-none">
          <div className="border-b border-stone-100 bg-stone-50/70 px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <Heading slot="title" className="text-xs font-bold text-stone-800">{t('التبديل بين الفنادق', 'Switch property')}</Heading>
              <span className="rounded-md border border-stone-200 bg-white px-2 py-0.5 text-[10px] tabular-nums text-stone-500">{hotels.length} {t('فندق', 'properties')}</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-5 text-stone-500">{t('اختر الفندق لعرض بياناته وإدارة عملياته', 'Choose a property to view and manage its operations')}</p>
          </div>
          <SearchField aria-label={t('البحث عن فندق', 'Find a property')} value={query} onChange={setQuery} className="relative m-3">
            <Search size={15} aria-hidden="true" className="pointer-events-none absolute start-3 top-3 text-stone-400" />
            <Input placeholder={t('ابحث باسم الفندق…', 'Search property name…')} className="min-h-10 w-full rounded-xl border border-stone-200 bg-stone-50/50 pe-9 ps-9 text-xs text-stone-800 outline-none placeholder:text-stone-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-600/10 [&::-webkit-search-cancel-button]:appearance-none" />
            {query && <Button aria-label={t('مسح البحث', 'Clear search')} className="absolute end-2 top-2 flex size-6 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200">×</Button>}
          </SearchField>
          <ListBox aria-label={t('الفنادق المتاحة', 'Available properties')} items={filtered} selectionMode="single" selectedKeys={value ? [value] : []}
            onSelectionChange={keys => {
              if (keys === 'all') return;
              const selected = Array.from(keys)[0];
              if (selected == null) return;
              if (String(selected) !== value) onChange(String(selected));
              setOpen(false);
              setQuery('');
            }}
            renderEmptyState={() => <div className="px-4 py-7 text-center text-xs text-stone-500">{t('لا توجد فنادق مطابقة للبحث', 'No matching properties')}</div>}
            className="max-h-64 overflow-y-auto overscroll-contain px-2 pb-2 outline-none">
            {option => <ListBoxItem id={option.id} textValue={option.name} className="group mb-1 flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-transparent px-3 py-2 outline-none transition-colors hover:bg-stone-50 data-focused:bg-stone-100 data-selected:border-emerald-100 data-selected:bg-emerald-50/80 motion-reduce:transition-none">
              {({ isSelected }) => <>
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${isSelected ? 'bg-emerald-900 text-white' : 'bg-stone-100 text-stone-500'}`}>{option.id === 'all' ? <Layers size={16} /> : <Building2 size={16} />}</span>
                <span className="min-w-0 flex-1"><span className="block break-words text-xs font-semibold text-stone-800">{option.name}</span>
                  <span className="mt-1 block text-[10px] text-stone-400">{option.id === 'all' ? t('نظرة موحدة على جميع الفنادق', 'Overview of all properties') : isSelected ? t('الفندق الحالي', 'Current property') : t('فتح مساحة الفندق', 'Open property workspace')}</span>
                </span>
                {isSelected && <Check size={16} className="shrink-0 text-emerald-700" />}
              </>}
            </ListBoxItem>}
          </ListBox>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

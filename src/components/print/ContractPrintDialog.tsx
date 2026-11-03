'use client';
import { useState } from 'react';
import DocumentPrintDialog from './DocumentPrintDialog';
import ContractDocument from './ContractDocument';
import type { ContractDocumentData, ContractOptions } from '@/lib/print/contract-types';

export default function ContractPrintDialog({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const [options, setOptions] = useState<ContractOptions>({});
  const [settings, setSettings] = useState(false);
  const input = (name: keyof ContractOptions, label: string, multiline = false) => <label className="block text-xs font-semibold text-slate-600">
    {label}
    {multiline ? <textarea value={options[name] || ''} onChange={event => setOptions(previous => ({ ...previous, [name]: event.target.value }))} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" /> :
      <input value={options[name] || ''} onChange={event => setOptions(previous => ({ ...previous, [name]: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" />}
  </label>;
  return <DocumentPrintDialog<ContractDocumentData> sourceId={bookingId} kind="contract" title="عقد الإيجار" onClose={onClose}
    controls={<div>
      <button type="button" onClick={() => setSettings(value => !value)} aria-expanded={settings} className="text-sm font-bold text-emerald-900">{settings ? 'إخفاء خيارات العقد' : 'خيارات العقد والموقّع'}</button>
      {settings && <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {input('agentName', 'اسم الوكيل / المفوّض')}{input('agentTitle', 'صفة الموقّع (الافتراضي: وكيل)')}
        {input('durationNote', 'ملاحظة المدة', true)}{input('rentNote', 'نص الأجرة المخصص', true)}
        <button type="button" onClick={() => setOptions({})} className="text-start text-xs font-bold text-slate-600">إعادة النصوص الافتراضية</button>
      </div>}
    </div>}
    renderDocument={data => <ContractDocument data={data} options={options} />} />;
}

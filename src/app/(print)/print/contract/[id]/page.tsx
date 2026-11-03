import { loadContract, ContractLoadError } from '@/lib/print/contract';
import type { ContractOptions } from '@/lib/print/contract-types';
import ContractDocument from '@/components/print/ContractDocument';
import ContractControls from '@/components/ContractControls';
import PrintActions from '../../PrintActions';

export const runtime = 'edge';

export default async function ContractPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<ContractOptions & { embed?: string }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) || {};
  const embed = sp.embed === '1';
  const qsNoAgent = new URLSearchParams();
  if (sp.durationNote) qsNoAgent.set('durationNote', sp.durationNote);
  if (sp.rentNote) qsNoAgent.set('rentNote', sp.rentNote);
  const qsNoRent = new URLSearchParams();
  if (sp.durationNote) qsNoRent.set('durationNote', sp.durationNote);
  if (sp.agentName) qsNoRent.set('agentName', sp.agentName);
  if (sp.agentTitle) qsNoRent.set('agentTitle', sp.agentTitle);
  let data;
  let message = '';
  try { data = await loadContract(id); }
  catch (error) { message = error instanceof ContractLoadError ? error.message : 'تعذر تحميل بيانات العقد. حاول مرة أخرى.'; }
  if (!data) return <div dir="rtl" className="p-8 text-center" role="alert">{message}</div>;
  return <div dir="rtl" className="overflow-auto bg-slate-100 print:bg-white print:overflow-visible">
    {!embed && <ContractControls {...sp} removeAgentHref={`?${qsNoAgent}`} removeRentHref={`?${qsNoRent}`} />}
    <ContractDocument data={data} options={sp} />
    {!embed && <PrintActions />}
  </div>;
}

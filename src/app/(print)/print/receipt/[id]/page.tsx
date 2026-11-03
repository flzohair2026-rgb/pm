import { loadReceipt, ReceiptLoadError } from '@/lib/print/receipt';
import ReceiptDocument from '@/components/print/ReceiptDocument';
import PrintActions from '../../PrintActions';

export const runtime = 'edge';

export default async function ReceiptPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ note?: string; embed?: string }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) || {};
  let data;
  let message = '';
  try {
    data = await loadReceipt(id);
  } catch (error) {
    message = error instanceof ReceiptLoadError ? error.message : 'تعذر تحميل بيانات السند. حاول مرة أخرى.';
  }
  if (!data) return <div dir="rtl" className="p-8 text-center" role="alert">{message}</div>;
  return <>
    {sp.embed !== '1' && <PrintActions />}
    <ReceiptDocument data={data} note={sp.note} />
  </>;
}

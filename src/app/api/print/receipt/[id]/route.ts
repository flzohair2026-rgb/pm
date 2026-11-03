import { NextResponse } from 'next/server';
import { loadReceipt, ReceiptLoadError } from '@/lib/print/receipt';

export const runtime = 'edge';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: 'رقم السند غير صالح' }, { status: 400 });
    }
    return NextResponse.json(await loadReceipt(id), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ReceiptLoadError ? error.message : 'تعذر تحميل بيانات السند. حاول مرة أخرى.' },
      { status: error instanceof ReceiptLoadError ? error.status : 500, headers: { 'Cache-Control': 'private, no-store' } });
  }
}

import { NextResponse } from 'next/server';
import { loadContract, ContractLoadError } from '@/lib/print/contract';

export const runtime = 'edge';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: 'رقم العقد غير صالح' }, { status: 400 });
    }
    return NextResponse.json(await loadContract(id), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ContractLoadError ? error.message : 'تعذر تحميل بيانات العقد. حاول مرة أخرى.' },
      { status: error instanceof ContractLoadError ? error.status : 500, headers: { 'Cache-Control': 'private, no-store' } });
  }
}

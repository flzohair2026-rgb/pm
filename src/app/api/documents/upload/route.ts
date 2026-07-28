import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const fd = await req.formData();
    const file = fd.get('file') as File | null;
    const requestedType = String(fd.get('doc_type') || '').trim().toLowerCase();
    const unitNumber = String(fd.get('unit_number') || '').trim();
    const customerId = String(fd.get('customer_id') || '').trim();
    const docDate = String(fd.get('doc_date') || '').trim();
    const bookingId = String(fd.get('booking_id') || '').trim();
    if (!file || !requestedType || !unitNumber || !customerId) return NextResponse.json({ ok: false }, { status: 400 });
    const docTypeMap: Record<string, string> = {
      receipt: 'voucher',
      contract: 'contract',
      identity: 'statement',
      other: 'statement',
      voucher: 'voucher',
      invoice: 'invoice',
      statement: 'statement',
      handover: 'handover',
      return: 'return',
    };
    const normalizedDocType = docTypeMap[requestedType];
    if (!normalizedDocType) {
      return NextResponse.json({
        ok: false,
        error: 'invalid_doc_type',
        message: 'نوع الملف غير مدعوم'
      }, { status: 400 });
    }
    const ext = file.type === 'application/pdf' ? 'pdf' : 'jpg';
    const fileName = `DOC_${requestedType}_${unitNumber}_${Date.now()}.${ext}`;
    const path = `${unitNumber}/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file, { contentType: file.type });
    if (uploadError) {
      return NextResponse.json({ 
        ok: false, 
        error: 'upload_failed', 
        message: uploadError.message 
      }, { status: 500 });
    }
    const { data: units } = await supabase
      .from('units')
      .select('id')
      .eq('unit_number', unitNumber)
      .limit(1);
    const unitId = units && units.length > 0 ? units[0].id : null;
    const insertPayload = {
      doc_type: normalizedDocType,
      unit_id: unitId,
      unit_number: unitNumber,
      customer_id: customerId,
      storage_path: path,
      content_type: file.type,
      doc_date: docDate ? new Date(docDate).toISOString() : new Date().toISOString()
    };
    const { error: insertError } = await supabase.from('documents').insert(insertPayload);
    if (insertError) {
      await supabase.storage.from('documents').remove([path]).catch(() => undefined);
      return NextResponse.json({ 
        ok: false, 
        error: 'insert_failed', 
        message: insertError.message.includes('documents_doc_type_check')
          ? 'نوع الملف غير متوافق مع إعدادات الأرشيف الحالية'
          : insertError.message
      }, { status: 500 });
    }
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user || null;
    const { error: logError } = await supabase.from('system_events').insert({
      event_type: 'document_uploaded',
      booking_id: bookingId || null,
      customer_id: customerId,
      unit_id: unitId,
      message: `رفع ملف (${requestedType}) للوحدة ${unitNumber}`,
      created_by: user?.id || null,
      payload: {
        path,
        requested_type: requestedType,
        docType: normalizedDocType,
        unitNumber,
        customerId,
        docDate,
        booking_id: bookingId || null,
        actor_id: user?.id || null,
        actor_email: user?.email || null
      }
    });
    const { data: pubUrl } = supabase.storage.from('documents').getPublicUrl(path);
    return NextResponse.json({ ok: true, path, publicUrl: pubUrl?.publicUrl || null, logError: logError?.message || null }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

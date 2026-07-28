import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const id = String(body?.id || '').trim();
    const bookingId = String(body?.booking_id || '').trim();
    if (!id) return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user || null;
    if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    const role = profile?.role || null;
    if (!['admin', 'manager'].includes(role)) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({
        ok: false,
        error: 'missing_service_role',
        message: 'مفتاح الخدمة غير مهيأ للحذف'
      }, { status: 409 });
    }
    const admin = createSupabaseAdminClient(supabaseUrl, serviceKey);

    const { data: doc, error: fetchErr } = await admin
      .from('documents')
      .select('id, storage_path, unit_id, customer_id')
      .eq('id', id)
      .single();
    if (fetchErr || !doc) {
      return NextResponse.json({
        ok: false,
        error: 'not_found',
        message: 'الملف غير موجود أو تم حذفه مسبقاً'
      }, { status: 404 });
    }

    let storageOk = true;
    if (doc.storage_path) {
      const { error: rmErr } = await admin.storage.from('documents').remove([doc.storage_path]);
      if (rmErr) storageOk = false;
    }

    const { error: delErrAll } = await admin.from('documents').delete().eq('storage_path', doc.storage_path);
    if (delErrAll) {
      const { error: delErrOne } = await admin.from('documents').delete().eq('id', id);
      if (delErrOne) {
        return NextResponse.json({
          ok: false,
          error: 'delete_failed',
          message: delErrOne.message
        }, { status: 500 });
      }
    }
    const { data: remains } = await admin
      .from('documents')
      .select('id')
      .eq('storage_path', doc.storage_path);
    const deletedAll = !remains || remains.length === 0;

    try {
      await admin.from('system_events').insert({
        event_type: 'document_deleted',
        booking_id: bookingId || null,
        customer_id: doc.customer_id || null,
        unit_id: doc.unit_id || null,
        message: 'حذف وثيقة',
        payload: {
          document_id: doc.id,
          storage_path: doc.storage_path,
          deleted_all: deletedAll,
          booking_id: bookingId || null,
          actor_id: user.id,
          actor_email: user.email
        }
      });
    } catch {}

    return NextResponse.json({ ok: true, storageOk, deletedAll }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const body = await req.json().catch(() => ({} as any));
    const idsRaw = Array.isArray(body?.ids) ? body.ids : body?.id ? [body.id] : [];
    const ids: string[] = Array.from(
      new Set<string>(idsRaw.map((x: any) => String(x || '').trim()).filter(Boolean))
    );
    if (ids.length === 0) return NextResponse.json({ ok: false, error: 'missing_ids' }, { status: 400 });

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user ?? null;
    if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

    const { data: profile, error: roleErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (roleErr) return NextResponse.json({ ok: false, error: roleErr.message }, { status: 500 });
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ ok: false, error: 'missing_service_role' }, { status: 409 });
    }
    const admin = createSupabaseAdminClient(supabaseUrl, serviceKey);

    const referencedIds = new Set<string>();

    const { data: bookingsRefs } = await admin.from('bookings').select('unit_id').in('unit_id', ids);
    (bookingsRefs || []).forEach((r: any) => r?.unit_id && referencedIds.add(String(r.unit_id)));

    const { data: groupRefs } = await admin.from('group_booking_units').select('unit_id').in('unit_id', ids);
    (groupRefs || []).forEach((r: any) => r?.unit_id && referencedIds.add(String(r.unit_id)));

    const { data: groupInvoiceRefs } = await admin.from('group_invoice_items').select('unit_id').in('unit_id', ids);
    (groupInvoiceRefs || []).forEach((r: any) => r?.unit_id && referencedIds.add(String(r.unit_id)));

    const deletableIds = ids.filter((id) => !referencedIds.has(id));
    const skippedIds = ids.filter((id) => referencedIds.has(id));

    if (deletableIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'referenced', referencedIds: skippedIds },
        { status: 409 }
      );
    }

    await admin.from('temporary_reservations').delete().in('unit_id', deletableIds);
    await admin.from('system_events').update({ unit_id: null }).in('unit_id', deletableIds);
    await admin.from('documents').update({ unit_id: null }).in('unit_id', deletableIds);
    await admin.from('cleaning_logs').update({ unit_id: null }).in('unit_id', deletableIds);
    await admin.from('maintenance_logs').update({ unit_id: null }).in('unit_id', deletableIds);

    const { error: delErr } = await admin.from('units').delete().in('id', deletableIds);
    if (delErr) {
      return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
    }

    try {
      await admin.from('system_events').insert({
        event_type: 'units_deleted',
        message: 'حذف وحدات',
        payload: {
          deleted_ids: deletableIds,
          skipped_ids: skippedIds,
          actor_id: user.id,
          actor_email: user.email,
        },
        created_by: user.id,
      });
    } catch {}

    return NextResponse.json(
      { ok: true, deletedIds: deletableIds, skippedIds },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'internal_error' }, { status: 500 });
  }
}

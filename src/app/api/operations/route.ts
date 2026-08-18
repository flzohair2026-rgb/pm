import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

type Operation = 'complete-cleaning' | 'submit-maintenance-request' | 'complete-maintenance';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const body = await req.json().catch(() => ({} as any));
    const operation = String(body?.operation || '').trim() as Operation;
    const unit_id = String(body?.unit_id || '').trim();

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user ?? null;
    if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
    if (!unit_id) return NextResponse.json({ ok: false, error: 'missing_unit_id' }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ ok: false, error: 'missing_service_role' }, { status: 500 });
    }
    const admin = createSupabaseAdminClient(supabaseUrl, serviceKey);

    switch (operation) {
      case 'complete-cleaning': {
        const cleaned_by = user.id;
        const cleaned_at = new Date().toISOString();
        const notes = (body?.notes && String(body.notes).trim()) || null;
        const photo_data = (body?.photo_data && String(body.photo_data).trim()) || null;
        const hotel_id = body?.hotel_id ? String(body.hotel_id) : null;
        const unit_number = body?.unit_number ? String(body.unit_number) : '';
        const hotel_name = body?.hotel_name ? String(body.hotel_name) : '';

        const { data: logInsert, error: logError } = await admin
          .from('cleaning_logs')
          .insert({
            unit_id,
            cleaned_by,
            cleaned_at,
            notes,
            photo_data,
            status: 'completed'
          })
          .select('id')
          .single();
        if (logError) return NextResponse.json({ ok: false, error: logError.message }, { status: 500 });

        const { error: unitError } = await admin.from('units').update({ status: 'available' }).eq('id', unit_id);
        if (unitError) return NextResponse.json({ ok: false, error: unitError.message }, { status: 500 });

        try {
          const msg = `تم تنظيف الغرفة ${unit_number} ${hotel_name ? 'في الفندق ' + hotel_name : ''}`;
          await admin.from('system_events').insert({
            event_type: 'cleaning_finished',
            unit_id,
            hotel_id,
            message: msg,
            payload: {
              actor_id: cleaned_by,
              actor_email: user.email,
              notes,
              cleaning_log_id: logInsert?.id || null,
              cleaned_at
            }
          });
        } catch {}

        return NextResponse.json({ ok: true, cleaning_log_id: logInsert?.id || null });
      }

      case 'submit-maintenance-request': {
        const issue_type = String(body?.issue_type || 'other').trim();
        const notes = (body?.notes && String(body.notes).trim()) || null;
        const photo_before = (body?.photo_before && String(body.photo_before).trim()) || null;

        if (!photo_before) {
          return NextResponse.json({ ok: false, error: 'photo_before_required' }, { status: 400 });
        }

        const { data: logInsert, error: logError } = await admin
          .from('maintenance_logs')
          .insert({
            unit_id,
            issue_type,
            reported_by: user.id,
            reported_at: new Date().toISOString(),
            notes,
            photo_before,
            status: 'pending'
          })
          .select('id')
          .single();
        if (logError) return NextResponse.json({ ok: false, error: logError.message }, { status: 500 });

        const { error: unitError } = await admin.from('units').update({ status: 'maintenance' }).eq('id', unit_id);
        if (unitError) return NextResponse.json({ ok: false, error: unitError.message }, { status: 500 });

        return NextResponse.json({ ok: true, maintenance_log_id: logInsert?.id || null });
      }

      case 'complete-maintenance': {
        const completion_notes = (body?.completion_notes && String(body.completion_notes).trim()) || null;
        const photo_after = (body?.photo_after && String(body.photo_after).trim()) || null;
        const performed_at = new Date().toISOString();
        const performed_by = user.id;

        if (!photo_after) {
          return NextResponse.json({ ok: false, error: 'photo_after_required' }, { status: 400 });
        }

        const { data: existingLogs } = await admin
          .from('maintenance_logs')
          .select('id, status')
          .eq('unit_id', unit_id)
          .in('status', ['pending', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(1);
        const targetId = (existingLogs && existingLogs.length > 0) ? existingLogs[0].id : null;

        if (targetId) {
          const { error: updErr } = await admin
            .from('maintenance_logs')
            .update({
              performed_by,
              performed_at,
              completion_notes,
              photo_after,
              status: 'completed'
            })
            .eq('id', targetId);
          if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
        } else {
          const { error: insErr } = await admin
            .from('maintenance_logs')
            .insert({
              unit_id,
              issue_type: 'other',
              reported_by: user.id,
              reported_at: new Date().toISOString(),
              performed_by,
              performed_at,
              completion_notes,
              photo_after,
              status: 'completed'
            });
          if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
        }

        const { error: unitError } = await admin.from('units').update({ status: 'cleaning' }).eq('id', unit_id);
        if (unitError) return NextResponse.json({ ok: false, error: unitError.message }, { status: 500 });

        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ ok: false, error: 'unknown_operation' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[api/operations] error:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'unknown_error' }, { status: 500 });
  }
}

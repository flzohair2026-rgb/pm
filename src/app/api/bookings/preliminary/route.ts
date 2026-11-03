import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import {
  createPreliminaryBooking,
  type PreliminaryBookingInput,
} from '@/lib/bookings/preliminary-service';

export const runtime = 'nodejs';

const getAdminSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  return createSupabaseAdmin(supabaseUrl, serviceKey);
};

export async function POST(req: Request) {
  try {
    const body: Partial<PreliminaryBookingInput> = (await req.json().catch(() => ({}))) || {};

    const payload: PreliminaryBookingInput = {
      unit_id: String(body?.unit_id || '').trim(),
      check_in: String(body?.check_in || '').trim(),
      check_out: String(body?.check_out || '').trim(),
      customer_name: String(body?.customer_name || '').trim(),
      customer_phone: body?.customer_phone ? String(body.customer_phone).trim() : undefined,
      national_id: body?.national_id ? String(body.national_id).trim() : undefined,
      email: body?.email ? String(body.email).trim() : undefined,
      daily_rate: typeof body?.daily_rate === 'number' ? body.daily_rate : undefined,
      deposit_amount: typeof body?.deposit_amount === 'number' ? body.deposit_amount : 0,
      deposit_paid: Boolean(body?.deposit_paid ?? false),
      notes: body?.notes ? String(body.notes).trim() : undefined,
      booking_source: (body?.booking_source as any) || 'quick',
      booking_type: (body?.booking_type as any) || 'quick',
      external_reference: body?.external_reference
        ? String(body.external_reference).trim()
        : undefined,
    };

    const admin = getAdminSupabase();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error_code: 'server_config', error: 'إعدادات الخادم غير مكتملة' },
        { status: 500 },
      );
    }

    const result = await createPreliminaryBooking(admin, payload);
    if (!result.ok) {
      const status =
        result.error_code === 'date_conflict' || result.error_code === 'duplicate_external_ref'
          ? 409
          : result.error_code === 'invalid_input' ||
              result.error_code === 'invalid_dates' ||
              result.error_code === 'unit_not_found'
            ? 400
            : 500;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    console.error('[bookings/preliminary] error:', err);
    return NextResponse.json(
      { ok: false, error_code: 'internal_error', error: err?.message || 'حدث خطأ داخلي' },
      { status: 500 },
    );
  }
}

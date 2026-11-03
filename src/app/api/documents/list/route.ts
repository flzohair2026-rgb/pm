import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const offset = Number(body?.offset ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0) {
      return NextResponse.json({ ok: false, error: 'invalid_offset' }, { status: 400 });
    }
    const docType       = body?.doc_type       || null;
    const unitNumber    = body?.unit_number    || null;
    const customerId    = body?.customer_id    || null;
    const customerName  = (body?.customer_name || '').trim();
    const dateFrom      = body?.date_from      || null;
    const dateTo        = body?.date_to        || null;
    const bookingId     = body?.booking_id     || null;
    const query         = String(body?.query || '').trim();

    // =============================================================
    // استعلام واحد قوي يجمع بيانات المستند مع:
    //   - العميل (الاسم والهاتف) من جدول customers
    //   - الوحدة (النوع + الاسم المعروف) من جدول units
    //   - الحجز المرتبط من جدول bookings عبر customer_id + unit_id
    //     (لأن الـ upload لا يخزن booking_id في documents نفسه لكنه
    //      يخزنه في system_events تحت event_type=document_uploaded)
    // =============================================================

    let q = supabase
      .from('documents')
      .select(`
        id,
        doc_type,
        unit_id,
        unit_number,
        customer_id,
        storage_path,
        content_type,
        doc_date,
        uploaded_at,
        customer:customers(id, full_name, phone, national_id),
        unit:units(id, unit_number, unit_type_id, status)
      `)
      .order('uploaded_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + 299);

    if (docType)      q = q.eq('doc_type', docType);
    if (unitNumber)   q = q.ilike('unit_number', `%${unitNumber}%`);
    if (customerId)   q = q.eq('customer_id', customerId);
    if (dateFrom)     q = q.gte('doc_date', dateFrom);
    if (dateTo)       q = q.lte('doc_date', String(dateTo).includes('T') ? dateTo : `${dateTo}T23:59:59`);

    const { data, error } = await q;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // --- البحث الديناميكي (الاسم/الغرفة/النوع/المسار) داخل الخادم ---
    let rows = (data || []) as any[];
    if (customerName) {
      rows = rows.filter(r =>
        String(r?.customer?.full_name || '').includes(customerName) ||
        String(r?.customer?.full_name || '').toLowerCase().includes(customerName.toLowerCase())
      );
    }
    if (query) {
      const qq = query.toLowerCase();
      rows = rows.filter(r =>
        String(r?.unit_number || '').toLowerCase().includes(qq) ||
        String(r?.storage_path || '').toLowerCase().includes(qq) ||
        String(r?.customer?.full_name || '').toLowerCase().includes(qq) ||
        String(r?.customer?.phone || '').includes(qq) ||
        String(r?.doc_type || '').toLowerCase().includes(qq)
      );
    }

    // --- إضافة بيانات الحجز المُستنتجة لكل مستند ---
    // البحث في system_events عن أول حدث document_uploaded يحمل هذا المستند
    // للحصول على booking_id الدقيق.
    const docIds = rows.map(r => String(r.id));
    const eventBookingMap = new Map<string, any>();
    if (docIds.length > 0) {
      try {
        const paths = [...new Set(rows.map(r => String(r.storage_path || '')).filter(Boolean))];
        for (let pathOffset = 0; pathOffset < paths.length; pathOffset += 30) {
          for (let eventOffset = 0; ; eventOffset += 500) {
            const { data: evs, error: eventsError } = await supabase
              .from('system_events')
              .select('id, event_type, booking_id, created_by, payload, created_at')
              .eq('event_type', 'document_uploaded')
              .in('payload->>path', paths.slice(pathOffset, pathOffset + 30))
              .order('created_at', { ascending: false })
              .order('id', { ascending: false })
              .range(eventOffset, eventOffset + 499);
            if (eventsError) throw eventsError;
            (evs || []).forEach((ev: any) => {
              const payloadPath = String(ev?.payload?.path || '').toLowerCase();
              const payloadBookingId = String(ev?.payload?.booking_id || ev?.booking_id || '').trim();
              if (!payloadBookingId) return;
              if (!payloadPath) return;
              if (eventBookingMap.has(payloadPath)) return;
              // نربط عبر مسار التخزين (فريد تماماً لكل ملف مرفوع)
              eventBookingMap.set(payloadPath, {
                booking_id: payloadBookingId,
                uploaded_by: ev?.created_by || null,
                uploaded_at: ev?.created_at || null,
                requested_type: String(ev?.payload?.requested_type || '').trim()
              });
            });
            if (!evs || evs.length < 500) break;
          }
        }
      } catch {
        // A booking filter must never silently return unrelated documents.
        if (bookingId) return NextResponse.json({ ok: false, error: 'booking_lookup_failed' }, { status: 500 });
      }
    }

    // إزالة التكرارات عبر مسار التخزين ثم إعداد النتيجة
    const dedupMap = new Map<string, any>();
    for (const d of rows) {
      const key = (d.storage_path || '').toLowerCase() || d.id;
      if (!dedupMap.has(key)) dedupMap.set(key, d);
    }

    const result: any[] = [];
    for (const d of dedupMap.values()) {
      const { data: pub } = supabase.storage.from('documents').getPublicUrl(d.storage_path);
      const ev = eventBookingMap.get((d.storage_path || '').toLowerCase()) || null;
      if (bookingId && ev?.booking_id !== String(bookingId)) continue;
      result.push({
        id: d.id,
        doc_type: d.doc_type,
        unit_id: d.unit_id,
        unit_number: d.unit_number,
        unit_type_id: (d.unit as any)?.unit_type_id || null,
        customer_id: d.customer_id,
        customer_full_name: (d.customer as any)?.full_name || null,
        customer_phone: (d.customer as any)?.phone || null,
        customer_national_id: (d.customer as any)?.national_id || null,
        storage_path: d.storage_path,
        content_type: d.content_type,
        doc_date: d.doc_date,
        uploaded_at: d.uploaded_at,
        public_url: pub?.publicUrl || null,
        // البيانات المستخرجة من system_events (booking_id الحقيقي من تفاصيل الحجز)
        booking_id: ev?.booking_id || null,
        upload_actor_id: ev?.uploaded_by || null,
        requested_doc_type: ev?.requested_type || null,
      });
    }

    return NextResponse.json({ ok: true, documents: result, next_offset: data?.length === 300 ? offset + 300 : null }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'internal' }, { status: 500 });
  }
}

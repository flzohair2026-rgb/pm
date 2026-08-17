import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';

export const runtime = 'edge';

// 🔒 المعرف الثابت للسوبر أدمن المحمي:
//    أولاً: SUPER_ADMIN_ID (الخاص خفي في الخادم — الأفضل للأمان لأنه لا يظهر في المتصفح)
//    ثانياً: NEXT_PUBLIC_SUPER_ADMIN_ID (إن لم يوجد الخاص)
//    ثالثاً: fallback مطابق لملف super_admin_protection.sql (كحل أخير)
const SUPER_ADMIN_ID: string =
  process.env.SUPER_ADMIN_ID ||
  process.env.NEXT_PUBLIC_SUPER_ADMIN_ID ||
  '';

async function resolveTargetUserId(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let targetUserId: string | undefined;
  try {
    const { id } = await ctx.params;
    targetUserId = id;
  } catch {}
  if (!targetUserId) {
    try {
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const last = pathParts[pathParts.length - 1];
      if (last && last !== 'users') targetUserId = last;
      if (!targetUserId) {
        const q = url.searchParams.get('id');
        if (q) targetUserId = q;
      }
    } catch {}
  }
  return targetUserId;
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const { data: myProfile, error: roleErr } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .maybeSingle();
    if (roleErr) {
      return NextResponse.json({ ok: false, error: roleErr.message }, { status: 500 });
    }
    if (!myProfile || myProfile.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const targetUserId = await resolveTargetUserId(req, ctx);
    if (!targetUserId) {
      return NextResponse.json({ ok: false, error: 'missing_user_id' }, { status: 400 });
    }
    if (targetUserId === user.id) {
      return NextResponse.json({ ok: false, error: 'cannot_delete_self' }, { status: 400 });
    }

    // 🔒 طبقة الحماية في الـ API: منع حذف السوبر أدمن مهما كانت طريقة الوصول
    if (targetUserId === SUPER_ADMIN_ID) {
      return NextResponse.json(
        { ok: false, error: 'super_admin_cannot_be_deleted', reason: 'هذا المستخدم هو سوبر أدمن محمي ولا يمكن حذفه حتى ناعماً من قبل أي شخص حتى أدمن آخر.' },
        { status: 403 }
      );
    }

    // ============================================================
    //  🛡️  نظام Soft Delete الجديد (حفظ اللوجات وعدم كسر FK)
    //  الخطوتين تُنفذان معاً دائماً (بغض النظر عن mode):
    //  1) حظر المستخدم من Auth مدى الحياة → لا يستطيع تسجيل الدخول
    //  2) تعيين علامات Soft Delete في profiles → يختفي من القوائم
    //  لماذا؟ لأنه لا يمكن حذف المستخدم نهائياً بسبب Foreign Keys في
    //  cleaning_logs / maintenance_logs / staff_notes تشير إلى
    //  auth.users(id) أو profiles(id) مع ON DELETE NO ACTION.
    // ============================================================

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // --- الخطوة 1: حظر المستخدم من Auth (إذا توفرت Service Role) ---
    let banResult: { ok: boolean; banned_until: any; error?: string } = { ok: false, banned_until: null };
    if (supabaseUrl && serviceKey) {
      try {
        const admin = createSupabaseClient(supabaseUrl, serviceKey);
        const { data, error: banErr } = await admin.auth.admin.updateUserById(
          targetUserId,
          { ban_duration: '87600h' } // 10 سنوات = حظر دائم فعلي
        );
        if (!banErr) {
          banResult = { ok: true, banned_until: (data as any)?.user?.banned_until ?? null };
        } else {
          banResult = { ok: false, banned_until: null, error: banErr.message };
        }
      } catch (e: any) {
        banResult = { ok: false, banned_until: null, error: e?.message };
      }
    }

    // --- الخطوة 2: علامات Soft Delete في جدول profiles ---
    //    (هذه الخطوة الإلزامية — لا نحذف الصف أبداً)
    const { error: profErr } = await supabase
      .from('profiles')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id
      } as any)
      .eq('id', targetUserId);
    if (profErr) {
      return NextResponse.json({ ok: false, error: profErr.message }, { status: 500 });
    }

    // --- الخطوة 3: تسجيل حدث في النظام ---
    try {
      await supabase.from('system_events').insert({
        event_type: 'user_soft_deleted',
        message: banResult.ok
          ? 'حذف ناعم + حظر Auth — تمت الإزالة مع الحفاظ على كافة اللوجات'
          : 'حذف ناعم في النظام فقط (غير مهيأ Service Role للحظر)',
        payload: {
          target_user_id: targetUserId,
          actor_id: user.id,
          actor_email: user.email,
          auth_ban_applied: banResult.ok,
          auth_ban_error: banResult.error || null
        }
      } as any);
    } catch {}

    return NextResponse.json(
      { ok: true, mode: 'soft', auth_banned: banResult.ok, banned_until: banResult.banned_until },
      { status: 200 }
    );

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'internal_error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const { data: myProfile, error: roleErr } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .maybeSingle();
    if (roleErr) {
      return NextResponse.json({ ok: false, error: roleErr.message }, { status: 500 });
    }
    if (!myProfile || myProfile.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const targetUserId = await resolveTargetUserId(req, ctx);
    if (!targetUserId) {
      return NextResponse.json({ ok: false, error: 'missing_user_id' }, { status: 400 });
    }
    if (targetUserId === user.id) {
      return NextResponse.json({ ok: false, error: 'cannot_ban_self' }, { status: 400 });
    }

    // 🔒 طبقة الحماية في الـ API: منع حظر/رفع حظر السوبر أدمن
    if (targetUserId === SUPER_ADMIN_ID) {
      return NextResponse.json(
        { ok: false, error: 'super_admin_cannot_be_banned', reason: 'هذا المستخدم هو سوبر أدمن محمي ولا يمكن حظره أو رفع حظره من قبل أي شخص حتى أدمن آخر.' },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as any;
    const action = String(body?.action || '').toLowerCase();
    if (action !== 'ban' && action !== 'unban') {
      return NextResponse.json({ ok: false, error: 'invalid_action' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ ok: false, error: 'missing_service_role' }, { status: 409 });
    }

    const admin = createSupabaseClient(supabaseUrl, serviceKey);
    const banDuration = action === 'ban' ? '87600h' : 'none';
    const { data, error } = await admin.auth.admin.updateUserById(targetUserId, { ban_duration: banDuration });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    try {
      await supabase.from('system_events').insert({
        event_type: action === 'ban' ? 'user_banned' : 'user_unbanned',
        message: action === 'ban' ? 'حظر مستخدم' : 'رفع الحظر عن مستخدم',
        payload: { target_user_id: targetUserId, actor_id: user.id, actor_email: user.email }
      });
    } catch {}

    return NextResponse.json(
      { ok: true, action, banned_until: (data as any)?.user?.banned_until ?? null },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'internal_error' }, { status: 500 });
  }
}

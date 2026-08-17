import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export const runtime = 'edge';

// 🔒 رمز التحقق الإضافي للأدمن — يأتي فقط من متغير البيئة الخاص بالخادم
//    (لا يُعرض هذا المتغير في المكونات العميلة أبداً — الأمان المفضل)
const EXPECTED_CODE: string = (process.env.ADMIN_EXTRA_AUTH_CODE || '').trim();

// الأدوار المحمية (نرى الدور من profile و نتحقق هنا كطبقة حماية ثانية)
const PROTECTED_ROLES = new Set(['admin', 'super_admin']);

export async function POST(req: Request) {
  try {
    // 1) فحص: هل الرمز مهيأ في الخادم أصلاً؟ (أمان إضافي)
    if (!EXPECTED_CODE) {
      return NextResponse.json(
        { ok: false, error: 'extra_auth_not_configured', reason: 'لم يتم تهيئة رمز التحقق الإضافي على الخادم بعد.' },
        { status: 409 }
      );
    }

    // 2) فحص المستخدم مسجل الدخول فعلاً + دوره هو أدمن أو سوبر أدمن
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_super_admin, is_deleted')
      .eq('id', user.id)
      .maybeSingle();

    const role: string = (
      (profile as any)?.is_super_admin === true
        ? 'super_admin'
        : (profile as any)?.role ?? 'guest'
    ).toLowerCase();

    if (!PROTECTED_ROLES.has(role)) {
      return NextResponse.json(
        { ok: false, error: 'role_not_protected', reason: 'هذا الدور لا يتطلب تحققاً إضافياً.' },
        { status: 403 }
      );
    }
    if ((profile as any)?.is_deleted === true) {
      return NextResponse.json({ ok: false, error: 'account_suspended' }, { status: 403 });
    }

    // 3) قراءة الرمز من الطلب + المقارنة الآمنة (تجاهل مسافات جانبية)
    const body = (await req.json().catch(() => ({}))) as { code?: unknown };
    const incoming = String(body?.code || '').trim();
    if (!incoming) {
      return NextResponse.json(
        { ok: false, error: 'missing_code', reason: 'الرجاء إدخال رمز التحقق.' },
        { status: 400 }
      );
    }

    // 4) مقارنة بسيطة (الرمز ثابت من ENV)
    if (incoming !== EXPECTED_CODE) {
      // (اختياري يمكن إضافة عدد المحاولات هنا لاحقاً مع Rate Limiting)
      return NextResponse.json(
        { ok: false, error: 'invalid_code', reason: 'رمز التحقق الإضافي غير صحيح. تحقق واعد المحاولة.' },
        { status: 401 }
      );
    }

    // 5) النجاح ✅ → نرجع موافقة للعميل ليحفظ الجلسة في localStorage لمدة المحددة
    //    (يمكن لاحقاً تسجيل حدث في system_events للتدقيق الأمني)
    try {
      await supabase.from('system_events').insert({
        event_type: 'admin_extra_auth_passed',
        message: 'أدمن أو سوبر أدمن أتم تحقق إضافي ناجح',
        payload: {
          user_id: user.id,
          user_email: user.email,
          role,
          verified_at: new Date().toISOString(),
          user_agent: (req.headers as any)?.get?.('user-agent') ?? null,
          ip: null  // Edge runtime في بعض البيئات لا تدعم ip مباشرة (يمكن إضافته لاحقاً)
        }
      } as any);
    } catch { /* تجاهل خطأ تسجيل الحدث لا يُعطل العملية */ }

    return NextResponse.json(
      { ok: true, granted: true, role, expires_in_hours: Number(process.env.NEXT_PUBLIC_ADMIN_EXTRA_AUTH_DURATION_HOURS) || 12 },
      { status: 200 }
    );

  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: 'internal_error', reason: e?.message || 'خطأ داخلي أثناء التحقق.' },
      { status: 500 }
    );
  }
}

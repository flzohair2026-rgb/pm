'use client';

import React from 'react';
import Link from 'next/link';
import {
  FileBarChart,
  TrendingUp,
  DollarSign,
  Calendar,
  Users,
  Home,
  Send,
  FileDown,
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  DatabaseZap,
  X as XIcon,
} from 'lucide-react';
import RoleGate from '@/components/auth/RoleGate';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

const EXPECTED_TABLES_ORDER: string[] = [
  'accounting_periods',
  'cost_centers',
  'accounts',
  'hotels',
  'unit_types',
  'payment_methods',
  'customers',
  'customer_accounts',
  'profiles',
  'units',
  'bookings',
  'temporary_reservations',
  'invoices',
  'journal_entries',
  'payments',
  'payment_allocations',
  'journal_lines',
  'system_events',
  'ejar_contract_uploads',
  'documents',
];

export default function ReportsPage() {
  const { role } = useUserRole();
  const [backupBusy, setBackupBusy] = React.useState(false);
  const [restoreOpen, setRestoreOpen] = React.useState(false);
  const restoreFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [restoreFile, setRestoreFile] = React.useState<File | null>(null);
  const [restoreSheets, setRestoreSheets] = React.useState<
    Array<{ table: string; rows: number; found: boolean }>
  >([]);
  const [restoreConfirm, setRestoreConfirm] = React.useState(false);
  const [restoreBusy, setRestoreBusy] = React.useState(false);
  const [restoreResult, setRestoreResult] = React.useState<any>(null);

  const reports = [
    {
      title: 'عقود منصة إيجار',
      description: 'عرض العقود التي تم تسجيل رفعها إلى منصة إيجار.',
      icon: Send,
      color: 'bg-emerald-100 text-emerald-600',
      href: '/reports/ejar-contracts',
      isAdminOnly: false
    },
    {
      title: 'التقرير الشامل',
      description: 'تقرير يجمع كافة العمليات المالية (فواتير، سندات، حجوزات) في جدول واحد مفصل.',
      icon: FileBarChart,
      color: 'bg-amber-100 text-amber-600',
      href: '/reports/comprehensive',
      isAdminOnly: true
    },
    {
      title: 'ميزان المراجعة',
      description: 'كشف بأرصدة جميع الحسابات (أصول، خصوم، إيرادات، مصروفات) للتحقق من توازن القيد المزدوج.',
      icon: FileBarChart,
      color: 'bg-indigo-100 text-indigo-600',
      href: '/reports/trial-balance',
      isAdminOnly: true,
      hideFromMarketing: true
    },
    {
      title: 'تقرير المديونية',
      description: 'كشف بالمديونية حسب العملاء اعتمادًا على الفواتير والمدفوعات.',
      icon: Users,
      color: 'bg-rose-100 text-rose-600',
      href: '/reports/receivables',
      isAdminOnly: true
    },
    {
      title: 'تقرير الإيرادات',
      description: 'ملخص الإيرادات اليومية والشهرية والسنوية',
      icon: DollarSign,
      color: 'bg-green-100 text-green-600',
      href: '/reports/revenue',
      isAdminOnly: true
    },
    {
      title: 'تقرير مراكز التكلفة',
      description: 'تجميع العمليات المالية حسب الفنادق والشقق كوحدات تكلفة.',
      icon: TrendingUp,
      color: 'bg-blue-100 text-blue-600',
      href: '/reports/cost-centers',
      isAdminOnly: true,
      hideFromMarketing: true
    },
    {
      title: 'تقرير الإشغال',
      description: 'نسب الإشغال للوحدات والغرف',
      icon: TrendingUp,
      color: 'bg-cyan-100 text-cyan-600',
      href: '/reports/occupancy',
      isAdminOnly: false
    },
    {
      title: 'سجل الحجوزات',
      description: 'تقرير تفصيلي عن جميع الحجوزات وحالاتها',
      icon: Calendar,
      color: 'bg-purple-100 text-purple-600',
      href: '/reports/bookings-log',
      isAdminOnly: false
    },
    {
      title: 'التحديثيات',
      description: 'عرض حالة كل وحدة مع تاريخ الخروج إن كانت عليها حجز.',
      icon: Home,
      color: 'bg-emerald-100 text-emerald-600',
      href: '/reports/updates',
      isAdminOnly: false
    },
    {
      title: 'تقرير اليوم',
      description: 'تقرير منظم لكل ما حدث اليوم (حجوزات، دخول/خروج، سندات، فواتير، متبقي).',
      icon: Calendar,
      color: 'bg-blue-100 text-blue-600',
      href: '/reports/daily',
      isAdminOnly: false,
      hideFromMarketing: true
    },
    {
      title: 'تقرير العملاء',
      description: 'تحليل بيانات العملاء والأكثر تردداً',
      icon: Users,
      color: 'bg-orange-100 text-orange-600',
      href: '#',
      isAdminOnly: false
    }
  ];

  const filteredReports = reports.filter(r => {
    // Admin and Accountant see everything
    if (role === 'admin' || role === 'accountant') return true;
    
    // Marketing sees everything except accounting reports (Trial Balance and Cost Centers)
    if (role === 'marketing') return !r.hideFromMarketing;
    
    // Managers see all reports except accounting-only reports
    if (role === 'manager') return !['/reports/comprehensive', '/reports/trial-balance'].includes(r.href);

    // Receptionists see daily report and public reports
    if (role === 'receptionist') return r.href === '/reports/daily' || (!r.isAdminOnly && !r.hideFromMarketing);
    
    // Others see only public reports
    return !r.isAdminOnly && !r.hideFromMarketing;
  });

  const handleLogReportView = async (reportTitle: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('system_events').insert({
        event_type: 'report_viewed',
        message: `تم عرض تقرير: ${reportTitle}`,
        payload: {
          report_title: reportTitle,
          actor_id: user?.id || null,
          actor_email: user?.email || null
        }
      });
    } catch {}
  };

  const downloadBackup = async () => {
    if (backupBusy) return;
    try {
      setBackupBusy(true);
      const res = await fetch('/api/admin/backup', { method: 'GET' });
      if (!res.ok) {
        const js = await res.json().catch(() => null);
        const code = String(js?.error || '');
        if (res.status === 409 && code === 'missing_service_role') {
          alert('لا يمكن إنشاء نسخة احتياطية كاملة: مفتاح الخدمة غير مُعد (SUPABASE_SERVICE_ROLE_KEY).');
          return;
        }
        if (res.status === 403) {
          alert('غير مصرح: النسخة الاحتياطية متاحة للأدمن فقط.');
          return;
        }
        alert(`تعذر إنشاء النسخة الاحتياطية: ${js?.error || res.statusText || 'خطأ غير معروف'}`);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().replace(/[:]/g, '-').replace('T', '_').slice(0, 19);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${stamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBackupBusy(false);
    }
  };

  const resetRestoreForm = () => {
    setRestoreFile(null);
    setRestoreSheets([]);
    setRestoreConfirm(false);
    setRestoreResult(null);
    if (restoreFileInputRef.current) {
      restoreFileInputRef.current.value = '';
    }
  };

  const handleRestoreFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreConfirm(false);
    setRestoreResult(null);
    const file = e.target.files?.[0] || null;
    setRestoreFile(file);
    if (!file) {
      setRestoreSheets([]);
      return;
    }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      alert('يرجى اختيار ملف XLSX صالح (نفس الملف الذي تم تنزيله من زر النسخة الاحتياطية).');
      setRestoreFile(null);
      setRestoreSheets([]);
      if (restoreFileInputRef.current) restoreFileInputRef.current.value = '';
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetMap: Record<string, number> = {};
      wb.SheetNames.forEach((sn) => {
        const sh = wb.Sheets[sn];
        const rows = XLSX.utils.sheet_to_json(sh, { defval: null });
        sheetMap[sn] = rows.length;
      });
      const detected = EXPECTED_TABLES_ORDER.map((t) => {
        const exact = sheetMap[t];
        if (typeof exact === 'number') return { table: t, rows: exact, found: true };
        const lowerT = t.toLowerCase();
        const candidate = Object.keys(sheetMap).find((k) => k.toLowerCase() === lowerT);
        if (candidate) return { table: t, rows: sheetMap[candidate], found: true };
        return { table: t, rows: 0, found: false };
      });
      setRestoreSheets(detected);
    } catch (err: any) {
      alert(`تعذر قراءة ملف الإكسل: ${String(err?.message || err)}`);
      setRestoreFile(null);
      setRestoreSheets([]);
      if (restoreFileInputRef.current) restoreFileInputRef.current.value = '';
    }
  };

  const handleRunRestore = async () => {
    if (!restoreFile || restoreBusy) return;
    if (!restoreConfirm) {
      alert('يرجى تأكيد الخيار أعلاه أولاً (أقر بأنني أريد حذف وكتابة جميع البيانات).');
      return;
    }
    const sheetFound = restoreSheets.filter((s) => s.found).length;
    const shouldProceed = window.confirm(
      `هذه العملية خطيرة جداً ولا يمكن التراجع عنها.\n\n` +
        `سيتم حذف جميع الصفوف الموجودة حالياً ثم كتابة ${sheetFound} جداول من الملف المحدد.\n\n` +
        `هل أنت متأكد 100% من المتابعة؟\n` +
        `اكتب نعم إذا أردت المتابعة حرفياً:`,
    );
    if (!shouldProceed) return;
    try {
      setRestoreBusy(true);
      setRestoreResult(null);
      const formData = new FormData();
      formData.append('file', restoreFile);
      formData.append('confirm', 'yes_iam_sure_i_want_to_overwrite_all_data');
      const res = await fetch('/api/admin/restore', {
        method: 'POST',
        body: formData,
      });
      const js = await res.json().catch(() => null);
      if (!res.ok) {
        setRestoreResult({ ok: false, error: js?.error || res.statusText || 'خطأ غير معروف', details: js || null });
        return;
      }
      setRestoreResult({ ok: true, ...js });
    } catch (err: any) {
      setRestoreResult({ ok: false, error: String(err?.message || err || 'خطأ في الشبكة') });
    } finally {
      setRestoreBusy(false);
    }
  };

  return (
    <RoleGate allow={['admin', 'manager', 'accountant', 'marketing', 'receptionist']}>
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-emerald-950">التقارير</h1>
          <p className="text-emerald-900/60 mt-1 font-bold">تقارير وإحصائيات الأداء المالي والتشغيلي</p>
        </div>
        {role === 'admin' ? (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={downloadBackup}
              disabled={backupBusy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-l from-emerald-700 via-emerald-800 to-emerald-900 text-white font-extrabold shadow-sm ring-1 ring-emerald-900/20 hover:from-emerald-800 hover:via-emerald-900 hover:to-emerald-950 disabled:opacity-60"
            >
              <FileDown size={18} />
              <span>{backupBusy ? 'جارٍ تجهيز النسخة...' : 'نسخة احتياطية'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                resetRestoreForm();
                setRestoreOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-l from-rose-600 via-red-700 to-rose-800 text-white font-extrabold shadow-sm ring-1 ring-rose-900/20 hover:from-rose-700 hover:via-red-800 hover:to-rose-900"
            >
              <UploadCloud size={18} />
              <span>استعادة نسخة احتياطية</span>
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredReports.map((report, index) => (
          <Link 
            key={index} 
            href={report.href}
            className="block"
            onClick={() => handleLogReportView(report.title)}
          >
            <div 
              className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm ring-1 ring-emerald-200/70 hover:shadow-md hover:bg-emerald-50/30 transition-all cursor-pointer group h-full"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ring-1 ring-emerald-200/70 ${report.color}`}>
                  <report.icon size={24} />
                </div>
                <div className="bg-emerald-50 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ring-1 ring-emerald-200/60">
                  <FileBarChart size={16} className="text-emerald-700/70" />
                </div>
              </div>
              
              <h3 className="text-base sm:text-lg font-extrabold text-emerald-950 mb-2">{report.title}</h3>
              <p className="text-emerald-900/60 text-sm leading-relaxed font-bold">
                {report.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
      
      <div className="bg-gradient-to-r from-emerald-50 via-white to-white border border-emerald-200/70 rounded-2xl p-6 text-center mt-8 shadow-sm">
        <h3 className="text-lg font-extrabold text-emerald-950 mb-2">هل تحتاج تقارير مخصصة؟</h3>
        <p className="text-emerald-900/70 mb-4 font-bold">
          يمكنك طلب تقارير مخصصة حسب احتياجاتك من فريق الدعم الفني.
        </p>
        <button className="bg-gradient-to-l from-emerald-700 via-emerald-800 to-emerald-900 text-white px-6 py-2 rounded-xl font-extrabold hover:from-emerald-800 hover:via-emerald-900 hover:to-emerald-950 transition-colors shadow-sm ring-1 ring-emerald-900/20">
          تواصل مع الدعم
        </button>
      </div>

      {restoreOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto p-4 sm:p-8 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl ring-1 ring-emerald-200 my-6">
            <div className="sticky top-0 z-10 bg-gradient-to-l from-rose-50 via-white to-rose-50 rounded-t-2xl border-b border-rose-100 px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-gradient-to-l from-rose-600 via-red-700 to-rose-800 text-white shadow-sm">
                  <DatabaseZap size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-extrabold text-rose-950 truncate">استعادة نسخة احتياطية</h2>
                  <p className="text-sm text-rose-900/65 font-bold truncate">تطبيق بيانات ملف الإكسل على جداول قاعدة البيانات (بدون لمس الهيكل)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (restoreBusy) return;
                  setRestoreOpen(false);
                  resetRestoreForm();
                }}
                className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/80 text-rose-900/70 ring-1 ring-rose-200 hover:text-rose-900 hover:bg-rose-50"
                aria-label="إغلاق"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 ring-1 ring-rose-200/70 border border-rose-100">
                <ShieldAlert className="shrink-0 text-rose-700 mt-0.5" size={22} />
                <div className="text-sm font-bold leading-relaxed text-rose-950 space-y-1">
                  <p>
                    هذه العملية <span className="underline decoration-wavy decoration-rose-500/70">خطيرة ولا يمكن التراجع عنها</span>.
                  </p>
                  <p className="text-rose-900/85">
                    قبل المتابعة تأكد من أن:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-rose-900/85 pr-2">
                    <li>قاعدة البيانات الحالية تحتوي على الهيكل الصحيح (001 → 006 مطبقة).</li>
                    <li>هذا الملف هو نفس الملف الذي نزلته من زر <span className="font-black">«نسخة احتياطية»</span> في هذه الصفحة.</li>
                    <li>لديك نسخة احتياطية حديثة أخرى جاهزة في حال حدوث خطأ.</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/40 ring-1 ring-emerald-200/70">
                <label className="block text-sm font-extrabold text-emerald-950 mb-2">
                  1. اختر ملف النسخة الاحتياطية (.xlsx)
                </label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-emerald-300 rounded-xl cursor-pointer bg-white hover:bg-emerald-50/60 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-4 pb-5 px-4">
                      <UploadCloud className="mb-2 text-emerald-700/75" size={26} />
                      <p className="mb-1 text-sm font-bold text-emerald-950">
                        {restoreFile ? `الملف المختار: ${restoreFile.name}` : 'اضغط لاختيار الملف أو اسحبه هنا'}
                      </p>
                      {restoreFile ? (
                        <p className="text-xs text-emerald-900/65 font-bold">
                          الحجم: {(restoreFile.size / 1024).toFixed(1)} كيلوبايت
                        </p>
                      ) : (
                        <p className="text-xs text-emerald-900/55 font-bold">فقط ملفات .xlsx التي تم إنشاؤها من النظام</p>
                      )}
                    </div>
                    <input
                      ref={restoreFileInputRef}
                      type="file"
                      accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
                      className="hidden"
                      onChange={handleRestoreFileChange}
                      disabled={restoreBusy}
                    />
                  </label>
                </div>
              </div>

              {restoreFile && restoreSheets.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-extrabold text-emerald-950">
                      2. ملخص الجداول الموجودة في الملف
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900/70 bg-emerald-50 px-2.5 py-1 rounded-lg ring-1 ring-emerald-200/70">
                      <span>
                        {restoreSheets.filter((s) => s.found).length} / {restoreSheets.length} جداول
                      </span>
                      <span>·</span>
                      <span>
                        {restoreSheets.reduce((a, s) => a + s.rows, 0).toLocaleString('ar-SA')} صف
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-auto rounded-xl ring-1 ring-emerald-200/60 bg-white p-2">
                    {restoreSheets.map((s) => (
                      <div
                        key={s.table}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold ring-1 ${
                          s.found
                            ? 'bg-emerald-50 text-emerald-950 ring-emerald-200/70'
                            : 'bg-slate-50 text-slate-600 ring-slate-200/70'
                        }`}
                      >
                        {s.found ? (
                          <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                        ) : (
                          <AlertTriangle size={15} className="shrink-0 text-slate-400" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{s.table}</div>
                          <div className={s.found ? 'text-[11px] text-emerald-900/65' : 'text-[11px] text-slate-500'}>
                            {s.found ? `${s.rows.toLocaleString('ar-SA')} صف` : 'غير موجود'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {restoreFile && restoreSheets.length > 0 ? (
                <label
                  className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer select-none ring-1 transition-colors ${
                    restoreConfirm
                      ? 'bg-rose-50 ring-rose-300 border border-rose-200'
                      : 'bg-slate-50 ring-slate-200 border border-slate-100 hover:bg-rose-50/40 hover:ring-rose-200/70'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={restoreBusy || !restoreSheets.some((s) => s.found)}
                    checked={restoreConfirm}
                    onChange={(e) => setRestoreConfirm(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-rose-700"
                  />
                  <span className="text-sm font-bold leading-relaxed text-slate-900">
                    <span className="font-black text-rose-800">إقرار وتعهد:</span> أقر وأتعهد أنني أريد حذف جميع بيانات جداول قاعدة البيانات الحالية واستبدالها بالبيانات الموجودة في ملف الإكسل المرفوع. أفهم أن هذه العملية لا يمكن التراجع عنها، وأنني قمت مسبقاً بتطبيق هيكل الجداول (ملفات 001 حتى 006) على قاعدة البيانات الهدف.
                  </span>
                </label>
              ) : null}

              {restoreResult ? (
                <div
                  className={`p-4 rounded-xl ring-1 border ${
                    restoreResult.ok
                      ? 'bg-emerald-50 ring-emerald-200/80 border-emerald-100'
                      : 'bg-rose-50 ring-rose-200/80 border-rose-100'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {restoreResult.ok ? (
                      <CheckCircle2 className="shrink-0 text-emerald-700 mt-0.5" size={22} />
                    ) : (
                      <AlertTriangle className="shrink-0 text-rose-700 mt-0.5" size={22} />
                    )}
                    <div className="flex-1 space-y-2 min-w-0">
                      <p className="font-extrabold text-sm">
                        {restoreResult.ok
                          ? `تمت الاستعادة بنجاح — ${(restoreResult.total_rows_restored || 0).toLocaleString('ar-SA')} صف مُستعادة`
                          : `فشلت الاستعادة: ${String(restoreResult.error || 'خطأ غير معروف')}`}
                      </p>
                      {restoreResult.summary && Array.isArray(restoreResult.summary) ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-auto rounded-lg bg-white p-2 ring-1 ring-black/5">
                          {restoreResult.summary.map((s: any) => (
                            <div
                              key={String(s.table)}
                              className={`px-2 py-1.5 rounded-md text-[11px] font-bold ring-1 ${
                                s.status === 'ok'
                                  ? 'bg-emerald-50 text-emerald-950 ring-emerald-200/60'
                                  : s.status === 'warn'
                                  ? 'bg-amber-50 text-amber-950 ring-amber-200/60'
                                  : s.status === 'skipped'
                                  ? 'bg-slate-50 text-slate-600 ring-slate-200/60'
                                  : 'bg-rose-50 text-rose-950 ring-rose-200/60'
                              }`}
                            >
                              <div className="truncate">{s.table}</div>
                              <div className="truncate opacity-80">
                                {s.rows_restored ?? s.rows_deleted ?? 0} صف ·{' '}
                                {s.status === 'ok' ? 'تم' : s.status === 'warn' ? 'تحذير' : s.status === 'skipped' ? 'تخطي' : 'خطأ'}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {restoreResult.details?.failed_at_table ? (
                        <p className="text-xs font-bold text-rose-900/85">
                          الفشل عند الجدول: <span className="font-black">{restoreResult.details.failed_at_table}</span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={restoreBusy}
                  onClick={() => {
                    setRestoreOpen(false);
                    resetRestoreForm();
                  }}
                  className="px-4 py-2 rounded-xl font-extrabold text-sm text-slate-700 bg-white ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleRunRestore}
                  disabled={
                    restoreBusy ||
                    !restoreConfirm ||
                    !restoreFile ||
                    !restoreSheets.some((s) => s.found)
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white font-extrabold text-sm bg-gradient-to-l from-rose-600 via-red-700 to-rose-800 ring-1 ring-rose-900/20 hover:from-rose-700 hover:via-red-800 hover:to-rose-900 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {restoreBusy ? <Loader2 className="animate-spin" size={16} /> : <UploadCloud size={16} />}
                  <span>{restoreBusy ? 'جارٍ تنفيذ الاستعادة...' : 'ابدأ الاستعادة الآن'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
    </RoleGate>
  );
}

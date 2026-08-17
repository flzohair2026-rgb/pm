'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Users, Shield, Edit, X, Check, Loader2, UserPlus, AlertCircle, Trash2, Building2
} from 'lucide-react';
import { format } from 'date-fns';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'manager' | 'receptionist' | 'housekeeping' | 'accountant' | 'marketing';
  created_at: string;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  is_super_admin?: boolean;
}

// 🔒 المعرف الثابت للسوبر أدمن المحمي (من متغير البيئة NEXT_PUBLIC_SUPER_ADMIN_ID
//    مع fallback مطابق لملف super_admin_protection.sql في حال عدم تعيين المتغير)
const SUPER_ADMIN_ID: string =
  (process.env.NEXT_PUBLIC_SUPER_ADMIN_ID as string | undefined) ??
  '';

export default function UserManagementPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [bannedIds, setBannedIds] = useState<Record<string, boolean>>({});
  const [banningId, setBanningId] = useState<string | null>(null);
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('receptionist');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [hotels, setHotels] = useState<Array<{ id: string; name: string }>>([]);
  const [hotelModalOpen, setHotelModalOpen] = useState(false);
  const [hotelUser, setHotelUser] = useState<{ id: string; email: string; full_name?: string } | null>(null);
  const [hotelSelection, setHotelSelection] = useState<Set<string>>(new Set());
  const [hotelSelectionInitial, setHotelSelectionInitial] = useState<Set<string>>(new Set());
  const [defaultHotelId, setDefaultHotelId] = useState<string | null>(null);
  const [savingHotels, setSavingHotels] = useState(false);
  const [loadingHotelsModal, setLoadingHotelsModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // 1. Get Current User Role
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: myProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      setCurrentUserRole(myProfile?.role || null);

      // 2. Fetch All Profiles (فلترة is_deleted = false بشكل افتراضي)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles(data || []);

      const { data: hotelsData } = await supabase
        .from('hotels')
        .select('id, name')
        .order('name', { ascending: true });
      setHotels((hotelsData || []) as any);

    } catch (error: any) {
      console.error('Error fetching users FULL:', JSON.stringify(error, null, 2));
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      console.error('Error hint:', error.hint);
    } finally {
      setLoading(false);
    }
  };

  const openHotelsModal = async (profile: Profile) => {
    setHotelUser({ id: profile.id, email: profile.email, full_name: profile.full_name });
    setHotelModalOpen(true);
    setLoadingHotelsModal(true);
    try {
      const { data: mapRows, error: mapErr } = await supabase
        .from('profile_hotels')
        .select('hotel_id')
        .eq('profile_id', profile.id);
      if (mapErr) throw mapErr;
      const ids = new Set<string>((mapRows || []).map((r: any) => String(r.hotel_id)));
      setHotelSelection(ids);
      setHotelSelectionInitial(new Set(ids));

      const { data: profRow, error: profErr } = await supabase
        .from('profiles')
        .select('default_hotel_id')
        .eq('id', profile.id)
        .maybeSingle();
      if (!profErr) {
        const v = (profRow as any)?.default_hotel_id ? String((profRow as any).default_hotel_id) : null;
        setDefaultHotelId(v && ids.has(v) ? v : null);
      } else {
        setDefaultHotelId(null);
      }
    } catch (e: any) {
      alert(e?.message || 'تعذر تحميل صلاحيات الفروع');
      setHotelModalOpen(false);
      setHotelUser(null);
      setHotelSelection(new Set());
      setHotelSelectionInitial(new Set());
      setDefaultHotelId(null);
    } finally {
      setLoadingHotelsModal(false);
    }
  };

  const closeHotelsModal = () => {
    if (savingHotels) return;
    setHotelModalOpen(false);
    setHotelUser(null);
    setHotelSelection(new Set());
    setHotelSelectionInitial(new Set());
    setDefaultHotelId(null);
  };

  const toggleHotel = (hotelId: string) => {
    setHotelSelection((prev) => {
      const next = new Set(prev);
      if (next.has(hotelId)) next.delete(hotelId);
      else next.add(hotelId);
      return next;
    });
    setDefaultHotelId((prev) => {
      if (!prev) return prev;
      if (prev === hotelId) return null;
      return prev;
    });
  };

  const saveHotels = async () => {
    if (!hotelUser) return;
    setSavingHotels(true);
    try {
      const current = hotelSelectionInitial;
      const next = hotelSelection;

      const toAdd: string[] = [];
      const toRemove: string[] = [];
      next.forEach((id) => {
        if (!current.has(id)) toAdd.push(id);
      });
      current.forEach((id) => {
        if (!next.has(id)) toRemove.push(id);
      });

      if (toRemove.length > 0) {
        const { error: delErr } = await supabase
          .from('profile_hotels')
          .delete()
          .eq('profile_id', hotelUser.id)
          .in('hotel_id', toRemove);
        if (delErr) throw delErr;
      }

      if (toAdd.length > 0) {
        const { error: insErr } = await supabase
          .from('profile_hotels')
          .upsert(
            toAdd.map((hotel_id) => ({ profile_id: hotelUser.id, hotel_id })),
            { onConflict: 'profile_id,hotel_id' }
          );
        if (insErr) throw insErr;
      }

      const finalDefault = defaultHotelId && next.has(defaultHotelId) ? defaultHotelId : null;
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ default_hotel_id: finalDefault, updated_at: new Date().toISOString() })
        .eq('id', hotelUser.id);
      if (updErr) throw updErr;

      setHotelSelectionInitial(new Set(next));
      alert('تم تحديث صلاحيات الفروع');
      closeHotelsModal();
    } catch (e: any) {
      alert(e?.message || 'تعذر حفظ صلاحيات الفروع');
    } finally {
      setSavingHotels(false);
    }
  };

  const handleEditClick = (profile: Profile) => {
    setEditingId(profile.id);
    setSelectedRole(profile.role);
  };

  const handleToggleBan = async (profile: Profile) => {
    if (!profile?.id) return;
    if (profile.id === currentUserId) {
      alert('لا يمكن حظر حسابك الحالي');
      return;
    }
    const isBanned = !!bannedIds[profile.id];
    const confirmText = isBanned
      ? `تأكيد رفع الحظر عن المستخدم:\n${profile.email}`
      : `تأكيد حظر المستخدم:\n${profile.email}\nلن يتمكن من تسجيل الدخول.`;
    if (!window.confirm(confirmText)) return;

    setBanningId(profile.id);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(profile.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isBanned ? 'unban' : 'ban' })
      });
      const body = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        if (body?.error === 'missing_service_role') {
          throw new Error('لا يمكن الحظر حالياً: لم يتم تهيئة مفتاح الخدمة على الخادم');
        }
        throw new Error(body?.error || `فشل العملية (HTTP ${res.status})`);
      }
      setBannedIds(prev => ({ ...prev, [profile.id]: !isBanned }));
      alert(isBanned ? 'تم رفع الحظر' : 'تم حظر المستخدم');
    } catch (e: any) {
      alert(e?.message || 'تعذر تنفيذ العملية');
    } finally {
      setBanningId(null);
    }
  };

  const handleSaveRole = async (userId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('update_user_role', {
        target_user_id: userId,
        new_role: selectedRole
      });

      if (error) throw error;

      // Optimistic Update
      setProfiles(profiles.map(p => 
        p.id === userId ? { ...p, role: selectedRole as any } : p
      ));
      setEditingId(null);
      alert('تم تحديث الصلاحيات بنجاح');

    } catch (error: any) {
      console.error('Update Error:', error);
      alert('خطأ في التحديث: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!userId) return;
    if (!window.confirm(
      `تأكيد حذف المستخدم:\n${email}\n\n` +
      `سيتم تنفيذ ما يلي:\n` +
      `• حظر المستخدم من تسجيل الدخول مدى الحياة\n` +
      `• إزالته من قوائم الموظفين\n` +
      `• الحفاظ على كافة سجلاته (تنظيفات / صيانات / ملاحظات) دون أي تعديل\n\n` +
      `هذه العملية يمكن التراجع عنها لاحقاً عبر قاعدة البيانات.`
    )) {
      return;
    }
    setDeletingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as any));
        throw new Error(body?.error || `فشل الحذف (HTTP ${res.status})`);
      }
      const done = await res.json().catch(() => ({} as any));
      setProfiles(prev => prev.filter(p => p.id !== userId));
      if (done?.auth_banned) {
        alert('تم حذف المستخدم بنجاح:\n• محظور من تسجيل الدخول مدى الحياة\n• جميع سجلاته محفوظة');
      } else {
        alert('تم حذف المستخدم من قوائم الموظفين.\nملاحظة: لم يتم تطبيق حظر Auth (Service Role غير مهيأ).');
      }
    } catch (e: any) {
      alert(e?.message || 'تعذر حذف المستخدم');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (currentUserRole !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
        <Shield size={64} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح لك بالدخول</h1>
        <p className="text-gray-600">هذه الصفحة مخصصة للمشرفين (Admins) فقط.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="text-blue-600" size={18} />
            إدارة المستخدمين والصلاحيات
          </h1>
          <p className="text-xs sm:text-base text-gray-500 mt-0.5 sm:mt-1">عرض وتعديل صلاحيات الموظفين في النظام</p>
        </div>
        
        {/* <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <UserPlus size={18} />
          <span>دعوة مستخدم جديد</span>
        </button> */}
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 flex items-start gap-3">
        <AlertCircle className="text-blue-600 mt-0.5" size={18} />
        <div>
          <h3 className="font-semibold text-blue-900">ملاحظة هامة</h3>
          <div className="text-xs sm:text-sm text-blue-800">
            <p>
              يتم إنشاء المستخدمين تلقائياً عند تسجيلهم لأول مرة. يمكنك هنا تعديل صلاحياتهم بعد التسجيل.
            </p>
            <p className="mt-1">الصلاحيات المتاحة:</p>
            <ul className="list-disc list-inside mt-1">
              <li><b>Admin:</b> تحكم كامل بالنظام.</li>
              <li><b>Manager:</b> إدارة الحجوزات والتقارير (لا يمكنه تعديل الصلاحيات).</li>
              <li><b>Accountant:</b> العمليات المحاسبية، التقارير المالية، والحجوزات.</li>
              <li><b>Marketing:</b> إدارة العملاء، التقارير التشغيلية، ومتابعة حالة الوحدات.</li>
              <li><b>Receptionist:</b> إنشاء وتعديل الحجوزات فقط.</li>
              <li><b>Housekeeping:</b> صيانة وتنظيف الوحدات فقط.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-right text-[11px] sm:text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-2 py-2 sm:px-6 sm:py-4 font-semibold text-gray-900 whitespace-nowrap">الاسم / البريد الإلكتروني</th>
              <th className="px-2 py-2 sm:px-6 sm:py-4 font-semibold text-gray-900 whitespace-nowrap">الصلاحية الحالية</th>
              <th className="px-2 py-2 sm:px-6 sm:py-4 font-semibold text-gray-900 whitespace-nowrap">تاريخ الانضمام</th>
              <th className="px-2 py-2 sm:px-6 sm:py-4 font-semibold text-gray-900 whitespace-nowrap">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {profiles.map((profile) => {
              const isSuperAdmin = profile.id === SUPER_ADMIN_ID || profile.is_super_admin === true;
              const canEditThis = !isSuperAdmin && (profile.id !== currentUserId || editingId !== null);
              return (
              <tr key={profile.id} className={`transition-colors ${isSuperAdmin ? 'bg-gradient-to-l from-emerald-50 to-white hover:from-emerald-50' : 'hover:bg-gray-50'}`}>
                <td className="px-2 py-2 sm:px-6 sm:py-4">
                  <div className="flex items-center gap-2">
                    {isSuperAdmin && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold shadow-sm shrink-0" title="سوبر أدمن محمي — لا يمكن تعديله أو حذفه أو حظره من قبل أي مستخدم آخر">
                        🔒 سوبر أدمن
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{profile.full_name || 'بدون اسم'}</div>
                      <div className="text-[10px] sm:text-sm text-gray-500 font-mono truncate">{profile.email}</div>
                    </div>
                  </div>
                </td>
                
                <td className="px-2 py-2 sm:px-6 sm:py-4 whitespace-nowrap">
                  {editingId === profile.id ? (
                    <select 
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="px-2 py-1.5 border border-gray-300 rounded-md text-[11px] sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="receptionist">Receptionist</option>
                      <option value="manager">Manager</option>
                      <option value="accountant">Accountant</option>
                      <option value="marketing">Marketing Manager</option>
                      <option value="admin">Admin</option>
                      <option value="housekeeping">Housekeeping</option>
                    </select>
                  ) : (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold ${
                      isSuperAdmin ? 'bg-emerald-600 text-white shadow-sm' :
                      profile.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                      profile.role === 'manager' ? 'bg-orange-100 text-orange-800' :
                      profile.role === 'accountant' ? 'bg-blue-100 text-blue-800' :
                      profile.role === 'marketing' ? 'bg-pink-100 text-pink-800' :
                      profile.role === 'receptionist' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {isSuperAdmin ? 'SUPER ADMIN' : profile.role.toUpperCase()}
                    </span>
                  )}
                </td>

                <td className="px-2 py-2 sm:px-6 sm:py-4 text-gray-500 whitespace-nowrap">
                  {profile.created_at ? (
                    <>
                      <span className="sm:hidden">{format(new Date(profile.created_at), 'yy/MM/dd')}</span>
                      <span className="hidden sm:inline">{format(new Date(profile.created_at), 'yyyy/MM/dd')}</span>
                    </>
                  ) : '-'}
                </td>

                <td className="px-2 py-2 sm:px-6 sm:py-4">
                  {editingId === profile.id ? (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleSaveRole(profile.id)}
                        disabled={saving || !canEditThis}
                        className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title="حفظ"
                      >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      </button>
                      <button 
                        onClick={() => setEditingId(null)}
                        disabled={saving}
                        className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title="إلغاء"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleEditClick(profile)}
                        disabled={!canEditThis}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md text-[11px] sm:text-sm transition-colors ${
                          canEditThis
                            ? 'border-gray-300 hover:bg-gray-50 text-gray-700'
                            : 'border-gray-200 bg-gray-50 text-gray-400 opacity-50 cursor-not-allowed'
                        }`}
                        title={canEditThis ? 'تعديل الدور' : 'محمي — لا يمكن تعديل دور السوبر أدمن'}
                      >
                        <Edit size={14} />
                        <span>تعديل</span>
                      </button>
                      <button
                        onClick={() => openHotelsModal(profile)}
                        disabled={!canEditThis}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md text-[11px] sm:text-sm transition-colors ${
                          canEditThis
                            ? 'border-gray-300 hover:bg-gray-50 text-gray-700'
                            : 'border-gray-200 bg-gray-50 text-gray-400 opacity-50 cursor-not-allowed'
                        }`}
                        title={canEditThis ? 'تحديد صلاحيات الفروع' : 'محمي — لا يمكن تعديل صلاحيات الفروع للسوبر أدمن'}
                      >
                        <Building2 size={14} />
                        <span>الفروع</span>
                      </button>
                      <button
                        onClick={() => handleToggleBan(profile)}
                        disabled={banningId === profile.id || profile.id === currentUserId || isSuperAdmin}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md text-[11px] sm:text-sm transition-colors ${
                          isSuperAdmin
                            ? 'border-gray-200 bg-gray-50 text-gray-400 opacity-50 cursor-not-allowed'
                            : bannedIds[profile.id]
                              ? 'border-emerald-300 hover:bg-emerald-50 text-emerald-700'
                              : 'border-amber-300 hover:bg-amber-50 text-amber-800'
                        }`}
                        title={isSuperAdmin ? 'محمي — لا يمكن حظر السوبر أدمن' : bannedIds[profile.id] ? 'رفع الحظر' : 'حظر المستخدم'}
                      >
                        {banningId === profile.id ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                        <span>{isSuperAdmin ? '—' : bannedIds[profile.id] ? 'رفع الحظر' : 'حظر'}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteUser(profile.id, profile.email)}
                        disabled={deletingId === profile.id || isSuperAdmin}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md text-[11px] sm:text-sm transition-colors ${
                          isSuperAdmin
                            ? 'border-gray-200 bg-gray-50 text-gray-400 opacity-50 cursor-not-allowed'
                            : 'border-red-300 hover:bg-red-50 text-red-700'
                        }`}
                        title={isSuperAdmin ? 'محمي — لا يمكن حذف السوبر أدمن' : 'حذف نهائي'}
                      >
                        {deletingId === profile.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        <span>{isSuperAdmin ? '—' : 'حذف'}</span>
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
            })}

            {profiles.length === 0 && (
              <tr>
                <td colSpan={4} className="px-2 sm:px-6 py-8 text-center text-gray-500 text-xs sm:text-sm">
                  لا يوجد مستخدمين مسجلين حالياً
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hotelModalOpen && hotelUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-3 z-50">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div>
                <div className="font-bold text-gray-900">صلاحيات الفروع</div>
                <div className="text-xs text-gray-500 font-mono">{hotelUser.email}</div>
              </div>
              <button
                onClick={closeHotelsModal}
                disabled={savingHotels}
                className="p-2 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-60"
                title="إغلاق"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {loadingHotelsModal ? (
                <div className="flex items-center justify-center py-10 text-gray-500">
                  <Loader2 className="animate-spin" size={22} />
                  <span className="mr-2 text-sm">جارِ التحميل...</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-2 max-h-64 overflow-auto border border-gray-100 rounded-xl p-2">
                    {hotels.map((h) => (
                      <label
                        key={h.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={hotelSelection.has(h.id)}
                            onChange={() => toggleHotel(h.id)}
                            className="w-4 h-4"
                          />
                          <div className="text-sm font-bold text-gray-900">{h.name}</div>
                        </div>
                        <div className="text-[10px] font-mono text-gray-400">{h.id.slice(0, 8)}</div>
                      </label>
                    ))}
                    {hotels.length === 0 && (
                      <div className="px-3 py-6 text-center text-sm text-gray-500">لا توجد فنادق</div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-bold text-gray-700">الفرع الافتراضي</div>
                    <select
                      value={defaultHotelId ?? ''}
                      onChange={(e) => setDefaultHotelId(e.target.value || null)}
                      disabled={hotelSelection.size === 0}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-60"
                    >
                      <option value="">بدون</option>
                      {hotels
                        .filter((h) => hotelSelection.has(h.id))
                        .map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={closeHotelsModal}
                disabled={savingHotels}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-800 text-sm font-bold hover:bg-gray-50 disabled:opacity-60"
              >
                إلغاء
              </button>
              <button
                onClick={saveHotels}
                disabled={savingHotels || loadingHotelsModal}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60"
              >
                {savingHotels ? 'جارِ الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

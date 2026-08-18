'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Brush, 
  CheckCircle, 
  Filter, 
  BedDouble, 
  AlertCircle,
  Check,
  Camera,
  X,
  User,
  ClipboardList,
  Calendar,
  UserCheck,
  Search,
  MessageSquare,
  AlertTriangle,
  Award,
  Plus,
  Wrench
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks/useUserRole';
import { useAppLanguage } from '@/hooks/useAppLanguage';
import { useActiveHotel } from '@/hooks/useActiveHotel';

// Types
interface Hotel {
  id: string;
  name: string;
}

interface UnitType {
  name: string;
}

interface Unit {
  id: string;
  unit_number: string;
  floor: string;
  status: 'available' | 'occupied' | 'maintenance' | 'cleaning' | 'reserved' | 'booked' | 'future_booked';
  hotel_id: string;
  hotel?: Hotel;
  unit_type?: UnitType;
  unit_type_id?: string | null;
  unit_type_name?: string | null;
  // حقول الحجوزات المحسوبة بناءً على الحجز الفعلي (مثل RoomStatusGrid)
  booking_id?: string | null;
  booking_check_in?: string | null;
  booking_check_out?: string | null;
  guest_name?: string | null;
  guest_phone?: string | null;
  // next_action: مغادرة اليوم / وصول اليوم / تجاوز الخروج
  next_action?: 'arrival' | 'departure' | 'overdue' | null;
  action_guest_name?: string | null;
  remaining_days?: number | null;
  has_temp_res?: boolean;
  future_bookings?: { start: string; end: string }[];
  payment_due_status?: 'due_today' | 'due_soon' | 'overdue' | null;
  payment_due_in_days?: number | null;
  payment_due_date?: string | null;
  payment_due_amount?: number | null;
}

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  user_metadata?: {
    full_name?: string;
  } | null;
}

interface CleaningLog {
  id: string;
  unit_id: string;
  cleaned_by: string;
  cleaned_at: string;
  notes?: string;
  photo_data?: string;
  unit?: {
    unit_number: string;
    hotel?: {
      name: string;
    };
  };
  cleaner_name?: string;
  status?: 'pending' | 'confirmed';
  confirmed_by?: string;
  confirmed_at?: string;
  confirmer_name?: string;
}

interface MaintenanceLog {
  id: string;
  unit_id: string;
  issue_type?: string;
  reported_by?: string;
  reported_at?: string;
  performed_by?: string;
  performed_at?: string;
  notes?: string;
  completion_notes?: string;
  photo_before?: string;
  photo_after?: string;
  photo_data?: string;
  unit?: {
    unit_number: string;
    hotel?: {
      name: string;
    };
  };
  reporter_name?: string;
  performer_name?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'confirmed';
  confirmed_by?: string;
  confirmed_at?: string;
  confirmer_name?: string;
}

const MAINTENANCE_ISSUE_TYPES = [
  { key: 'plumbing',   ar: 'سباكة',                en: 'Plumbing',              ur: 'پلمبنگ',              bn: 'প্লাম্বিং' },
  { key: 'electrical', ar: 'كهرباء',               en: 'Electrical',            ur: 'الیکٹریکل',           bn: 'ইলেকট্রিক্যাল' },
  { key: 'hvac',       ar: 'تكييف/تبريد',          en: 'HVAC / AC',             ur: 'ایس سی/ایچ وی اے سی', bn: 'এসি/এইচভিএসি' },
  { key: 'furniture',  ar: 'أثاث',                 en: 'Furniture',             ur: 'فرنیچر',              bn: 'আসবাবপত্র' },
  { key: 'pest',       ar: 'مكافحة حشرات',         en: 'Pest control',          ur: 'کیڑے مار دوا',        bn: 'কীটনাশক' },
  { key: 'carpentry',  ar: 'نجارة',                en: 'Carpentry',             ur: 'کشتی سازی',           bn: 'কাঠাম' },
  { key: 'paint',      ar: 'دهان/جدار',            en: 'Painting / Walls',      ur: 'رنگ / دیوار',         bn: 'রং / দেয়াল' },
  { key: 'appliance',  ar: 'أجهزة (ثلاجة/غسالة..)',en: 'Appliance (fridge/...)',ur: 'آلات (فریج/واشنگ..)', bn: 'অ্যাপ্লায়েন্স (ফ্রিজ..)' },
  { key: 'other',      ar: 'أخرى',                 en: 'Other',                 ur: 'دیگر',                bn: 'অন্যান্য' }
];

interface StaffNote {
  id: string;
  target_user_id: string;
  created_by: string;
  type: 'violation' | 'note' | 'commendation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  content: string;
  created_at: string;
  target_user_name?: string;
  creator_name?: string;
}

const STATUS_LABELS: Record<string, { label: { ar: string; en: string; ur: string; bn: string }; color: string; icon: any }> = {
  available: { label: { ar: 'متاح', en: 'Available', ur: 'دستیاب', bn: 'উপলব্ধ' }, color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  occupied: { label: { ar: 'مشغول', en: 'Occupied', ur: 'مصروف', bn: 'ব্যস্ত' }, color: 'bg-blue-100 text-blue-700 border-blue-200', icon: BedDouble },
  booked: { label: { ar: 'محجوز (بعربون)', en: 'Booked (deposit)', ur: 'محفوظ (شیٹ کے ساتھ)', bn: 'বুকড (ডিপোজিট)' }, color: 'bg-blue-50 text-blue-700 border-blue-200', icon: BedDouble },
  future_booked: { label: { ar: 'محجوز قادم', en: 'Upcoming booking', ur: 'آنے والی بکنگ', bn: 'আসন্ন বুকিং' }, color: 'bg-amber-100 text-amber-700 border-amber-200', icon: BedDouble },
  reserved: { label: { ar: 'محجوز مؤقت', en: 'Temporarily reserved', ur: 'عارضی طور پر محفوظ', bn: 'সাময়িকভাবে সংরক্ষিত' }, color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: BedDouble },
  maintenance: { label: { ar: 'صيانة', en: 'Maintenance', ur: 'مرمت', bn: 'মেরামত' }, color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle },
  cleaning: { label: { ar: 'تنظيف', en: 'Cleaning', ur: 'صفائی', bn: 'পরিষ্কার' }, color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Brush },
};

export default function CleaningPage() {
  const { role } = useUserRole();
  const { language, setLanguage } = useAppLanguage();
  const { activeHotelId } = useActiveHotel();
  const t = (arText: string, enText: string, urText?: string, bnText?: string) => {
    if (language === 'bn') return bnText ?? arText;
    if (language === 'ur') return urText ?? arText;
    return language === 'en' ? enText : arText;
  };
  const dateLocale = language === 'en' ? 'en-GB' : language === 'ur' ? 'ur-PK' : language === 'bn' ? 'bn-BD' : 'ar-EG';
  const timeLocale = language === 'en' ? 'en-US' : language === 'ur' ? 'ur-PK' : language === 'bn' ? 'bn-BD' : 'ar-SA';
  const unknownUserLabel = t('مستخدم غير معروف', 'Unknown user', 'نامعلوم صارف', 'অজানা ব্যবহারকারী');
  const unknownStaffLabel = t('موظف غير معروف', 'Unknown staff', 'نامعلوم عملہ', 'অজানা কর্মচারী');
  const isReceptionist = role === 'receptionist';
  const isHousekeeping = role === 'housekeeping';
  const selectedHotelId = activeHotelId || 'all';
  type CleaningTab = 'needs_cleaning' | 'needs_maintenance' | 'available_units' | 'all' | 'history' | 'notes';
  // ⚠️ للهاوس كيبنج: التبويبات المسموح بها فقط (تحتاج تنظيف + تحتاج صيانة + وحدات متاحة — بدون تجاوز خروج!)
  //    نحمي التبويب النشط ونجبره على أول مسموح في حال الدخول على محظور
  const HOUSEKEEPING_ALLOWED: CleaningTab[] = ['needs_cleaning', 'needs_maintenance', 'available_units'];
  const initialTab: CleaningTab = 'needs_cleaning';
  const [rawActiveTab, setRawActiveTab] = useState<CleaningTab>(initialTab);
  // الحماية النشطة: إذا كان هاوس كيبنج والتبويب الحالي غير مسموح → يُرجع تلقائياً لـ needs_cleaning
  const activeTab: CleaningTab = React.useMemo(() => {
    if (isHousekeeping && !HOUSEKEEPING_ALLOWED.includes(rawActiveTab)) {
      return 'needs_cleaning';
    }
    return rawActiveTab;
  }, [isHousekeeping, rawActiveTab]);
  const setActiveTab = (next: CleaningTab) => {
    if (isHousekeeping && !HOUSEKEEPING_ALLOWED.includes(next)) return; // حظر التبديل لتبويب محظور
    setRawActiveTab(next);
  };
  const [units, setUnits] = useState<Unit[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [cleaningLogs, setCleaningLogs] = useState<CleaningLog[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [staffNotes, setStaffNotes] = useState<StaffNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [cleanerFilter, setCleanerFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [rawHistoryTab, setRawHistoryTab] = useState<'cleaning' | 'maintenance'>('cleaning');
  const selectedHotelName = React.useMemo(() => {
    if (selectedHotelId === 'all') return t('الكل', 'All', 'تمام', 'সব');
    return hotels.find((h) => String(h.id) === String(selectedHotelId))?.name || '-';
  }, [hotels, selectedHotelId, language]);
  
  // Cleaning Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  
  // Note Modal State
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteForm, setNoteForm] = useState<{
    target_user_id: string;
    type: 'violation' | 'note' | 'commendation';
    severity: 'low' | 'medium' | 'high' | 'critical';
    content: string;
  }>({
    target_user_id: '',
    type: 'note',
    severity: 'low',
    content: ''
  });
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [notes, setNotes] = useState('');
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Maintenance Request Modal (تقرير مشكلة — صورة قبل)
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestedUnit, setRequestedUnit] = useState<Unit | null>(null);
  const [requestIssueType, setRequestIssueType] = useState<string>('plumbing');
  const [requestNotes, setRequestNotes] = useState('');
  const [requestPhotoBefore, setRequestPhotoBefore] = useState<string | null>(null);

  // Maintenance Completion Modal (إكمال صيانة — صورة بعد + ملاحظات)
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [completeUnit, setCompleteUnit] = useState<Unit | null>(null);
  const [completeNotes, setCompleteNotes] = useState('');
  const [completePhotoAfter, setCompletePhotoAfter] = useState<string | null>(null);

  // Fetch Data
  useEffect(() => {
    if (activeTab === 'history') {
      if (!isHousekeeping) {
        if (rawHistoryTab === 'cleaning') {
          fetchHistory();
        } else {
          fetchMaintenanceHistory();
        }
        fetchProfiles();
      }
    } else if (activeTab === 'notes') {
      if (!isHousekeeping) { fetchNotes(); fetchProfiles(); }
    } else {
      fetchData();
    }
    fetchCurrentUser();
  }, [activeTab, selectedHotelId, isHousekeeping, rawHistoryTab]);

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) setAllProfiles(data);
  };

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const { data: notesData, error } = await supabase
        .from('staff_notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (notesData) {
        // Fetch profiles to map names
        // Since we fetch profiles separately, we can just map them later or ensure profiles are fetched.
        // For simplicity, let's just rely on fetchProfiles being called in parallel or ensure we have names.
        // Actually fetchProfiles runs in parallel. But we need to wait for profiles to map names?
        // Better to just fetch profiles first or here.
        
        // Let's get unique IDs from notes
        const userIds = new Set<string>();
        notesData.forEach(n => {
          userIds.add(n.target_user_id);
          userIds.add(n.created_by);
        });

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', Array.from(userIds));
          
        const profileMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p.full_name || unknownUserLabel;
          return acc;
        }, {} as Record<string, string>);

        const enrichedNotes = notesData.map(n => ({
          ...n,
          target_user_name: profileMap[n.target_user_id] || unknownStaffLabel,
          creator_name: profileMap[n.created_by] || unknownUserLabel
        }));

        setStaffNotes(enrichedNotes as StaffNote[]);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      if (selectedHotelId !== 'all') {
        const { data: unitRows, error: unitsErr } = await supabase
          .from('units')
          .select('id')
          .eq('hotel_id', selectedHotelId);
        if (unitsErr) throw unitsErr;
        const unitIds = (unitRows || []).map((u: any) => u.id).filter(Boolean);
        if (unitIds.length === 0) {
          setCleaningLogs([]);
          return;
        }

        let query = supabase
          .from('cleaning_logs')
          .select(
            `
          *,
          unit:units(unit_number, hotel:hotels(name))
        `
          )
          .in('unit_id', unitIds)
          .order('cleaned_at', { ascending: false });

        if (cleanerFilter !== 'all') {
          query = query.eq('cleaned_by', cleanerFilter);
        }

        if (dateFilter) {
          const nextDay = new Date(dateFilter);
          nextDay.setDate(nextDay.getDate() + 1);
          query = query.gte('cleaned_at', dateFilter).lt('cleaned_at', nextDay.toISOString().split('T')[0]);
        }

        const { data: logs, error } = await query;
        if (error) throw error;

        if (logs) {
          const userIds = new Set<string>();
          logs.forEach((log: any) => {
            if (log.cleaned_by) userIds.add(log.cleaned_by);
            if (log.confirmed_by) userIds.add(log.confirmed_by);
          });

          const uniqueUserIds = Array.from(userIds);
          let profileMap: Record<string, string> = {};

          if (uniqueUserIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', uniqueUserIds);

            profileMap = (profiles || []).reduce((acc, profile) => {
              acc[profile.id] = profile.full_name || unknownUserLabel;
              return acc;
            }, {} as Record<string, string>);
          }

          const logsWithNames = logs.map((log: any) => ({
            ...log,
            cleaner_name: profileMap[log.cleaned_by] || unknownUserLabel,
            confirmer_name: log.confirmed_by ? profileMap[log.confirmed_by] || unknownUserLabel : undefined,
          }));

          setCleaningLogs(logsWithNames as any);
        }
        return;
      }

      let query = supabase
        .from('cleaning_logs')
        .select(`
          *,
          unit:units(unit_number, hotel:hotels(name))
        `)
        .order('cleaned_at', { ascending: false });

      if (cleanerFilter !== 'all') {
        query = query.eq('cleaned_by', cleanerFilter);
      }
      
      if (dateFilter) {
        // Filter by date (ignoring time)
        const nextDay = new Date(dateFilter);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query.gte('cleaned_at', dateFilter).lt('cleaned_at', nextDay.toISOString().split('T')[0]);
      }

      const { data: logs, error } = await query;

      if (error) throw error;

      if (logs) {
        // Fetch cleaner and confirmer names
        const userIds = new Set<string>();
        logs.forEach(log => {
          if (log.cleaned_by) userIds.add(log.cleaned_by);
          if (log.confirmed_by) userIds.add(log.confirmed_by);
        });
        
        const uniqueUserIds = Array.from(userIds);
        let profileMap: Record<string, string> = {};
        
        if (uniqueUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', uniqueUserIds);
          
          profileMap = (profiles || []).reduce((acc, profile) => {
            acc[profile.id] = profile.full_name || unknownUserLabel;
            return acc;
          }, {} as Record<string, string>);
        }

        const logsWithNames = logs.map(log => ({
          ...log,
          cleaner_name: profileMap[log.cleaned_by] || unknownUserLabel,
          confirmer_name: log.confirmed_by ? (profileMap[log.confirmed_by] || unknownUserLabel) : undefined
        }));
        
        setCleaningLogs(logsWithNames);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaintenanceHistory = async () => {
    setLoading(true);
    try {
      const buildQuery = () => {
        let query = supabase
          .from('maintenance_logs')
          .select(`
            *,
            unit:units(unit_number, hotel:hotels(name))
          `)
          .order('created_at', { ascending: false });
        return query;
      };

      let query = buildQuery();
      if (selectedHotelId !== 'all') {
        const { data: unitRows, error: unitsErr } = await supabase.from('units').select('id').eq('hotel_id', selectedHotelId);
        if (unitsErr) throw unitsErr;
        const unitIds = (unitRows || []).map((u: any) => u.id).filter(Boolean);
        if (unitIds.length === 0) {
          setMaintenanceLogs([]);
          return;
        }
        query = query.in('unit_id', unitIds);
      }
      if (cleanerFilter !== 'all') {
        query = query.or(`reported_by.eq.${cleanerFilter},performed_by.eq.${cleanerFilter},confirmed_by.eq.${cleanerFilter}`);
      }
      if (dateFilter) {
        const nextDay = new Date(dateFilter);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query.gte('created_at', dateFilter).lt('created_at', nextDay.toISOString().split('T')[0]);
      }

      const { data: logs, error } = await query;
      if (error) throw error;

      if (logs) {
        const userIds = new Set<string>();
        logs.forEach((log: any) => {
          if (log.reported_by) userIds.add(log.reported_by);
          if (log.performed_by) userIds.add(log.performed_by);
          if (log.confirmed_by) userIds.add(log.confirmed_by);
        });
        const uniqueUserIds = Array.from(userIds);
        let profileMap: Record<string, string> = {};
        if (uniqueUserIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', uniqueUserIds);
          profileMap = (profiles || []).reduce((acc, profile) => {
            acc[profile.id] = profile.full_name || unknownUserLabel;
            return acc;
          }, {} as Record<string, string>);
        }
        const logsWithNames = (logs || []).map((log: any) => ({
          ...log,
          reporter_name: log.reported_by ? profileMap[log.reported_by] || unknownStaffLabel : undefined,
          performer_name: log.performed_by ? profileMap[log.performed_by] || unknownStaffLabel : undefined,
          confirmer_name: log.confirmed_by ? profileMap[log.confirmed_by] || unknownUserLabel : undefined,
        }));
        setMaintenanceLogs(logsWithNames as MaintenanceLog[]);
      }
    } catch (err) {
      console.error('Error fetching maintenance logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      if (rawHistoryTab === 'cleaning') fetchHistory();
      else fetchMaintenanceHistory();
    }
  }, [cleanerFilter, dateFilter, selectedHotelId, rawHistoryTab]); // Re-fetch when filters change or sub-tab switches

  const handleConfirmLog = async (log: CleaningLog) => {
    if (!currentUser) return;
    if (!confirm(t('هل أنت متأكد من تأكيد هذا التنظيف؟ سيتم حذف الصورة وتسجيل التأكيد.', 'Are you sure you want to confirm this cleaning? The photo will be deleted and the confirmation will be recorded.', 'کیا آپ اس صفائی کی تصدیق کرنے کے لیے یقینی ہیں؟ تصویر حذف کر دی جائے گی اور تصدیق درج ہو جائے گی۔', 'আপনি কি এই পরিচ্ছন্নতা নিশ্চিত করতে চান? ছবিটি মুছে ফেলা হবে এবং নিশ্চিতকরণ নথিভুক্ত করা হবে।'))) return;

    try {
      // 1. Update cleaning_logs
      const { error } = await supabase
        .from('cleaning_logs')
        .update({
          status: 'confirmed',
          confirmed_by: currentUser.id,
          confirmed_at: new Date().toISOString(),
          photo_data: null // Delete photo to save space/privacy
        })
        .eq('id', log.id);

      if (error) throw error;

      // 2. Update local state
      setCleaningLogs(prev => prev.map(l => 
        l.id === log.id 
          ? { 
              ...l, 
              status: 'confirmed', 
              confirmed_by: currentUser.id, 
              confirmed_at: new Date().toISOString(),
              photo_data: undefined,
              confirmer_name: currentUser.full_name || currentUser.email || t('أنا', 'Me', 'میں', 'আমি')
            } 
          : l
      ));

    } catch (error) {
      console.error('Error confirming log:', error);
      alert(t('حدث خطأ أثناء التأكيد', 'An error occurred while confirming', 'تصدیق کے دوران ایک خرابی پیش آئی', 'নিশ্চিত করার সময় একটি ত্রুটি ঘটেছে'));
    }
  };

  // ========== Maintenance Handlers ==========
  const openMaintenanceRequestModal = (unit: Unit) => {
    setRequestedUnit(unit);
    setRequestIssueType('plumbing');
    setRequestNotes('');
    setRequestPhotoBefore(null);
    setIsRequestModalOpen(true);
  };

  const openMaintenanceCompleteModal = (unit: Unit) => {
    setCompleteUnit(unit);
    setCompleteNotes('');
    setCompletePhotoAfter(null);
    setIsCompleteModalOpen(true);
  };

  const handleConfirmMaintenanceLog = async (log: MaintenanceLog) => {
    if (!currentUser) return;
    if (!confirm(t('هل أنت متأكد من تأكيد إنهاء هذه الصيانة؟ سيتم حذف الصور بعد التأكيد.', 'Are you sure you want to confirm this maintenance is fully completed? Photos will be cleared after confirmation.', 'کیا آپ اس مرمت کی مکمل تصدیق کرنے کے لیے یقینی ہیں؟ تصدیق کے بعد تصاویر حذف کر دی جائیں گی۔', 'আপনি কি এই রক্ষণাবেক্ষণটি সম্পূর্ণরূপে নিশ্চিত করতে চান? নিশ্চিতকরণের পর ছবিগুলি মুছে ফেলা হবে।'))) return;
    try {
      const { error } = await supabase
        .from('maintenance_logs')
        .update({
          status: 'confirmed',
          confirmed_by: currentUser.id,
          confirmed_at: new Date().toISOString(),
          photo_before: null,
          photo_after: null
        })
        .eq('id', log.id);
      if (error) throw error;
      setMaintenanceLogs(prev => prev.map(l =>
        l.id === log.id
          ? { ...l, status: 'confirmed', confirmed_by: currentUser.id, confirmed_at: new Date().toISOString(), photo_before: undefined, photo_after: undefined, confirmer_name: currentUser.full_name || currentUser.email || t('أنا', 'Me', 'میں', 'আমি') }
          : l
      ));
    } catch (err) {
      console.error('Error confirming maintenance log:', err);
      alert(t('حدث خطأ أثناء تأكيد سجل الصيانة', 'An error occurred confirming the maintenance log', 'مرمت لاگ کی تصدیق کرتے وقت ایک خرابی پیش آئی', 'মেইনটেনেন্স লগ নিশ্চিত করার সময় একটি ত্রুটি ঘটেছে'));
    }
  };

  const handleSubmitMaintenanceRequest = async () => {
    if (!currentUser || !requestedUnit) return;
    if (!requestPhotoBefore) {
      alert(t('الرجاء رفع صورة للمشكلة قبل الإرسال', 'Please upload a photo of the issue before submitting', 'جمع کرنے سے پہلے مسئلے کی تصویر اپ لوڈ کریں', 'জমা দেওয়ার আগে সমস্যার একটি ছবি আপলোড করুন'));
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'submit-maintenance-request',
          unit_id: requestedUnit.id,
          issue_type: requestIssueType,
          notes: requestNotes || null,
          photo_before: requestPhotoBefore
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'Request failed');
      }
      setUnits(prev => prev.map(u => u.id === requestedUnit.id ? { ...u, status: 'maintenance' } : u));
      setIsRequestModalOpen(false);
    } catch (err: any) {
      console.error('Error submitting maintenance request:', err);
      alert(t('حدث خطأ أثناء إرسال الطلب', 'An error occurred while submitting the request', 'درخواست بھیجتے وقت ایک خرابی پیش آئی', 'অনুরোধ জমা দেওয়ার সময় একটি ত্রুটি ঘটেছে') + '\n' + (err?.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteMaintenance = async () => {
    if (!currentUser || !completeUnit) return;
    if (!completePhotoAfter) {
      alert(t('الرجاء رفع صورة بعد الصيانة للإثبات', 'Please upload an after-completion photo as proof', 'ثبوت کے لیے مرمت کے بعد تصویر اپ لوڈ کریں', 'প্রমাণ হিসেবে সমাপ্তির পর একটি ছবি আপলোড করুন'));
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'complete-maintenance',
          unit_id: completeUnit.id,
          completion_notes: completeNotes || null,
          photo_after: completePhotoAfter
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'Request failed');
      }
      setUnits(prev => prev.map(u => u.id === completeUnit.id ? { ...u, status: 'cleaning' } : u));
      setIsCompleteModalOpen(false);
    } catch (err: any) {
      console.error('Error completing maintenance:', err);
      alert(t('حدث خطأ أثناء إنهاء الصيانة', 'An error occurred completing maintenance', 'مرمت مکمل کرتے وقت ایک خرابی پیش آئی', 'মেইনটেনেন্স সম্পন্ন করার সময় একটি ত্রুটি ঘটেছে') + '\n' + (err?.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Fetch profile if exists, otherwise use auth data
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
        
      setCurrentUser({
        id: user.id,
        email: user.email || '',
        full_name: profile?.full_name
      });
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // ===== تواريخ اليوم بالرياض =====
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
      const nextDay = new Date(`${todayStr}T00:00:00`);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
      const next14 = new Date(`${todayStr}T00:00:00`);
      next14.setDate(next14.getDate() + 14);
      const next14Str = next14.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });

      // ===== جلب الفنادق =====
      const { data: hotelsData } = await supabase
        .from('hotels')
        .select('id, name')
        .order('name');
      if (hotelsData) setHotels(hotelsData);

      // ===== بناء المصفوفات Base =====
      const unitsBase = supabase
        .from('units')
        .select(
          `
          id,
          unit_number,
          floor,
          status,
          hotel_id,
          hotel:hotels(id, name),
          unit_type:unit_types(name),
          unit_type_id
        `
        )
        .order('unit_number');

      // active: حجوزات في تاريخ اليوم (check_in <= اليوم && check_out >= اليوم) مع status checked_in / confirmed
      const activeBookingsBase = supabase
        .from('bookings')
        .select(`
          id,
          unit_id,
          check_in,
          check_out,
          status,
          booking_type,
          total_price,
          nights,
          booking_source,
          customers(id, full_name, phone)
        `)
        .in('status', ['checked_in', 'confirmed'])
        .lte('check_in', nextDayStr)
        .gte('check_out', todayStr);

      // arrivals: وصول اليوم (check_in = اليوم)
      const arrivalsBase = supabase
        .from('bookings')
        .select(`id, unit_id, check_in, check_out, status, customers(id, full_name, phone)`)
        .eq('status', 'confirmed')
        .eq('check_in', todayStr);

      // departures: خروج اليوم (check_out = اليوم, check_in <= اليوم)
      const departuresBase = supabase
        .from('bookings')
        .select(`id, unit_id, check_in, check_out, status, customers(id, full_name, phone)`)
        .in('status', ['checked_in', 'confirmed'])
        .eq('check_out', todayStr)
        .lte('check_in', todayStr);

      // overdue: تجاوز تاريخ الخروج و status لا يزال checked_in
      const overdueBase = supabase
        .from('bookings')
        .select(`id, unit_id, check_in, check_out, status, customers(id, full_name, phone)`)
        .eq('status', 'checked_in')
        .lt('check_out', todayStr);

      // upcoming: حجوزات قادمة خلال 14 يوماً (check_in من tomorrow إلى +14)
      const upcomingBase = supabase
        .from('bookings')
        .select(`id, unit_id, check_in, check_out, status, customers(id, full_name, phone)`)
        .eq('status', 'confirmed')
        .gte('check_in', nextDayStr)
        .lte('check_in', next14Str);

      // checked_out: حجوزات خروجها اليوم و status = checked_out
      const checkedOutBase = supabase
        .from('bookings')
        .select(`id, unit_id, check_in, check_out, status, customers(id, full_name, phone)`)
        .eq('status', 'checked_out')
        .eq('check_out', todayStr);

      // temp_reservations: حجوزات مؤقتة اليوم
      const tempResBase = supabase
        .from('temporary_reservations')
        .select('unit_id, customer_name, phone, date')
        .eq('date', todayStr);

      // unpaid invoices for payment status
      const unpaidInvBase = supabase
        .from('invoices')
        .select('id, booking_id, due_date, total_amount, paid_amount, status')
        .in('status', ['posted'])
        .not('due_date', 'is', null)
        .lte('due_date', next14Str);

      const invTotalsBase = supabase
        .from('invoices')
        .select('booking_id, total_invoiced, total_paid');

      const applyHotel = <Q extends { eq: (k: string, v: any) => Q }>(q: Q, hid: string) =>
        hid !== 'all' ? q.eq('hotel_id', hid) : q;

      // ===== التنفيذ المتوازي =====
      const [
        unitsRes, activeRes, arrRes, depRes, ovrRes, upRes, coRes, tempRes, unpaidInv, invTotals
      ] = await Promise.all([
        applyHotel(unitsBase, selectedHotelId),
        applyHotel(activeBookingsBase, selectedHotelId),
        applyHotel(arrivalsBase, selectedHotelId),
        applyHotel(departuresBase, selectedHotelId),
        applyHotel(overdueBase, selectedHotelId),
        applyHotel(upcomingBase, selectedHotelId),
        applyHotel(checkedOutBase, selectedHotelId),
        applyHotel(tempResBase, selectedHotelId),
        applyHotel(unpaidInvBase, selectedHotelId),
        applyHotel(invTotalsBase, selectedHotelId)
      ]);

      const unitsData: any[] = (unitsRes as any).data || [];
      const activeForDate: any[] = (activeRes as any).data || [];
      const arrivals: any[] = (arrRes as any).data || [];
      const departures: any[] = (depRes as any).data || [];
      const overdue: any[] = (ovrRes as any).data || [];
      const upcoming: any[] = (upRes as any).data || [];
      const checkedOut: any[] = (coRes as any).data || [];
      const tempResList: any[] = (tempRes as any).data || [];
      const unpaidInvoices: any[] = (unpaidInv as any).data || [];
      const invoiceTotals: any[] = (invTotals as any).data || [];

      // ===== بناء الـ Maps مثل RoomStatusWithDate =====
      const custName = (row: any): string => {
        if (Array.isArray(row.customers)) return row.customers[0]?.full_name || t('غير معروف', 'Unknown', 'نامعلوم', 'অজানা');
        return (row.customers as any)?.full_name || t('غير معروف', 'Unknown', 'نامعلوم', 'অজানা');
      };
      const custPhone = (row: any): string | undefined => {
        if (Array.isArray(row.customers)) return row.customers[0]?.phone || undefined;
        return (row.customers as any)?.phone || undefined;
      };

      const activeMap = new Map<string, { id: string; guest: string; phone?: string; check_in?: string; check_out?: string; booking_status?: string; booking_type?: string; total_price?: number; nights?: number; booking_source?: string }>();
      activeForDate.forEach((b: any) => {
        if (!b.unit_id) return;
        activeMap.set(b.unit_id, {
          id: b.id, guest: custName(b), phone: custPhone(b),
          check_in: b.check_in, check_out: b.check_out,
          booking_status: b.status, booking_type: b.booking_type,
          total_price: b.total_price, nights: b.nights, booking_source: b.booking_source
        });
      });

      const upcomingMap = new Map<string, { id: string; guest: string; phone?: string; check_in?: string; check_out?: string; booking_status?: string }>();
      upcoming.forEach((b: any) => {
        if (!b.unit_id) return;
        if (upcomingMap.has(b.unit_id)) return;
        upcomingMap.set(b.unit_id, {
          id: b.id, guest: custName(b), phone: custPhone(b),
          check_in: b.check_in, check_out: b.check_out, booking_status: b.status
        });
      });

      const checkedOutMap = new Map<string, { id: string; guest: string; phone?: string; check_in?: string; check_out?: string; booking_status?: string }>();
      checkedOut.forEach((b: any) => {
        if (!b.unit_id) return;
        if (checkedOutMap.has(b.unit_id)) return;
        checkedOutMap.set(b.unit_id, {
          id: b.id, guest: custName(b), phone: custPhone(b),
          check_in: b.check_in, check_out: b.check_out, booking_status: b.status
        });
      });

      const actionMap = new Map<string, { action: 'arrival' | 'departure' | 'overdue'; guest: string; phone?: string; check_out?: string; booking_id?: string }>();
      arrivals.forEach((b: any) => {
        if (!b.unit_id) return;
        actionMap.set(b.unit_id, { action: 'arrival', guest: custName(b), phone: custPhone(b) });
      });
      departures.forEach((b: any) => {
        if (!b.unit_id) return;
        actionMap.set(b.unit_id, { action: 'departure', guest: custName(b), phone: custPhone(b) });
      });
      overdue.forEach((b: any) => {
        if (!b.unit_id) return;
        actionMap.set(b.unit_id, { action: 'overdue', guest: custName(b), phone: custPhone(b), check_out: b.check_out, booking_id: b.id });
      });

      const bookingToUnitMap = new Map<string, string>();
      [...activeForDate, ...upcoming, ...checkedOut].forEach((b: any) => {
        if (b.unit_id) bookingToUnitMap.set(b.id, b.unit_id);
      });

      const allRelevantBookings = [...activeForDate, ...upcoming, ...checkedOut];
      const totalInvoicedByBooking = new Map<string, number>();
      const totalPaidInvoicedByBooking = new Map<string, number>();
      (invoiceTotals || []).forEach((row: any) => {
        const bid = row?.booking_id;
        if (!bid) return;
        totalInvoicedByBooking.set(String(bid), Number(row?.total_invoiced) || 0);
        totalPaidInvoicedByBooking.set(String(bid), Number(row?.total_paid) || 0);
      });
      const bookingTypeById = new Map<string, string>();
      const bookingStatusById = new Map<string, string>();
      allRelevantBookings.forEach((b: any) => {
        if (!b?.id) return;
        bookingTypeById.set(b.id, String(b.booking_type || ''));
        bookingStatusById.set(b.id, String(b.status || ''));
      });

      const paymentMap = new Map<string, { status: 'due_today' | 'due_soon' | 'overdue'; days: number; date: string; amount: number; booking_id: string }>();

      const MS_PER_DAY = 1000 * 60 * 60 * 24;
      const today = new Date(`${todayStr}T00:00:00`);
      const addMonthsSafe = (date: Date, months: number): Date => {
        const res = new Date(date);
        const day = res.getDate();
        res.setDate(1);
        res.setMonth(res.getMonth() + months);
        res.setDate(Math.min(day, new Date(res.getFullYear(), res.getMonth() + 1, 0).getDate()));
        return res;
      };

      // حساب أقساط الحجوزات الشهرية والسنوية
      allRelevantBookings.forEach((booking: any) => {
        if (!booking.unit_id) return;
        if (paymentMap.has(booking.unit_id)) return;
        const bookingType = String(booking.booking_type || '');
        if (bookingType !== 'monthly' && bookingType !== 'yearly') return;
        const totalAmount = Number(totalInvoicedByBooking.get(booking.id) ?? booking.total_price ?? 0);
        const nights = Number(booking.nights || 0);
        if (totalAmount <= 0) return;
        const platformFee = String(booking.booking_source || '') === 'platform' ? 250 : 0;
        const netTotal = Math.max(0, totalAmount - platformFee);
        const bookingStatus = String(booking.status || '');
        const invTotal = Number(totalInvoicedByBooking.get(booking.id) ?? totalAmount);
        const invPaid = Number(totalPaidInvoicedByBooking.get(booking.id) ?? 0);
        const remainingFromInvoices = Math.max(0, invTotal - invPaid);
        if (bookingStatus === 'checked_out' && remainingFromInvoices <= 1) return;
        const paidForInstallments = Math.max(0, invPaid - platformFee);
        if (Math.max(0, netTotal - paidForInstallments) <= 1) return;

        const checkIn = new Date(`${booking.check_in}T00:00:00`);
        const derivedNights = (() => {
          if (Number.isFinite(nights) && nights > 0) return nights;
          try {
            const ci = new Date(`${booking.check_in}T00:00:00`);
            const co = new Date(`${booking.check_out}T00:00:00`);
            const diff = Math.ceil((co.getTime() - ci.getTime()) / MS_PER_DAY);
            return Number.isFinite(diff) && diff > 0 ? diff : 0;
          } catch { return 0; }
        })();
        const monthsCount = Math.max(1, Math.round(derivedNights / 30));
        const installmentAmount = netTotal / monthsCount;
        let currentPaid = paidForInstallments;

        for (let i = 0; i < monthsCount; i++) {
          const dueDate = addMonthsSafe(checkIn, i);
          dueDate.setHours(0, 0, 0, 0);
          const amountForThisInstallment = installmentAmount;
          const amountPaidForThis = Math.min(amountForThisInstallment, Math.max(0, currentPaid));
          currentPaid -= amountForThisInstallment;
          const isFullyPaid = amountPaidForThis >= (amountForThisInstallment - 1);
          if (!isFullyPaid) {
            const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / MS_PER_DAY);
            let pStatus: 'due_today' | 'due_soon' | 'overdue' | null = null;
            if (diffDays < 0) pStatus = 'overdue';
            else if (diffDays === 0) pStatus = 'due_today';
            else if (diffDays <= 5) pStatus = 'due_soon';
            if (pStatus) {
              paymentMap.set(booking.unit_id, {
                status: pStatus, days: diffDays, date: dueDate.toISOString().split('T')[0],
                amount: amountForThisInstallment - amountPaidForThis, booking_id: booking.id
              });
              break;
            }
          }
        }
      });

      // فواتير غير مدفوعة (فولباك للحجوزات الأخرى)
      unpaidInvoices.forEach((inv: any) => {
        const unitId = bookingToUnitMap.get(inv.booking_id);
        if (!unitId) return;
        if (paymentMap.has(unitId)) return;
        const bt = bookingTypeById.get(inv.booking_id) || '';
        if (bt === 'monthly' || bt === 'yearly') return;
        const dueDate = new Date(`${inv.due_date}T00:00:00`);
        const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / MS_PER_DAY);
        let pStatus: 'due_today' | 'due_soon' | 'overdue' | null = null;
        if (diffDays < 0) pStatus = 'overdue';
        else if (diffDays === 0) pStatus = 'due_today';
        else if (diffDays <= 5) pStatus = 'due_soon';
        const remaining = Math.max(0, (Number(inv.total_amount) || 0) - (Number(inv.paid_amount) || 0));
        if (pStatus && remaining > 1) {
          paymentMap.set(unitId, {
            status: pStatus, days: diffDays, date: inv.due_date,
            amount: remaining, booking_id: inv.booking_id
          });
        }
      });

      // ===== دمج النتائج النهائية =================================================
      const finalUnits: Unit[] = unitsData.map((u: any) => {
        const active = activeMap.get(u.id);
        const action = actionMap.get(u.id);
        const payment = paymentMap.get(u.id);
        const checkedOutInfo = checkedOutMap.get(u.id);
        const unitFutureBookings = upcoming
          .filter((b: any) => b.unit_id === u.id)
          .map((b: any) => ({ start: b.check_in, end: b.check_out }));

        // محاسبة الحالة بناءً على الحجز — بالضبط مثل RoomStatusGrid
        let status: Unit['status'] = u.status || 'available';
        if (active) {
          status = String(active.booking_status || '').toLowerCase() === 'checked_in' ? 'occupied' : 'booked';
        } else {
          if (!['maintenance', 'cleaning', 'unavailable'].includes(status)) status = 'available';
        }
        const up = !active ? upcomingMap.get(u.id) : null;
        if (!active && status === 'available' && up) {
          status = 'future_booked';
        }

        const nested = u.unit_type;
        const typeName = nested?.name;
        const paymentBookingId = payment?.booking_id;
        const invTotal = paymentBookingId ? totalInvoicedByBooking.get(paymentBookingId) : undefined;
        const invPaid = paymentBookingId ? totalPaidInvoicedByBooking.get(paymentBookingId) : undefined;

        let remaining_days: number | null = null;
        if ((status === 'occupied' || status === 'booked') && active?.check_out) {
          const sd = new Date(`${todayStr}T00:00:00`);
          const co = new Date(`${active.check_out}T00:00:00`);
          const diff = Math.ceil((co.getTime() - sd.getTime()) / MS_PER_DAY);
          remaining_days = diff >= 0 ? diff : 0;
        }

        return {
          id: u.id,
          unit_number: u.unit_number,
          floor: u.floor,
          status,
          hotel_id: u.hotel_id,
          hotel: u.hotel,
          unit_type: u.unit_type,
          unit_type_id: u.unit_type_id || null,
          unit_type_name: typeName || null,
          booking_id: (active?.id || up?.id || (action as any)?.booking_id || payment?.booking_id || checkedOutInfo?.id) || null,
          booking_check_in: (active?.check_in || up?.check_in || checkedOutInfo?.check_in) || null,
          booking_check_out: (active?.check_out || up?.check_out || (action as any)?.check_out || checkedOutInfo?.check_out) || null,
          guest_name: active?.guest || up?.guest || action?.guest || checkedOutInfo?.guest || null,
          guest_phone: active?.phone || up?.phone || action?.phone || checkedOutInfo?.phone || null,
          next_action: action?.action || null,
          action_guest_name: action?.guest || null,
          remaining_days,
          future_bookings: unitFutureBookings,
          payment_due_status: payment?.status || null,
          payment_due_in_days: payment?.days ?? null,
          payment_due_date: payment?.date || null,
          payment_due_amount: payment?.amount ?? null
        };
      });

      // دمج الحجوزات المؤقتة
      const tempMap = new Map<string, any>();
      (tempResList || []).forEach((t: any) => tempMap.set(t.unit_id, t));
      for (let i = 0; i < finalUnits.length; i++) {
        const t = tempMap.get(finalUnits[i].id);
        if (t) {
          finalUnits[i] = {
            ...finalUnits[i],
            has_temp_res: true,
            action_guest_name: t.customer_name,
            guest_phone: t.phone || finalUnits[i].guest_phone
          };
        }
      }

      setUnits(finalUnits as any);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Open Cleaning Modal
  const openCleaningModal = (unit: Unit) => {
    setSelectedUnit(unit);
    setNotes('');
    setPhotoData(null);
    setIsModalOpen(true);
  };

  // Handle Image Capture/Upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Resize image
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 600;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Convert to base64 (low quality JPEG)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          setPhotoData(dataUrl);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Cleaning Log
  const handleConfirmCleaning = async () => {
    if (!selectedUnit || !currentUser) return;

    setIsSubmitting(true);
    try {
      const hotelName = hotels.find(h => h.id === selectedUnit.hotel_id)?.name || '';
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'complete-cleaning',
          unit_id: selectedUnit.id,
          notes: notes || null,
          photo_data: photoData || null,
          hotel_id: selectedUnit.hotel_id,
          unit_number: selectedUnit.unit_number,
          hotel_name: hotelName
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'Request failed');
      }
      setUnits(prev => prev.map(u =>
        u.id === selectedUnit.id ? { ...u, status: 'available' } : u
      ));
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Error confirming cleaning:', error);
      alert(t('حدث خطأ أثناء تأكيد التنظيف', 'An error occurred while confirming cleaning', 'صفائی کی تصدیق کے دوران خرابی پیش آئی', 'পরিচ্ছন্নতা নিশ্চিত করার সময় একটি ত্রুটি ঘটেছে') + '\n' + (error?.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNote = async () => {
    if (!currentUser) return;
    if (!noteForm.target_user_id || !noteForm.content) {
      alert(t('يرجى اختيار الموظف وكتابة المحتوى', 'Please choose an employee and enter the content', 'براہ کرم ملازم کو منتخب کریں اور مواد درج کریں', 'দয়া করে একজন কর্মচারী বেছে নিন এবং বিষয়বস্তু লিখুন'));
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: inserted, error } = await supabase
        .from('staff_notes')
        .insert({
          target_user_id: noteForm.target_user_id,
          created_by: currentUser.id,
          type: noteForm.type,
          severity: noteForm.severity,
          content: noteForm.content
        })
        .select('id')
        .single();

      if (error) throw error;

      try {
        const targetProfile = allProfiles.find(p => p.id === noteForm.target_user_id);
        const msg = `توجد ملاحظة على الموظف ${targetProfile?.full_name || ''}: ${noteForm.content.slice(0, 80)}`;
        await supabase.from('system_events').insert({
          event_type: 'staff_note',
          staff_note_id: inserted?.id || null,
          message: msg,
          payload: {
            type: noteForm.type,
            severity: noteForm.severity
          }
        });
      } catch (eventError) {
        console.error('Failed to log staff_note event:', eventError);
      }

      // Refresh list
      fetchNotes();
      setIsNoteModalOpen(false);
      setNoteForm({
        target_user_id: '',
        type: 'note',
        severity: 'low',
        content: ''
      });
      alert(t('تم إضافة الملاحظة بنجاح', 'Note added successfully', 'نوٹ کامیابی سے شامل کر دیا گیا', 'নোট সফলভাবে যোগ করা হয়েছে'));

    } catch (error) {
      console.error('Error adding note:', error);
      alert(t('حدث خطأ أثناء إضافة الملاحظة', 'An error occurred while adding the note', 'نوٹ شامل کرنے کے دوران خرابی پیش آئی', 'নোট যোগ করার সময় একটি ত্রুটি ঘটেছে'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update Status (Direct)
  const updateUnitStatus = async (unitId: string, newStatus: string) => {
    // If setting to available from cleaning, use the modal flow (optional, but requested for "Cleaned" action)
    // But for the dropdown in "All Units", we might want direct update or trigger modal.
    // The user said "When clicking Cleaned, show form".
    // In "All Units" tab, we have a dropdown. 
    // Let's keep dropdown for quick status change, but if they select "available" from "cleaning", maybe trigger modal?
    // For simplicity, I'll keep the dropdown as "Admin override" and the button as "Cleaner workflow".
    
    setUpdating(unitId);
    try {
      const { error } = await supabase
        .from('units')
        .update({ status: newStatus })
        .eq('id', unitId);

      if (error) throw error;

      // Optimistic Update
      setUnits(prev => prev.map(u => 
        u.id === unitId ? { ...u, status: newStatus as any } : u
      ));

    } catch (error) {
      console.error('Error updating status:', error);
      alert(t('حدث خطأ أثناء تحديث الحالة', 'An error occurred while updating status', 'حالت کو اپ ڈیٹ کرنے کے دوران خرابی پیش آئی', 'স্ট্যাটাস আপডেট করার সময় একটি ত্রুটি ঘটেছে'));
    } finally {
      setUpdating(null);
    }
  };

  // Filter Logic — بناءً على الحالة المحسوبة من الحجز الفعلي مثل RoomStatusGrid
  const filteredUnits = units.filter(unit => {
    // Hotel Filter
    if (selectedHotelId !== 'all' && unit.hotel_id !== selectedHotelId) return false;

    // 🧹 تبويب تحتاج تنظيف
    if (activeTab === 'needs_cleaning') {
      // الوحدة تظهر هنا فقط إذا تم تحويلها صراحةً لحالة "تنظيف" بعد تسجيل الخروج الرسمي
      // (الوحدات المشغولة أو المتأخرة أو مغادرة اليوم لا تظهر حتى يتم خروج الضيف رسمياً)
      return unit.status === 'cleaning';
    }
    // 🔧 تبويب تحتاج صيانة
    if (activeTab === 'needs_maintenance') {
      return unit.status === 'maintenance';
    }
    // ✅ تبويب الوحدات المتاحة: متاحة فعلًا أو محجوزة قادمًا فقط
    if (activeTab === 'available_units') {
      const isAvailable = unit.status === 'available' || unit.status === 'future_booked';
      // نستثني الوحدات التي تحتاج تنظيف (مغادرون اليوم أو تجاوز الخروج)
      const needsCleaning = (unit.next_action === 'departure' || unit.next_action === 'overdue');
      return isAvailable && !needsCleaning;
    }

    return true;
  });

  // Group by Floor (Optional visualization improvement)
  const groupedUnits = filteredUnits.reduce((acc, unit) => {
    const floor = unit.floor || t('غير محدد', 'Unspecified', 'غیر مقرر', 'অনির্দিষ্ট');
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(unit);
    return acc;
  }, {} as Record<string, Unit[]>);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wrench className="text-red-600" />
            <span className="mx-1 text-gray-300">|</span>
            <Brush className="text-blue-600" />
            {t('العمليات التشغيلية — الصيانة والنظافة', 'Operations — Maintenance & Cleaning', 'آپریشنل آپریشنز — مرمت اور صفائی', 'অপারেশনস — মেরামত ও পরিচ্ছন্নতা')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('إدارة متكاملة لنظافة وصيانة جميع الغرف والوحدات في مكان واحد', 'Integrated management for cleaning and maintenance of all rooms/units in one place', 'ایک جگہ تمام کمروں اور یونٹس کی صفائی اور مرمت کا مربوط انتظام', 'এক জায়গায় সব রুম/ইউনিটের পরিচ্ছন্নতা ও মেরামতের সমন্বিত ব্যবস্থাপনা')}
          </p>
        </div>

        {/* Filters + Language Switcher */}
        <div className="w-full md:w-auto flex flex-wrap items-center gap-3">
          {/* Language Switcher: AR / EN / UR / BN */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
            {(['ar', 'en', 'ur', 'bn'] as const).map((lang) => {
              const label = lang === 'ar' ? 'العربية' : lang === 'en' ? 'English' : lang === 'ur' ? 'اردو' : 'বাংলা';
              return (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang as any)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-md transition-colors",
                    language === lang
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="w-full md:w-auto flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
            <Filter size={18} className="text-gray-400 mr-1 shrink-0" />
            <div className="w-full md:w-auto text-sm text-gray-700 font-bold bg-transparent outline-none min-w-[150px]">
              {selectedHotelName}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="-mb-px flex gap-6 min-w-max">
          <button
            onClick={() => setActiveTab('needs_cleaning')}
            className={cn(
              "pb-4 px-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2",
              activeTab === 'needs_cleaning'
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}
          >
            <Brush size={16} />
            {t('تحتاج تنظيف', 'Needs cleaning', 'صفائی درکار', 'পরিষ্কার প্রয়োজন')}
            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs">
              {units.filter(u => u.status === 'cleaning' && (selectedHotelId === 'all' || u.hotel_id === selectedHotelId)).length}
            </span>
          </button>
          
          {/* ✅ تبويب جديد: تحتاج صيانة — يظهر للجميع وينتقل فيه الهاوس كيبنج مباشرة */}
          <button
            onClick={() => setActiveTab('needs_maintenance')}
            className={cn(
              "pb-4 px-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2",
              activeTab === 'needs_maintenance'
                ? "border-red-600 text-red-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}
          >
            <Wrench size={16} />
            {t('تحتاج صيانة', 'Needs maintenance', 'مرمت درکار', 'মেরামত প্রয়োজন')}
            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">
              {units.filter(u => u.status === 'maintenance' && (selectedHotelId === 'all' || u.hotel_id === selectedHotelId)).length}
            </span>
          </button>

          {/* ✅ تبويب جديد: وحدات متاحة — للهاوس كيبنج أيضاً (ولا تظهر له وحدات تجاوز الخروج) */}
          <button
            onClick={() => setActiveTab('available_units')}
            className={cn(
              "pb-4 px-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2",
              activeTab === 'available_units'
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}
          >
            <CheckCircle size={16} />
            {t('وحدات متاحة', 'Available units', 'دستیاب یونٹس', 'উপলব্ধ ইউনিট')}
            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs">
              {units.filter(u => {
                if (selectedHotelId !== 'all' && u.hotel_id !== selectedHotelId) return false;
                const isAvailable = u.status === 'available' || u.status === 'future_booked';
                const needsCleaning = (u.next_action === 'departure' || u.next_action === 'overdue');
                return isAvailable && !needsCleaning;
              }).length}
            </span>
          </button>

          {/* باقي التبويبات: للادمن والمدير فقط — لا تظهر للهاوس كيبنج */}
          {!isHousekeeping && (
            <>
              <button
                onClick={() => setActiveTab('all')}
                className={cn(
                  "pb-4 px-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2",
                  activeTab === 'all'
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                <BedDouble size={16} />
                {t('كل الوحدات', 'All units', 'تمام یونٹس', 'সব ইউনিট')}
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                  {selectedHotelId === 'all' ? units.length : units.filter(u => u.hotel_id === selectedHotelId).length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={cn(
                  "pb-4 px-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2",
                  activeTab === 'history'
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                <ClipboardList size={16} />
                {t('سجلات العمليات', 'Operations logs', 'آپریشنز لاگز', 'অপারেশনস লগ')}
              </button>

              <button
                onClick={() => setActiveTab('notes')}
                className={cn(
                  "pb-4 px-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2",
                  activeTab === 'notes'
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                <MessageSquare size={16} />
                {t('الملاحظات والمخالفات', 'Notes & violations', 'نوٹس اور خلاف ورزیاں', 'নোট ও লঙ্ঘন')}
              </button>
            </>
          )}
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">{t('جاري تحميل البيانات...', 'Loading...', 'ڈیٹا لوڈ ہو رہا ہے...', 'ডেটা লোড হচ্ছে...')}</div>
      ) : activeTab === 'history' ? (
        <div className="space-y-4">
          {/* Sub-tabs: Cleaning / Maintenance */}
          <div className="bg-white rounded-xl border border-gray-200 p-1 flex gap-1 w-full sm:w-auto sm:inline-flex">
            <button
              onClick={() => setRawHistoryTab('cleaning')}
              className={cn(
                "flex-1 sm:flex-none px-5 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2",
                rawHistoryTab === 'cleaning'
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Brush size={16} />
              {t('سجل التنظيفات', 'Cleaning logs', 'صفائی لاگز', 'পরিচ্ছন্নতা লগ')}
            </button>
            <button
              onClick={() => setRawHistoryTab('maintenance')}
              className={cn(
                "flex-1 sm:flex-none px-5 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2",
                rawHistoryTab === 'maintenance'
                  ? "bg-red-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Wrench size={16} />
              {t('سجل الصيانات', 'Maintenance logs', 'مرمت لاگز', 'মেরামত লগ')}
            </button>
          </div>

          {rawHistoryTab === 'cleaning' ? (
            <>
          {/* Filters */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">{t('تصفية:', 'Filter:', 'فلٹر:', 'ফিল্টার:')}</span>
            </div>
            
            <div className="relative">
              <User size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={cleanerFilter}
                onChange={(e) => setCleanerFilter(e.target.value)}
                className="pr-9 pl-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="all">{t('كل الموظفين', 'All staff', 'تمام عملہ', 'সব কর্মচারী')}</option>
                {allProfiles.map(profile => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name || profile.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pr-9 pl-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            
            {(cleanerFilter !== 'all' || dateFilter) && (
              <button 
                onClick={() => { setCleanerFilter('all'); setDateFilter(''); }}
                className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
              >
                <X size={14} />
                {t('مسح التصفيات', 'Clear filters', 'فلٹر صاف کریں', 'ফিল্টার সাফ করুন')}
              </button>
            )}
          </div>

          {cleaningLogs.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <ClipboardList size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">{t('لا توجد سجلات تنظيف', 'No cleaning logs', 'کوئی صفائی لاگز نہیں', 'কোনো পরিচ্ছন্নতার লগ নেই')}</h3>
              <p className="text-gray-500">
                  {(cleanerFilter !== 'all' || dateFilter)
                    ? t('لا توجد نتائج تطابق التصفيات', 'No results match the filters', 'فلٹرز سے کوئی نتیجہ میل نہیں کھاتا', 'ফিল্টারের সাথে কোনো ফলাফল মেলে না')
                    : t('سجل التنظيف فارغ حالياً', 'Cleaning history is currently empty', 'صفائی کی تاریخ فی الحال خالی ہے', 'পরিচ্ছন্নতার ইতিহাস বর্তমানে খালি')}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile View (Cards) */}
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {cleaningLogs.map((log) => (
                  <div key={log.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3">
                    <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                      <div>
                        <div className="font-bold text-gray-900 flex items-center gap-2">
                          {log.unit?.unit_number}
                          <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {log.unit?.hotel?.name}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <User size={12} />
                          {log.cleaner_name}
                        </div>
                      </div>
                      {log.status === 'confirmed' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle size={12} />
                          {t('مؤكد', 'Confirmed', 'تصدیق شدہ', 'নিশ্চিত')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          <AlertCircle size={12} />
                          {t('انتظار', 'Pending', 'زیر التوثیق', 'বিচারাধীন')}
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <div className="text-gray-600 flex flex-col text-xs">
                        <span>{new Date(log.cleaned_at).toLocaleDateString(dateLocale)}</span>
                        <span className="text-gray-400">{new Date(log.cleaned_at).toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      
                      {log.photo_data && (
                        <button
                          onClick={() => setSelectedImage(log.photo_data || null)}
                          className="text-blue-600 text-xs flex items-center gap-1 hover:underline"
                        >
                          <Camera size={14} />
                          {t('عرض الصورة', 'View photo', 'تصویر دیکھیں', 'ছবি দেখুন')}
                        </button>
                      )}
                    </div>

                    {log.notes && (
                      <div className="bg-gray-50 p-2 rounded text-xs text-gray-700 italic">
                        {log.notes}
                      </div>
                    )}

                    {log.status !== 'confirmed' && (
                      isReceptionist ? (
                        <button
                          className="w-full py-2 bg-gray-200 text-gray-500 text-sm font-medium rounded-lg cursor-not-allowed mt-1"
                          title={t('غير مسموح للرسيبشن', 'Not allowed for reception', 'رسیپشن کے لیے اجازت نہیں', 'রিসেপশনের জন্য অনুমোদিত নয়')}
                          aria-disabled
                        >
                          {t('تأكيد التنظيف', 'Confirm cleaning', 'صفائی کی تصدیق کریں', 'পরিচ্ছন্নতা নিশ্চিত করুন')}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConfirmLog(log)}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 mt-1"
                        >
                          <CheckCircle size={16} />
                          {t('تأكيد التنظيف', 'Confirm cleaning', 'صفائی کی تصدیق کریں', 'পরিচ্ছন্নতা নিশ্চিত করুন')}
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop View (Table) */}
              <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-gray-50 text-gray-700 font-medium border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4">{t('الوحدة', 'Unit', 'یونٹ', 'ইউনিট')}</th>
                        <th className="px-6 py-4">{t('المنفذ', 'Cleaner', 'صفائی کرنے والا', 'পরিচ্ছন্নতাকারী')}</th>
                        <th className="px-6 py-4">{t('التاريخ', 'Date', 'تاریخ', 'তারিখ')}</th>
                        <th className="px-6 py-4">{t('ملاحظات', 'Notes', 'نوٹس', 'নোট')}</th>
                        <th className="px-6 py-4">{t('الصورة', 'Photo', 'تصویر', 'ছবি')}</th>
                        <th className="px-6 py-4">{t('الحالة', 'Status', 'سٹیٹس', 'স্ট্যাটাস')}</th>
                        <th className="px-6 py-4">{t('إجراءات', 'Actions', 'کارروائیاں', 'কার্যক্রম')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {cleaningLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-900">{log.unit?.unit_number}</div>
                            <div className="text-xs text-gray-500">{log.unit?.hotel?.name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                                <User size={14} />
                              </div>
                              {log.cleaner_name}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-600 dir-ltr text-right">
                            <div className="flex items-center gap-2 justify-end">
                              {new Date(log.cleaned_at).toLocaleDateString(dateLocale)}
                              <span className="text-xs text-gray-400">
                                {new Date(log.cleaned_at).toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 max-w-[200px]">
                            {log.notes ? (
                              <span className="text-gray-700 truncate block" title={log.notes}>{log.notes}</span>
                            ) : (
                              <span className="text-gray-400 italic">{t('لا توجد ملاحظات', 'No notes', 'کوئی نوٹس نہیں', 'কোনো নোট নেই')}</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {log.photo_data ? (
                              <div 
                                className="relative group w-16 h-12 cursor-pointer"
                                onClick={() => setSelectedImage(log.photo_data || null)}
                              >
                                <img 
                                  src={log.photo_data} 
                                  alt="Cleaning" 
                                  className="w-full h-full object-cover rounded-lg border border-gray-200"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                  <span className="text-white text-xs">{t('عرض', 'View', 'دیکھیں', 'দেখুন')}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">{t('تم حذف الصورة', 'Photo deleted', 'تصویر حذف کر دی گئی', 'ছবি মুছে ফেলা হয়েছে')}</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {log.status === 'confirmed' ? (
                              <div className="flex flex-col gap-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 w-fit">
                                  <CheckCircle size={12} />
                                  {t('مؤكد', 'Confirmed', 'تصدیق شدہ', 'নিশ্চিত')}
                                </span>
                                {log.confirmer_name && (
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <UserCheck size={10} />
                                    {t('بواسطة:', 'By:', 'کے ذریعہ:', 'দ্বারা:')} {log.confirmer_name}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                <AlertCircle size={12} />
                                {t('بانتظار التأكيد', 'Awaiting confirmation', 'تصدیق کا انتظار', 'নিশ্চিতকরণের অপেক্ষায়')}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {log.status !== 'confirmed' && (
                              <button
                                onClick={() => handleConfirmLog(log)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                              >
                                <CheckCircle size={14} />
                                {t('تأكيد', 'Confirm', 'تصدیق کریں', 'নিশ্চিত করুন')}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
            </>
          ) : (
            // ==================== سجل الصيانات Maintenance ====================
            <>
              {/* Filters — نفسها ولكن لون أحمر للتركيز */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Filter size={18} className="text-red-500" />
                  <span className="text-sm font-medium text-gray-700">{t('تصفية الصيانات:', 'Maintenance filter:', 'مرمت فلٹر:', 'মেরামত ফিল্টার:')}</span>
                </div>
                <div className="relative">
                  <User size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select
                    value={cleanerFilter}
                    onChange={(e) => setCleanerFilter(e.target.value)}
                    className="pr-9 pl-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  >
                    <option value="all">{t('كل الموظفين', 'All staff', 'تمام عملہ', 'সব কর্মচারী')}</option>
                    {allProfiles.map(profile => (
                      <option key={profile.id} value={profile.id}>
                        {profile.full_name || profile.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="pr-9 pl-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  />
                </div>
                {(cleanerFilter !== 'all' || dateFilter) && (
                  <button
                    onClick={() => { setCleanerFilter('all'); setDateFilter(''); }}
                    className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                  >
                    <X size={14} />
                    {t('مسح التصفيات', 'Clear filters', 'فلٹر صاف کریں', 'ফিল্টার সাফ করুন')}
                  </button>
                )}
              </div>

              {maintenanceLogs.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <Wrench size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">{t('لا توجد سجلات صيانة', 'No maintenance logs', 'کوئی مرمت لاگز نہیں', 'কোনো মেরামতের লগ নেই')}</h3>
                  <p className="text-gray-500">
                    {(cleanerFilter !== 'all' || dateFilter)
                      ? t('لا توجد نتائج تطابق التصفيات', 'No results match the filters', 'فلٹرز سے کوئی نتیجہ میل نہیں کھاتا', 'ফিল্টারের সাথে কোনো ফলাফল মেলে না')
                      : t('لم يتم تسجيل أي طلبات صيانة أو إكمال بعد', 'No maintenance requests or completions yet', 'ابھی تک کوئی مرمت کی درخواست یا تکمیل درج نہیں کی گئی', 'এখনো কোনো মেরামতের অনুরোধ বা সমাপ্তি নথিভুক্ত করা হয়নি')}
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile Cards للصيانات */}
                  <div className="grid grid-cols-1 gap-4 md:hidden">
                    {maintenanceLogs.map((log) => (
                      <div key={log.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3">
                        <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                          <div>
                            <div className="font-bold text-gray-900 flex items-center gap-2">
                              {log.unit?.unit_number}
                              <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                {log.unit?.hotel?.name}
                              </span>
                              {log.issue_type && (
                                <span className="text-xs font-bold bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-100">
                                  {MAINTENANCE_ISSUE_TYPES.find(i => i.key === log.issue_type)?.[language as 'ar' | 'en' | 'ur' | 'bn'] || log.issue_type}
                                </span>
                              )}
                            </div>
                            {log.reporter_name && (
                              <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                <User size={12} />
                                {t('أبلغ عن:', 'Reported by:', 'دریافت کنندہ:', 'রিপোর্ট করেছেন:')} {log.reporter_name}
                              </div>
                            )}
                          </div>
                          {log.status === 'confirmed' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle size={12} />
                              {t('مؤكد', 'Confirmed', 'تصدیق شدہ', 'নিশ্চিত')}
                            </span>
                          ) : log.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <Check size={12} />
                              {t('منجزة', 'Completed', 'مکمل', 'সম্পন্ন')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              <AlertCircle size={12} />
                              {t('قيد التنفيذ', 'In progress', 'زیر التوثیق', 'চলমান')}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-4 text-xs text-gray-600">
                          {log.reported_at && (
                            <div>
                              <div className="font-bold text-gray-700">{t('تاريخ البلاغ:', 'Reported at:', 'اطلاع کی تاریخ:', 'রিপোর্টের সময়:')}</div>
                              <div>{new Date(log.reported_at).toLocaleDateString(dateLocale)}</div>
                            </div>
                          )}
                          {log.performed_at && (
                            <div>
                              <div className="font-bold text-gray-700">{t('تاريخ الإكمال:', 'Completed at:', 'تکمیل کی تاریخ:', 'সম্পন্ন করার সময়:')}</div>
                              <div>{new Date(log.performed_at).toLocaleDateString(dateLocale)}</div>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          {log.photo_before && (
                            <button
                              onClick={() => setSelectedImage(log.photo_before || null)}
                              className="text-red-600 text-xs flex items-center gap-1 hover:underline px-2 py-1 bg-red-50 rounded-lg border border-red-100"
                            >
                              📷 {t('قبل', 'Before', 'پہلے', 'আগে')}
                            </button>
                          )}
                          {log.photo_after && (
                            <button
                              onClick={() => setSelectedImage(log.photo_after || null)}
                              className="text-green-600 text-xs flex items-center gap-1 hover:underline px-2 py-1 bg-green-50 rounded-lg border border-green-100"
                            >
                              📷 {t('بعد', 'After', 'بعد میں', 'পরে')}
                            </button>
                          )}
                        </div>

                        {(log.notes || log.completion_notes) && (
                          <div className="bg-gray-50 p-2 rounded text-xs text-gray-700 italic space-y-1">
                            {log.notes && <div><span className="font-bold text-red-700">{t('بلاغ:', 'Report:', 'اطلاع:', 'রিপোর্ট:')}</span> {log.notes}</div>}
                            {log.completion_notes && <div><span className="font-bold text-green-700">{t('إكمال:', 'Completion:', 'تکمیل:', 'সমাপ্তি:')}</span> {log.completion_notes}</div>}
                          </div>
                        )}

                        {log.performer_name && (
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <UserCheck size={12} />
                            {t('المنفذ:', 'Performed by:', 'تکمیل کنندہ:', 'সম্পন্ন করেছেন:')} {log.performer_name}
                          </div>
                        )}

                        {(log.status === 'completed' || log.status === 'in_progress' || log.status === 'pending') && (
                          isReceptionist ? (
                            <button className="w-full py-2 bg-gray-200 text-gray-500 text-sm font-medium rounded-lg cursor-not-allowed" aria-disabled>
                              {t('تأكيد الصيانة', 'Confirm maintenance', 'مرمت تصدیق کریں', 'মেরামত নিশ্চিত করুন')}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleConfirmMaintenanceLog(log)}
                              className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                              <CheckCircle size={16} />
                              {t('تأكيد الصيانة', 'Confirm maintenance', 'مرمت تصدیق کریں', 'মেরামত নিশ্চিত করুন')}
                            </button>
                          )
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table للصيانات */}
                  <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-right">
                        <thead className="bg-gray-50 text-gray-700 font-medium border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-4">{t('الوحدة', 'Unit', 'یونٹ', 'ইউনিট')}</th>
                            <th className="px-6 py-4">{t('نوع المشكلة', 'Issue type', 'قسم مسئلہ', 'সমস্যার ধরন')}</th>
                            <th className="px-6 py-4">{t('المُبلغ / المُنفذ', 'Reporter / Performer', 'اطلاع/تکمیل', 'রিপোর্টার / পারফর্মার')}</th>
                            <th className="px-6 py-4">{t('التواريخ', 'Dates', 'تاریخیں', 'তারিখসমূহ')}</th>
                            <th className="px-6 py-4">{t('الصور', 'Photos', 'تصاویر', 'ছবি')}</th>
                            <th className="px-6 py-4">{t('الحالة', 'Status', 'سٹیٹس', 'স্ট্যাটাস')}</th>
                            <th className="px-6 py-4">{t('إجراءات', 'Actions', 'کارروائیاں', 'কার্যক্রম')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {maintenanceLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-bold text-gray-900">{log.unit?.unit_number}</div>
                                <div className="text-xs text-gray-500">{log.unit?.hotel?.name}</div>
                              </td>
                              <td className="px-6 py-4">
                                {log.issue_type ? (
                                  <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                                    {MAINTENANCE_ISSUE_TYPES.find(i => i.key === log.issue_type)?.[language as 'ar' | 'en' | 'ur' | 'bn'] || log.issue_type}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 italic text-xs">-</span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-xs text-gray-700">
                                  <div className="flex items-center gap-1"><User size={12} className="text-gray-400" /> {t('أبلغ:', 'R:', 'اطلاع:', 'রিপোর্ট:')} <span className="font-bold">{log.reporter_name || '—'}</span></div>
                                  {log.performer_name && (
                                    <div className="flex items-center gap-1 mt-1"><UserCheck size={12} className="text-gray-400" /> {t('أكمل:', 'C:', 'تکمیل:', 'সম্পন্ন:')} <span className="font-bold">{log.performer_name}</span></div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-gray-600 dir-ltr text-right">
                                <div className="text-xs">
                                  {log.reported_at && <div className="flex items-center gap-1 justify-end"><AlertCircle size={12} className="text-gray-400" /> {new Date(log.reported_at).toLocaleDateString(dateLocale)}</div>}
                                  {log.performed_at && <div className="flex items-center gap-1 justify-end mt-0.5"><CheckCircle size={12} className="text-gray-400" /> {new Date(log.performed_at).toLocaleDateString(dateLocale)}</div>}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex gap-1">
                                  {log.photo_before ? (
                                    <div className="relative group w-14 h-11 cursor-pointer border-2 border-red-200 rounded-lg overflow-hidden"
                                         onClick={() => setSelectedImage(log.photo_before || null)}>
                                      <img src={log.photo_before} alt="Before" className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                                        <span className="text-white text-[10px] font-bold">{t('قبل', 'B', 'پہلے', 'আগে')}</span>
                                      </div>
                                    </div>
                                  ) : null}
                                  {log.photo_after ? (
                                    <div className="relative group w-14 h-11 cursor-pointer border-2 border-green-200 rounded-lg overflow-hidden"
                                         onClick={() => setSelectedImage(log.photo_after || null)}>
                                      <img src={log.photo_after} alt="After" className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                                        <span className="text-white text-[10px] font-bold">{t('بعد', 'A', 'بعد میں', 'পরে')}</span>
                                      </div>
                                    </div>
                                  ) : null}
                                  {!log.photo_before && !log.photo_after && (
                                    <span className="text-gray-400 italic text-xs px-1">{t('لا توجد', 'None', 'کوئی نہیں', 'নেই')}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-1">
                                  {log.status === 'confirmed' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 w-fit">
                                      <CheckCircle size={12} />
                                      {t('مؤكد', 'Confirmed', 'تصدیق شدہ', 'নিশ্চিত')}
                                    </span>
                                  ) : log.status === 'completed' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 w-fit">
                                      <Check size={12} />
                                      {t('منجزة', 'Completed', 'مکمل', 'সম্পন্ন')}
                                    </span>
                                  ) : log.status === 'in_progress' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 w-fit">
                                      ⚙️ {t('قيد التنفيذ', 'In progress', 'زیر التوثیق', 'চলমান')}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 w-fit">
                                      <AlertCircle size={12} />
                                      {t('بانتظار', 'Pending', 'زیر التوثیق', 'বিচারাধীন')}
                                    </span>
                                  )}
                                  {log.confirmer_name && (
                                    <span className="text-xs text-gray-500 flex items-center gap-1">
                                      <UserCheck size={10} />
                                      {t('بواسطة:', 'By:', 'کے ذریعہ:', 'দ্বারা:')} {log.confirmer_name}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {(log.status === 'pending' || log.status === 'in_progress' || log.status === 'completed') && (
                                  <button
                                    onClick={() => handleConfirmMaintenanceLog(log)}
                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                                  >
                                    <CheckCircle size={14} />
                                    {t('تأكيد', 'Confirm', 'تصدیق کریں', 'নিশ্চিত করুন')}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      ) : activeTab === 'notes' ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200">
            <div>
              <h2 className="text-lg font-medium text-gray-900">{t('سجل الملاحظات والمخالفات', 'Notes & violations log', 'نوٹس اور خلاف ورزیوں کا لاگ', 'নোট ও লঙ্ঘনের লগ')}</h2>
              <p className="text-sm text-gray-500">{t('متابعة أداء الموظفين وتسجيل الملاحظات الإدارية', 'Track staff performance and record administrative notes', 'ملازمین کی کارکردگی کا جائزہ لینا اور انتظامی نوٹس درج کرنا', 'কর্মচারীদের কার্যকারিতা ট্র্যাক করুন এবং প্রশাসনিক নোট রেকর্ড করুন')}</p>
            </div>
            {!isReceptionist && (
              <button
                onClick={() => setIsNoteModalOpen(true)}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                {t('إضافة ملاحظة', 'Add note', 'نوٹ شامل کریں', 'নোট যোগ করুন')}
              </button>
            )}
          </div>

          {staffNotes.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">{t('لا توجد ملاحظات', 'No notes', 'کوئی نوٹس نہیں')}</h3>
                <p className="text-gray-500">{t('لم يتم تسجيل أي ملاحظات أو مخالفات بعد', 'No notes or violations have been recorded yet', 'ابھی تک کوئی نوٹس یا خلاف ورزی درج نہیں کی گئی ہے', 'এখনো কোনো নোট বা লঙ্ঘন রেকর্ড করা হয়নি')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {staffNotes.map((note) => (
                <div key={note.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
                        <User size={16} />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{note.target_user_name}</div>
                        <div className="text-xs text-gray-500">{new Date(note.created_at).toLocaleDateString(dateLocale)}</div>
                      </div>
                    </div>
                    {note.type === 'violation' ? (
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1",
                        note.severity === 'low' ? "bg-amber-100 text-amber-700" :
                        note.severity === 'medium' ? "bg-orange-100 text-orange-700" :
                        "bg-red-100 text-red-700"
                      )}>
                        <AlertTriangle size={12} />
                        {t('مخالفة', 'Violation', 'خلاف ورزی', 'লঙ্ঘন')} ({note.severity === 'critical' ? t('جسيمة', 'Critical', 'سنگین', 'মারাত্মক') : note.severity === 'high' ? t('عالية', 'High', 'زیادہ', 'উচ্চ') : note.severity === 'medium' ? t('متوسطة', 'Medium', 'متوسط', 'মাঝারি') : t('بسيطة', 'Low', 'کم', 'নিম্ন')})
                      </span>
                    ) : note.type === 'commendation' ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 flex items-center gap-1">
                        <Award size={12} />
                        {t('تنويه', 'Commendation', 'تعریف', 'সম্মাননা')}
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 flex items-center gap-1">
                        <MessageSquare size={12} />
                        {t('ملاحظة', 'Note', 'نوٹ', 'নোট')}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-gray-700 text-sm mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100 min-h-[60px]">
                    {note.content}
                  </p>
                  
                  <div className="flex justify-between items-center text-xs text-gray-400 border-t border-gray-100 pt-3">
                    <span>{t('بواسطة:', 'By:', 'کے ذریعہ:', 'দ্বারা:')} {note.creator_name}</span>
                    <span>{new Date(note.created_at).toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : filteredUnits.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <CheckCircle size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">{t('لا توجد وحدات', 'No units', 'کوئی یونٹس نہیں', 'কোনো ইউনিট নেই')}</h3>
          <p className="text-gray-500">
            {activeTab === 'needs_cleaning' 
              ? t('جميع الوحدات نظيفة وجاهزة!', 'All units are clean and ready!', 'تمام یونٹس صاف اور تیار ہیں!', 'সব ইউনিট পরিষ্কার ও প্রস্তুত!')
              : activeTab === 'needs_maintenance'
                ? t('لا توجد وحدات بحاجة للصيانة حالياً.', 'No units currently require maintenance.', 'فی الحال کوئی یونٹ مرمت کی ضرورت نہیں ہے۔', 'বর্তমানে কোনো ইউনিটের মেরামতের প্রয়োজন নেই।')
                : activeTab === 'available_units'
                  ? t('لا توجد وحدات متاحة حالياً.', 'No units are currently available.', 'فی الحال کوئی دستیاب یونٹس نہیں ہیں۔', 'বর্তমানে কোনো ইউনিট পাওয়া যাচ্ছে না।')
                  : t('لا توجد وحدات مطابقة للفلتر المحدد', 'No units match the selected filter', 'منتخب فلٹر سے کوئی یونٹس میل نہیں کھاتے', 'নির্বাচিত ফিল্টারের সাথে কোনো ইউনিট মেলে না')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredUnits.map((unit) => {
            const StatusIcon = (STATUS_LABELS[unit.status] || STATUS_LABELS.available).icon;
            const statusLabel = (STATUS_LABELS[unit.status] || STATUS_LABELS.available).label;
            const statusColor = (STATUS_LABELS[unit.status] || STATUS_LABELS.available).color;
            const formatDt = (d?: string | null) => {
              if (!d) return null;
              try { return new Date(d).toLocaleDateString(dateLocale); } catch { return d; }
            };
            return (
              <div
                key={unit.id}
                className={cn(
                  "bg-white rounded-xl border shadow-sm hover:shadow-md transition-all p-4 flex flex-col gap-3",
                  unit.next_action === 'overdue' ? 'border-rose-300 ring-1 ring-rose-200' :
                  unit.next_action === 'departure' ? 'border-orange-300 ring-1 ring-orange-200' :
                  unit.next_action === 'arrival' ? 'border-sky-300 ring-1 ring-sky-200' :
                  'border-gray-200'
                )}
              >
                {/* Header */}
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      {unit.unit_number}
                      <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded truncate">
                        {unit.unit_type?.name || unit.unit_type_name || ''}
                      </span>
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                        {unit.hotel?.name} • {t('طابق', 'Floor', 'منزل', 'তলা')} {unit.floor}
                    </p>
                    {/* اسم الضيف + معلومات الحجز */}
                    {(unit.guest_name || unit.has_temp_res) && (
                      <div className="mt-2 space-y-1">
                        <div className="text-xs font-medium text-gray-700 flex items-center gap-1.5 truncate">
                          <User size={11} className="text-gray-400 flex-shrink-0" />
                          <span className="truncate">
                            {unit.action_guest_name || unit.guest_name || t('ضيف', 'Guest', 'مہمان', 'অতিথি')}
                          </span>
                          {unit.has_temp_res && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded ring-1 ring-indigo-200 flex-shrink-0">
                              {t('حجز مؤقت', 'Temp. reserve', 'عارضی بکنگ', 'সাময়িক বুকিং')}
                            </span>
                          )}
                        </div>
                        {(unit.booking_check_in || unit.booking_check_out) && (
                          <div className="text-[11px] text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          {unit.booking_check_in && (
                            <span className="whitespace-nowrap">{t('دخول:', 'In:', 'داخل:', 'ইন:')} {formatDt(unit.booking_check_in)}</span>
                          )}
                          {unit.booking_check_out && (
                            <span className={cn(
                              "whitespace-nowrap",
                              unit.next_action === 'departure' && 'font-semibold text-orange-700',
                              unit.next_action === 'overdue' && 'font-semibold text-rose-700'
                            )}>{t('خروج:', 'Out:', 'باہر:', 'আউট:')} {formatDt(unit.booking_check_out)}
                              {unit.remaining_days != null && unit.remaining_days >= 0 && (
                                <span className="ml-1 text-gray-400">({unit.remaining_days} {t('يوم', 'd', 'دن', 'দিন')})</span>
                              )}
                            </span>
                          )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className={cn(
                    "px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 border flex-shrink-0",
                    statusColor
                  )}>
                    <StatusIcon size={12} />
                    <span className="whitespace-nowrap">
                      {language === 'en' ? statusLabel.en :
                        language === 'ur' ? statusLabel.ur :
                        language === 'bn' ? statusLabel.bn :
                        statusLabel.ar}
                    </span>
                  </div>
                </div>

                {/* شارات العمل والدفعات */}
                <div className="flex flex-wrap gap-1.5">
                  {unit.next_action === 'departure' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-100 text-orange-700 ring-1 ring-orange-200">
                      🏁 {t('خروج اليوم', 'Check-out today', 'آج چھوٹنا', 'আজ চেক-আউট')}
                    </span>
                  )}
                  {unit.next_action === 'overdue' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-100 text-rose-700 ring-1 ring-rose-200">
                      ⚠️ {t('تجاوز الخروج', 'Overdue checkout', 'چھوٹ گزرنا', 'ওভারডিউ চেক-আউট')}
                    </span>
                  )}
                  {unit.next_action === 'arrival' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-100 text-sky-700 ring-1 ring-sky-200">
                      ✅ {t('وصول اليوم', 'Check-in today', 'آج آنا', 'আজ চেক-ইন')}
                    </span>
                  )}
                  {unit.payment_due_status === 'due_today' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
                      💰 {t('سداد اليوم', 'Pay today', 'آج ادا کریں', 'আজ পরিশোধ')}
                    </span>
                  )}
                  {unit.payment_due_status === 'overdue' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-100 text-rose-700 ring-1 ring-rose-200">
                      💸 {t('متأخر سداد', 'Overdue payment', 'دیر سے ادائیگی', 'ওভারডিউ পেমেন্ট')}
                    </span>
                  )}
                  {unit.payment_due_status === 'due_soon' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700 ring-1 ring-amber-200">
                      ⏳ {t('قريباً', 'Due soon', 'جلد ہی', 'শীঘ্রই বকেয়া')}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-auto pt-3 border-t border-gray-100 flex gap-2">
                  {activeTab === 'needs_cleaning' ? (
                    <button
                      onClick={() => openCleaningModal(unit)}
                      disabled={updating === unit.id}
                      className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {updating === unit.id ? (
                        <span className="animate-spin">⌛</span>
                      ) : (
                        <>
                          <Check size={16} />
                          {t('تم التنظيف', 'Cleaned', 'صفائی ہو گئی', 'পরিষ্কার করা হয়েছে')}
                        </>
                      )}
                    </button>
                  ) : activeTab === 'needs_maintenance' ? (
                    <div className="w-full flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => openMaintenanceRequestModal(unit)}
                        disabled={updating === unit.id}
                        className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <AlertCircle size={15} />
                        {t('إبلاغ مشكلة', 'Report issue', 'مسئلہ کی اطلاع', 'সমস্যা রিপোর্ট')}
                      </button>
                      <button
                        onClick={() => openMaintenanceCompleteModal(unit)}
                        disabled={updating === unit.id}
                        className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle size={15} />
                        {t('إنهاء صيانة', 'Complete maintenance', 'مرمت مکمل کریں', 'মেরামত সম্পন্ন')}
                      </button>
                    </div>
                  ) : activeTab === 'available_units' ? (
                    <div className="w-full flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => updateUnitStatus(unit.id, 'cleaning')}
                        disabled={updating === unit.id}
                        className="flex-1 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Brush size={15} />
                        {t('إضافة للتنظيف', 'Add to cleaning', 'صفائی میں شامل کریں', 'পরিচ্ছন্নতায় যোগ করুন')}
                      </button>
                      <button
                        onClick={() => openMaintenanceRequestModal(unit)}
                        disabled={updating === unit.id}
                        className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Wrench size={15} />
                        {t('إضافة للصيانة', 'Add to maintenance', 'مرمت میں شامل کریں', 'মেরামতে যোগ করুন')}
                      </button>
                    </div>
                  ) : (
                    <div className="w-full flex flex-col gap-2">
                      <div className="flex flex-col sm:flex-row gap-2">
                        {unit.status !== 'cleaning' && (
                          <button
                            onClick={() => updateUnitStatus(unit.id, 'cleaning')}
                            disabled={updating === unit.id}
                            className="flex-1 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                          >
                            <Brush size={14} />
                            {t('للتنظيف', 'To cleaning', 'صفائی کو', 'পরিচ্ছন্নতায়')}
                          </button>
                        )}
                        {unit.status !== 'maintenance' && (
                          <button
                            onClick={() => openMaintenanceRequestModal(unit)}
                            disabled={updating === unit.id}
                            className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                          >
                            <Wrench size={14} />
                            {t('للصيانة', 'To maintenance', 'مرمت کو', 'মেরামতে')}
                          </button>
                        )}
                      </div>
                      <select
                        value={unit.status}
                        onChange={(e) => updateUnitStatus(unit.id, e.target.value)}
                        disabled={updating === unit.id}
                        className="w-full py-2 px-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 cursor-pointer outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                      >
                        <option value="available">{t('متاح (نظيف)', 'Available (clean)', 'دستیاب (صاف)', 'উপলব্ধ (পরিষ্কার)')}</option>
                        <option value="cleaning">{t('يحتاج تنظيف', 'Needs cleaning', 'صفائی درکار', 'পরিষ্কার প্রয়োজন')}</option>
                        <option value="maintenance">{t('صيانة', 'Maintenance', 'مرمت', 'মেরামত')}</option>
                        <option value="occupied">{t('مشغول', 'Occupied', 'مصروف', 'ব্যস্ত')}</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center">
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 left-0 text-white hover:text-gray-300 p-2"
            >
              <X size={24} />
            </button>
            <img 
              src={selectedImage} 
              alt="Cleaning Proof" 
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare size={20} className="text-blue-600" />
                {t('إضافة ملاحظة / مخالفة', 'Add note / violation', 'نوٹ / خلاف ورزی شامل کریں', 'নোট / লঙ্ঘন যোগ করুন')}
              </h3>
              <button 
                onClick={() => setIsNoteModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Employee Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('الموظف المعني', 'Target employee', 'متعلقہ ملازم', 'লক্ষ্য কর্মচারী')}
                </label>
                <select
                  value={noteForm.target_user_id}
                  onChange={(e) => setNoteForm({...noteForm, target_user_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-right"
                >
                  <option value="">{t('اختر الموظف...', 'Select employee...', 'ملازم منتخب کریں...', 'কর্মচারী নির্বাচন করুন...')}</option>
                  {allProfiles.map(profile => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name || profile.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Select */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('نوع السجل', 'Entry type', ' اندراج کی قسم', 'এন্ট্রি ধরন')}
                </label>
                <select
                  value={noteForm.type}
                  onChange={(e) => setNoteForm({...noteForm, type: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-right"
                >
                  <option value="note">{t('ملاحظة عامة', 'General note', 'عام نوٹ', 'সাধারণ নোট')}</option>
                  <option value="violation">{t('مخالفة', 'Violation', 'خلاف ورزی', 'লঙ্ঘন')}</option>
                  <option value="commendation">{t('تنويه / شكر', 'Commendation', 'تعریف / شکریہ', 'সম্মাননা / ধন্যবাদ')}</option>
                </select>
                </div>
                
                {noteForm.type === 'violation' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('درجة المخالفة', 'Severity', 'شدت', 'তীব্রতা')}
                    </label>
                    <select
                      value={noteForm.severity}
                      onChange={(e) => setNoteForm({...noteForm, severity: e.target.value as any})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-right"
                    >
                      <option value="low">{t('بسيطة', 'Low', 'کم', 'নিম্ন')}</option>
                      <option value="medium">{t('متوسطة', 'Medium', 'متوسط', 'মাঝারি')}</option>
                      <option value="high">{t('عالية', 'High', 'زیادہ', 'উচ্চ')}</option>
                      <option value="critical">{t('جسيمة', 'Critical', 'سنگین', 'মারাত্মক')}</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('نص الملاحظة', 'Content', 'مواد', 'বিষয়বস্তু')}
                </label>
                <textarea
                  value={noteForm.content}
                  onChange={(e) => setNoteForm({...noteForm, content: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none h-32 resize-none text-right"
                  placeholder={t('اكتب تفاصيل الملاحظة أو المخالفة هنا...', 'Write note/violation details here...', 'یہاں نوٹ/خلاف ورزی کی تفصیلات لکھیں...', 'এখানে নোট/লঙ্ঘনের বিবরণ লিখুন...')}
                ></textarea>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setIsNoteModalOpen(false)}
                className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
              >
                {t('إلغاء', 'Cancel', 'منسوخ کریں', 'বাতিল করুন')}
              </button>
              <button
                onClick={handleAddNote}
                disabled={isSubmitting || !noteForm.target_user_id || !noteForm.content}
                className={cn(
                  "px-4 py-2 text-white font-medium rounded-lg transition-colors flex items-center gap-2",
                  isSubmitting || !noteForm.target_user_id || !noteForm.content
                    ? "bg-blue-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {isSubmitting ? t('جاري الحفظ...', 'Saving...', 'محفوظ کیا جا رہا ہے...', 'সংরক্ষণ হচ্ছে...') : t('حفظ الملاحظة', 'Save note', 'نوٹ محفوظ کریں', 'নোট সংরক্ষণ করুন')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cleaning Confirmation Modal */}
      {isModalOpen && selectedUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{t('تأكيد تنظيف الوحدة', 'Confirm unit cleaning', 'یونٹ کی صفائی کی تصدیق کریں', 'ইউনিট পরিচ্ছন্নতা নিশ্চিত করুন')}</h3>
                <p className="text-sm text-gray-500">#{selectedUnit.unit_number} - {selectedUnit.hotel?.name}</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Cleaner Info */}
              <div className="bg-blue-50 p-3 rounded-lg flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                  <User size={18} />
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-medium mb-0.5">{t('منفذ التنظيف', 'Cleaner', 'صفائی کرنے والا', 'পরিচ্ছন্নতাকারী')}</p>
                  <p className="text-sm font-bold text-gray-900">
                    {currentUser?.full_name || currentUser?.email || unknownUserLabel}
                  </p>
                </div>
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('صورة الغرفة (مطلوب)', 'Room photo (required)', 'کمرے کی تصویر (ضروری)', 'রুমের ছবি (প্রয়োজনীয়)')}
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageChange}
                    className="hidden"
                    id="cleaning-photo"
                  />
                  <label
                    htmlFor="cleaning-photo"
                    className={cn(
                      "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
                      photoData ? "border-green-300 bg-green-50" : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                    )}
                  >
                    {photoData ? (
                      <div className="relative w-full h-full p-2">
                        <img 
                          src={photoData} 
                          alt="Room Preview" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity rounded-lg">
                          <p className="text-white text-xs font-bold">{t('تغيير الصورة', 'Change photo', 'تصویر تبدیل کریں', 'ছবি পরিবর্তন করুন')}</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Camera className="text-gray-400 mb-2" size={24} />
                        <p className="text-sm text-gray-500 font-medium">{t('التقاط صورة للغرفة', 'Take a room photo', 'کمرے کی تصویر لیں', 'রুমের ছবি তুলুন')}</p>
                        <p className="text-xs text-gray-400 mt-1">{t('اضغط للكاميرا أو المعرض', 'Tap to open camera or gallery', 'کیمرہ یا گیلری کھولنے کے لیے تھپتھپائیں', 'ক্যামেরা বা গ্যালারি খুলতে ট্যাপ করুন')}</p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('تقرير التنظيف (اختياري)', 'Cleaning report (optional)', 'صفائی کی رپورٹ (اختیاری)', 'পরিচ্ছন্নতা রিপোর্ট (ঐচ্ছিক)')}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('هل هناك ملاحظات صيانة أو أضرار؟', 'Any maintenance notes or damages?', 'کوئی مرمت نوٹس یا نقصانات ہیں؟', 'কোনো মেরামত নোট বা ক্ষতি আছে?')}
                  className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none h-24"
                />
              </div>
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                disabled={isSubmitting}
              >
                {t('إلغاء', 'Cancel', 'منسوخ کریں', 'বাতিল করুন')}
              </button>
              <button
                onClick={handleConfirmCleaning}
                disabled={isSubmitting || !photoData}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-200"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    {t('جاري الحفظ...', 'Saving...', 'محفوظ کیا جا رہا ہے...', 'সংরক্ষণ হচ্ছে...')}
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    {t('تأكيد التنظيف', 'Confirm cleaning', 'صفائی کی تصدیق کریں', 'পরিচ্ছন্নতা নিশ্চিত করুন')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Maintenance Request Modal (تقرير مشكلة) */}
      {isRequestModalOpen && requestedUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-red-50/50">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <AlertCircle size={20} className="text-red-600" />
                  {t('إبلاغ عن مشكلة صيانة', 'Report maintenance issue', 'مرمت مسئلہ کی اطلاع', 'মেরামত সমস্যা রিপোর্ট')}
                </h3>
                <p className="text-sm text-gray-500">#{requestedUnit.unit_number} - {requestedUnit.hotel?.name}</p>
              </div>
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Reporter */}
              <div className="bg-red-50 p-3 rounded-lg flex items-center gap-3">
                <div className="bg-red-100 p-2 rounded-full text-red-600">
                  <User size={18} />
                </div>
                <div>
                  <p className="text-xs text-red-600 font-medium mb-0.5">{t('المُبلغ عن المشكلة', 'Reporter', 'اطلاع کنندہ', 'রিপোর্টার')}</p>
                  <p className="text-sm font-bold text-gray-900">
                    {currentUser?.full_name || currentUser?.email || unknownUserLabel}
                  </p>
                </div>
              </div>

              {/* Issue Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('نوع المشكلة (مطلوب)', 'Issue type (required)', 'قسم مسئلہ (ضروری)', 'সমস্যার ধরন (প্রয়োজনীয়)')}
                </label>
                <select
                  value={requestIssueType}
                  onChange={(e) => setRequestIssueType(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                >
                  {MAINTENANCE_ISSUE_TYPES.map(issue => (
                    <option key={issue.key} value={issue.key}>
                      {language === 'en' ? issue.en : language === 'ur' ? issue.ur : language === 'bn' ? issue.bn : issue.ar}
                    </option>
                  ))}
                </select>
              </div>

              {/* Photo Before */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('صورة المشكلة — قبل الإصلاح (مطلوب)', 'Issue photo — before repair (required)', 'مسئلے کی تصویر (ضروری)', 'সমস্যার ছবি — মেরামতের আগে (প্রয়োজনীয়)')}
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const MW = 800, MH = 600;
                            let w = img.width, h = img.height;
                            if (w > h) { if (w > MW) { h *= MW / w; w = MW; } } else { if (h > MH) { w *= MH / h; h = MH; } }
                            canvas.width = w; canvas.height = h;
                            (canvas.getContext('2d') as any).drawImage(img, 0, 0, w, h);
                            setRequestPhotoBefore(canvas.toDataURL('image/jpeg', 0.6));
                          };
                          img.src = ev.target?.result as string;
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden"
                    id="maint-photo-before"
                  />
                  <label
                    htmlFor="maint-photo-before"
                    className={cn(
                      "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
                      requestPhotoBefore ? "border-red-300 bg-red-50" : "border-gray-300 hover:border-red-400 hover:bg-red-50"
                    )}
                  >
                    {requestPhotoBefore ? (
                      <div className="relative w-full h-full p-2">
                        <img src={requestPhotoBefore} alt="Issue Before" className="w-full h-full object-cover rounded-lg" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity rounded-lg">
                          <p className="text-white text-xs font-bold">{t('تغيير الصورة', 'Change photo', 'تصویر تبدیل کریں', 'ছবি পরিবর্তন করুন')}</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Camera className="text-gray-400 mb-2" size={24} />
                        <p className="text-sm text-gray-500 font-medium">{t('التقاط صورة للمشكلة', 'Take a photo of the issue', 'مسئلے کی تصویر لیں', 'সমস্যার ছবি তুলুন')}</p>
                        <p className="text-xs text-gray-400 mt-1">{t('اضغط للكاميرا أو المعرض', 'Tap to open camera or gallery', 'کیمرہ یا گیلری کھولنے کے لیے تھپتھپائیں', 'ক্যামেরা বা গ্যালারি খুলতে ট্যাপ করুন')}</p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('تفاصيل المشكلة (اختياري)', 'Issue details (optional)', 'مسئلے کی تفصیلات (اختیاری)', 'সমস্যার বিবরণ (ঐচ্ছিক)')}
                </label>
                <textarea
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder={t('اشرح المشكلة بالتفصيل مثلاً: ماء يتسرب من تحت الحوض...', 'Describe the issue in detail (e.g. water leaking under sink...)', 'مسئلہ کی تفصیل بتائیں مثلاً سنک کے نیچے سے پانی لیک ہو رہا ہے...', 'সমস্যাটি বিস্তারিত বর্ণনা করুন (যেমন সিঙ্কের নিচ থেকে পানি ফুটছে...)')}
                  className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none resize-none h-24"
                />
              </div>
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                disabled={isSubmitting}
              >
                {t('إلغاء', 'Cancel', 'منسوخ کریں', 'বাতিল করুন')}
              </button>
              <button
                onClick={handleSubmitMaintenanceRequest}
                disabled={isSubmitting || !requestPhotoBefore}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-red-200"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    {t('جاري الإرسال...', 'Submitting...', 'بھیجا جا رہا ہے...', 'জমা দেওয়া হচ্ছে...')}
                  </>
                ) : (
                  <>
                    <Wrench size={18} />
                    {t('إرسال البلاغ', 'Submit report', 'اطلاع بھیجیں', 'রিপোর্ট জমা দিন')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Completion Modal (إنهاء الصيانة) */}
      {isCompleteModalOpen && completeUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-green-50/50">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <CheckCircle size={20} className="text-green-600" />
                  {t('إنهاء الصيانة للوحدة', 'Complete unit maintenance', 'یونٹ کی مرمت مکمل کریں', 'ইউনিটের মেরামত সম্পন্ন করুন')}
                </h3>
                <p className="text-sm text-gray-500">#{completeUnit.unit_number} - {completeUnit.hotel?.name}</p>
              </div>
              <button
                onClick={() => setIsCompleteModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Performer */}
              <div className="bg-green-50 p-3 rounded-lg flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-full text-green-600">
                  <UserCheck size={18} />
                </div>
                <div>
                  <p className="text-xs text-green-600 font-medium mb-0.5">{t('المنفذ للصيانة', 'Maintenance by', 'مرمت کرنے والا', 'মেরামতকারী')}</p>
                  <p className="text-sm font-bold text-gray-900">
                    {currentUser?.full_name || currentUser?.email || unknownUserLabel}
                  </p>
                </div>
              </div>

              {/* Photo After */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('صورة بعد الإصلاح (مطلوب كإثبات)', 'After-repair photo (required as proof)', 'اصلاح کے بعد کی تصویر (ثبوت کے لیے ضروری)', 'মেরামতের পর ছবি (প্রমাণ হিসেবে প্রয়োজনীয়)')}
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const MW = 800, MH = 600;
                            let w = img.width, h = img.height;
                            if (w > h) { if (w > MW) { h *= MW / w; w = MW; } } else { if (h > MH) { w *= MH / h; h = MH; } }
                            canvas.width = w; canvas.height = h;
                            (canvas.getContext('2d') as any).drawImage(img, 0, 0, w, h);
                            setCompletePhotoAfter(canvas.toDataURL('image/jpeg', 0.6));
                          };
                          img.src = ev.target?.result as string;
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden"
                    id="maint-photo-after"
                  />
                  <label
                    htmlFor="maint-photo-after"
                    className={cn(
                      "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
                      completePhotoAfter ? "border-green-300 bg-green-50" : "border-gray-300 hover:border-green-400 hover:bg-green-50"
                    )}
                  >
                    {completePhotoAfter ? (
                      <div className="relative w-full h-full p-2">
                        <img src={completePhotoAfter} alt="Completed" className="w-full h-full object-cover rounded-lg" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity rounded-lg">
                          <p className="text-white text-xs font-bold">{t('تغيير الصورة', 'Change photo', 'تصویر تبدیل کریں', 'ছবি পরিবর্তন করুন')}</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Camera className="text-gray-400 mb-2" size={24} />
                        <p className="text-sm text-gray-500 font-medium">{t('التقاط صورة بعد الإصلاح', 'Take a post-repair photo', 'اصلاح کے بعد تصویر لیں', 'মেরামতের পর ছবি তুলুন')}</p>
                        <p className="text-xs text-gray-400 mt-1">{t('اضغط للكاميرا أو المعرض', 'Tap to open camera or gallery', 'کیمرہ یا گیلری کھولنے کے لیے تھپتھپائیں', 'ক্যামেরা বা গ্যালারি খুলতে ট্যাপ করুন')}</p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Completion Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('تقرير الإكمال (اختياري)', 'Completion report (optional)', 'تکمیل کی رپورٹ (اختیاری)', 'সমাপ্তি রিপোর্ট (ঐচ্ছিক)')}
                </label>
                <textarea
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  placeholder={t('ماذا تم إصلاحه؟ استبدلت القطعة أم تم الإصلاح مؤقتاً؟', 'What was fixed? Part replaced or temporary fix?', 'کیا مرمت کیا گیا؟ پرزہ تبدیل کیا یا عارضی طور پر درست؟', 'কী ঠিক করা হয়েছিল? অংশ পরিবর্তন নাকি অস্থায়ী সংশোধন?')}
                  className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none resize-none h-24"
                />
              </div>
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setIsCompleteModalOpen(false)}
                className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                disabled={isSubmitting}
              >
                {t('إلغاء', 'Cancel', 'منسوخ کریں', 'বাতিল করুন')}
              </button>
              <button
                onClick={handleCompleteMaintenance}
                disabled={isSubmitting || !completePhotoAfter}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-green-200"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    {t('جاري الحفظ...', 'Saving...', 'محفوظ کیا جا رہا ہے...', 'সংরক্ষণ হচ্ছে...')}
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    {t('حفظ وتأكيد الإكمال', 'Save & complete', 'محفوظ اور تکمیل کی تصدیق', 'সংরক্ষণ ও সম্পন্ন করুন')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

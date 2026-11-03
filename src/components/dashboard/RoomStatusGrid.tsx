'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import UnitDetailsDialog from './UnitDetailsDialog';
import { cn } from '@/lib/utils';
import { BedDouble, Wrench, Sparkles, User, LogOut, LogIn, AlertTriangle, Calendar, CalendarDays, CalendarCheck, MoreVertical, X, Search, MessageCircle, Copy, ExternalLink, CheckCircle2, Info, Clock, CreditCard, Zap, Phone } from 'lucide-react';
import MobileRoomFilters from './MobileRoomFilters';
import BookingRangeModal from '@/components/dashboard/BookingRangeModal';
import QuickBookingModal from '@/components/dashboard/QuickBookingModal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

export interface Unit {
  id: string;
  unit_number: string;
  status: string;
  unit_type_id?: string;
  booking_id?: string;
  booking_check_in?: string;
  booking_check_out?: string;
  unit_type_name?: string;
  annual_price?: number | string;
  guest_name?: string;
  next_action?: 'arrival' | 'departure' | 'overdue' | null;
  action_guest_name?: string;
  guest_phone?: string;
  has_temp_res?: boolean;
  remaining_days?: number;
  future_bookings?: Array<{ start: string; end: string }>;
  payment_due_status?: 'due_today' | 'due_soon' | 'overdue' | null;
  payment_due_in_days?: number;
  payment_due_date?: string;
  payment_due_amount?: number;
  payment_booking_id?: string;
  payment_booking_status?: string;
  payment_invoice_total?: number;
  payment_invoice_paid?: number;
  payment_invoice_remaining?: number;
}

export const RoomStatusGrid = ({ units, selectedDate, dateLabel, tempResTotalCount, onJumpTempDate, language = 'ar', size = 'normal' }: { units: Unit[]; selectedDate?: string; dateLabel?: string; tempResTotalCount?: number; onJumpTempDate?: () => void; language?: 'ar' | 'en'; size?: 'normal' | 'compact' | 'mini' }) => {
    const t = (arText: string, enText: string) => (language === 'en' ? enText : arText);
    const [filter, setFilter] = useState<'all' | 'arrival' | 'departure' | 'overdue' | 'payment_today' | 'payment_soon' | 'payment_overdue' | 'available'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
    const [detailsOpenUnitId, setDetailsOpenUnitId] = useState<string | null>(null);
    const [showReserveFormFor, setShowReserveFormFor] = useState<string | null>(null);
    const [reserveName, setReserveName] = useState('');
    const [reservePhone, setReservePhone] = useState('');
    const [reserveDate, setReserveDate] = useState('');
    const [unitsState, setUnitsState] = useState<Unit[]>(units);
    const [rangeModalUnit, setRangeModalUnit] = useState<Unit | null>(null);
    const [quickBookingUnit, setQuickBookingUnit] = useState<Unit | null>(null);
    const router = useRouter();

    const triggerRefs = useRef<Map<string, HTMLElement>>(new Map());
    const closeDetailsPopover = useCallback(() => {
        setDetailsOpenUnitId(null);
    }, []);
    type MessageType = 'extension' | 'payment_due' | 'welcome' | 'checkout_today' | 'satisfaction';

    const WEBSITE_URL = 'https://residence.masaken-rc.com.sa/';
    const MAPS_URL = 'https://maps.app.goo.gl/uDohcSLPqziWotuS7';

    const [messageModalUnit, setMessageModalUnit] = useState<Unit | null>(null);
    const [selectedMessageType, setSelectedMessageType] = useState<MessageType>('extension');
    const [showReviewLink, setShowReviewLink] = useState(true);

    useEffect(() => {
        setUnitsState(units);
    }, [units]);

    const openRangeModal = (u: Unit) => {
      setRangeModalUnit(u);
    };

    const goToNewBooking = (u: Unit, checkIn: string, checkOut: string) => {
      const params = new URLSearchParams({
        unit_id: u.id,
        check_in: checkIn,
        check_out: checkOut,
      });
      router.push(`/bookings?${params.toString()}`);
    };

    const formatDateText = (date?: string) => { 
      if (!date) return '—'; 
      try { 
        return new Date(date).toLocaleDateString(language === 'en' ? 'en-US' : 'ar-SA', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric', 
        }); 
      } catch { 
        return date; 
      } 
    };
    
    const normalizePhoneForWhatsApp = (phone?: string) => { 
      if (!phone) return ''; 
      // Remove all non-numeric characters except +
      let value = phone.replace(/[^\d+]/g, ''); 
    
      // Handle + prefix
      if (value.startsWith('+')) { 
        value = value.slice(1); 
      } 
      
      // Handle 00 prefix
      if (value.startsWith('00')) { 
        value = value.slice(2); 
      }

      // Now we should have something like 9665... or 05... or 5...
      
      // If it starts with 0, it's likely a local number, replace with 966
      if (value.startsWith('0')) { 
        value = `966${value.slice(1)}`; 
      } 
      
      // If it doesn't start with 966, and it's a 9-digit number starting with 5, add 966
      // (Common for Saudi numbers like 501234567)
      if (!value.startsWith('966')) { 
        value = `966${value}`; 
      } 
    
      return value; 
    }; 
    
    const buildCustomerMessage = (unit: Unit, type: MessageType, includeReview: boolean = true) => { 
      const guestName = unit.guest_name || unit.action_guest_name || 'عميلنا الكريم'; 
      const unitNumber = unit.unit_number || '—'; 
      const endDate = formatDateText(unit.booking_check_out); 
      const adjustedEndDate = endDate;

      const dueDate = formatDateText(unit.payment_due_date); 
      const dueAmount = 
        typeof unit.payment_due_amount === 'number' 
          ? new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ar-SA', { 
              style: 'currency', 
              currency: 'SAR', 
              maximumFractionDigits: 0, 
            }).format(unit.payment_due_amount) 
          : '—'; 
    
      const reviewPart = includeReview ? `\n\nونشرف بتقييمكم لنا على خرائط جوجل:\n${MAPS_URL}` : '';
      const footer = `\n\nزوروا موقعنا الإلكتروني:\n${WEBSITE_URL}${reviewPart}`; 
    
      switch (type) { 
        case 'extension': 
          return `مرحباً عزيزي ${guestName} 
نود تذكيركم بأن موعد نهاية حجزكم في الوحدة رقم ${unitNumber} سيكون بتاريخ ${adjustedEndDate}. 
يسعدنا خدمتك، ونأمل إفادتنا هل لديكم رغبة في التمديد أم سيكون الخروج في الموعد المحدد؟${footer}`; 
    
        case 'payment_due': 
          return `مرحباً عزيزي ${guestName} 
نود تذكيركم بأن لديكم دفعة مستحقة للحجز الشهري الخاص بالوحدة رقم ${unitNumber}. 
تاريخ الاستحقاق: ${dueDate} 
قيمة الدفعة: ${dueAmount} 
نأمل التكرم بالسداد في الموعد المحدد، وفي حال تم السداد مسبقاً نعتذر عن الإزعاج.${footer}`; 
    
        case 'welcome': 
          return `عزيزي ${guestName} 
ترحب بكم مساكن الصفا، ونسعد باختياركم الإقامة لدينا. 
نتمنى لكم إقامة هنيئة ومريحة، وفي حال احتجتم لأي خدمة أو استفسار فنحن في خدمتكم بكل سرور.${footer}`; 
    
        case 'checkout_today': 
          return `مرحباً عزيزي ${guestName} 
نود تذكيركم بأن اليوم هو موعد خروجكم من الوحدة رقم ${unitNumber}. 
نسعد بخدمتكم دائماً، وفي حال رغبتكم بالتمديد نرجو التواصل معنا في أقرب وقت ممكن قبل موعد الخروج.${footer}`; 
    
        case 'satisfaction': 
          return `عزيزي ${guestName} 
نأمل أن تكونوا مستمتعين بإقامتكم في الوحدة رقم ${unitNumber}. 
نسعد بالتواصل معكم للتأكد من أن كل شيء نال على استحسانكم، وفي حال كان لديكم أي ملاحظات أو طلبات فنحن دائماً في خدمتكم.${footer}`; 
    
        default: 
          return ''; 
      } 
    }; 
    
    const openWhatsAppForUnit = (unit: Unit, type: MessageType) => { 
      const rawPhone = unit.guest_phone;
      const normalizedPhone = normalizePhoneForWhatsApp(rawPhone); 
      const message = buildCustomerMessage(unit, type, showReviewLink); 
    
      if (!normalizedPhone) { 
        navigator.clipboard.writeText(message); 
        if (rawPhone) {
          alert(`رقم الجوال (${rawPhone}) غير صالح للإرسال عبر واتساب. تم نسخ الرسالة للحافظة.`);
        } else {
          alert('لا يوجد رقم جوال للعميل، تم نسخ الرسالة للحافظة.'); 
        }
        return; 
      } 
    
      const url = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`; 
      window.open(url, '_blank'); 
    }; 
    
    const copyMessageForUnit = async (unit: Unit, type: MessageType) => { 
      const message = buildCustomerMessage(unit, type, showReviewLink); 
      await navigator.clipboard.writeText(message); 
      alert('تم نسخ الرسالة.'); 
    };

    type StatusMeta = {
        label: string;
        ringTone: string;
        borderTone: string;
        bgSoft: string;
        chipBg: string;
        chipText: string;
        chipRing: string;
        progressBar: string;
        Icon: React.ElementType;
        badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
        badgeClassName?: string;
        // خلفية تعبئة كاملة للبطاقة عند Hover
        hoverFill: string;
        // لون النص في الطبقة العائمة (عادة أبيض)
        hoverText: string;
        // لون نص بديل للعناوين الصغيرة في الـ Hover
        hoverMuted: string;
        // شارة في وسط الـ Hover (باللون المناسب)
        hoverBadge: string;
    };

    const getStatusMeta = (status: string): StatusMeta => {
        switch(status) {
            case 'available': return {
                label: t('متاح', 'Available'),
                ringTone: 'ring-emerald-100 hover:ring-emerald-200',
                borderTone: 'border-emerald-200',
                bgSoft: 'before:from-emerald-200/30 before:to-transparent',
                chipBg: 'bg-emerald-50',
                chipText: 'text-emerald-700',
                chipRing: 'ring-emerald-200',
                progressBar: 'bg-emerald-500',
                Icon: BedDouble,
                badgeVariant: 'outline',
                badgeClassName: 'border-emerald-300 text-emerald-700 bg-emerald-50',
                hoverFill: 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700',
                hoverText: 'text-white',
                hoverMuted: 'text-emerald-100/90',
                hoverBadge: 'bg-white/20 text-white ring-white/30'
            };
            case 'reserved': return {
                label: t('محجوز مؤقت', 'Temporarily reserved'),
                ringTone: 'ring-indigo-100 hover:ring-indigo-200',
                borderTone: 'border-indigo-200',
                bgSoft: 'before:from-indigo-200/30 before:to-transparent',
                chipBg: 'bg-indigo-50',
                chipText: 'text-indigo-700',
                chipRing: 'ring-indigo-200',
                progressBar: 'bg-indigo-500',
                Icon: Calendar,
                badgeVariant: 'secondary',
                badgeClassName: 'bg-indigo-100 text-indigo-800',
                hoverFill: 'bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700',
                hoverText: 'text-white',
                hoverMuted: 'text-indigo-100/90',
                hoverBadge: 'bg-white/20 text-white ring-white/30'
            };
            case 'preliminary': return {
                label: t('حجز أولي (نشط)', 'Preliminary (active)'),
                ringTone: 'ring-yellow-200 hover:ring-yellow-300',
                borderTone: 'border-yellow-300',
                bgSoft: 'before:from-yellow-200/50 before:to-transparent',
                chipBg: 'bg-yellow-50',
                chipText: 'text-yellow-800',
                chipRing: 'ring-yellow-300',
                progressBar: 'bg-yellow-500',
                Icon: Zap,
                badgeVariant: 'secondary',
                badgeClassName: 'bg-yellow-200 text-yellow-950 ring-1 ring-yellow-400/60 font-extrabold',
                hoverFill: 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600',
                hoverText: 'text-yellow-950',
                hoverMuted: 'text-yellow-900/85',
                hoverBadge: 'bg-yellow-950/20 text-yellow-950 ring-yellow-950/30'
            };
            case 'future_preliminary': return {
                label: t('حجز أولي قادم', 'Preliminary (upcoming)'),
                ringTone: 'ring-yellow-100 hover:ring-yellow-200',
                borderTone: 'border-yellow-200',
                bgSoft: 'before:from-yellow-100/50 before:to-transparent',
                chipBg: 'bg-yellow-50/80',
                chipText: 'text-yellow-700',
                chipRing: 'ring-yellow-200',
                progressBar: 'bg-yellow-400',
                Icon: Zap,
                badgeVariant: 'outline',
                badgeClassName: 'border-yellow-400 text-yellow-900 bg-yellow-50 font-extrabold',
                hoverFill: 'bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500',
                hoverText: 'text-yellow-950',
                hoverMuted: 'text-yellow-900/85',
                hoverBadge: 'bg-yellow-950/15 text-yellow-950 ring-yellow-950/25'
            };
            case 'booked': return {
                label: t('محجوز (بعربون)', 'Booked (deposit)'),
                ringTone: 'ring-blue-100 hover:ring-blue-200',
                borderTone: 'border-blue-200',
                bgSoft: 'before:from-blue-200/40 before:to-transparent',
                chipBg: 'bg-blue-50',
                chipText: 'text-blue-700',
                chipRing: 'ring-blue-200',
                progressBar: 'bg-blue-500',
                Icon: CalendarCheck,
                badgeVariant: 'default',
                badgeClassName: 'bg-blue-600 text-white',
                hoverFill: 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700',
                hoverText: 'text-white',
                hoverMuted: 'text-blue-100/90',
                hoverBadge: 'bg-white/20 text-white ring-white/30'
            };
            case 'future_booked': return {
                label: t('محجوز قادم', 'Upcoming booking'),
                ringTone: 'ring-amber-100 hover:ring-amber-200',
                borderTone: 'border-amber-200',
                bgSoft: 'before:from-amber-200/40 before:to-transparent',
                chipBg: 'bg-amber-50',
                chipText: 'text-amber-700',
                chipRing: 'ring-amber-200',
                progressBar: 'bg-amber-500',
                Icon: CalendarCheck,
                badgeVariant: 'secondary',
                badgeClassName: 'bg-amber-100 text-amber-800',
                hoverFill: 'bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700',
                hoverText: 'text-white',
                hoverMuted: 'text-amber-100/90',
                hoverBadge: 'bg-white/20 text-white ring-white/30'
            };
            case 'occupied': return {
                label: t('مشغول', 'Occupied'),
                ringTone: 'ring-rose-100 hover:ring-rose-200',
                borderTone: 'border-rose-200',
                bgSoft: 'before:from-rose-200/40 before:to-transparent',
                chipBg: 'bg-rose-50',
                chipText: 'text-rose-700',
                chipRing: 'ring-rose-200',
                progressBar: 'bg-rose-500',
                Icon: User,
                badgeVariant: 'destructive',
                badgeClassName: 'bg-rose-600 text-white',
                hoverFill: 'bg-gradient-to-br from-rose-500 via-rose-600 to-rose-700',
                hoverText: 'text-white',
                hoverMuted: 'text-rose-100/90',
                hoverBadge: 'bg-white/20 text-white ring-white/30'
            };
            case 'cleaning': return {
                label: t('تنظيف', 'Cleaning'),
                ringTone: 'ring-sky-100 hover:ring-sky-200',
                borderTone: 'border-sky-200',
                bgSoft: 'before:from-sky-200/40 before:to-transparent',
                chipBg: 'bg-sky-50',
                chipText: 'text-sky-700',
                chipRing: 'ring-sky-200',
                progressBar: 'bg-sky-500',
                Icon: Sparkles,
                badgeVariant: 'secondary',
                badgeClassName: 'bg-sky-100 text-sky-800',
                hoverFill: 'bg-gradient-to-br from-sky-500 via-sky-600 to-sky-700',
                hoverText: 'text-white',
                hoverMuted: 'text-sky-100/90',
                hoverBadge: 'bg-white/20 text-white ring-white/30'
            };
            case 'maintenance': return {
                label: t('صيانة', 'Maintenance'),
                ringTone: 'ring-zinc-100 hover:ring-zinc-200',
                borderTone: 'border-zinc-300',
                bgSoft: 'before:from-zinc-300/40 before:to-transparent',
                chipBg: 'bg-zinc-100',
                chipText: 'text-zinc-700',
                chipRing: 'ring-zinc-300',
                progressBar: 'bg-zinc-500',
                Icon: Wrench,
                badgeVariant: 'outline',
                badgeClassName: 'border-zinc-400 text-zinc-700 bg-zinc-50',
                hoverFill: 'bg-gradient-to-br from-zinc-600 via-zinc-700 to-zinc-800',
                hoverText: 'text-white',
                hoverMuted: 'text-zinc-200/90',
                hoverBadge: 'bg-white/15 text-white ring-white/25'
            };
            default: return {
                label: status,
                ringTone: 'ring-zinc-100 hover:ring-zinc-200',
                borderTone: 'border-zinc-200',
                bgSoft: 'before:from-zinc-100 before:to-transparent',
                chipBg: 'bg-zinc-50',
                chipText: 'text-zinc-700',
                chipRing: 'ring-zinc-200',
                progressBar: 'bg-zinc-500',
                Icon: BedDouble,
                badgeVariant: 'outline',
                badgeClassName: 'border-zinc-300 text-zinc-700',
                hoverFill: 'bg-gradient-to-br from-zinc-500 via-zinc-600 to-zinc-700',
                hoverText: 'text-white',
                hoverMuted: 'text-zinc-100/90',
                hoverBadge: 'bg-white/15 text-white ring-white/25'
            };
        }
    };

    const getActionMeta = (unit: Unit) => {
        if (unit.next_action === 'overdue') return { icon: AlertTriangle, label: t('تجاوز الخروج', 'Overdue'), tone: 'bg-rose-100 text-rose-700 ring-rose-200', variant: 'destructive' as const };
        if (unit.next_action === 'departure') return { icon: LogOut, label: t('خروج اليوم', 'Departure'), tone: 'bg-orange-100 text-orange-700 ring-orange-200', variant: 'secondary' as const };
        if (unit.next_action === 'arrival') return { icon: LogIn, label: t('وصول اليوم', 'Arrival'), tone: 'bg-sky-100 text-sky-700 ring-sky-200', variant: 'default' as const };
        return null;
    };

    const getPaymentTone = (st: NonNullable<Unit['payment_due_status']>) => {
        switch (st) {
            case 'due_today': return { label: t('السداد اليوم', 'Pay today'), tone: 'bg-emerald-100 text-emerald-700 ring-emerald-200', icon: CheckCircle2 };
            case 'due_soon': return { label: t('قريب السداد', 'Due soon'), tone: 'bg-amber-100 text-amber-700 ring-amber-200', icon: Calendar };
            case 'overdue': return { label: t('دفعة متأخرة', 'Overdue'), tone: 'bg-rose-100 text-rose-700 ring-rose-200', icon: AlertTriangle };
        }
    };

    // Calculate stats
    const stats = {
        total: unitsState.length,
        available: unitsState.filter(u => {
            const s = (u.has_temp_res && u.status === 'available') ? 'reserved' : u.status;
            return s === 'available';
        }).length,
        occupied: unitsState.filter(u => {
            const s = (u.has_temp_res && u.status === 'available') ? 'reserved' : u.status;
            return s === 'occupied';
        }).length,
        booked: unitsState.filter(u => u.status === 'booked' || u.status === 'preliminary' || u.status === 'future_booked' || u.status === 'future_preliminary').length,
        preliminary: unitsState.filter(u => u.status === 'preliminary' || u.status === 'future_preliminary').length,
        maintenance: unitsState.filter(u => {
            const s = (u.has_temp_res && u.status === 'available') ? 'reserved' : u.status;
            return ['maintenance', 'cleaning'].includes(s);
        }).length,
        
        // Action stats
        arrival: unitsState.filter(u => u.next_action === 'arrival').length,
        departure: unitsState.filter(u => u.next_action === 'departure').length,
        overdue: unitsState.filter(u => u.next_action === 'overdue').length,
        // Payment stats
        payment_today: unitsState.filter(u => u.payment_due_status === 'due_today').length,
        payment_soon: unitsState.filter(u => u.payment_due_status === 'due_soon').length,
        payment_overdue: unitsState.filter(u => u.payment_due_status === 'overdue').length
    };

    /**
     * هل الوحدة متاحة حقاً حالياً وطوال الأيام الـ 4 القادمة؟
     *   - status يجب أن يكون 'available' فقط (لا تنظيف ولا صيانة)
     *   - لا حجز مؤقت (has_temp_res)
     *   - لا booking_id نشط أو أن الحجز الحالي لا يتداخل مع الفترة
     *   - لا حجوزات مستقبلية (future_bookings) تتداخل مع [التاريخ المحدد، التاريخ المحدد + 4 أيام]
     */
    const isTrulyAvailableNowAndSoon = (u: Unit): boolean => {
        // 1. الحالة الصلبة: يجب أن تكون 'available' فقط (لا تنظيف ولا صيانة ولا محجوز بأي صورة)
        if (u.status !== 'available') return false;

        // 2. لا حجز مؤقت على الإطلاق
        if (u.has_temp_res) return false;

        // 3. تحديد نطاق الفحص: من selectedDate (أو اليوم) إلى + 4 أيام
        const baseDateStr = selectedDate || new Date().toISOString().split('T')[0];
        const rangeStart = new Date(baseDateStr + 'T00:00:00');
        const rangeEnd = new Date(rangeStart);
        rangeEnd.setDate(rangeEnd.getDate() + 4);
        rangeEnd.setHours(23, 59, 59, 999);

        const overlap = (startStr: string, endStr: string): boolean => {
            const s = new Date(startStr + 'T00:00:00');
            const e = new Date(endStr + 'T23:59:59');
            return s <= rangeEnd && e >= rangeStart;
        };

        // 4. تحقق من الحجز الحالي إن وجد (حتى لو booking_id غير موجود → تحقق إن كانت التواريخ تتداخل)
        if (u.booking_check_in && u.booking_check_out) {
            if (overlap(u.booking_check_in, u.booking_check_out)) return false;
        } else if (u.booking_id) {
            // لو فيه booking_id بدون تواريخ → نفترض أنه حجز نشط → استبعاد
            return false;
        }

        // 5. تحقق من الحجوزات المستقبلية إن وجدت
        if (Array.isArray(u.future_bookings) && u.future_bookings.length > 0) {
            for (const fb of u.future_bookings) {
                if (fb?.start && fb?.end) {
                    if (overlap(fb.start, fb.end)) return false;
                }
            }
        }

        return true;
    };

    const filteredUnits = unitsState.filter(u => {
        // Text Search Filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const matchesSearch = 
                (u.guest_name?.toLowerCase().includes(query)) ||
                (u.guest_phone?.toLowerCase().includes(query)) ||
                (u.action_guest_name?.toLowerCase().includes(query)) ||
                (u.unit_number?.toLowerCase().includes(query));
            
            if (!matchesSearch) return false;
        }

        // Status/Action Filters
        if (filter === 'all') return true;
        if (filter === 'arrival' || filter === 'departure' || filter === 'overdue') {
            return u.next_action === filter;
        }
        if (filter === 'payment_today') return u.payment_due_status === 'due_today';
        if (filter === 'payment_soon') return u.payment_due_status === 'due_soon';
        if (filter === 'payment_overdue') return u.payment_due_status === 'overdue';
        // فلتر "متاح": فقط الوحدات status=available خالية من أي حجز خلال الأيام الـ 4 القادمة
        if (filter === 'available') {
            return isTrulyAvailableNowAndSoon(u);
        }
        return true;
    });

    const labelText = dateLabel || new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const selectedUnit = unitsState.find(u => u.id === showReserveFormFor);
    const handleSaveReserve = async () => {
        if (!selectedUnit || !reserveName || !reserveDate) return;
        setUnitsState(prev => prev.map(u => u.id === selectedUnit.id ? { ...u, action_guest_name: reserveName, guest_phone: reservePhone, has_temp_res: true } : u));
        const res = await fetch('/api/units/set-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unit_id: selectedUnit.id, status: 'reserved', customer_name: reserveName, phone: reservePhone, reserve_date: reserveDate }) });
        if (!res.ok) {
            setUnitsState(prev => prev.map(u => u.id === selectedUnit.id ? { ...u, action_guest_name: undefined, guest_phone: undefined, has_temp_res: false } : u));
            alert(t('فشل حفظ الحجز المؤقت', 'Failed to save temporary reservation'));
        }
        setShowReserveFormFor(null);
        setActiveUnitId(null);
    };

    const departureUnits = unitsState.filter(u => {
        if (u.next_action !== 'departure') return false;
        return true;
    });

    // الوحدات المتاحة فعلاً (status=available) وخالية من أي حجز خلال الأيام الـ 4 القادمة
    const availableUnits = unitsState.filter(isTrulyAvailableNowAndSoon);

    void size;
    void selectedUnit;
    void handleSaveReserve;

    return (
        <>
        <BookingRangeModal
            open={Boolean(rangeModalUnit)}
            onClose={() => setRangeModalUnit(null)}
            unitId={rangeModalUnit?.id}
            unitNumber={rangeModalUnit?.unit_number}
            unitTypeName={rangeModalUnit?.unit_type_name}
            annualPrice={rangeModalUnit?.annual_price as any}
            blockedRanges={[
                ...(rangeModalUnit?.booking_check_in && rangeModalUnit?.booking_check_out
                    ? [{ start: rangeModalUnit.booking_check_in, end: rangeModalUnit.booking_check_out }]
                    : []),
                ...(rangeModalUnit?.future_bookings || [])
            ]}
            initialMonth={selectedDate || new Date().toISOString().split('T')[0]}
            minDate={new Date().toISOString().split('T')[0]}
            onComplete={(checkIn, checkOut) => {
                const u = rangeModalUnit;
                if (!u) return;
                goToNewBooking(u, checkIn, checkOut);
            }}
        />
        <QuickBookingModal
            open={Boolean(quickBookingUnit)}
            onClose={() => setQuickBookingUnit(null)}
            unitId={quickBookingUnit?.id}
            unitNumber={quickBookingUnit?.unit_number}
            unitTypeName={quickBookingUnit?.unit_type_name}
            onSuccess={(bookingId) => {
                setQuickBookingUnit(null);
                try {
                    router.refresh();
                } catch {}
                setTimeout(() => {
                    if (bookingId) {
                        router.push(`/bookings-list/${bookingId}`);
                    }
                }, 300);
            }}
        />
        {messageModalUnit && ( 
          <div className="fixed inset-0 z-[80]" dir="rtl"> 
            <div className="absolute inset-0 bg-black/40" onClick={() => setMessageModalUnit(null)} /> 
            <div className="absolute inset-0 flex items-center justify-center p-3"> 
              <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden"> 
                <div className="px-4 py-3 border-b flex items-center justify-between gap-2"> 
                  <div className="min-w-0"> 
                    <div className="font-black text-gray-900 text-sm truncate">تواصل مع العميل</div> 
                    <div className="text-[11px] text-gray-600 truncate"> 
                      {messageModalUnit.guest_name || messageModalUnit.action_guest_name || 'العميل'} • الوحدة {messageModalUnit.unit_number} 
                    </div> 
                  </div> 
                  <button 
                    type="button" 
                    onClick={() => setMessageModalUnit(null)} 
                    className="p-2 rounded-2xl hover:bg-gray-100 text-gray-700" 
                  > 
                    <X size={18} /> 
                  </button> 
                </div> 
        
                <div className="p-4 space-y-4"> 
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"> 
                    <button 
                      type="button" 
                      onClick={() => setSelectedMessageType('extension')} 
                      className={`px-3 py-2 rounded-2xl border text-sm font-bold transition ${ 
                        selectedMessageType === 'extension' 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50' 
                      }`} 
                    > 
                      تذكير بالتمديد 
                    </button> 
        
                    <button 
                      type="button" 
                      onClick={() => setSelectedMessageType('payment_due')} 
                      className={`px-3 py-2 rounded-2xl border text-sm font-bold transition ${ 
                        selectedMessageType === 'payment_due' 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50' 
                      }`} 
                    > 
                      تذكير بسداد دفعة 
                    </button> 
        
                    <button 
                      type="button" 
                      onClick={() => setSelectedMessageType('welcome')} 
                      className={`px-3 py-2 rounded-2xl border text-sm font-bold transition ${ 
                        selectedMessageType === 'welcome' 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50' 
                      }`} 
                    > 
                      رسالة ترحيب 
                    </button> 
        
                    <button 
                      type="button" 
                      onClick={() => setSelectedMessageType('checkout_today')} 
                      className={`px-3 py-2 rounded-2xl border text-sm font-bold transition ${ 
                        selectedMessageType === 'checkout_today' 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50' 
                      }`} 
                    > 
                      رسالة خروج اليوم 
                    </button> 
                    
                    <button 
                      type="button" 
                      onClick={() => setSelectedMessageType('satisfaction')} 
                      className={`px-3 py-2 rounded-2xl border text-sm font-bold transition ${ 
                        selectedMessageType === 'satisfaction' 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50' 
                      }`} 
                    > 
                      رضا العميل 
                    </button> 
                  </div> 
        
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3"> 
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-bold text-gray-700">معاينة الرسالة</div> 
                      <button
                        type="button"
                        onClick={() => setShowReviewLink(!showReviewLink)}
                        className={cn(
                          "px-2 py-1 rounded-lg text-[10px] font-black transition-colors flex items-center gap-1.5",
                          showReviewLink ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"
                        )}
                      >
                        {showReviewLink ? "رابط التقييم مفعل" : "رابط التقييم مخفي"}
                      </button>
                    </div>
                    <textarea 
                      readOnly 
                      value={buildCustomerMessage(messageModalUnit, selectedMessageType, showReviewLink)} 
                      className="w-full min-h-[220px] rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-800 resize-none focus:outline-none" 
                    /> 
                  </div> 
        
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2"> 
                    <button 
                      type="button" 
                      onClick={() => copyMessageForUnit(messageModalUnit, selectedMessageType)} 
                      className="px-4 py-3 rounded-2xl bg-white border border-gray-200 text-gray-900 font-black text-sm hover:bg-gray-50 flex items-center justify-center gap-2" 
                    > 
                      <Copy size={16} /> 
                      نسخ الرسالة 
                    </button> 
        
                    <button 
                      type="button" 
                      onClick={() => openWhatsAppForUnit(messageModalUnit, selectedMessageType)} 
                      className="px-4 py-3 rounded-2xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-700 flex items-center justify-center gap-2" 
                    > 
                      <MessageCircle size={16} /> 
                      واتساب 
                    </button> 
        
                    <button 
                      type="button" 
                      onClick={() => window.open(WEBSITE_URL, '_blank')} 
                      className="px-4 py-3 rounded-2xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 flex items-center justify-center gap-2" 
                    > 
                      <ExternalLink size={16} /> 
                      فتح الموقع 
                    </button> 
                  </div> 
        
                  <div className="text-[11px] text-gray-500 leading-6"> 
                    رقم الجوال المستخدم: {messageModalUnit.guest_phone || 'غير متوفر'}<br /> 
                    عند عدم توفر رقم الجوال سيتم نسخ الرسالة تلقائياً بدل فتح واتساب. 
                  </div> 
                </div> 
              </div> 
            </div> 
          </div> 
        )}
        <div className="h-full flex flex-col">
        <Card className="bg-card/95 ring-1 ring-emerald-100/70 shadow-sm hover:ring-emerald-200/70 transition-all rounded-3xl overflow-hidden">
            <CardHeader className="gap-2.5 space-y-0 border-b border-stone-200/80 bg-[#faf9f6] px-4 py-3 sm:px-5">
                <div className="flex flex-col items-stretch justify-between gap-2.5 lg:flex-row lg:items-center lg:gap-5">
                    <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="inline-flex flex-wrap items-center gap-x-3 gap-y-2 text-base font-bold text-stone-900 sm:text-lg">
                                {t('حالة الغرف', 'Room status')}
                                <Badge variant="secondary" className="inline-flex h-auto min-h-6 max-w-full items-center gap-1.5 whitespace-normal rounded-lg border-stone-200 bg-white px-2.5 py-1 text-[10px] font-medium leading-5 text-stone-500 sm:text-xs">
                                    <Calendar size={12} />
                                    {labelText}
                                </Badge>
                            </CardTitle>
                        </div>
                <CardDescription className="flex flex-wrap items-center gap-1.5 text-[11px] leading-5">
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                                <BedDouble size={13} />
                                {stats.available} {t('متاح', 'available')}
                            </span>
                            <span className="hidden">•</span>
                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">
                                <User size={13} />
                                {stats.occupied} {t('مشغول', 'occupied')}
                            </span>
                            <span className="hidden">•</span>
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
                                <CalendarCheck size={13} />
                                {stats.booked} {t('محجوز', 'booked')}
                            </span>
                            <span className="hidden">•</span>
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                                <Wrench size={13} />
                                {stats.maintenance} {t('غير جاهز', 'not ready')}
                            </span>
                        </CardDescription>

                    </div>

                    {/* Search Bar */}
                    <div className="relative w-full shrink-0 lg:w-72 xl:w-80">
                        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-700/70" size={16} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('بحث باسم العميل، الجوال، أو رقم الغرفة...', 'Search guest, phone or room...')}
                            className="min-h-11 w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-10 text-[13px] text-stone-800 transition-colors placeholder:text-stone-400 focus:border-emerald-600/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
                        />
                        {searchQuery && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setSearchQuery('')}
                                className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground"
                            >
                                <X size={14} />
                            </Button>
                        )}
                    </div>
                </div>



                <MobileRoomFilters
                    value={filter}
                    onChange={(value) => setFilter(value as typeof filter)}
                    label={t('الفلاتر', 'Filters')}
                    options={[
                        { value: 'all', label: t('الكل', 'All'), count: units.length, group: t('حركة الغرف', 'Room activity'), tone: 'stone' },
                        { value: 'available', label: t('متاح', 'Available'), count: availableUnits.length, group: t('حركة الغرف', 'Room activity'), tone: 'emerald' },
                        { value: 'overdue', label: t('تجاوز الخروج', 'Overdue check-out'), count: stats.overdue, group: t('حركة الغرف', 'Room activity'), tone: 'rose' },
                        { value: 'departure', label: t('مغادرة اليوم', 'Departures today'), count: stats.departure, group: t('حركة الغرف', 'Room activity'), tone: 'orange' },
                        { value: 'arrival', label: t('وصول اليوم', 'Arrivals today'), count: stats.arrival, group: t('حركة الغرف', 'Room activity'), tone: 'sky' },
                        { value: 'payment_overdue', label: t('دفعات متأخرة', 'Overdue Payments'), count: stats.payment_overdue, group: t('السداد والمتابعة', 'Payments & follow-up'), tone: 'rose' },
                        { value: 'payment_today', label: t('مستحق اليوم', 'Due Today'), count: stats.payment_today, group: t('السداد والمتابعة', 'Payments & follow-up'), tone: 'emerald' },
                        { value: 'payment_soon', label: t('قريب سداد', 'Due Soon'), count: stats.payment_soon, group: t('السداد والمتابعة', 'Payments & follow-up'), tone: 'amber' },
                    ]}
                    temporary={typeof tempResTotalCount === 'number' && onJumpTempDate
                        ? { label: t('حجز مؤقت', 'Temp reservation'), count: tempResTotalCount, onClick: onJumpTempDate }
                        : undefined}
                />
                <div className="hidden flex-wrap items-center gap-x-3 gap-y-2 border-t border-stone-200/80 pt-2.5 sm:flex">
                <p className="sr-only">{language === "en" ? "Room activity" : "حركة الغرف"}</p>
                {/* Filters / Tabs */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <button
                        type="button"
                        aria-pressed={filter === 'all'}
                        onClick={() => setFilter('all')}
                        className={cn(
                            "min-h-10 sm:min-h-8 rounded-lg border border-stone-200 px-2.5 py-1 text-start text-[11px] font-semibold cursor-pointer select-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700",
                            filter === 'all' ? 'bg-emerald-900 text-white border-emerald-900 shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                    >
                        {t('الكل', 'All')} ({units.length})
                    </button>
                    <button
                        type="button"
                        aria-pressed={filter === 'available'}
                        onClick={() => setFilter('available')}
                        className={cn(
                            "min-h-10 sm:min-h-8 rounded-lg border border-stone-200 px-2.5 py-1 text-start text-[11px] font-semibold cursor-pointer select-none inline-flex items-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700",
                            filter === 'available' ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm' : 'text-muted-foreground hover:text-emerald-700 hover:bg-emerald-50'
                        )}
                    >
                        <CheckCircle2 size={14} />
                        {t('متاح', 'Available')}
                        {availableUnits.length > 0 && (
                            <span className={cn(
                                "text-[10px] h-5 min-w-5 rounded-md px-1 inline-flex items-center justify-center font-bold tabular-nums",
                                filter === 'available' ? 'bg-white text-emerald-700' : 'bg-emerald-600 text-white'
                            )}>{availableUnits.length}</span>
                        )}
                    </button>
                    <button
                        type="button"
                        aria-pressed={filter === 'overdue'}
                        onClick={() => setFilter('overdue')}
                        className={cn(
                            "min-h-10 sm:min-h-8 rounded-lg border border-stone-200 px-2.5 py-1 text-start text-[11px] font-semibold cursor-pointer select-none inline-flex items-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700",
                            filter === 'overdue' ? 'bg-rose-600 text-white border-rose-600 shadow-sm' : 'text-muted-foreground hover:text-rose-700 hover:bg-rose-50'
                        )}
                    >
                        <AlertTriangle size={14} />
                        {t('تجاوز الخروج', 'Overdue check-out')}
                        {stats.overdue > 0 && (
                            <span className={cn(
                                "text-[10px] h-5 min-w-5 rounded-md px-1 inline-flex items-center justify-center font-bold tabular-nums",
                                filter === 'overdue' ? 'bg-white text-rose-700' : 'bg-rose-600 text-white'
                            )}>{stats.overdue}</span>
                        )}
                    </button>
                    <button
                        type="button"
                        aria-pressed={filter === 'departure'}
                        onClick={() => setFilter('departure')}
                        className={cn(
                            "min-h-10 sm:min-h-8 rounded-lg border border-stone-200 px-2.5 py-1 text-start text-[11px] font-semibold cursor-pointer select-none inline-flex items-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700",
                            filter === 'departure' ? 'bg-orange-600 text-white hover:bg-orange-700 shadow-sm' : 'text-muted-foreground hover:text-orange-700 hover:bg-orange-50'
                        )}
                    >
                        <LogOut size={14} />
                        {t('مغادرة اليوم', 'Departures today')}
                        {stats.departure > 0 && (
                            <span className={cn(
                                "text-[10px] h-5 min-w-5 rounded-md px-1 inline-flex items-center justify-center font-bold tabular-nums",
                                filter === 'departure' ? 'bg-white text-orange-700' : 'bg-orange-600 text-white'
                            )}>{stats.departure}</span>
                        )}
                    </button>
                    <button
                        type="button"
                        aria-pressed={filter === 'arrival'}
                        onClick={() => setFilter('arrival')}
                        className={cn(
                            "min-h-10 sm:min-h-8 rounded-lg border border-stone-200 px-2.5 py-1 text-start text-[11px] font-semibold cursor-pointer select-none inline-flex items-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700",
                            filter === 'arrival' ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-sm' : 'text-muted-foreground hover:text-sky-700 hover:bg-sky-50'
                        )}
                    >
                        <LogIn size={14} />
                        {t('وصول اليوم', 'Arrivals today')}
                        {stats.arrival > 0 && (
                            <span className={cn(
                                "text-[10px] h-5 min-w-5 rounded-md px-1 inline-flex items-center justify-center font-bold tabular-nums",
                                filter === 'arrival' ? 'bg-white text-sky-700' : 'bg-sky-600 text-white'
                            )}>{stats.arrival}</span>
                        )}
                    </button>

                </div>
                <p className="sr-only">{language === "en" ? "Payments & follow-up" : "السداد والمتابعة"}</p>
                <div className="flex flex-wrap items-center gap-1.5 border-s border-stone-200 ps-3">

                    {/* Payment Filters */}
                    <button
                        type="button"
                        aria-pressed={filter === 'payment_overdue'}
                        onClick={() => setFilter('payment_overdue')}
                        className={cn(
                            "min-h-10 sm:min-h-8 rounded-lg border border-stone-200 px-2.5 py-1 text-start text-[11px] font-semibold cursor-pointer select-none inline-flex items-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700",
                            filter === 'payment_overdue' ? 'bg-rose-600 text-white border-rose-600 shadow-sm' : 'text-muted-foreground hover:text-rose-700 hover:bg-rose-50'
                        )}
                    >
                        <AlertTriangle size={14} />
                        {t('دفعات متأخرة', 'Overdue Payments')}
                        {stats.payment_overdue > 0 && (
                            <span className={cn(
                                "text-[10px] h-5 min-w-5 rounded-md px-1 inline-flex items-center justify-center font-bold tabular-nums",
                                filter === 'payment_overdue' ? 'bg-white text-rose-700' : 'bg-rose-600 text-white'
                            )}>{stats.payment_overdue}</span>
                        )}
                    </button>
                    <button
                        type="button"
                        aria-pressed={filter === 'payment_today'}
                        onClick={() => setFilter('payment_today')}
                        className={cn(
                            "min-h-10 sm:min-h-8 rounded-lg border border-stone-200 px-2.5 py-1 text-start text-[11px] font-semibold cursor-pointer select-none inline-flex items-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700",
                            filter === 'payment_today' ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm' : 'text-muted-foreground hover:text-emerald-700 hover:bg-emerald-50'
                        )}
                    >
                        <CheckCircle2 size={14} />
                        {t('مستحق اليوم', 'Due Today')}
                        {stats.payment_today > 0 && (
                            <span className={cn(
                                "text-[10px] h-5 min-w-5 rounded-md px-1 inline-flex items-center justify-center font-bold tabular-nums",
                                filter === 'payment_today' ? 'bg-white text-emerald-700' : 'bg-emerald-600 text-white'
                            )}>{stats.payment_today}</span>
                        )}
                    </button>
                    <button
                        type="button"
                        aria-pressed={filter === 'payment_soon'}
                        onClick={() => setFilter('payment_soon')}
                        className={cn(
                            "min-h-10 sm:min-h-8 rounded-lg border border-stone-200 px-2.5 py-1 text-start text-[11px] font-semibold cursor-pointer select-none inline-flex items-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700",
                            filter === 'payment_soon' ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm' : 'text-muted-foreground hover:text-amber-700 hover:bg-amber-50'
                        )}
                    >
                        <Calendar size={14} />
                        {t('قريب سداد', 'Due Soon')}
                        {stats.payment_soon > 0 && (
                            <span className={cn(
                                "text-[10px] h-5 min-w-5 rounded-md px-1 inline-flex items-center justify-center font-bold tabular-nums",
                                filter === 'payment_soon' ? 'bg-white text-amber-700' : 'bg-amber-600 text-white'
                            )}>{stats.payment_soon}</span>
                        )}
                    </button>
                    {typeof tempResTotalCount === 'number' && onJumpTempDate && (
                        <button type="button"
                            onClick={onJumpTempDate}
                            className="min-h-10 sm:min-h-8 rounded-lg border border-amber-200 px-2.5 py-1 text-start text-[11px] font-semibold cursor-pointer select-none inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 transition-colors hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
                            title={t('التنقل بين تواريخ الحجوزات المؤقتة', 'Jump between temporary reservation dates')}
                        >
                            {t('حجز مؤقت', 'Temp reservation')}
                            <span className="text-[10px] h-5 min-w-5 rounded-md px-1 inline-flex items-center justify-center font-bold tabular-nums bg-amber-600 text-white">{tempResTotalCount}</span>
                        </button>
                    )}
                </div>
                </div>
            </CardHeader>

            <CardContent className="px-2 sm:px-7 pb-5 sm:pb-7">
            {filter === 'departure' && departureUnits.length > 0 && (
                <div className="mb-5 rounded-2xl border border-orange-200 bg-orange-50/60 p-3 sm:p-4">
                    <div className="text-xs sm:text-[13px] font-bold text-orange-800 mb-2.5 inline-flex items-center gap-1.5">
                        <LogOut size={15} />
                        {t('المغادرون اليوم', 'Departures today')}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {departureUnits.map(u => (
                            <div key={u.id} className="flex items-center justify-between gap-2 bg-background/80 border border-orange-200/60 rounded-xl px-3 py-2 shadow-sm">
                                <div className="text-[11px] sm:text-xs text-foreground min-w-0">
                                    <div className="font-bold text-foreground truncate">{u.guest_name || u.action_guest_name || t('ضيف', 'Guest')}</div>
                                    <div className="text-muted-foreground text-[10px] sm:text-[11px] truncate">{t('الوحدة', 'Unit')} {u.unit_number}{u.unit_type_name ? ` • ${u.unit_type_name}` : ''}</div>
                                </div>
                                <Button
                                    size="sm"
                                    className="h-7 text-[10px] sm:text-[11px] px-3 bg-orange-600 text-white hover:bg-orange-700 rounded-xl font-bold shrink-0"
                                    onClick={() => {
                                        if (u.booking_id) {
                                            router.push(`/bookings-list/${u.booking_id}`);
                                        } else {
                                            const q = encodeURIComponent(u.guest_name || u.action_guest_name || '');
                                            router.push(`/bookings?q=${q}&unit_id=${u.id}&search=1`);
                                        }
                                    }}
                                >
                                    {t('فتح الحجز', 'Open booking')}
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {filteredUnits.length === 0 ? (
                 <div className="flex-1 flex flex-col items-center justify-center py-16 text-muted-foreground bg-muted/30 rounded-2xl border border-dashed border-border">
                    <BedDouble size={52} strokeWidth={1.3} className="mb-4 opacity-25" />
                    <p className="text-sm font-semibold">{t('لا توجد وحدات تطابق الفلتر', 'No units match the filter')}</p>
                    <p className="text-[11px] mt-1.5 text-muted-foreground/80">
                        {t('جرّب تعديل الفلاتر أو مسح شريط البحث.', 'Try adjusting filters or clearing search.')}
                    </p>
                 </div>
            ) : (
                    <div className="grid min-w-0 grid-cols-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-x-2 gap-y-3 sm:gap-4 content-start pt-4 overflow-visible">
                    {filteredUnits.map((unit) => {
                        const effectiveStatus = (unit.has_temp_res && unit.status === 'available') ? 'reserved' : unit.status;
                        const meta = getStatusMeta(effectiveStatus);
                        const StatusIcon = meta.Icon;
                        const overdueCheckout = unit.next_action === 'overdue';

                        // ⏱️ دالة مساعدة: حساب أيام تأخر تسجيل الخروج يدوياً في الفرونت
                        //    — الفرق بين التاريخ المحدد (selectedDate أو اليوم) و booking_check_out
                        const calcCheckoutOverdueDaysManual = (): number | null => {
                            const checkOutISO = unit.booking_check_out;
                            if (!checkOutISO) return null;
                            try {
                                const dateOnly = (iso: string) => iso.slice(0, 10);
                                const todayStr = dateOnly(selectedDate ?? new Date().toISOString());
                                const coStr = dateOnly(checkOutISO);
                                const today = new Date(`${todayStr}T00:00:00`);
                                const coDate = new Date(`${coStr}T00:00:00`);
                                const MS_PER_DAY = 1000 * 60 * 60 * 24;
                                const diffDays = Math.round((today.getTime() - coDate.getTime()) / MS_PER_DAY);
                                return diffDays; // موجب = تأخر (تجاوز)، صفر = اليوم، سالب = لم يحين بعد
                            } catch {
                                return null;
                            }
                        };
                        // الأيام المحسوبة يدوياً لتأخر تسجيل الخروج:
                        //  - إذا كان تجاوز الخروج + النتيجة موجبة = أيام التأخر (المطلوب بالضبط)
                        //  - وإلا نستخدم remaining_days الأصلي كحل احتياطي
                        const manualOverdueRaw = calcCheckoutOverdueDaysManual();
                        const checkoutOverdueDays = (overdueCheckout && typeof manualOverdueRaw === 'number' && manualOverdueRaw >= 0)
                            ? manualOverdueRaw
                            : null;

                        const paidRatio = (() => {
                            const total = unit.payment_invoice_total;
                            const paid = unit.payment_invoice_paid;
                            if (typeof total !== 'number' || !Number.isFinite(total) || total <= 0) return null;
                            const p = typeof paid === 'number' && Number.isFinite(paid) ? (paid / total) * 100 : 0;
                            return Math.max(0, Math.min(100, Math.round(p)));
                        })();

                        const isUpcoming = unit.status === 'future_booked' || unit.status === 'future_preliminary';
                        const isCurrent = unit.status === 'occupied' || unit.status === 'booked' || unit.status === 'preliminary';
                        const isPastCheckedOut = unit.payment_booking_status === 'checked_out' && unit.status === 'available';
                        void isPastCheckedOut;

                        // تصنيف خطورة الوحدة لاختيار الإطار والأنميشن المناسب
                        const pmtOverdue = unit.payment_due_status === 'overdue';
                        const pmtDueSoon = unit.payment_due_status === 'due_soon';
                        const pmtDueToday = unit.payment_due_status === 'due_today';

                        // === تجاوزات لون وعنوان وحدة تجاوز الخروج (بني غامق فاخر — لا أحمر ولا أخضر!) ===
                        const overdueFill = 'bg-gradient-to-br from-[#5d4037] via-[#6d4c41] to-[#4e342e]';
                        const overdueLabel = t('تجاوز الخروج', 'Overdue check-out');
                        const OverdueIcon = AlertTriangle;
                        const displayFill = overdueCheckout ? overdueFill : meta.hoverFill;
                        const displayLabel = overdueCheckout ? overdueLabel : meta.label;
                        const DisplayIcon = overdueCheckout ? OverdueIcon : StatusIcon;
                        const displayText = overdueCheckout ? 'text-[#fff8e1]' : meta.hoverText;
                        const displayMuted = overdueCheckout ? 'text-[#d7ccc8]/90' : meta.hoverMuted;

                        return (
                            <Card
                                key={unit.id}
                                role="button"
                                tabIndex={0}
                                aria-haspopup="dialog"
                                aria-expanded={detailsOpenUnitId === unit.id}
                                aria-label={`${t('تفاصيل الوحدة', 'Unit details')} ${unit.unit_number}`}
                                onKeyDown={(event) => {
                                    if (event.target !== event.currentTarget) return;
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        setDetailsOpenUnitId(unit.id);
                                    }
                                }}
                                ref={(el) => {
                                    if (el) triggerRefs.current.set(unit.id, el);
                                    else triggerRefs.current.delete(unit.id);
                                }}
                                className={cn(
                                    "group relative rounded-2xl transition-all duration-200 cursor-pointer border bg-background overflow-visible select-none max-sm:min-w-0 max-sm:min-h-[144px] max-sm:py-0 max-sm:gap-0",
                                    // === تجاوز الخروج: خلفية بنية غامقة فاخرة + نبض خطير ===
                                    overdueCheckout
                                        ? "bg-gradient-to-br from-[#3e2723]/98 via-[#5d4037]/95 to-[#3e2723]/98 text-white border-[#6d4c41]/90 shadow-[0_10px_35px_-10px_rgba(62,39,35,0.75)] ring-2 ring-[#795548]/80 hover:shadow-[0_14px_40px_-10px_rgba(62,39,35,0.85)] animate-[dangerPulse_2.1s_ease-in-out_infinite]"
                                        // === دفعة متأخرة: إطار أحمر + نبض خفيف للإطار ===
                                        : pmtOverdue
                                            ? "border-2 border-rose-500/90 ring-4 ring-rose-500/25 shadow-[0_8px_25px_-8px_rgba(244,63,94,0.45)] hover:shadow-[0_12px_30px_-8px_rgba(244,63,94,0.55)] animate-[softRedPulse_2.4s_ease-in-out_infinite]"
                                            // === دفعة مستحقة اليوم: إطار برتقالي/أحمر ===
                                            : pmtDueToday
                                                ? "border-2 border-orange-500/90 ring-4 ring-orange-500/20 shadow-[0_8px_25px_-8px_rgba(249,115,22,0.4)] hover:shadow-[0_14px_36px_-10px_rgba(249,115,22,0.55)] hover:-translate-y-1 hover:scale-[1.02]"
                                                // === قريب سداد: إطار أصفر فاتح ===
                                                : pmtDueSoon
                                                    ? "border-2 border-amber-400/90 ring-4 ring-amber-400/15 shadow-[0_6px_20px_-8px_rgba(245,158,11,0.35)] hover:shadow-[0_12px_32px_-10px_rgba(245,158,11,0.52)] hover:-translate-y-1 hover:scale-[1.02]"
                                                    // === الحالة العادية ===
                                                    : "shadow-md hover:shadow-[0_14px_40px_-12px_rgba(0,0,0,0.22)] hover:-translate-y-1 hover:scale-[1.025] border-zinc-200/90",
                                    !overdueCheckout && !pmtOverdue && !pmtDueToday && !pmtDueSoon && meta.ringTone
                                )}
                                onClick={() => {
                                    // أول نقرة على البطاقة → تفتح Popover التفاصيل (الذي يحتوي كل الإجراءات الآن)
                                    // نقرة ثانية على نفس البطاقة → تغلق Popover فقط (لأن كل الإجراءات داخله الآن)
                                    const isOpen = detailsOpenUnitId === unit.id;

                                    if (!isOpen) {
                                        setDetailsOpenUnitId(unit.id);
                                    } else {
                                        closeDetailsPopover();
                                    }
                                }}
                                title={unit.guest_name || meta.label}
                            >
                                {/* دائرة زاوية علوية: تنبض هادئة + رقم الأيام فقط (نصفها داخل ونصفها خارج البطاقة)
                                    => توضع قبل المغلف الداخلي لضمان ظهورها فوق كامل العناصر وخارج إطار البطاقة */}
                                {(() => {
                                    // حساب قيمة الأيام المطلوبة للعرض
                                    let daysValue: number | null = null;
                                    let tooltipAr = '';
                                    let tooltipEn = '';
                                    let tone: 'overdue' | 'departure' | 'remainingLow' | 'remaining' | null = null;

                                    // 1. تجاوز الخروج: الأيام التي **تأخر تسجيل الخروج عنها** (محسوبة يدوياً في الفرونت)
                                    if (overdueCheckout && (typeof checkoutOverdueDays === 'number' || typeof unit.remaining_days === 'number')) {
                                        const days = typeof checkoutOverdueDays === 'number'
                                            ? checkoutOverdueDays
                                            : Math.abs(unit.remaining_days || 0);
                                        daysValue = days;
                                        tone = 'overdue';
                                        tooltipAr = typeof checkoutOverdueDays === 'number'
                                            ? `تأخر تسجيل الخروج بـ ${days} ${days === 1 ? 'يوم' : 'أيام'}`
                                            : `تجاوز موعد الخروج بـ ${days} ${days === 1 ? 'يوم' : 'أيام'}`;
                                        tooltipEn = typeof checkoutOverdueDays === 'number'
                                            ? `Check-out logged ${days} day${days === 1 ? '' : 's'} late`
                                            : `${days} day${days === 1 ? '' : 's'} overdue`;
                                    }
                                    // 2. مغادرة اليوم أو أقربها: عدد الأيام المتبقية حتى الخروج
                                    else if (unit.next_action === 'departure' && typeof unit.remaining_days === 'number' && unit.remaining_days >= 0) {
                                        daysValue = unit.remaining_days;
                                        tone = daysValue <= 1 ? 'departure' : (daysValue <= 3 ? 'remainingLow' : 'remaining');
                                        if (daysValue === 0) {
                                            tooltipAr = 'يوم الخروج';
                                            tooltipEn = 'Check-out today';
                                        } else {
                                            tooltipAr = `${daysValue} ${daysValue === 1 ? 'يوم' : 'أيام'} متبقية حتى الخروج`;
                                            tooltipEn = `${daysValue} day${daysValue === 1 ? '' : 's'} until check-out`;
                                        }
                                    }
                                    // 3. وصول أو حجز قادم: الأيام المتبقية حتى الوصول أو الحجز
                                    else if ((unit.next_action === 'arrival' || unit.status === 'future_booked') && typeof unit.remaining_days === 'number' && unit.remaining_days >= 0) {
                                        daysValue = unit.remaining_days;
                                        tone = daysValue <= 3 ? 'remainingLow' : 'remaining';
                                        if (daysValue === 0) {
                                            tooltipAr = 'يوم الوصول';
                                            tooltipEn = 'Check-in today';
                                        } else {
                                            tooltipAr = `${daysValue} ${daysValue === 1 ? 'يوم' : 'أيام'} حتى الوصول`;
                                            tooltipEn = `${daysValue} day${daysValue === 1 ? '' : 's'} until check-in`;
                                        }
                                    }
                                    // 4. وحدات مشغولة عادة: الأيام المتبقية إن وجدت
                                    else if (typeof unit.remaining_days === 'number' && unit.remaining_days >= 0 &&
                                        (unit.status === 'occupied' || unit.status === 'booked' || unit.status === 'checked_in' || unit.status === 'reserved')) {
                                        daysValue = unit.remaining_days;
                                        tone = daysValue <= 3 ? 'remainingLow' : 'remaining';
                                        tooltipAr = `${daysValue} ${daysValue === 1 ? 'يوم' : 'أيام'} متبقية من الحجز`;
                                        tooltipEn = `${daysValue} day${daysValue === 1 ? '' : 's'} remaining`;
                                    }

                                    if (daysValue === null) return null;

                                    // تحديد الألوان حسب النغمة
                                    const toneStyles = {
                                        overdue: {
                                            base: 'bg-gradient-to-br from-[#6d4c41] to-[#4e342e] text-[#fff8e1] border-2 border-[#d7ccc8]',
                                            ring: 'ring-2 ring-[#8d6e63]/70',
                                            pulseShadow: 'rgba(93,64,55,0.75)',
                                        },
                                        departure: {
                                            base: 'bg-gradient-to-br from-orange-500 to-orange-600 text-white border-2 border-white',
                                            ring: 'ring-2 ring-orange-400/60',
                                            pulseShadow: 'rgba(249,115,22,0.55)',
                                        },
                                        remainingLow: {
                                            base: 'bg-gradient-to-br from-amber-500 to-yellow-500 text-white border-2 border-white',
                                            ring: 'ring-2 ring-amber-300/70',
                                            pulseShadow: 'rgba(245,158,11,0.5)',
                                        },
                                        remaining: {
                                            base: 'bg-gradient-to-br from-sky-500 to-cyan-500 text-white border-2 border-white',
                                            ring: 'ring-1.5 ring-sky-300/60',
                                            pulseShadow: 'rgba(14,165,233,0.45)',
                                        },
                                    } as const;
                                    const style = toneStyles[tone!];
                                    const tooltipText = t(tooltipAr, tooltipEn);

                                    // 🚨 لوحدات تجاوز الخروج فقط: إضافة علامة تعجب دائرية أكبر بجانب الدائرة الزاوية
                                    //    الموضع: إلى اليسار (start) من الدائرة الزاوية — أي ناحية بداخل البطاقة أكثر
                                    const showAlertBadge = overdueCheckout && tone === 'overdue';
                                    const alertBadgeSize = 32; // أكبر من الدائرة (22px) بنسبة ~45%
                                    const gapBetweenBadges = 6; // هامش صغير بين الدائرتين

                                    return (
                                        <div
                                            aria-hidden={false}
                                            className={cn(
                                                // الموقع الأساسي: الزاوية العلوية اليمنى بالضبط
                                                // — الآن نحول الموضع إلى end-0 كنقطة مرجعية، ونضع الدائرتين داخله باستخدام flex
                                                "absolute top-0 end-0 -translate-y-[50%] translate-x-[50%] z-[60] isolation-isolate select-none",
                                                "inline-flex items-center gap-[6px]"
                                            )}
                                            style={{
                                                pointerEvents: 'none',
                                                // عكس اتجاه الحاوية بحيث تظهر الدائرة الأيمن (الأيام) في النهاية كما كانت
                                                // وعلامة التعجب إلى يسارها (start) من وجهة نظر البطاقة = اليسار هنا
                                                flexDirection: language === 'ar' ? 'row-reverse' : 'row',
                                            }}
                                        >
                                            {/* ⚠️ علامة التعجب الدائرية الكبيرة — فقط لوحدات تجاوز الخروج */}
                                            {showAlertBadge && (
                                                <div
                                                    title={t('تنبيه هام: تجاوز موعد الخروج — يجب اتخاذ إجراء فوري', 'Important: Check-out overdue — action required')}
                                                    aria-label="Overdue alert"
                                                    className="relative shrink-0 inline-flex items-center justify-center rounded-full shadow-[0_4px_16px_-2px_rgba(93,64,55,0.55)] animate-[cornerBadgeBreath_2.3s_ease-in-out_infinite]"
                                                    style={{
                                                        width: alertBadgeSize,
                                                        height: alertBadgeSize,
                                                    }}
                                                >
                                                    {/* هالة ضبابية خلف علامة التعجب */}
                                                    <span
                                                        aria-hidden
                                                        className="absolute -inset-0.5 rounded-full opacity-70 animate-[cornerBadgePulse_2s_ease-in-out_infinite]"
                                                        style={{
                                                            boxShadow: '0 0 0 0 rgba(62,39,35,0.7)',
                                                        }}
                                                    />
                                                    <div className="relative w-full h-full rounded-full bg-gradient-to-br from-[#6d4c41] via-[#5d4037] to-[#3e2723] border-2 border-[#d7ccc8] ring-2 ring-[#a1887f]/60 inline-flex items-center justify-center">
                                                        <AlertTriangle size={17} strokeWidth={2.7} className="text-[#fff8e1]" />
                                                    </div>
                                                </div>
                                            )}

                                            {/* 📌 الدائرة الزاوية الأساسية: رقم الأيام */}
                                            <div
                                                aria-hidden={false}
                                                title={tooltipText}
                                                className="relative shrink-0"
                                            >
                                                {/* النبض الخارجي الهادئ */}
                                                <span
                                                    aria-hidden
                                                    className="absolute -inset-1 rounded-full opacity-60 animate-[cornerBadgePulse_2.2s_ease-in-out_infinite]"
                                                    style={{
                                                        boxShadow: `0 0 0 0 ${style.pulseShadow}`,
                                                    }}
                                                />
                                                {/* الدائرة نفسها: صغيرة مع طبقة ظل عالية لتبرز خارج البطاقة */}
                                                <div
                                                    className={cn(
                                                        "relative inline-flex items-center justify-center w-[22px] h-[22px] rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.25)]",
                                                        style.base,
                                                        style.ring,
                                                        "animate-[cornerBadgeBreath_2.6s_ease-in-out_infinite]"
                                                    )}
                                                >
                                                    {/* رقم الأيام فقط — بدون وصف */}
                                                    <span className="text-[10px] font-black tabular-nums leading-none tracking-tight">
                                                        {daysValue}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* المغلف الداخلي للبطاقة: يحتفظ بـ overflow-hidden لجميع العناصر الداخلية (غير الدائرة) */}
                                <div className="absolute inset-0 rounded-2xl overflow-hidden z-0">
                                    {/* شريط جانبي رفيع على اليمين للون الحالة */}
                                    <div
                                        aria-hidden
                                        className={cn(
                                            "absolute inset-y-0 end-0 w-[3px] rounded-s-2xl transition-all",
                                            overdueCheckout ? 'bg-[#a1887f] shadow-[0_0_12px_2px_rgba(121,85,72,0.65)]' : meta.progressBar
                                        )}
                                    />
                                    <div
                                       className={cn(
                                         "absolute top-0 inset-x-0 h-[1px] rounded-t-xl transition-all opacity-50",
                                         overdueCheckout ? "bg-[#bcaaa4]/80" : meta.progressBar
                                       )}
                                     />

                                    {/* زخرفة خلفية ثابتة لحالة تجاوز الخروج: تدرج قاتم بني مع زخرفة هالات داخلية فاخرة */}
                                    {overdueCheckout && (
                                        <>
                                            <div aria-hidden className="absolute -top-10 -end-10 w-40 h-40 rounded-full bg-[#8d6e63]/25 blur-3xl pointer-events-none" />
                                            <div aria-hidden className="absolute -bottom-12 -start-10 w-44 h-44 rounded-full bg-[#6d4c41]/18 blur-3xl pointer-events-none" />
                                        </>
                                    )}
                                </div>

                                {/* 🔵🔴🟢🟡 طبقة أساسية (بطاقة افتراضية الآن): تعبأ البطاقة بلون الحالة وتعرض الرقم والحالة فقط في المنتصف
                                    z-index = 30 لتكون فوق المحتوى وتحت الدائرة العلوية (التي عند 60) */}
                                <div
                                    className={cn(
                                        // الموقع: تغطي كامل البطاقة بدون أي زيادة
                                        "absolute inset-0 rounded-2xl z-[30] max-sm:relative max-sm:inset-auto max-sm:flex-1 max-sm:overflow-hidden",
                                        // ظاهرة دائماً الآن (لم تعد في الهوفر فقط!)
                                        "opacity-100 pointer-events-none",
                                        // أنيميشن هادئ للظهور الأولي وتحويلات الهوفر
                                        "transition-[opacity,transform,box-shadow] duration-300 ease-out",
                                        "origin-center scale-100 group-hover:scale-[1.005]",
                                        // الخلفية الملونة حسب الحالة (لوحدات تجاوز الخروج: أحمر قاتم دائماً ولا يأخذ لون الأخضر المتاح أبداً)
                                        displayFill,
                                        // ظل داخلي ناعم + خطافات خفيفة على الحواف
                                        "shadow-[inset_0_2px_12px_rgba(0,0,0,0.22)]"
                                    )}
                                >
                                    {/* زخرفتي هالات ضبابية خلفية لون الحالة = مظهر فاخر */}
                                    <div aria-hidden className="absolute -top-14 -start-14 w-44 h-44 rounded-full bg-white/15 blur-3xl pointer-events-none" />
                                    <div aria-hidden className="absolute -bottom-16 -end-12 w-48 h-48 rounded-full bg-white/10 blur-3xl pointer-events-none" />

                                    {/* زخرفة شبكة خفيفة شبه شفافة (Calm UI) */}
                                    <div
                                        aria-hidden
                                        className="absolute inset-0 rounded-2xl opacity-[0.07] pointer-events-none mix-blend-overlay"
                                        style={{
                                            backgroundImage:
                                                'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)',
                                            backgroundSize: '14px 14px',
                                        }}
                                    />

                                    {/* المحتوى المركزي: رقم الوحدة + الحالة + تاريخ الحجز إن وجد */}
                                    <div className="relative z-10 w-full h-full flex flex-col items-center justify-center gap-1 p-1.5 sm:gap-2.5 sm:p-3 text-center max-sm:min-h-[144px]">
                                        {/* 1) رقم الوحدة: بحجم ضخم جداً في المنتصف */}
                                        <div
                                            className={cn(
                                                "font-black leading-[0.95] tracking-tight tabular-nums dir-ltr",
                                                "max-w-full break-all text-2xl sm:text-5xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]",
                                                displayText
                                            )}
                                        >
                                            {unit.unit_number}
                                        </div>

                                        {/* 2) حالة الوحدة: نص بسيط + أيقونة بدون أي بطاقة أو شارة أو إطار
                                            — لوحدات تجاوز الخروج: نص "تجاوز الخروج" مع أيقونة تحذير وليس "متاح" */}
                                        <div className={cn(
                                            "inline-flex max-w-full items-center gap-1 text-[10px] font-bold leading-snug sm:gap-1.5 sm:text-[12px] sm:leading-none",
                                            "tracking-wide opacity-95",
                                            displayText
                                        )}>
                                            <DisplayIcon size={13} strokeWidth={2.4} />
                                            <span>{displayLabel}</span>
                                        </div>

                                        {/* 🔴🟡🟠 دوائر التنبيه المركزية: دائرة الأيام + دائرة علامة التحذير
                                            — ظاهرة فقط للحالات الحرجة (تجاوز الخروج / دفعات متأخرة / اليوم / قريب) */}
                                        {(() => {
                                            let badgeDays: number | null = null;
                                            let badgeTone: 'overdue' | 'pmtOverdue' | 'today' | 'soon' | null = null;
                                            let badgeTooltipAr = '';
                                            let badgeTooltipEn = '';

                                            // الأولوية 1: تجاوز الخروج (أولى وأهم)
                                            //   — الأيام الآن = أيام تأخر تسجيل الخروج (محسوبة يدوياً دائماً في الفرونت)
                                            //   — القيمة دائماً موجبة لأنها "عدد أيام التأخر" وليست المتبقي
                                            if (overdueCheckout && (typeof checkoutOverdueDays === 'number' || typeof unit.remaining_days === 'number')) {
                                                const finalDays = typeof checkoutOverdueDays === 'number'
                                                    ? checkoutOverdueDays
                                                    : Math.abs(unit.remaining_days || 0);
                                                badgeDays = finalDays; // دائماً موجبة = عدد الأيام المتأخرة
                                                badgeTone = 'overdue';
                                                badgeTooltipAr = typeof checkoutOverdueDays === 'number'
                                                    ? `تأخر تسجيل الخروج بـ ${finalDays} ${finalDays === 1 ? 'يوم' : 'أيام'}`
                                                    : `تجاوز موعد الخروج بـ ${finalDays} ${finalDays === 1 ? 'يوم' : 'أيام'}`;
                                                badgeTooltipEn = typeof checkoutOverdueDays === 'number'
                                                    ? `Check-out was not logged for ${finalDays} day${finalDays === 1 ? '' : 's'}`
                                                    : `${finalDays} day${finalDays === 1 ? '' : 's'} overdue`;
                                            }
                                            // الأولوية 2: دفعات متأخرة
                                            //   — كذلك نترك أيام السداد كما هي (سالبة عند التأخر) لتكون "نفسها التي تعرض كم متبقي"
                                            else if (unit.payment_due_status === 'overdue' && typeof unit.payment_due_in_days === 'number') {
                                                badgeDays = unit.payment_due_in_days || 0; // بدون Math.abs
                                                badgeTone = 'pmtOverdue';
                                                const absDays = Math.abs(badgeDays);
                                                badgeTooltipAr = `تأخر في السداد بـ ${absDays} ${absDays === 1 ? 'يوم' : 'أيام'}`;
                                                badgeTooltipEn = `${absDays} day${absDays === 1 ? '' : 's'} payment overdue`;
                                            }
                                            // الأولوية 3: مستحق اليوم
                                            else if (unit.payment_due_status === 'due_today') {
                                                badgeDays = 0;
                                                badgeTone = 'today';
                                                badgeTooltipAr = 'مستحق الدفع اليوم';
                                                badgeTooltipEn = 'Payment due today';
                                            }
                                            // الأولوية 4: قريباً
                                            else if (unit.payment_due_status === 'due_soon' && typeof unit.payment_due_in_days === 'number' && unit.payment_due_in_days >= 0) {
                                                badgeDays = unit.payment_due_in_days;
                                                badgeTone = 'soon';
                                                badgeTooltipAr = `مستحق خلال ${badgeDays} ${badgeDays === 1 ? 'يوم' : 'أيام'}`;
                                                badgeTooltipEn = `Due in ${badgeDays} day${badgeDays === 1 ? '' : 's'}`;
                                            }

                                            if (badgeDays === null || !badgeTone) return null;

                                            // تدرجات لونية لكل نغمة (ملائمة لخلفيات الملونة للبطاقات)
                                            const palette = {
                                                overdue: {
                                                    daysBase: 'bg-gradient-to-br from-[#8d6e63] to-[#5d4037] border-2 border-white/90 ring-2 ring-white/50',
                                                    daysText: 'text-white',
                                                    warnBase: 'bg-gradient-to-br from-[#6d4c41] via-[#5d4037] to-[#3e2723] border-2 border-[#d7ccc8] ring-2 ring-[#a1887f]/70 shadow-[0_4px_14px_-2px_rgba(62,39,35,0.6)]',
                                                    warnText: 'text-[#fff8e1]',
                                                },
                                                pmtOverdue: {
                                                    daysBase: 'bg-gradient-to-br from-rose-500 to-rose-700 border-2 border-white/90 ring-2 ring-white/50',
                                                    daysText: 'text-white',
                                                    warnBase: 'bg-gradient-to-br from-rose-600 via-rose-500 to-rose-700 border-2 border-white/90 ring-2 ring-rose-300/60 shadow-[0_4px_14px_-2px_rgba(225,29,72,0.6)]',
                                                    warnText: 'text-white',
                                                },
                                                today: {
                                                    daysBase: 'bg-gradient-to-br from-orange-500 to-orange-700 border-2 border-white/90 ring-2 ring-white/50',
                                                    daysText: 'text-white',
                                                    warnBase: 'bg-gradient-to-br from-orange-600 via-orange-500 to-orange-700 border-2 border-white/90 ring-2 ring-orange-300/60 shadow-[0_4px_14px_-2px_rgba(234,88,12,0.6)]',
                                                    warnText: 'text-white',
                                                },
                                                soon: {
                                                    daysBase: 'bg-gradient-to-br from-amber-400 to-amber-600 border-2 border-white/90 ring-2 ring-white/50',
                                                    daysText: 'text-gray-900',
                                                    warnBase: 'bg-gradient-to-br from-amber-500 via-amber-400 to-amber-600 border-2 border-white/90 ring-2 ring-amber-300/60 shadow-[0_4px_14px_-2px_rgba(217,119,6,0.55)]',
                                                    warnText: 'text-gray-900',
                                                },
                                            } as const;
                                            const toneC = palette[badgeTone];
                                            const BADGE_DAYS_SIZE = 34;   // دائرة الأيام: متوسطة الحجم
                                            const BADGE_WARN_SIZE = 42;   // دائرة التحذير: أكبر نسبياً (+23%)
                                            const BADGE_GAP = 7;          // هامش بين الدائرتين

                                            return (
                                                <div
                                                    className={cn(
                                                        "relative inline-flex items-center select-none shrink-0 mt-0.5 mb-0.5 max-sm:scale-[0.8] max-sm:origin-center",
                                                    )}
                                                    style={{
                                                        gap: BADGE_GAP,
                                                        // دائرة الأيام دائماً أقرب لمنتصف البطاقة = اليمين في العربية (لأن start هي اليمين)، اليسار في الإنجليزية
                                                        // وعلامة التحذير تظهر على الجهة الخارجية منها
                                                        flexDirection: language === 'ar' ? 'row' : 'row-reverse',
                                                    }}
                                                    title={t(badgeTooltipAr, badgeTooltipEn)}
                                                >
                                                    {/* ⚠️ دائرة علامة التحذير (أكبر نسبياً) */}
                                                    <div
                                                        className={cn(
                                                            "relative shrink-0 rounded-full inline-flex items-center justify-center",
                                                            "animate-[cornerBadgeBreath_2.3s_ease-in-out_infinite]",
                                                            toneC.warnBase,
                                                        )}
                                                        style={{ width: BADGE_WARN_SIZE, height: BADGE_WARN_SIZE }}
                                                    >
                                                        {/* هالة نبض خفيفة خلف دائرة التحذير */}
                                                        <span
                                                            aria-hidden
                                                            className="absolute -inset-0.5 rounded-full opacity-70 animate-[cornerBadgePulse_2s_ease-in-out_infinite]"
                                                            style={{
                                                                boxShadow: badgeTone === 'overdue'
                                                                    ? '0 0 0 0 rgba(62,39,35,0.7)'
                                                                    : badgeTone === 'pmtOverdue'
                                                                        ? '0 0 0 0 rgba(244,63,94,0.65)'
                                                                        : badgeTone === 'today'
                                                                            ? '0 0 0 0 rgba(249,115,22,0.65)'
                                                                            : '0 0 0 0 rgba(245,158,11,0.6)',
                                                            }}
                                                        />
                                                        <AlertTriangle
                                                            size={badgeTone === 'overdue' ? 21 : 20}
                                                            strokeWidth={badgeTone === 'overdue' ? 2.9 : 2.7}
                                                            className={cn("relative z-10", toneC.warnText)}
                                                        />
                                                    </div>

                                                    {/* 🔢 دائرة عدد الأيام (أصغر قليلاً من دائرة التحذير)
                                                         — علامة + للموجب (متبقي) وعلامة - للسالب (متجاوز) ليعكس المتبقي الحقيقي */}
                                                    <div
                                                        className={cn(
                                                            "relative shrink-0 rounded-full inline-flex items-center justify-center",
                                                            "animate-[cornerBadgeBreath_2.55s_ease-in-out_infinite]",
                                                            toneC.daysBase,
                                                        )}
                                                        style={{ width: BADGE_DAYS_SIZE, height: BADGE_DAYS_SIZE }}
                                                    >
                                                        <span className={cn(
                                                            "text-[12.5px] font-black tabular-nums leading-none tracking-tight",
                                                            toneC.daysText,
                                                        )}>
                                                            {badgeDays > 0 ? `+${badgeDays}` : badgeDays}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* 3) تواريخ الحجز: إذا كانت الوحدة مشغولة أو محجوزة (عندها من → إلى)
                                            — بأرقام فقط بصيغة سنة/شهر/يوم متصلة بشرطة أو مائل — بدون بطاقات */}
                                        {(() => {
                                            const hasRange = Boolean(unit.booking_check_in && unit.booking_check_out);
                                            if (!hasRange) return null;
                                            // تنسيق تاريخ رقمي فقط: YYYY-MM-DD (سنة-شهر-يوم) بأرقام بدون كلمات
                                            const numericDate = (iso?: string) => {
                                                if (!iso) return '—';
                                                // إذا كان بالصيغة yyyy-mm-dd أصلًا نرجعها كما هي (بأرقام وشرطات)
                                                if (/^\d{4}-\d{2}-\d{2}/.test(iso)) {
                                                    const [y, m, d] = iso.slice(0, 10).split('-');
                                                    return language === 'en'
                                                        ? `${m}/${d}/${y}`   // أمريكية: شهر/يوم/سنة
                                                        : `${d}/${m}/${y}`;  // عربي: يوم/شهر/سنة
                                                }
                                                try {
                                                    const dt = new Date(iso);
                                                    const y = dt.getFullYear();
                                                    const m = String(dt.getMonth() + 1).padStart(2, '0');
                                                    const d = String(dt.getDate()).padStart(2, '0');
                                                    return language === 'en'
                                                        ? `${m}/${d}/${y}`
                                                        : `${d}/${m}/${y}`;
                                                } catch {
                                                    return iso.slice(0, 10);
                                                }
                                            };
                                            const fromNum = numericDate(unit.booking_check_in);
                                            const toNum = numericDate(unit.booking_check_out);
                                            return (
                                                <div className={cn(
                                                    "mt-0.5 sm:mt-1 flex min-w-0 flex-col items-center gap-0.5 sm:gap-1 max-w-full sm:max-w-[94%]",
                                                    displayMuted
                                                )}>
                                                    {/* تواريخ بسيطة بأرقام فقط: من X → Y بدون أي بطاقات */}
                                                    <div
                                                        dir="ltr"
                                                        className={cn(
                                                            "inline-flex max-w-full flex-row items-center justify-center gap-0.5 whitespace-nowrap text-[clamp(6px,1.85vw,8px)] font-medium leading-tight tabular-nums sm:gap-2 sm:text-[12px] sm:font-bold sm:leading-none",
                                                            displayText,
                                                            "opacity-95"
                                                        )}
                                                    >
                                                        <CalendarDays size={12.5} strokeWidth={2} className={cn("hidden sm:block shrink-0 opacity-80", displayMuted)} />
                                                        <span>{fromNum}</span>
                                                        <span className="opacity-75 font-black">→</span>
                                                        <span>{toNum}</span>
                                                    </div>
                                                    {/* اسم نوع الوحدة بشكل خفيف جداً تحت التواريخ */}
                                                    {unit.unit_type_name && (
                                                        <div className={cn(
                                                            "text-[8px] sm:text-[10.5px] font-medium sm:font-bold leading-tight opacity-75 break-words max-w-full sm:truncate",
                                                            displayMuted
                                                        )} dir="auto">
                                                            {unit.unit_type_name}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Card body padding + طبقة تبييض خفيفة لوحدات تجاوز الخروج لضمان وضوح النصوص */}
                                <CardContent className={cn(
                                    "p-3 sm:p-3.5 relative z-[1] max-sm:absolute max-sm:inset-0 max-sm:overflow-hidden",
                                    // مخفي بصرياً دائماً لكن يبقى في التدفق للحفاظ على حجم وارتفاع البطاقة الأصلية
                                    "opacity-0 pointer-events-none",
                                    overdueCheckout && "bg-black/5"
                                )}>
                                    {/* Row 1: رقم الوحدة + الأيقونة من اليسار (RTL) + شارة الحالة المصقولة في أعلى يمين البطاقة */}
                                    <div className="flex items-start justify-between gap-2.5">
                                        <div className="min-w-0 flex items-start gap-2.5 pt-0.5">
                                            <div className={cn(
                                                "inline-flex items-center justify-center w-10 h-10 rounded-xl shrink-0 shadow-sm transition-all duration-300",
                                                overdueCheckout
                                                    ? "bg-white/15 text-rose-50 ring-1 ring-white/20 backdrop-blur-sm"
                                                    : cn("ring-1 ring-black/5", meta.chipBg, meta.chipText, meta.chipRing)
                                            )}>
                                                <StatusIcon size={18} strokeWidth={overdueCheckout ? 2.3 : 2} />
                                            </div>
                                            <div className="min-w-0 pt-0.5">
                                                <div className={cn(
                                                    "font-black leading-tight tracking-tight tabular-nums dir-ltr text-right transition-all duration-300",
                                                    overdueCheckout
                                                        ? "text-lg sm:text-[19px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
                                                        : "text-base sm:text-[17px] text-foreground"
                                                )}>
                                                    {unit.unit_number}
                                                </div>
                                                <div className={cn(
                                                    "text-[10.5px] font-bold truncate mt-0.5 leading-tight transition-all duration-300",
                                                    overdueCheckout ? "text-rose-100/85" : meta.chipText
                                                )}>
                                                    {String(unit.unit_type_name || t('نوع غير محدد', 'Unspecified type'))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* شارة الحالة المصقولة في الزاوية العلوية اليمنى ملحقة بالخط المتلون */}
                                        <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
                                            <Badge
                                                variant={meta.badgeVariant}
                                                className={cn(
                                                    "h-6 text-[10.5px] px-2.5 rounded-full shrink-0 shadow-sm ring-1 transition-all duration-300",
                                                    overdueCheckout
                                                        ? "!bg-white !text-rose-700 !border-0 !ring-rose-200 font-black"
                                                        : cn("ring-black/5", meta.badgeClassName)
                                                )}
                                            >
                                                {meta.label}
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Row 2: الدفعات القادمة + المبلغ + زر علامة الاستفهام (مبسط بجوارها) */}
                                    <div className="mt-3 flex items-center justify-between gap-2.5">
                                        <div className="min-w-0 flex-1 flex items-center gap-2">
                                            {(() => {
                                                const pmtStatus = unit.payment_due_status;
                                                const hasPmtInfo =
                                                    (typeof unit.payment_due_amount === 'number' && unit.payment_due_amount > 0) ||
                                                    Boolean(pmtStatus);

                                                if (!hasPmtInfo && typeof paidRatio !== 'number') {
                                                    return (
                                                        <div className="text-[11px] font-bold text-muted-foreground/70 truncate min-w-0">
                                                            {t('لا توجد معلومات دفعات', 'No payment info')}
                                                        </div>
                                                    );
                                                }

                                                const formatPmtAmount = (amount?: number) => {
                                                    if (typeof amount !== 'number' || !Number.isFinite(amount)) return t('—', '—');
                                                    return `${amount.toLocaleString(language === 'en' ? 'en-US' : 'ar-SA')} ${t('ر.س', 'SAR')}`;
                                                };

                                                if (pmtStatus === 'overdue') {
                                                    return (
                                                        <div className="min-w-0 flex-1 flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-lg inline-flex items-center justify-center shrink-0 bg-rose-100 text-rose-600 ring-1 ring-rose-200">
                                                                <AlertTriangle size={14} strokeWidth={2.2} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="text-[9.5px] font-black text-rose-500 uppercase tracking-wide leading-tight">
                                                                    {t('دفعة متأخرة', 'Overdue')}
                                                                </div>
                                                                <div className="text-[11.5px] font-black tabular-nums text-rose-700 leading-tight truncate">
                                                                    {formatPmtAmount(unit.payment_due_amount)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                if (pmtStatus === 'due_today') {
                                                    return (
                                                        <div className="min-w-0 flex-1 flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-lg inline-flex items-center justify-center shrink-0 bg-orange-100 text-orange-600 ring-1 ring-orange-200">
                                                                <Zap size={14} strokeWidth={2.2} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="text-[9.5px] font-black text-orange-500 uppercase tracking-wide leading-tight">
                                                                    {t('مستحق اليوم', 'Due today')}
                                                                </div>
                                                                <div className="text-[11.5px] font-black tabular-nums text-orange-700 leading-tight truncate">
                                                                    {formatPmtAmount(unit.payment_due_amount)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                if (pmtStatus === 'due_soon') {
                                                    return (
                                                        <div className="min-w-0 flex-1 flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-lg inline-flex items-center justify-center shrink-0 bg-amber-100 text-amber-600 ring-1 ring-amber-200">
                                                                <Calendar size={14} strokeWidth={2.2} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="text-[9.5px] font-black text-amber-600 uppercase tracking-wide leading-tight">
                                                                    {t('دفعة قادمة', 'Upcoming')}
                                                                </div>
                                                                <div className="text-[11.5px] font-black tabular-nums text-amber-700 leading-tight truncate">
                                                                    {formatPmtAmount(unit.payment_due_amount)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                if (typeof paidRatio === 'number') {
                                                    return (
                                                        <div className="min-w-0 flex-1 flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-lg inline-flex items-center justify-center shrink-0 bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200">
                                                                <CheckCircle2 size={14} strokeWidth={2.2} />
                                                            </div>
                                                            <div className="min-w-0 flex-1 max-w-[70%]">
                                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                                    <span className="text-[9.5px] font-black text-emerald-600 uppercase tracking-wide leading-tight">
                                                                        {t('السداد', 'Paid')}
                                                                    </span>
                                                                    <span className="text-[10px] font-black tabular-nums text-emerald-800 leading-tight">{paidRatio}%</span>
                                                                </div>
                                                                <Progress
                                                                    value={paidRatio}
                                                                    className={cn(
                                                                        "h-1.5 rounded-full bg-emerald-100/80 [&>div]:rounded-full transition-all",
                                                                        paidRatio >= 100
                                                                            ? '[&>div]:!bg-emerald-500'
                                                                            : `[&>div]:!${meta.progressBar}`
                                                                    )}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div className="text-[11px] font-bold text-muted-foreground/70 truncate min-w-0">
                                                        {t('لا توجد دفعات', 'No upcoming payments')}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* Row 3: اسم العميل + حالة العميل (حالي / قادم / سابق) — بدون رقم جوال */}
                                    <div className={cn(
                                        "mt-3 min-h-[28px] rounded-xl px-2.5 py-2 transition-all duration-300",
                                        overdueCheckout
                                            ? "bg-black/15 ring-1 ring-white/10"
                                            : pmtOverdue
                                                ? "bg-rose-50/60 ring-1 ring-rose-200/60"
                                                : pmtDueToday
                                                    ? "bg-orange-50/60 ring-1 ring-orange-200/50"
                                                    : pmtDueSoon
                                                        ? "bg-amber-50/60 ring-1 ring-amber-200/50"
                                                        : "bg-transparent"
                                    )}>
                                        {unit.guest_name || unit.action_guest_name ? (
                                            <div className="flex items-center justify-between gap-2 min-w-0">
                                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                    <User
                                                        size={13}
                                                        strokeWidth={overdueCheckout ? 2.3 : 2}
                                                        className={cn(
                                                            "shrink-0",
                                                            overdueCheckout ? "text-rose-100/90" : "text-muted-foreground/80"
                                                        )}
                                                    />
                                                    <span className={cn(
                                                        "font-bold truncate leading-tight transition-all duration-300",
                                                        overdueCheckout
                                                            ? "text-[12px] text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]"
                                                            : "text-[11.5px] text-foreground"
                                                    )}>
                                                        {unit.guest_name || unit.action_guest_name || t('ضيف', 'Guest')}
                                                    </span>
                                                </div>
                                                {/* حالة العميل (حالي/قادم/سابق) */}
                                                {(() => {
                                                    const customerStatusBadge = isUpcoming
                                                        ? { label: t('عميل قادم', 'Upcoming'), className: 'bg-sky-50 text-sky-700 ring-sky-200' }
                                                        : isCurrent
                                                            ? { label: t('عميل حالي', 'Current'), className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' }
                                                            : overdueCheckout
                                                                ? { label: t('تجاوز الخروج', 'OVERDUE'), className: '!bg-white !text-rose-700 !ring-rose-300 shadow-sm' }
                                                                : unit.next_action === 'departure'
                                                                    ? { label: t('عميل حالي', 'Current'), className: 'bg-orange-50 text-orange-700 ring-orange-200' }
                                                                    : null;
                                                    if (!customerStatusBadge) return null;
                                                    return (
                                                        <span
                                                            className={cn(
                                                                "inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[9.5px] font-black ring-1 shrink-0",
                                                                customerStatusBadge.className
                                                            )}
                                                        >
                                                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                                                            {customerStatusBadge.label}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between gap-2 min-w-0">
                                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                    <Sparkles size={12} className={cn(
                                                        "shrink-0",
                                                        overdueCheckout ? "text-rose-100/70" : "text-muted-foreground/60"
                                                    )} strokeWidth={2} />
                                                    <span className={cn(
                                                        "font-bold leading-tight truncate",
                                                        overdueCheckout
                                                            ? "text-[11.5px] text-rose-100/90"
                                                            : "text-[11px] text-muted-foreground/80"
                                                    )}>
                                                        {t('لا يوجد ضيف', 'No guest')}
                                                    </span>
                                                </div>
                                                <span className={cn(
                                                    "inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[9.5px] font-black ring-1 shrink-0",
                                                    overdueCheckout
                                                        ? "bg-white/10 text-white/90 ring-white/15"
                                                        : "bg-zinc-50 text-zinc-600 ring-zinc-200"
                                                )}>
                                                    <span className={cn("w-1.5 h-1.5 rounded-full", overdueCheckout ? "bg-emerald-300" : "bg-zinc-400")} />
                                                    {t('متاحة', 'Available')}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* لو مفعّلة إعدادات الوحدة (تنظيف/صيانة/حجز مؤقت) */}
                                    {(unit.status === 'available' || unit.status === 'cleaning') && activeUnitId === unit.id && (
                                        <div className="mt-2.5 grid grid-cols-3 gap-1.5 pt-2 border-t border-border/60">
                                            <Button
                                                size="sm"
                                                className="h-7 text-[10px] sm:text-[10.5px] rounded-xl font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    setUnitsState(prev => prev.map(u => u.id === unit.id ? { ...u, status: 'cleaning' } : u));
                                                    const res = await fetch('/api/units/set-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unit_id: unit.id, status: 'cleaning' }) });
                                                    if (!res.ok) {
                                                        setUnitsState(prev => prev.map(u => u.id === unit.id ? { ...u, status: 'available' } : u));
                                                        alert(t('فشل تعديل الحالة إلى تنظيف', 'Failed to change status to cleaning'));
                                                    }
                                                    setActiveUnitId(null);
                                                }}
                                            >
                                                {t('تنظيف', 'Cleaning')}
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="h-7 text-[10px] sm:text-[10.5px] rounded-xl font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    setUnitsState(prev => prev.map(u => u.id === unit.id ? { ...u, status: 'maintenance' } : u));
                                                    const res = await fetch('/api/units/set-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unit_id: unit.id, status: 'maintenance' }) });
                                                    if (!res.ok) {
                                                        setUnitsState(prev => prev.map(u => u.id === unit.id ? { ...u, status: 'available' } : u));
                                                        alert(t('فشل تعديل الحالة إلى صيانة', 'Failed to change status to maintenance'));
                                                    }
                                                    setActiveUnitId(null);
                                                }}
                                            >
                                                {t('صيانة', 'Maintenance')}
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="h-7 text-[10px] sm:text-[10.5px] rounded-xl font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowReserveFormFor(unit.id);
                                                    setActiveUnitId(null);
                                                    setReserveName('');
                                                    setReservePhone('');
                                                    setReserveDate(new Date().toISOString().split('T')[0]);
                                                }}
                                            >
                                                {t('حجز مؤقت', 'Temp reserve')}
                                            </Button>
                                        </div>
                                    )}

                                    {/* تأكيد / إلغاء حجز مؤقت */}
                                    {(unit.status === 'reserved' || unit.has_temp_res) && (
                                        <div className="mt-2.5 grid grid-cols-2 gap-1.5 pt-2 border-t border-border/60">
                                            <Button
                                                size="sm"
                                                className="h-7.5 text-[10.5px] rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const q = encodeURIComponent(unit.action_guest_name || '');
                                                    router.push(`/bookings?q=${q}&unit_id=${unit.id}&search=1`);
                                                }}
                                            >
                                                {t('تأكيد الحجز', 'Confirm booking')}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="h-7.5 text-[10.5px] rounded-xl font-bold hover:bg-muted/80"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    const prev = { status: unit.status, action_guest_name: unit.action_guest_name, guest_phone: unit.guest_phone, has_temp_res: unit.has_temp_res };
                                                    setUnitsState(prevUnits => prevUnits.map(u => u.id === unit.id ? { ...u, status: 'available', action_guest_name: undefined, guest_phone: undefined, has_temp_res: false } : u));
                                                    const res = await fetch('/api/units/cancel-reservation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unit_id: unit.id }) });
                                                    if (!res.ok) {
                                                        setUnitsState(prevUnits => prevUnits.map(u => u.id === unit.id ? { ...u, status: prev.status as any, action_guest_name: prev.action_guest_name, guest_phone: prev.guest_phone, has_temp_res: prev.has_temp_res } : u));
                                                        alert(t('فشل إلغاء الحجز المؤقت', 'Failed to cancel temporary reservation'));
                                                    }
                                                }}
                                            >
                                                {t('إلغاء الحجز', 'Cancel')}
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
            </CardContent>
        </Card>
        </div>
        {detailsOpenUnitId && (() => {
            const unit = unitsState.find(u => u.id === detailsOpenUnitId);
            if (!unit) return null;
            const effectiveStatus = unit.has_temp_res && unit.status === 'available' ? 'reserved' : unit.status;
            return <UnitDetailsDialog unit={unit} language={language} selectedDate={selectedDate}
                statusLabel={unit.next_action === 'overdue' ? t('تجاوز الخروج', 'Overdue check-out') : getStatusMeta(effectiveStatus).label}
                actionLabel={getActionMeta(unit)?.label}
                onClose={closeDetailsPopover}
                onQuickBooking={() => { closeDetailsPopover(); setQuickBookingUnit(unit); }}
                onNewBooking={() => { closeDetailsPopover(); openRangeModal(unit); }}
                onContact={() => { closeDetailsPopover(); setMessageModalUnit(unit); setSelectedMessageType('extension'); }} />;
        })()}
            </>
        );
    };

// Global Modal (Rendered outside unit card to avoid parent click handlers)
export const ReserveModal = ({
    unit,
    visible,
    onClose,
    onSave,
    name,
    phone,
    date,
    setName,
    setPhone,
    setDate,
    language = 'ar'
}: {
    unit: Unit | undefined;
    visible: boolean;
    onClose: () => void;
    onSave: () => void;
    name: string;
    phone: string;
    date: string;
    setName: (v: string) => void;
    setPhone: (v: string) => void;
    setDate: (v: string) => void;
    language?: 'ar' | 'en';
}) => {
    if (!visible) return null;
    const t = (arText: string, enText: string) => (language === 'en' ? enText : arText);
    return (
        <div
            className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-2xl p-5 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-800">{t('حجز مؤقت للوحدة', 'Temporary reservation')}</span>
                        {unit && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">
                                {unit.unit_number}
                            </span>
                        )}
                    </div>
                    <button
                        className="px-2 py-1 rounded-lg text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
                        onClick={onClose}
                    >
                        {t('إغلاق', 'Close')}
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-700">{t('اسم العميل', 'Customer name')}</label>
                        <input
                            type="text"
                            className="w-full p-2.5 border border-gray-200 rounded-xl text-[12px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            placeholder={t('ادخل الاسم', 'Enter name')}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-700">{t('رقم الجوال', 'Mobile')}</label>
                        <input
                            type="tel"
                            className="w-full p-2.5 border border-gray-200 rounded-xl text-[12px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            placeholder="05xxxxxxxx"
                            dir="ltr"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                        <label className="text-[11px] font-bold text-gray-700">{t('تاريخ الحجز', 'Reservation date')}</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                className="w-full p-2.5 border border-gray-200 rounded-xl text-[12px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 pt-2">
                    <button
                        className="flex-1 px-3 py-2 text-[12px] rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                        onClick={onSave}
                    >
                        {t('حفظ', 'Save')}
                    </button>
                    <button
                        className="flex-1 px-3 py-2 text-[12px] rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200"
                        onClick={onClose}
                    >
                        {t('إلغاء', 'Cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};



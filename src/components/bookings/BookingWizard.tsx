'use client';

import React, { useState } from 'react';
import styles from './BookingWizard.module.css';
import { CustomerStep, Customer } from './steps/CustomerStep';
import { UnitSelectionStep } from './steps/UnitSelectionStep';
import { PricingStep, PricingResult } from './steps/PricingStep';
import { DepositStep, DepositResult } from './steps/DepositStep';
import { ConfirmStep } from './steps/ConfirmStep';
import { UnitType, PriceCalculation, calculateDetailedDuration } from '@/lib/pricing';
import { User, Calendar, CreditCard, FileCheck, CheckCircle } from 'lucide-react';
import { format, addDays, addMonths, differenceInCalendarDays, parseISO } from 'date-fns';
import { useAppLanguage, AppLanguage } from '@/hooks/useAppLanguage';

type Step = 'customer' | 'unit' | 'price' | 'deposit' | 'confirm';

export interface Unit {
  id: string;
  unit_number: string;
  floor: string;
  status: string;
  unit_type_id: string;
  hotel_id?: string;
}

export interface BookingData {
  customer: Customer | null;
  unitType?: UnitType;
  unit?: Unit;
  startDate?: Date;
  endDate?: Date;
  priceCalculation?: PriceCalculation;
  pricingResult?: PricingResult;
  depositResult?: DepositResult;
  bookingType?: 'daily' | 'monthly' | 'yearly';
  customerPreferences?: string;
  companions?: Array<{ name: string; national_id?: string }>;
  bookingSource?: 'reception' | 'platform' | 'broker' | 'website' | 'api' | 'walk_in' | 'phone' | 'quick';
  platformName?: string;
  brokerName?: string;
  brokerId?: string;
}

const STEPS = [
  { id: 'customer', label: { ar: 'العميل', en: 'Customer' }, icon: User },
  { id: 'unit', label: { ar: 'الوحدة والتواريخ', en: 'Unit & dates' }, icon: Calendar },
  { id: 'price', label: { ar: 'التسعير', en: 'Pricing' }, icon: CreditCard },
  { id: 'deposit', label: { ar: 'العربون', en: 'Deposit' }, icon: FileCheck },
  { id: 'confirm', label: { ar: 'تأكيد', en: 'Confirm' }, icon: CheckCircle },
];

export const BookingWizard: React.FC<{ initialCustomer?: Customer; initialUnitId?: string; initialQuery?: string; initialCheckIn?: string; initialCheckOut?: string; language?: AppLanguage; mode?: 'create' | 'complete'; completeBookingId?: string; completeBookingData?: any }> = ({ initialCustomer, initialUnitId, initialQuery, initialCheckIn, initialCheckOut, language: languageProp, mode = 'create', completeBookingId, completeBookingData }) => {
  const { language: storedLanguage } = useAppLanguage();
  const language = languageProp ?? storedLanguage;
  const t = (arText: string, enText: string) => (language === 'en' ? enText : arText);
  const [currentStep, setCurrentStep] = useState<Step>('customer');
  const toLocalYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const parseYMD = (ymd?: string) => {
    const s = (ymd || '').trim();
    if (!s) return null;
    const d = new Date(`${s}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const addDaysLocal = (d: Date, days: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const addMonthsAligned = (d: Date, months: number) => {
    const year = d.getFullYear();
    const monthIndex = d.getMonth() + months;
    const day = d.getDate();
    const lastDayInTargetMonth = new Date(year, monthIndex + 1, 0).getDate();
    const safeDay = Math.min(day, lastDayInTargetMonth);
    const x = new Date(year, monthIndex, safeDay, 0, 0, 0, 0);
    return x;
  };
  const diffDaysLocal = (start: Date, end: Date) => {
    const a = new Date(start);
    const b = new Date(end);
    a.setHours(0, 0, 0, 0);
    b.setHours(0, 0, 0, 0);
    const msDay = 24 * 60 * 60 * 1000;
    return Math.ceil((b.getTime() - a.getTime()) / msDay);
  };

  const rawStart = parseYMD(initialCheckIn);
  const rawEnd = parseYMD(initialCheckOut);
  let initialStartDate = rawStart ?? undefined;
  let initialEndDate = rawEnd ?? undefined;
  let initialBookingType: BookingData['bookingType'] | undefined = undefined;
  let initialDurationDays: number | undefined = undefined;
  let initialDurationMonths: number | undefined = undefined;

  if (initialStartDate) {
    if (!initialEndDate || initialEndDate <= initialStartDate) {
      initialEndDate = addDays(initialStartDate, 1);
    }
    const rawNights = Math.max(1, differenceInCalendarDays(initialEndDate, initialStartDate));
    
    // If we have both dates from outside, respect them
    if (rawStart && rawEnd) {
      initialEndDate = rawEnd;
      if (rawNights < 15) {
        initialBookingType = 'daily';
        initialDurationDays = rawNights;
      } else {
        initialBookingType = rawNights >= 360 ? 'yearly' : 'monthly';
        const { months } = calculateDetailedDuration(initialStartDate, initialEndDate);
        initialDurationMonths = months;
      }
    } else {
      // Logic for when only start date or invalid range is provided
      if (rawNights < 15) {
        initialBookingType = 'daily';
        initialDurationDays = rawNights;
      } else {
        const months = Math.max(1, Math.round(rawNights / 30));
        initialDurationMonths = months;
        initialBookingType = months >= 12 ? 'yearly' : 'monthly';
        initialEndDate = addDays(addMonths(initialStartDate, months), -1);
      }
    }
  }
  const [bookingData, setBookingData] = useState<BookingData>({
    customer: initialCustomer || null,
    startDate: initialStartDate,
    endDate: initialEndDate,
    bookingType: initialBookingType,
  });

  const handleCustomerSelect = (customer: Customer, meta?: { bookingSource?: 'reception'|'platform'|'broker'; platformName?: string; brokerName?: string; brokerId?: string }) => {
    setBookingData(prev => ({ 
      ...prev, 
      customer,
      bookingSource: meta?.bookingSource || prev.bookingSource,
      platformName: meta?.platformName || prev.platformName,
      brokerName: meta?.brokerName || prev.brokerName,
      brokerId: meta?.brokerId || prev.brokerId
    }));
    setCurrentStep('unit');
  };

  const handleUnitSelect = (data: { unitType: UnitType; unit: Unit; startDate: Date; endDate: Date; calculation: PriceCalculation; bookingType: 'daily' | 'monthly' | 'yearly'; customerPreferences?: string; companions?: Array<{ name: string; national_id?: string }> }) => {
    setBookingData(prev => ({
      ...prev,
      unitType: data.unitType,
      unit: data.unit,
      startDate: data.startDate,
      endDate: data.endDate,
      priceCalculation: data.calculation,
      bookingType: data.bookingType,
      customerPreferences: data.customerPreferences,
      companions: data.companions
    }));
    setCurrentStep('price');
  };

  const handlePricingConfirm = (data: PricingResult) => {
    setBookingData(prev => ({ ...prev, pricingResult: data }));
    setCurrentStep('deposit');
  };

  const handleDepositConfirm = (data: DepositResult) => {
    setBookingData(prev => ({ ...prev, depositResult: data }));
    setCurrentStep('confirm');
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'unit':
        setCurrentStep('customer');
        break;
      case 'price':
        setCurrentStep('unit');
        break;
      case 'deposit':
        setCurrentStep('price');
        break;
      case 'confirm':
        setCurrentStep('deposit');
        break;
    }
  };

  const handleFinalSuccess = () => {
      // Keep user on confirm step (which shows success message)
      // Optionally reset form after delay or manual action
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'customer':
        return (
          <CustomerStep 
            onNext={handleCustomerSelect} 
            initialCustomer={bookingData.customer || undefined}
            initialQuery={initialQuery}
            language={language}
          />
        );
      case 'unit':
        return (
          <UnitSelectionStep 
            onNext={handleUnitSelect}
            onBack={handleBack}
            selectedCustomer={bookingData.customer || undefined}
            initialUnitId={initialUnitId}
            initialData={{
              unitType: bookingData.unitType,
              startDate: bookingData.startDate,
              endDate: bookingData.endDate,
              bookingType: bookingData.bookingType,
              durationMonths: initialDurationMonths,
              durationDays: initialDurationDays
            }}
            language={language}
          />
        );
      case 'price':
        if (!bookingData.unitType || !bookingData.priceCalculation) return <div>{t('بيانات ناقصة', 'Missing data')}</div>;
        return (
          <PricingStep
            unitType={bookingData.unitType}
            calculation={bookingData.priceCalculation}
            bookingType={bookingData.bookingType || 'monthly'}
            initialData={bookingData.pricingResult}
            onNext={handlePricingConfirm}
            onBack={handleBack}
            language={language as 'ar' | 'en'}
          />
        );
      case 'deposit':
        if (!bookingData.pricingResult) return <div>{t('بيانات ناقصة', 'Missing data')}</div>;
        return (
          <DepositStep
            pricingResult={bookingData.pricingResult}
            customerName={bookingData.customer?.full_name}
            initialData={bookingData.depositResult}
            onNext={handleDepositConfirm}
            onBack={handleBack}
            language={language as 'ar' | 'en'}
            unit={bookingData.unit}
          />
        );
      case 'confirm':
        return (
            <ConfirmStep 
                data={bookingData}
                onSuccess={handleFinalSuccess}
                onBack={handleBack}
                language={language as 'ar' | 'en'}
                mode={mode}
                completeBookingId={completeBookingId}
                completeBookingData={completeBookingData}
            />
        );
      default:
        return <div>{t('قريباً', 'Coming soon')}</div>;
    }
  };

  const steps = STEPS.map((s) => ({ ...s, label: language === 'en' ? s.label.en : s.label.ar }));
  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div dir={language === 'en' ? 'ltr' : 'rtl'} className="mx-auto w-full max-w-6xl space-y-4">
      <section aria-label={t('مراحل تسجيل الحجز', 'Booking progress')} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div className="flex items-center gap-2.5"><span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-900"><Calendar size={17} /></span>
            <div><p className="text-xs font-semibold text-stone-800">{mode === 'complete' ? t('إكمال إجراءات الحجز', 'Complete booking') : t('تسجيل حجز جديد', 'Create a booking')}</p><p className="mt-1 text-[10px] text-stone-400">{t('بيانات منظمة، خطوة بخطوة', 'One clear step at a time')}</p></div>
          </div>
          <span className="shrink-0 rounded-full bg-stone-100 px-3 py-1.5 text-[11px] font-medium tabular-nums text-stone-500">{t('خطوة', 'Step')} {currentStepIndex + 1} / {steps.length}</span>
        </div>
        <ol className="grid grid-cols-5 gap-1.5 sm:gap-3">
          {steps.map((step, index) => {
            const active = index === currentStepIndex;
            const completed = index < currentStepIndex;
            const Icon = step.icon;
            return <li key={step.id} aria-current={active ? 'step' : undefined} className={`min-w-0 rounded-xl px-1 py-2 text-center sm:flex sm:items-center sm:gap-2.5 sm:px-3 sm:text-start ${active ? 'bg-emerald-50 ring-1 ring-emerald-100' : ''}`}>
              <span className={`mx-auto flex size-8 shrink-0 items-center justify-center rounded-lg sm:mx-0 sm:size-9 ${active ? 'bg-emerald-900 text-white shadow-sm' : completed ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-400'}`}>
                {completed ? <CheckCircle size={16} /> : <Icon size={16} />}
              </span>
              <span className={`mt-2 block break-words text-[10px] leading-4 sm:mt-0 sm:text-[11px] ${active ? 'font-bold text-emerald-950' : completed ? 'font-medium text-stone-700' : 'text-stone-400'}`}>{step.label}</span>
            </li>;
          })}
        </ol>
        <div role="progressbar" aria-label={t('تقدم خطوات الحجز', 'Booking step progress')} aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={currentStepIndex + 1} className="mt-4 h-1 overflow-hidden rounded-full bg-stone-100">
          <div className="h-full rounded-full bg-emerald-700 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }} />
        </div>
      </section>

      <section aria-labelledby="booking-step-title" className="min-w-0 rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 border-b border-stone-100 px-4 py-5 sm:px-7 sm:py-6">
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full border border-stone-200 text-xs font-semibold tabular-nums text-stone-400">0{currentStepIndex + 1}</span>
          <div><h2 id="booking-step-title" className="text-lg font-bold tracking-tight text-stone-900 sm:text-xl">{steps[currentStepIndex].label}</h2>
            <p className="mt-1.5 text-xs leading-6 text-stone-500">
              {currentStep === 'customer' && t('اختر العميل من السجل أو أضف بيانات عميل جديد.', 'Select an existing customer or add a new customer.')}
              {currentStep === 'unit' && t('اختر الوحدة وحدد تاريخ الوصول والمغادرة.', 'Choose a unit and set the check-in and check-out dates.')}
              {currentStep === 'price' && t('راجع تكلفة الإقامة والخدمات الإضافية والخصومات.', 'Review stay costs, additional services and discounts.')}
              {currentStep === 'deposit' && t('حدد قيمة العربون وطريقة الدفع وحالة الاستلام.', 'Set the deposit amount, payment method and receipt status.')}
              {currentStep === 'confirm' && t('تأكد من صحة البيانات والمبالغ قبل اعتماد الحجز.', 'Check the details and amounts before confirming the booking.')}
            </p>
          </div>
        </div>
        <div className={`${styles.form} min-w-0 p-4 sm:p-6 lg:p-7`}>
          {renderStep()}
        </div>
      </section>
    </div>
  );
};

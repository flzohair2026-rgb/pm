'use client';
import React from 'react';
import localFont from 'next/font/local';
import { format } from 'date-fns';
import Logo from '@/components/Logo';
import ContractSignature from '@/components/ContractSignature';
import type { ContractDocumentData, ContractOptions } from '@/lib/print/contract-types';
import { contractPrintStyles } from './contract-styles';
const contractFont = localFont({ src: [
  { path: '../../app/fonts/IBMPlexSansArabic-Regular.ttf', weight: '400' },
  { path: '../../app/fonts/IBMPlexSansArabic-Medium.ttf', weight: '500' },
  { path: '../../app/fonts/IBMPlexSansArabic-SemiBold.ttf', weight: '600' },
  { path: '../../app/fonts/IBMPlexSansArabic-Bold.ttf', weight: '700' },
] });
const parseDbDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const dt = new Date(str);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

export default function ContractDocument({ data, options = {} }: { data: ContractDocumentData; options?: ContractOptions }) {
  const { booking, terminationEvent, today, invoiceNumber, monthlyRent, dailyPrice, invoiceSubtotal, invoiceDiscount, invoiceAdditionalServices, computedInvoiceTotal, hasDiscount, docType, companionsCount, periodStart, periodEnd, startDayName, isAnnualContract, yearlyRent, monthsTotalContract, rentUnitAmountFromInvoice, isCustomSubtotal, totalRent, isDailyBooking, termLabel, durationText, depositAmountFromVouchers, depositAmount, bookingSourceLabel } = data;
  const { agentName, durationNote, rentNote, agentTitle = 'وكيل' } = options;
  return <article className={`contract-paper ${contractFont.className}`} dir="rtl" aria-label="عقد الإيجار"><style>{contractPrintStyles}</style>
        {/* Header */}
        <div className="contract-heading">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center overflow-hidden">
                <Logo className="w-8 h-8 object-contain" />
              </div>
              <div className="leading-tight">
                <h1 className="text-lg font-extrabold">عقد إيجار شهري</h1>
                <div className="flex items-center gap-3 text-[11px] text-gray-600">
                  <span>وحدة سكنية مفروشة</span>
                  {terminationEvent ? (
                    <span className="font-black text-red-700">
                      فسخ العقد — تاريخ المغادرة:{' '}
                      <span className="font-mono" dir="ltr">
                        {format(
                          parseDbDate((terminationEvent as any)?.payload?.exit_date || (terminationEvent as any)?.payload?.new_check_out) || new Date(String((terminationEvent as any)?.created_at || '')),
                          'dd/MM/yyyy'
                        )}
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="text-left">
              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold">
                <span className="inline-flex items-center gap-1">
                  <span>رقم العقد:</span>
                  <span className="font-mono">{booking?.id?.slice(0, 8)?.toUpperCase()}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span>تاريخ التحرير:</span>
                  <span>{today}</span>
                </span>
                {invoiceNumber && (
                  <span className="inline-flex items-center gap-1">
                    <span>رقم الفاتورة:</span>
                    <span className="font-mono" dir="ltr">{invoiceNumber}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <span>المصدر:</span>
                  <span>{bookingSourceLabel}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Parties */}
        <section className="mb-1 grid grid-cols-2 gap-6 border border-gray-300 rounded-lg p-1">
          <div>
            <h2 className="font-bold mb-2 text-sm">الطرف الأول (المؤجر)</h2>
            <p>المالك: شركة مساكن الرفاهية</p>
            <p>الممثل: شركة شموخ الرفاهية للتطوير والاستثمار العقاري</p>
            <p className="text-xs text-gray-700">السجل التجاري: <span className="font-mono font-bold">7037421299</span></p>
            <p>رقم الجوال 0538159915</p>
          </div>
          <div>
            <h2 className="font-bold mb-2 text-sm">الطرف الثاني (المستأجر)</h2>
  
            <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
              <p className="text-gray-600 text-right text-[10px] font-bold">الاسم</p>
              <p className="text-center text-[10px] font-bold">{booking?.customer?.full_name || '—'}</p>
              <p className="text-gray-600 text-left text-[10px] font-bold">Name</p>

              <p className="text-gray-600 text-right text-[10px] font-bold">الهوية</p>
              <p className="text-center font-mono text-[10px] font-bold">{booking?.customer?.national_id || '—'}</p>
              <p className="text-gray-600 text-left text-[10px] font-bold">National ID</p>

              <p className="text-gray-600 text-right text-[10px] font-bold">الجنسية</p> 
              <p className="text-center text-[10px] font-bold">{booking?.customer?.nationality || '—'}</p>
              <p className="text-gray-600 text-left text-[10px] font-bold">Nationality</p>

              <p className="text-gray-600 text-right text-[10px] font-bold">الجوال</p>
              <p className="text-center font-mono text-[10px] font-bold" dir="ltr">{booking?.customer?.phone || '—'}</p>
              <p className="text-gray-600 text-left text-[10px] font-bold">Mobile</p>

              <p className="text-gray-600 text-right text-[10px] font-bold">نوع الوثيقة</p>
              <p className="text-center text-[10px] font-bold">{docType || '—'}</p>
              <p className="text-gray-600 text-left text-[10px] font-bold">Document Type</p>

              <p className="text-gray-600 text-right text-[10px] font-bold">عدد المرافقين</p>
              <p className="text-center text-[10px] font-bold">{companionsCount != null ? companionsCount : '—'}</p>
              <p className="text-gray-600 text-left text-[10px] font-bold">Companions</p> 
            </div>
          </div>
        </section>

        {/* Unit Info */}
        <section className="mb-1 border border-gray-300 rounded-lg p-3">
          <h2 className="font-bold mb-2 text-sm">بيانات الوحدة</h2>
          <div className="grid grid-cols-3 gap-3">
            <p>
              رقم الوحدة: <span className="font-mono">{booking?.unit?.unit_number || '—'}</span>
            </p>
            <p>
              الدور: <span className="font-mono">{booking?.unit?.floor || '—'}</span>
            </p>
            <p>الاستخدام: سكني فقط</p>
          </div>
          <p className="mt-2 text-xs text-gray-600">
            النموذج: {booking?.unit?.unit_type?.name || '—'}
            {booking?.unit?.unit_type?.description ? (
              <> — {booking?.unit?.unit_type?.description}</>
            ) : null}
          </p>
          
        </section>

        {/* Terms Grid */}
        <section className="grid grid-cols-1 gap-2 mb-1">
          <div className="border border-gray-300 rounded-lg p-2 space-y-1.5 text-[11px]">
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-bold text-[12px]">المدة:</span>
              <span className="text-[11px]">
                مدة العقد: <span className="font-mono font-bold">{termLabel}</span>
                {durationText ? ` — ${durationText}` : ''}
                {durationNote ? ` — ${durationNote}` : ''}
                {periodStart && periodEnd ? (
                  <>
                    {' '}— من تاريخ <span className="font-mono font-bold" dir="ltr">{periodStart}</span>
                    {startDayName ? <> {' '}يوم <span className="font-mono font-bold">{startDayName}</span></> : null}
                    {' '}الساعة <span className="font-mono font-bold" dir="ltr">6 صباحاً</span>
                    {' '}— إلى تاريخ <span className="font-mono font-bold" dir="ltr">{periodEnd || '—'}</span>
                    {' '}الساعة <span className="font-mono font-bold" dir="ltr">6 مساءً</span>
                  </>
                ) : null}
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-1.5 pt-1.5">
              <span className="font-bold text-[12px]">الأجرة:</span>
              <span className="text-[11px]">
                {rentNote && rentNote.trim().length > 0 ? (
                  rentNote
                ) : (
                  <>
                    {(() => {
                      if (!isDailyBooking && !isAnnualContract) {
                        const monthsQty = Math.max(1, monthsTotalContract);
                        const baseSubtotal = invoiceSubtotal != null ? Number(invoiceSubtotal) : null;
                        const discount = Number(invoiceDiscount || 0);
                        const extras = Number(invoiceAdditionalServices || 0);
                        const net = computedInvoiceTotal != null
                          ? Number(computedInvoiceTotal)
                          : (baseSubtotal != null ? Math.max(0, baseSubtotal - discount + extras) : null);
                        const perMonthFromFinal = net != null ? (net / monthsQty) : null;
                        return (
                          <>
                            {perMonthFromFinal != null ? (
                              <>
                                الأجرة الشهرية:{' '}
                                <span className="font-extrabold font-mono" dir="ltr">
                                  {Math.round(perMonthFromFinal).toLocaleString('en-US')}
                                </span>{' '}
                                ريال
                              </>
                            ) : null}
                            {net != null ? (
                              <>
                                {' '}— الإجمالي النهائي للعقد:{' '}
                                <span className="font-extrabold font-mono" dir="ltr">{Math.round(net).toLocaleString('en-US')}</span>{' '}
                                ريال
                              </>
                            ) : null}
                          </>
                        );
                      }

                      return (
                        <>
                          {isDailyBooking ? 'اليومية' : (isAnnualContract ? 'السنوية' : 'الشهرية')}:{' '}
                          {rentUnitAmountFromInvoice != null ? (
                            <span className="font-extrabold font-mono" dir="ltr">{rentUnitAmountFromInvoice.toLocaleString('en-US')}</span>
                          ) : isDailyBooking && dailyPrice != null ? (
                            <span className="font-extrabold font-mono" dir="ltr">{Number(dailyPrice).toLocaleString('en-US')}</span>
                          ) : isAnnualContract && yearlyRent != null ? (
                            <span className="font-extrabold font-mono" dir="ltr">{yearlyRent.toLocaleString('en-US')}</span>
                          ) : monthlyRent != null ? (
                            <span className="font-extrabold font-mono" dir="ltr">{monthlyRent.toLocaleString('en-US')}</span>
                          ) : (
                            '____'
                          )}{' '}ريال{!isDailyBooking && !isAnnualContract ? ' (للشهر الواحد)' : ''}
                          {isDailyBooking ? '' : ' (شامل الخدمات)'}
                          {totalRent != null ? <> {' '}— إجمالي الأجرة: <span className="font-extrabold font-mono" dir="ltr">{totalRent.toLocaleString('en-US')}</span> ريال</> : null}
                          {hasDiscount ? (
                            <>
                              {' '}— خصم:{' '}
                              <span className="font-extrabold font-mono" dir="ltr">{Number(invoiceDiscount || 0).toLocaleString('en-US')}</span>{' '}
                              ريال
                            </>
                          ) : null}
                          {isCustomSubtotal ? (
                            <>
                              {' '}— سعر مخصص للإيجار (قبل الخصم):{' '}
                              <span className="font-extrabold font-mono" dir="ltr">{Number(invoiceSubtotal || 0).toLocaleString('en-US')}</span>{' '}
                              ريال
                            </>
                          ) : null}
                        </>
                      );
                    })()}
                    {!isDailyBooking && depositAmountFromVouchers != null && depositAmountFromVouchers > 0 ? (
                      <>
                        {' '}— التأمين:{' '}
                        <span className="font-extrabold font-mono" dir="ltr">{depositAmount.toLocaleString('en-US')}</span>{' '}ريال
                      </>
                    ) : null}
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1">
            <div className="border border-gray-300 rounded-lg p-2 space-y-1.5 text-[10px]">
              <h3 className="font-bold text-[12px]">الصيانة</h3>
              <ul className="list-disc pr-4 space-y-1">
                <li>سوء الاستخدام على الطرف الثاني</li>
                <li>الأعطال الفنية على الطرف الأول</li>
              </ul>
            </div>
            <div className="border border-gray-300 rounded-lg p-2 space-y-1.5 text-[9px]">
              <h3 className="font-bold text-[12px]">الإنهاء</h3>
              <p className="text-[10px]">
                يحق للمؤجر فسخ العقد عند التأخر بالسداد أو الإزعاج أو إساءة الاستخدام.
              </p>
              <p className="text-[10px]">
               في العقود الشهرية، عند انتهاء مدة العقد ولم يتم إشعار الإدارة قبل 7 أيام بالتمديد، يحق للطرف الأول إنهاء العقد، ويلتزم الطرف الثاني
               بالإخلاء الفوري للوحدة في تاريخ نهاية العقد  حسب المدة المحددة .
              </p>
            </div>
          </div>
        </section>

        <section className="contract-conditions mt-2 border border-gray-300 rounded-lg p-3">
          <h3 className="font-bold text-sm mb-2">الشروط والأحكام - التزامات الطرف الثاني</h3>
          <ul className="list-disc pr-4 space-y-1 text-[10px] leading-relaxed">
            <li>مراعاة السلوك والآداب الإسلامية، وعدم السماح بغير المرافقين، والالتزام بالهدوء وعدم إزعاج الآخرين.</li>
            <li>الطرف الثاني مسؤول عن كامل محتويات الشقة، المحافظة عليها، وتعويض أي تلف، ولا يجوز تحويل العهدة إلى شخص آخر.</li>
            <li>إغلاق التكييف والإضاءة والأجهزة الكهربائية عند المغادرة، ويتحمل المسؤولية عن أي أخطار.</li>
            <li>يحق للطرف الأول (أو ممثله) دخول الشقة للصيانة أو المعاينة بعد إشعار الطرف الثاني، كما يحق له الإخلاء الفوري عند استخدام الوحدة بشكل غير نظامي.</li>
<li>يتحمل الطرف الثاني كامل المسؤولية عن الشقة ومحتوياتها، وأي أضرار ناتجة عن سوء الاستخدام أو الإهمال، ويلتزم بتسليمها بالحالة المستلمة عليها.</li>
<li>يلتزم الطرف الثاني بسداد الإيجار في موعده، ويحق للطرف الأول عند التأخر فرض غرامة أو فسخ العقد دون إشعار.</li>
<li>يجب الالتزام بعدد الأشخاص المحدد، ويُمنع التأجير من الباطن أو إقامة التجمعات دون موافقة الإدارة، ويعد الإخلال سبباً لفسخ العقد.</li>
<li>لا يتحمل الطرف الأول مسؤولية انقطاع الخدمات الخارجة عن إرادته، ويحق له التصرف بالممتلكات المتروكة بعد (15) يوماً دون مسؤولية.</li>
            <li>يُدفع الإيجار مقدماً، وعند انتهاء مدة العقد وعدم الإخلاء في الموعد المحدد يتم احتساب (300) ريال كشرط جزائي عن كل يوم تأخير.</li>
            <li>عند التغيب بعد انتهاء العقد بثلاثة أيام، يحق للطرف الأول فتح الشقة والتصرف فيها ورفع الممتلكات إلى المستودع دون مسؤولية، ويُعتبر العقد لاغياً.</li>
            <li>الطرف الأول غير مسؤول عن فقدان الأشياء الثمينة الخاصة بالطرف الثاني داخل الشقة.</li>
            <li>لا يحق استرداد قيمة الإيجار عند المغادرة قبل انتهاء المدة المتفق عليها.</li>
            <li>عند رغبة التجديد أو الإخلاء، يجب إشعار الطرف الأول قبل انتهاء المدة بفترة مناسبة لا تقل عن 7 أيام.</li>
            <li>الإخلال بأي شرط يُلغي العقد، ويحق للطرف الأول فسخه دون إنذار مسبق.</li>
            <li>يمنع التأجير من الباطن.</li>
          </ul>
        </section>
        

        <ContractSignature portalPad 
          reference={data.id}
          customerName={booking?.customer?.full_name || '—'} 
          agentName={agentName}
          agentTitle={agentTitle}
        />
        
       

  </article>;
}

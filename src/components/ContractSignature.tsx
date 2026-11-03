'use client';

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import qrcode from 'qrcode-generator';
import { PenLine, X } from 'lucide-react';
import SignaturePad from './SignaturePad';

interface ContractSignatureProps {
  customerName: string;
  agentName?: string;
  agentTitle?: string;
  portalPad?: boolean;
  reference?: string;
}

export default function ContractSignature({ customerName, agentName, agentTitle, portalPad = false, reference = '' }: ContractSignatureProps) {
  const [showPad, setShowPad] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const qr = useMemo(() => {
    if (!portalPad) return '';
    const code = qrcode(0, 'M');
    code.addData(`CONTRACT:${reference};Signature:${signature ? 'YES' : 'NO'}`, 'Byte');
    code.make();
    return code.createSvgTag({ cellSize: 2, margin: 8, scalable: true });
  }, [portalPad, reference, signature]);

  const handleSave = (dataUrl: string) => {
    setSignature(dataUrl);
    setShowPad(false);
  };

  return (
    <section className="contract-signature mt-1 text-xs relative group/sig">
      {/* Signature Button - Hidden during print */}
      {!signature && (
        <div className={portalPad ? 'mb-2 print:hidden' : 'absolute -top-10 left-0 print:hidden opacity-0 group-hover/sig:opacity-100 transition-opacity'}>
          <button
            onClick={() => setShowPad(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm text-[11px] transition-all active:scale-95"
          >
            <PenLine size={14} />
            <span>توقيع إلكتروني</span>
          </button>
        </div>
      )}

      {signature && (
        <div className={portalPad ? 'mb-2 print:hidden' : 'absolute -top-8 left-0 print:hidden opacity-0 group-hover/sig:opacity-100 transition-opacity'}>
          <button
            onClick={() => setSignature(null)}
            className="flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100 text-[10px] transition-all"
          >
            <X size={12} />
            <span>حذف التوقيع</span>
          </button>
        </div>
      )}

      <div className={`${portalPad ? 'contract-signature-card' : ''} flex items-center gap-4 p-2 border border-gray-300 rounded-xl bg-white min-h-[80px]`}>
        <div className={`${portalPad ? 'contract-signature-details' : ''} flex-1`}>
          <div className="flex items-center gap-3">
            <span className="font-bold text-gray-900">الطرف الثاني</span>
            <span className="font-medium text-gray-800 text-[11px]">
              {customerName || '—'}
              {agentName ? ` — الموقع نيابة عنه: ${agentName}${agentTitle ? ` (${agentTitle})` : ''}` : ''}
            </span>
          </div>
          <div className="mt-1 flex items-end gap-3 relative">
            <div className={portalPad ? 'w-50 h-10 border-b-2 border-gray-800 relative' : 'w-50 h-4 border-b-2 border-gray-800 relative'}>
              {signature && (
                <img 
                  src={signature} 
                  alt="Signature" 
                  className={portalPad ? 'absolute bottom-1 right-0 h-10 w-auto object-contain pointer-events-none select-none' : 'absolute bottom-[-6px] right-0 h-14 w-auto object-contain pointer-events-none select-none'}
                  style={{ mixBlendMode: 'multiply' }}
                />
              )}
            </div>
            <span className="text-gray-700">الاسم / التوقيع</span>
          </div>
        </div>
        <div className={portalPad ? 'contract-signature-marks' : 'flex flex-col items-center justify-center gap-1'}>
          <div className="flex items-center gap-1">
            {!portalPad && <img src="/masaken.png" alt="Masaken" className="w-12 h-12 border border-gray-300 rounded-lg object-contain bg-white" />}
            {portalPad ? <div className="w-12 h-12" role="img" aria-label="رمز مرجع العقد" dangerouslySetInnerHTML={{ __html: qr }} /> : <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`Signature:${signature ? 'YES' : 'NO'}`)}`} 
              alt="QR" 
              className="w-12 h-12 border border-gray-300 rounded-lg" 
            />}
            <img src="/shmoh.png" alt="Shmoh" className="w-12 h-12 border border-gray-300 rounded-lg object-contain bg-white" />
          </div>
          {!portalPad && <span className="text-[7px] text-gray-600">رمز التحقق</span>}
        </div>
      </div>

      {showPad && (portalPad ? createPortal(<div className="fixed inset-0" style={{ zIndex: 200 }} data-document-signature>
        <SignaturePad onSave={handleSave} onCancel={() => setShowPad(false)} />
      </div>, document.body) : (
        <SignaturePad 
          onSave={handleSave} 
          onCancel={() => setShowPad(false)} 
        />
      ))}
    </section>
  );
}

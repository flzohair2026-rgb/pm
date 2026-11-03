'use client';
import DocumentPrintDialog from './DocumentPrintDialog';
import ReceiptDocument from './ReceiptDocument';
import type { ReceiptDocumentData } from '@/lib/print/receipt-types';

export default function ReceiptPrintDialog({ paymentId, onClose }: { paymentId: string; onClose: () => void }) {
  return <DocumentPrintDialog<ReceiptDocumentData> sourceId={paymentId} kind="receipt" title="سند قبض"
    renderDocument={data => <ReceiptDocument data={data} />} onClose={onClose} />;
}

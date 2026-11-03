export interface ReceiptDocumentData {
  id: string;
  voucherNumber: string;
  date: string;
  invoiceNumber: string;
  amount: number;
  amountWords: string;
  operationType: string;
  paymentMethod: string;
  description: string;
  customer: { name: string; phone: string; nationalId: string; nationality: string; docType: string };
  hotel: { name: string; address: string; cr: string };
  qrData: string;
  printedAt: string;
}

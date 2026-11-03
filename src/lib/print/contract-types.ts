export type ContractDocumentData = Awaited<ReturnType<typeof import('./contract').loadContract>>;

export interface ContractBooking {
  id: string;
  booking_type: string | null;
  check_in: string | null;
  check_out: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  additional_services: { amount?: number | null }[] | null;
  total_price: number | null;
  customer: { full_name: string | null; national_id: string | null; nationality: string | null; phone: string | null; details: string | null } | null;
  unit: { unit_number: string | null; floor: string | number | null;
    unit_type: { name: string | null; description: string | null; annual_price: number | null; daily_price: number | null } | null } | null;
}

export interface ContractOptions {
  agentName?: string;
  agentTitle?: string;
  durationNote?: string;
  rentNote?: string;
}

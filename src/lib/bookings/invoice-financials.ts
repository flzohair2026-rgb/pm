// Keep the established allocation/FIFO calculation unchanged. Cache each result
// only for the lifetime of the input snapshot; callers replace the lookup when
// invoices, allocations, direct payments, or the journal-derived paid total change.
export type InvoiceFinancials = { paid: number; remaining: number; status: string };
type Invoice = { id: string; total_amount?: number | string | null; status?: string; created_at: string };
type Allocation = { invoice_id: string; payment_id: string; amount?: number | string | null };
type Payment = { id: string; invoice_id?: string | null; amount?: number | string | null };

export function createInvoiceFinancialsLookup(invoices: Invoice[], allocations: Allocation[], directPayments: Payment[], paidAmount: number) {
  const results = new Map<string, InvoiceFinancials>();
  const calculate = (invoiceId: string): InvoiceFinancials => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return { paid: 0, remaining: 0, status: 'draft' };
    
    const total = Number(inv.total_amount) || 0;
    if (inv.status === 'void') return { paid: 0, remaining: 0, status: 'void' };
    if (inv.status === 'draft') return { paid: 0, remaining: total, status: 'draft' };

    // 1. Explicitly linked payments (Direct or Allocated)
    let explicitlyPaid = 0;
    const processedPaymentIdsForThisInv = new Set<string>();

    // First, sum allocations for this invoice
    const invoiceAllocations = (allocations || []).filter(a => a.invoice_id === invoiceId);
    invoiceAllocations.forEach(a => {
      explicitlyPaid += (Number(a.amount) || 0);
      processedPaymentIdsForThisInv.add(a.payment_id);
    });

    // Then, add direct payments that don't have ANY allocations
    const directLinks = (directPayments || []).filter(p => p.invoice_id === invoiceId && !processedPaymentIdsForThisInv.has(p.id));
    directLinks.forEach(p => {
      const hasAnyAlloc = (allocations || []).some(a => a.payment_id === p.id);
      if (!hasAnyAlloc) {
        explicitlyPaid += (Number(p.amount) || 0);
      }
    });
    
    // 2. Unallocated Payments for this booking (FIFO)
    // Total Paid for booking (truth from journal entries)
    const bookingTotalPaid = paidAmount;
    
    // Sum of ALL explicit payments across ALL invoices
    const allInvoicesExplicitlyPaid = invoices.reduce((sum, currentInv) => {
        if (currentInv.status === 'void' || currentInv.status === 'draft') return sum;
        
        let invExplicit = 0;
        const invAllocs = (allocations || []).filter(a => a.invoice_id === currentInv.id);
        const invProcessedIds = new Set<string>();
        invAllocs.forEach(a => {
          invExplicit += (Number(a.amount) || 0);
          invProcessedIds.add(a.payment_id);
        });

        const invDirects = (directPayments || []).filter(p => p.invoice_id === currentInv.id && !invProcessedIds.has(p.id));
        invDirects.forEach(p => {
          const hasAnyAlloc = (allocations || []).some(a => a.payment_id === p.id);
          if (!hasAnyAlloc) invExplicit += (Number(p.amount) || 0);
        });

        return sum + invExplicit;
    }, 0);
    
    let unallocated = Math.max(0, bookingTotalPaid - allInvoicesExplicitlyPaid);
    
    // Distribute unallocated to invoices in order of creation (FIFO)
    let currentPaid = explicitlyPaid;
    const sortedActiveInvoices = [...invoices]
        .filter(i => i.status !== 'void' && i.status !== 'draft')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    for (const i of sortedActiveInvoices) {
        const iTotal = Number(i.total_amount) || 0;
        
        let iExplicit = 0;
        const iAllocs = (allocations || []).filter(a => a.invoice_id === i.id);
        const iProcIds = new Set<string>();
        iAllocs.forEach(a => {
          iExplicit += (Number(a.amount) || 0);
          iProcIds.add(a.payment_id);
        });
        const iDirects = (directPayments || []).filter(p => p.invoice_id === i.id && !iProcIds.has(p.id));
        iDirects.forEach(p => {
          if (!(allocations || []).some(a => a.payment_id === p.id)) iExplicit += (Number(p.amount) || 0);
        });

        const iRemaining = Math.max(0, iTotal - iExplicit);
        
        const fromUnallocated = Math.min(iRemaining, unallocated);
        if (i.id === invoiceId) {
            currentPaid += fromUnallocated;
            break;
        }
        unallocated -= fromUnallocated;
    }

    const remaining = Math.max(0, total - currentPaid);
    const status = remaining <= 0.01 ? 'paid' : 'posted';
    
    return { paid: currentPaid, remaining, status };
    };
  return (invoiceId: string): InvoiceFinancials => {
    const cached = results.get(invoiceId);
    if (cached) return cached;
    const result = calculate(invoiceId);
    results.set(invoiceId, result);
    return result;
  };
}

/**
 * Baseline = giá PR từng item (Requestor nhập).
 * So sánh đơn giá NCC với đơn giá baseline từng item.
 * Chỉ cần 1 item vượt → báo giá đó bị đánh dấu "over baseline".
 */

export interface PRItemBaseline {
  id: string;
  lineNo: number;
  unitPrice: number | null;
  amount: number | null;
  qty: number;
}

export interface QuotationItemForBaseline {
  purchaseRequestItemId: string | null;
  unitPrice: number;
  lineNo?: number;
}

export interface ItemBaselineResult {
  purchaseRequestItemId: string | null;
  lineNo: number;
  baselineUnitPrice: number | null;
  quotationUnitPrice: number;
  overBaseline: boolean; // true nếu đơn giá NCC > baseline đơn giá
}

export interface QuotationBaselineResult {
  overBaseline: boolean; // true nếu bất kỳ item nào vượt baseline
  items: ItemBaselineResult[];
}

/**
 * Tính baseline cho 1 báo giá: so sánh từng dòng với giá PR (baseline).
 * overBaseline = true nếu có ít nhất 1 item có đơn giá NCC > đơn giá baseline.
 */
export function computeQuotationBaseline(
  prItems: PRItemBaseline[],
  quotationItems: QuotationItemForBaseline[]
): QuotationBaselineResult {
  const prMap = new Map(prItems.map((p) => [p.id, p]));
  const items: ItemBaselineResult[] = [];
  let overBaseline = false;

  for (const qi of quotationItems) {
    const prId = qi.purchaseRequestItemId;
    let baselineUnitPrice: number | null = null;
    
    // Tìm baseline unitPrice từ PR item
    if (prId && prMap.has(prId)) {
      const prItem = prMap.get(prId)!;
      // PR items đã được filter để chỉ có unitPrice > 0, nên không cần check null nữa
      baselineUnitPrice = Number(prItem.unitPrice);
    } else if (prId) {
      // PR item không tồn tại trong map (có thể không có unitPrice hoặc không match)
      console.log(`[computeQuotationBaseline] PR Item ${prId} không tìm thấy trong baseline map`);
    }
    
    const quotationUnitPrice = Number(qi.unitPrice) || 0;
    
    // So sánh: chỉ khi có baselineUnitPrice hợp lệ và quotationUnitPrice > baselineUnitPrice
    const over =
      baselineUnitPrice != null &&
      Number.isFinite(baselineUnitPrice) &&
      baselineUnitPrice > 0 &&
      quotationUnitPrice > baselineUnitPrice;

    if (over) {
      overBaseline = true;
      // Log chi tiết khi phát hiện vượt baseline
      console.log(`[computeQuotationBaseline] ⚠️ Item vượt baseline: PR Item ${prId}, Baseline=${baselineUnitPrice}, Quotation=${quotationUnitPrice}, Vượt=${((quotationUnitPrice - baselineUnitPrice) / baselineUnitPrice * 100).toFixed(2)}%`);
    }
    
    items.push({
      purchaseRequestItemId: prId,
      lineNo: qi.lineNo ?? 0,
      baselineUnitPrice,
      quotationUnitPrice,
      overBaseline: over,
    });
  }

  return { overBaseline, items };
}

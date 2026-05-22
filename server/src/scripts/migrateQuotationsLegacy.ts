/**
 * Nâng cấp báo giá cũ → khớp logic mới (tổng từ dòng, VAT, lead time / BH / ngày giao theo dòng).
 *
 *   npm run migrate-quotations-legacy -- --dry-run
 *   npm run migrate-quotations-legacy -- --confirm
 */
import 'dotenv/config';
import { prisma } from '../config/database';
import {
  coerceToValidCalendarYmd,
  computeLeadTimeDaysFromDelivery,
  desiredDeliveryDateToYmd,
  parseWarrantyMonthsInput,
  todayYmdLocal,
} from '../utils/quotationLeadTime';
import {
  inferVatPercentFromLine,
  mapQuotationItemAmounts,
  normalizeVatPercent,
  roundQuotationQty,
} from '../utils/quotationLine';

function parseHeaderWarrantyMonths(warranty: string | null | undefined): number {
  const n = parseWarrantyMonthsInput(warranty);
  return n != null && n >= 0 ? n : 12;
}

function quotationDateFromCreatedAt(createdAt: Date): string {
  return todayYmdLocal(createdAt);
}

function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const end = new Date(Date.UTC(y, m - 1, d + days));
  return coerceToValidCalendarYmd(todayYmdLocal(end));
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const confirm = process.argv.includes('--confirm');

  if (!dryRun && !confirm) {
    console.log('Chạy với --dry-run (xem trước) hoặc --confirm (ghi DB).');
    process.exit(1);
  }

  const quotations = await prisma.quotation.findMany({
    where: { deletedAt: null },
    include: {
      items: {
        where: { deletedAt: null },
        include: {
          purchaseRequestItem: {
            select: { desiredDeliveryDate: true },
          },
        },
        orderBy: { lineNo: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  let updatedQuotations = 0;
  let updatedItems = 0;

  for (const q of quotations) {
    if (!q.items.length) continue;

    const quoteYmd = quotationDateFromCreatedAt(q.createdAt);
    const headerLead = q.leadTime != null && q.leadTime >= 1 ? q.leadTime : null;
    const headerWarrantyMonths = parseHeaderWarrantyMonths(q.warranty);

    const itemUpdates: Array<{
      id: string;
      totalPrice: number;
      vatPercent: number;
      leadTimeDays: number;
      warrantyMonths: number;
      deliveryDateYmd: string;
    }> = [];

    for (const it of q.items) {
      const qty = roundQuotationQty(Number(it.qty));
      const unitPrice = Math.round(Number(it.unitPrice));
      let vatPercent = normalizeVatPercent(it.vatPercent);
      const oldTotal = Math.round(Number(it.totalPrice));
      const inferred = inferVatPercentFromLine(qty, unitPrice, oldTotal);
      if (inferred != null) vatPercent = inferred;

      const { totalPrice, vatPercent: vat } = mapQuotationItemAmounts({
        qty,
        unitPrice,
        vatPercent,
      });

      const buyerYmd = desiredDeliveryDateToYmd(it.purchaseRequestItem?.desiredDeliveryDate);
      let deliveryYmd =
        it.deliveryDate != null
          ? coerceToValidCalendarYmd(todayYmdLocal(it.deliveryDate))
          : buyerYmd;

      let leadTimeDays = it.leadTimeDays ?? null;
      if (deliveryYmd) {
        const calc = computeLeadTimeDaysFromDelivery(deliveryYmd, quoteYmd);
        if (calc.leadTimeDays) {
          leadTimeDays = calc.leadTimeDays;
          deliveryYmd = calc.deliveryDateYmd ?? deliveryYmd;
        }
      }
      if (leadTimeDays == null && headerLead != null) {
        leadTimeDays = headerLead;
        if (!deliveryYmd) deliveryYmd = addDaysToYmd(quoteYmd, headerLead);
      }
      if (leadTimeDays == null && deliveryYmd) {
        const calcOnly = computeLeadTimeDaysFromDelivery(deliveryYmd, quoteYmd);
        leadTimeDays = calcOnly.leadTimeDays ?? null;
      }
      if (leadTimeDays == null) leadTimeDays = 30;
      if (!deliveryYmd) deliveryYmd = addDaysToYmd(quoteYmd, leadTimeDays);

      const warrantyMonths =
        it.warrantyMonths != null && it.warrantyMonths >= 0
          ? it.warrantyMonths
          : headerWarrantyMonths;

      const changed =
        Math.round(Number(it.totalPrice)) !== totalPrice ||
        normalizeVatPercent(it.vatPercent) !== vat ||
        it.leadTimeDays !== leadTimeDays ||
        it.warrantyMonths !== warrantyMonths ||
        (it.deliveryDate == null
          ? deliveryYmd !== ''
          : coerceToValidCalendarYmd(todayYmdLocal(it.deliveryDate)) !== deliveryYmd);

      if (changed) {
        itemUpdates.push({
          id: it.id,
          totalPrice,
          vatPercent: vat,
          leadTimeDays,
          warrantyMonths,
          deliveryDateYmd: deliveryYmd,
        });
      }
    }

    const resolvedLines = q.items.map((it) => {
      const u = itemUpdates.find((x) => x.id === it.id);
      if (u) return u;
      const qty = roundQuotationQty(Number(it.qty));
      const unitPrice = Math.round(Number(it.unitPrice));
      const vatPercent = normalizeVatPercent(it.vatPercent);
      const { totalPrice } = mapQuotationItemAmounts({ qty, unitPrice, vatPercent });
      let leadTimeDays = it.leadTimeDays ?? headerLead ?? 30;
      let deliveryDateYmd =
        it.deliveryDate != null
          ? coerceToValidCalendarYmd(todayYmdLocal(it.deliveryDate))
          : desiredDeliveryDateToYmd(it.purchaseRequestItem?.desiredDeliveryDate) ||
            addDaysToYmd(quoteYmd, leadTimeDays);
      const warrantyMonths =
        it.warrantyMonths != null && it.warrantyMonths >= 0
          ? it.warrantyMonths
          : headerWarrantyMonths;
      return {
        id: it.id,
        totalPrice,
        vatPercent,
        leadTimeDays,
        warrantyMonths,
        deliveryDateYmd,
      };
    });

    const newTotal = Math.round(
      resolvedLines.reduce((sum, line) => sum + line.totalPrice, 0) * 100
    ) / 100;
    const newLeadTime = Math.max(...resolvedLines.map((l) => l.leadTimeDays), 1);
    const newWarrantyMax = Math.max(...resolvedLines.map((l) => l.warrantyMonths));
    const newWarranty = `${newWarrantyMax} tháng`;

    const headerChanged =
      Math.round(Number(q.totalAmount)) !== newTotal ||
      q.leadTime !== newLeadTime ||
      q.warranty !== newWarranty;

    const needsWrite =
      itemUpdates.length > 0 ||
      headerChanged ||
      resolvedLines.some((line) => {
        const it = q.items.find((i) => i.id === line.id)!;
        return (
          Math.round(Number(it.totalPrice)) !== line.totalPrice ||
          q.leadTime !== newLeadTime
        );
      });

    if (!needsWrite) continue;

    console.log(
      `[${dryRun ? 'DRY' : 'OK'}] ${q.quotationNumber ?? q.id.slice(0, 8)} — tổng ${Number(q.totalAmount)} → ${newTotal}, ` +
        `${itemUpdates.length} dòng cập nhật, lead ${q.leadTime} → ${newLeadTime}`
    );

    if (!dryRun && confirm) {
      await prisma.$transaction(async (tx) => {
        for (const line of resolvedLines) {
          const it = q.items.find((i) => i.id === line.id)!;
          const lineDirty =
            Math.round(Number(it.totalPrice)) !== line.totalPrice ||
            normalizeVatPercent(it.vatPercent) !== line.vatPercent ||
            it.leadTimeDays !== line.leadTimeDays ||
            it.warrantyMonths !== line.warrantyMonths ||
            (it.deliveryDate == null
              ? true
              : coerceToValidCalendarYmd(todayYmdLocal(it.deliveryDate)) !== line.deliveryDateYmd);
          if (!lineDirty) continue;
          await tx.quotationItem.update({
            where: { id: line.id },
            data: {
              totalPrice: line.totalPrice,
              vatPercent: line.vatPercent,
              leadTimeDays: line.leadTimeDays,
              warrantyMonths: line.warrantyMonths,
              deliveryDate: new Date(`${line.deliveryDateYmd}T00:00:00.000Z`),
            },
          });
          updatedItems++;
        }
        if (headerChanged) {
          await tx.quotation.update({
            where: { id: q.id },
            data: {
              totalAmount: newTotal,
              leadTime: newLeadTime,
              warranty: newWarranty,
            },
          });
          updatedQuotations++;
        }
      });
    } else {
      updatedItems += resolvedLines.length;
      if (headerChanged) updatedQuotations++;
    }
  }

  console.log(
    `\n${dryRun ? 'Dry-run' : 'Hoàn tất'}: ${updatedQuotations} báo giá header, ${updatedItems} dòng item (trong ${quotations.length} báo giá).`
  );
  if (dryRun) console.log('Chạy lại với --confirm để ghi vào DB.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

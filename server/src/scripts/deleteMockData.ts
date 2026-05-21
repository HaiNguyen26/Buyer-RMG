import 'dotenv/config';
import { prisma } from '../config/database';

function mockStringWhere(field: string) {
  return [
    { [field]: { startsWith: 'MOCK-' } },
    { [field]: { startsWith: 'Mock-' } },
    { [field]: { startsWith: 'mock-' } },
  ] as any[];
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.error('\n❌ Thiếu cờ --confirm. Ví dụ: npx tsx src/scripts/deleteMockData.ts --confirm\n');
    process.exit(1);
  }

  console.log('\n🧹 ========== DELETE MOCK DATA ONLY ==========');
  console.log('🎯 Mục tiêu: chỉ xóa dữ liệu có mã bắt đầu MOCK- (không đụng dữ liệu thật).\n');

  const mockPRs = await prisma.purchaseRequest.findMany({
    where: { OR: mockStringWhere('prNumber') },
    select: { id: true, prNumber: true },
  });
  const mockPRIds = mockPRs.map((x) => x.id);

  const mockRFQs = await prisma.rFQ.findMany({
    where: {
      OR: [
        ...mockStringWhere('rfqNumber'),
        ...(mockPRIds.length ? [{ purchaseRequestId: { in: mockPRIds } }] : []),
      ],
    },
    select: { id: true, rfqNumber: true },
  });
  const mockRFQIds = mockRFQs.map((x) => x.id);

  const mockPOs = await prisma.purchaseOrder.findMany({
    where: {
      OR: [
        ...mockStringWhere('poNumber'),
        ...(mockPRIds.length ? [{ purchaseRequestId: { in: mockPRIds } }] : []),
      ],
    },
    select: { id: true, poNumber: true },
  });
  const mockPOIds = mockPOs.map((x) => x.id);

  const mockSalesPOs = await prisma.salesPO.findMany({
    where: {
      OR: [
        ...mockStringWhere('salesPONumber'),
        ...mockStringWhere('customerPONumber'),
        ...mockStringWhere('projectCode'),
      ],
    },
    select: { id: true },
  });
  const mockSalesPOIds = mockSalesPOs.map((x) => x.id);

  const mockStockIssues = await prisma.stockIssue.findMany({
    where: {
      OR: [
        ...mockStringWhere('issueNumber'),
        ...(mockPRIds.length ? [{ purchaseRequestId: { in: mockPRIds } }] : []),
        ...(mockSalesPOIds.length ? [{ salesPoId: { in: mockSalesPOIds } }] : []),
      ],
    },
    select: { id: true, issueNumber: true },
  });
  const mockStockIssueIds = mockStockIssues.map((x) => x.id);

  const mockStockIssueItems = await prisma.stockIssueItem.findMany({
    where: { stockIssueId: { in: mockStockIssueIds.length ? mockStockIssueIds : ['__none__'] } },
    select: { id: true },
  });
  const mockStockIssueItemIds = mockStockIssueItems.map((x) => x.id);

  const mockGRNs = await prisma.goodsReceipt.findMany({
    where: {
      OR: [
        ...mockStringWhere('grnNumber'),
        ...(mockPOIds.length ? [{ purchaseOrderId: { in: mockPOIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const mockGRNIds = mockGRNs.map((x) => x.id);

  const mockQuotations = await prisma.quotation.findMany({
    where: {
      OR: [
        ...mockStringWhere('quotationNumber'),
        ...(mockRFQIds.length ? [{ rfqId: { in: mockRFQIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const mockQuotationIds = mockQuotations.map((x) => x.id);

  const mockPRItems = await prisma.purchaseRequestItem.findMany({
    where: { purchaseRequestId: { in: mockPRIds.length ? mockPRIds : ['__none__'] } },
    select: { id: true },
  });
  const mockPRItemIds = mockPRItems.map((x) => x.id);

  const mockSuppliers = await prisma.supplier.findMany({
    where: {
      OR: [...mockStringWhere('code'), ...mockStringWhere('name')],
    },
    select: { id: true },
  });
  const mockSupplierIds = mockSuppliers.map((x) => x.id);

  const mockCustomers = await prisma.customer.findMany({
    where: {
      OR: [...mockStringWhere('code'), ...mockStringWhere('name')],
    },
    select: { id: true },
  });
  const mockCustomerIds = mockCustomers.map((x) => x.id);

  console.log(`- PR mock: ${mockPRIds.length}`);
  console.log(`- RFQ mock: ${mockRFQIds.length}`);
  console.log(`- Quotation mock: ${mockQuotationIds.length}`);
  console.log(`- PO mock: ${mockPOIds.length}`);
  console.log(`- Stock Issue mock: ${mockStockIssueIds.length}`);
  console.log(`- Sales PO mock: ${mockSalesPOIds.length}`);
  console.log(`- Supplier mock (code/name): ${mockSupplierIds.length}`);
  console.log(`- Customer mock (code/name): ${mockCustomerIds.length}\n`);

  await prisma.$transaction(async (tx) => {
    const deleted: Record<string, number> = {};
    const del = async (key: string, fn: () => Promise<{ count: number }>) => {
      const r = await fn();
      deleted[key] = r.count;
    };

    await del('inventoryReservations', () =>
      tx.inventoryReservation.deleteMany({
        where: {
          OR: [
            ...(mockStockIssueItemIds.length ? [{ refId: { in: mockStockIssueItemIds } }] : []),
          ],
        },
      })
    );

    await del('stockIssueItems', () =>
      tx.stockIssueItem.deleteMany({
        where: { stockIssueId: { in: mockStockIssueIds.length ? mockStockIssueIds : ['__none__'] } },
      })
    );
    await del('stockIssues', () =>
      tx.stockIssue.deleteMany({
        where: { id: { in: mockStockIssueIds.length ? mockStockIssueIds : ['__none__'] } },
      })
    );

    await del('poAttachments', () =>
      tx.pOAttachment.deleteMany({
        where: { purchaseOrderId: { in: mockPOIds.length ? mockPOIds : ['__none__'] } },
      })
    );

    await del('goodsReceiptLines', () =>
      tx.goodsReceiptLine.deleteMany({
        where: { goodsReceiptId: { in: mockGRNIds.length ? mockGRNIds : ['__none__'] } },
      })
    );
    await del('goodsReceipts', () =>
      tx.goodsReceipt.deleteMany({
        where: { id: { in: mockGRNIds.length ? mockGRNIds : ['__none__'] } },
      })
    );

    await del('poItems', () =>
      tx.pOItem.deleteMany({
        where: { purchaseOrderId: { in: mockPOIds.length ? mockPOIds : ['__none__'] } },
      })
    );
    await del('purchaseOrders', () =>
      tx.purchaseOrder.deleteMany({
        where: { id: { in: mockPOIds.length ? mockPOIds : ['__none__'] } },
      })
    );

    await del('quotationAttachments', () =>
      tx.quotationAttachment.deleteMany({
        where: { quotationId: { in: mockQuotationIds.length ? mockQuotationIds : ['__none__'] } },
      })
    );
    await del('quotationItems', () =>
      tx.quotationItem.deleteMany({
        where: { quotationId: { in: mockQuotationIds.length ? mockQuotationIds : ['__none__'] } },
      })
    );
    await del('supplierSelectionsByQuotation', () =>
      tx.supplierSelection.deleteMany({
        where: { quotationId: { in: mockQuotationIds.length ? mockQuotationIds : ['__none__'] } },
      })
    );
    await del('supplierSelectionsByPR', () =>
      tx.supplierSelection.deleteMany({
        where: { purchaseRequestId: { in: mockPRIds.length ? mockPRIds : ['__none__'] } },
      })
    );
    await del('quotations', () =>
      tx.quotation.deleteMany({
        where: { id: { in: mockQuotationIds.length ? mockQuotationIds : ['__none__'] } },
      })
    );
    await del('rfqs', () =>
      tx.rFQ.deleteMany({
        where: { id: { in: mockRFQIds.length ? mockRFQIds : ['__none__'] } },
      })
    );

    await del('prAssignments', () =>
      tx.pRAssignment.deleteMany({
        where: { purchaseRequestId: { in: mockPRIds.length ? mockPRIds : ['__none__'] } },
      })
    );
    await del('prApprovals', () =>
      tx.pRApproval.deleteMany({
        where: { purchaseRequestId: { in: mockPRIds.length ? mockPRIds : ['__none__'] } },
      })
    );
    await del('budgetExceptions', () =>
      tx.budgetException.deleteMany({
        where: { purchaseRequestId: { in: mockPRIds.length ? mockPRIds : ['__none__'] } },
      })
    );
    await del('payments', () =>
      tx.payment.deleteMany({
        where: { purchaseRequestId: { in: mockPRIds.length ? mockPRIds : ['__none__'] } },
      })
    );
    await del('prAttachments', () =>
      tx.purchaseRequestAttachment.deleteMany({
        where: { purchaseRequestId: { in: mockPRIds.length ? mockPRIds : ['__none__'] } },
      })
    );
    await del('prItemAttachments', () =>
      tx.purchaseRequestItemAttachment.deleteMany({
        where: { purchaseRequestItemId: { in: mockPRItemIds.length ? mockPRItemIds : ['__none__'] } },
      })
    );
    await del('purchaseRequestItems', () =>
      tx.purchaseRequestItem.deleteMany({
        where: { id: { in: mockPRItemIds.length ? mockPRItemIds : ['__none__'] } },
      })
    );
    await del('purchaseRequests', () =>
      tx.purchaseRequest.deleteMany({
        where: { id: { in: mockPRIds.length ? mockPRIds : ['__none__'] } },
      })
    );

    await del('salesPOs', () =>
      tx.salesPO.deleteMany({
        where: { id: { in: mockSalesPOIds.length ? mockSalesPOIds : ['__none__'] } },
      })
    );
    await del('customers', () =>
      tx.customer.deleteMany({
        where: { id: { in: mockCustomerIds.length ? mockCustomerIds : ['__none__'] } },
      })
    );
    await del('suppliers', () =>
      tx.supplier.deleteMany({
        where: { id: { in: mockSupplierIds.length ? mockSupplierIds : ['__none__'] } },
      })
    );

    const totalDeleted = Object.values(deleted).reduce((a, b) => a + b, 0);
    console.log('✅ Deleted rows by table:');
    for (const [k, v] of Object.entries(deleted)) {
      if (v > 0) console.log(`   - ${k}: ${v}`);
    }
    console.log(`\n🎉 Done. Total deleted rows: ${totalDeleted}`);
  }, { timeout: 180000 });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('\n❌ Error while deleting mock data:', error);
    await prisma.$disconnect();
    process.exit(1);
  });

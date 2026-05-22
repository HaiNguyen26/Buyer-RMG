import { FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { auditCreate, auditUpdate, auditDelete } from '../utils/audit';
import { z } from 'zod';

const COUNTRY_CODE_MAP: Record<string, string> = {
  vietnam: 'VN',
  'viet nam': 'VN',
  'việt nam': 'VN',
  vn: 'VN',
  china: 'CN',
  cn: 'CN',
  usa: 'US',
  us: 'US',
  'united states': 'US',
  japan: 'JP',
  jp: 'JP',
  korea: 'KR',
  kr: 'KR',
};

const CATEGORY_CODE_MAP: Record<string, string> = {
  electrical: 'ELE',
  'điện': 'ELE',
  dien: 'ELE',
  mechanical: 'MEC',
  'cơ khí': 'MEC',
  'co khi': 'MEC',
  fabrication: 'FAB',
  'gia công': 'FAB',
  'gia cong': 'FAB',
  services: 'SRV',
  service: 'SRV',
  'dịch vụ': 'SRV',
  'dich vu': 'SRV',
  chemical: 'CHM',
  'hóa chất': 'CHM',
  'hoa chat': 'CHM',
  it: 'ITE',
  technology: 'ITE',
};

const normalizeCountryCode = (country?: string): string => {
  const key = (country || '').trim().toLowerCase();
  return COUNTRY_CODE_MAP[key] || 'VN';
};

const normalizeCategoryCode = (category?: string): string => {
  const key = (category || '').split(',')[0]?.trim().toLowerCase() || '';
  return CATEGORY_CODE_MAP[key] || 'SRV';
};

const formatVendorCode = (countryCode: string, categoryCode: string, sequence: number): string =>
  `VND-${countryCode}-${categoryCode}-${String(sequence).padStart(5, '0')}`;

const getNextVendorSequence = async (): Promise<number> => {
  const suppliers = await prisma.supplier.findMany({
    where: {
      deletedAt: null,
      code: { startsWith: 'VND-' },
    },
    select: { code: true },
  });

  let maxSequence = 0;
  for (const supplier of suppliers) {
    const match = (supplier.code || '').match(/-(\d{5})$/);
    if (!match) continue;
    const value = parseInt(match[1], 10);
    if (Number.isFinite(value) && value > maxSequence) {
      maxSequence = value;
    }
  }

  return maxSequence + 1;
};

// Validation schemas
const createSupplierSchema = z.object({
  name: z.string().min(1, 'Tên NCC là bắt buộc'),
  code: z.string().optional(),
  country: z.string().optional(),
  category: z.string().optional(),
  email: z.string().optional().refine((val) => {
    // If email is provided and not empty, validate it
    if (!val || val.trim() === '') return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(val.trim());
  }, {
    message: 'Email không hợp lệ. Vui lòng nhập email đúng định dạng hoặc để trống.',
  }),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxCode: z.string().optional(),
  contactPerson: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  notes: z.string().optional(),
});

const updateSupplierSchema = createSupplierSchema.partial();
const bulkImportSuppliersSchema = z.object({
  suppliers: z.array(createSupplierSchema).min(1, 'Danh sách NCC import không được rỗng'),
});

// Get Suppliers
export const getSuppliers = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { search, code } = request.query as { search?: string; code?: string };

    const where: any = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (code) {
      where.code = code;
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        _count: {
          select: {
            quotations: {
              where: {
                deletedAt: null,
                status: { in: ['VALID', 'SELECTED'] },
              },
            },
            purchaseRequests: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
      take: 2000,
    });

    const mappedSuppliers = suppliers.map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      code: supplier.code,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      taxCode: supplier.taxCode,
      contactPerson: supplier.contactPerson,
      bankName: supplier.bankName,
      bankAccount: supplier.bankAccount,
      notes: supplier.notes,
      quotationsCount: supplier._count.quotations,
      purchaseRequestsCount: supplier._count.purchaseRequests,
      createdAt: supplier.createdAt.toISOString(),
      updatedAt: supplier.updatedAt.toISOString(),
    }));

    reply.send({ suppliers: mappedSuppliers });
  } catch (error: any) {
    console.error('Get suppliers error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get Supplier by ID
export const getSupplierById = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        quotations: {
          where: { deletedAt: null },
          include: {
            rfq: {
              select: {
                rfqNumber: true,
                purchaseRequest: {
                  select: {
                    prNumber: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        purchaseRequests: {
          where: { deletedAt: null },
          select: {
            id: true,
            prNumber: true,
            status: true,
            totalAmount: true,
            currency: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!supplier) {
      return reply.code(404).send({ error: 'Supplier not found' });
    }

    reply.send({
      id: supplier.id,
      name: supplier.name,
      code: supplier.code,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      taxCode: supplier.taxCode,
      contactPerson: supplier.contactPerson,
      bankName: supplier.bankName,
      bankAccount: supplier.bankAccount,
      notes: supplier.notes,
      recentQuotations: supplier.quotations.map((q: any) => ({
        id: q.id,
        rfqNumber: q.rfq.rfqNumber,
        prNumber: q.rfq.purchaseRequest.prNumber,
        totalAmount: Number(q.totalAmount),
        currency: q.currency,
        status: q.status,
        createdAt: q.createdAt.toISOString(),
      })),
      recentPurchaseRequests: supplier.purchaseRequests.map((pr: any) => ({
        id: pr.id,
        prNumber: pr.prNumber,
        status: pr.status,
        totalAmount: pr.totalAmount ? Number(pr.totalAmount) : null,
        currency: pr.currency,
        createdAt: pr.createdAt.toISOString(),
      })),
      createdAt: supplier.createdAt.toISOString(),
      updatedAt: supplier.updatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error('Get supplier by ID error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Create Supplier
export const createSupplier = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const body = createSupplierSchema.parse(request.body);
    let supplierCode = body.code?.trim() || '';

    if (!supplierCode) {
      const nextSequence = await getNextVendorSequence();
      supplierCode = formatVendorCode(
        normalizeCountryCode(body.country),
        normalizeCategoryCode(body.category),
        nextSequence
      );
    }

    // Check if code already exists
    if (supplierCode) {
      const existing = await prisma.supplier.findFirst({
        where: {
          code: supplierCode,
          deletedAt: null,
        },
      });

      if (existing) {
        return reply.code(400).send({ 
          error: 'Supplier code already exists',
          message: 'Mã nhà cung cấp đã tồn tại. Vui lòng sử dụng mã khác.',
        });
      }
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: body.name.trim(),
        code: supplierCode || null,
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        address: body.address?.trim() || null,
        taxCode: body.taxCode?.trim() || null,
        contactPerson: body.contactPerson?.trim() || null,
        bankName: body.bankName?.trim() || null,
        bankAccount: body.bankAccount?.trim() || null,
        notes: body.notes?.trim() || null,
      },
    });

    // Audit log
    await auditCreate('suppliers', supplier.id, supplier, {
      userId,
      companyId: supplier.companyId || undefined,
    });

    reply.code(201).send({
      id: supplier.id,
      name: supplier.name,
      code: supplier.code,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      taxCode: supplier.taxCode,
      contactPerson: supplier.contactPerson,
      bankName: supplier.bankName,
      bankAccount: supplier.bankAccount,
      notes: supplier.notes,
      createdAt: supplier.createdAt.toISOString(),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation error', details: error.errors });
    }
    console.error('Create supplier error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Bulk Import Suppliers
export const bulkImportSuppliers = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const body = bulkImportSuppliersSchema.parse(request.body);
    const now = new Date();

    const normalizedSuppliers = body.suppliers.map((item, index) => ({
      index,
      name: item.name?.trim() || `Vendor-${index + 1}`,
      code: item.code?.trim() || null,
      country: item.country?.trim() || null,
      category: item.category?.trim() || null,
      email: item.email?.trim() || null,
      phone: item.phone?.trim() || null,
      address: item.address?.trim() || null,
      taxCode: item.taxCode?.trim() || null,
      contactPerson: item.contactPerson?.trim() || null,
      bankName: item.bankName?.trim() || null,
      bankAccount: item.bankAccount?.trim() || null,
      notes: item.notes?.trim() || null,
    }));

    // De-dup in request payload by code/taxCode/name
    const seen = new Set<string>();
    const dedupedSuppliers = normalizedSuppliers.filter((supplier) => {
      const key = `${supplier.code || ''}|${supplier.taxCode || ''}|${supplier.name.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const existingSuppliers = await prisma.supplier.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, taxCode: true, name: true, bankName: true, bankAccount: true },
    });

    const existingCodeSet = new Set(
      existingSuppliers
        .map((s) => s.code?.trim().toLowerCase())
        .filter((v): v is string => Boolean(v))
    );
    const existingTaxSet = new Set(
      existingSuppliers
        .map((s) => s.taxCode?.trim().toLowerCase())
        .filter((v): v is string => Boolean(v))
    );
    const existingNameSet = new Set(existingSuppliers.map((s) => s.name.trim().toLowerCase()));
    const usedCodeSet = new Set(existingCodeSet);
    let nextSequence = await getNextVendorSequence();

    for (const supplier of dedupedSuppliers) {
      if (supplier.code) {
        usedCodeSet.add(supplier.code.toLowerCase());
        continue;
      }

      let generatedCode = formatVendorCode(
        normalizeCountryCode(supplier.country || undefined),
        normalizeCategoryCode(supplier.category || undefined),
        nextSequence
      );

      while (usedCodeSet.has(generatedCode.toLowerCase())) {
        nextSequence += 1;
        generatedCode = formatVendorCode(
          normalizeCountryCode(supplier.country || undefined),
          normalizeCategoryCode(supplier.category || undefined),
          nextSequence
        );
      }

      supplier.code = generatedCode;
      usedCodeSet.add(generatedCode.toLowerCase());
      nextSequence += 1;
    }

    const toCreate = dedupedSuppliers.filter((supplier) => {
      const code = supplier.code?.toLowerCase() || null;
      const taxCode = supplier.taxCode?.toLowerCase() || null;
      const name = supplier.name.toLowerCase();
      if (code && existingCodeSet.has(code)) return false;
      if (taxCode && existingTaxSet.has(taxCode)) return false;
      if (existingNameSet.has(name)) return false;
      return true;
    });

    if (toCreate.length > 0) {
      await prisma.supplier.createMany({
        data: toCreate.map((supplier) => ({
          name: supplier.name,
          code: supplier.code,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          taxCode: supplier.taxCode,
          contactPerson: supplier.contactPerson,
          bankName: supplier.bankName,
          bankAccount: supplier.bankAccount,
          notes: supplier.notes,
          createdAt: now,
          updatedAt: now,
        })),
      });
    }

    const existingByCode = new Map(
      existingSuppliers
        .filter((s) => s.code?.trim())
        .map((s) => [s.code!.trim().toLowerCase(), s.id])
    );
    let bankFieldsUpdated = 0;
    for (const supplier of dedupedSuppliers) {
      const codeKey = supplier.code?.toLowerCase();
      if (!codeKey) continue;
      const existingId = existingByCode.get(codeKey);
      if (!existingId) continue;
      if (!supplier.bankName && !supplier.bankAccount) continue;
      const patch: { bankName?: string | null; bankAccount?: string | null; updatedAt: Date } = {
        updatedAt: now,
      };
      if (supplier.bankName) patch.bankName = supplier.bankName;
      if (supplier.bankAccount) patch.bankAccount = supplier.bankAccount;
      await prisma.supplier.update({ where: { id: existingId }, data: patch });
      bankFieldsUpdated += 1;
    }

    await auditCreate(
      'suppliers',
      `bulk-import-${now.getTime()}`,
      {
        totalReceived: body.suppliers.length,
        dedupedInPayload: dedupedSuppliers.length,
        inserted: toCreate.length,
        skipped: dedupedSuppliers.length - toCreate.length,
        bankFieldsUpdated,
      },
      { userId }
    );

    return reply.code(201).send({
      message: 'Import NCC thành công',
      totalReceived: body.suppliers.length,
      dedupedInPayload: dedupedSuppliers.length,
      inserted: toCreate.length,
      skipped: dedupedSuppliers.length - toCreate.length,
      bankFieldsUpdated,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation error', details: error.errors });
    }
    console.error('Bulk import suppliers error:', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Update Supplier
export const updateSupplier = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };
    const body = updateSupplierSchema.parse(request.body);

    const supplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      return reply.code(404).send({ error: 'Supplier not found' });
    }

    // Check if code already exists (if updating code)
    if (body.code && body.code !== supplier.code) {
      const existing = await prisma.supplier.findFirst({
        where: {
          code: body.code,
          deletedAt: null,
          id: { not: id },
        },
      });

      if (existing) {
        return reply.code(400).send({ error: 'Supplier code already exists' });
      }
    }

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.code !== undefined) updateData.code = body.code || null;
    if (body.email !== undefined) updateData.email = body.email || null;
    if (body.phone !== undefined) updateData.phone = body.phone || null;
    if (body.address !== undefined) updateData.address = body.address || null;
    if (body.taxCode !== undefined) updateData.taxCode = body.taxCode || null;
    if (body.contactPerson !== undefined) updateData.contactPerson = body.contactPerson || null;
    if (body.bankName !== undefined) updateData.bankName = body.bankName?.trim() || null;
    if (body.bankAccount !== undefined) updateData.bankAccount = body.bankAccount?.trim() || null;
    if (body.notes !== undefined) updateData.notes = body.notes || null;

    const updatedSupplier = await prisma.supplier.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await auditUpdate(
      'suppliers',
      id,
      supplier,
      updatedSupplier,
      { userId }
    );

    reply.send({
      id: updatedSupplier.id,
      name: updatedSupplier.name,
      code: updatedSupplier.code,
      email: updatedSupplier.email,
      phone: updatedSupplier.phone,
      address: updatedSupplier.address,
      taxCode: updatedSupplier.taxCode,
      contactPerson: updatedSupplier.contactPerson,
      bankName: updatedSupplier.bankName,
      bankAccount: updatedSupplier.bankAccount,
      notes: updatedSupplier.notes,
      updatedAt: updatedSupplier.updatedAt.toISOString(),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation error', details: error.errors });
    }
    console.error('Update supplier error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Delete Supplier (Soft Delete)
export const deleteSupplier = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        quotations: {
          where: {
            deletedAt: null,
            status: { in: ['VALID', 'SELECTED'] },
          },
        },
        purchaseRequests: {
          where: {
            deletedAt: null,
            status: { not: 'CANCELLED' },
          },
        },
      },
    });

    if (!supplier) {
      return reply.code(404).send({ error: 'Supplier not found' });
    }

    // Check if supplier has active quotations or purchase requests
    if (supplier.quotations.length > 0 || supplier.purchaseRequests.length > 0) {
      return reply.code(400).send({
        error: 'Cannot delete supplier with active quotations or purchase requests',
        activeQuotations: supplier.quotations.length,
        activePurchaseRequests: supplier.purchaseRequests.length,
      });
    }

    // Soft delete
    await prisma.supplier.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    // Audit log
    await auditDelete('suppliers', id, supplier, { userId });

    reply.send({ message: 'Supplier deleted successfully' });
  } catch (error: any) {
    console.error('Delete supplier error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};



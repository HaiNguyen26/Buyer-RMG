import { prisma } from '../config/database';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidLike(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export async function resolveSupplierForQuotationExcelImport(
  supplierId: string | null | undefined,
  supplierName: string | null | undefined
): Promise<{ id: string; name: string } | null> {
  const id = supplierId?.trim();
  if (id && isUuidLike(id)) {
    const byId = await prisma.supplier.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true },
    });
    if (byId) return byId;
  }

  const rawName = supplierName?.trim();
  if (!rawName) return null;

  const tryNames = [rawName, rawName.replace(/\s*\([^)]*\)\s*$/, '').trim()].filter(
    (n, i, arr) => n && arr.indexOf(n) === i
  );

  for (const name of tryNames) {
    const exact = await prisma.supplier.findFirst({
      where: { deletedAt: null, name: { equals: name, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    if (exact) return exact;
  }

  const needle = tryNames[tryNames.length - 1] ?? rawName;
  const fuzzy = await prisma.supplier.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: needle, mode: 'insensitive' } },
        { code: { contains: needle, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true },
    take: 2,
  });
  if (fuzzy.length === 1) return fuzzy[0];

  return null;
}

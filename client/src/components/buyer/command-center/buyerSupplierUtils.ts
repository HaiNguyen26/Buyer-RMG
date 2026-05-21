export type ApiSupplier = {
  id: string;
  name?: string;
  code?: string | null;
  phone?: string | null;
  email?: string | null;
  contactPerson?: string | null;
};

export function mapApiSuppliers(raw: unknown): ApiSupplier[] {
  if (!raw || typeof raw !== 'object' || !('suppliers' in raw)) return [];
  const list = (raw as { suppliers: unknown }).suppliers;
  if (!Array.isArray(list)) return [];
  return list
    .filter((s): s is Record<string, unknown> => s != null && typeof s === 'object')
    .map((s) => ({
      id: String(s.id ?? ''),
      name: typeof s.name === 'string' ? s.name : undefined,
      code: s.code != null ? String(s.code) : null,
      phone: s.phone != null ? String(s.phone) : null,
      email: s.email != null ? String(s.email) : null,
      contactPerson: s.contactPerson != null ? String(s.contactPerson) : null,
    }))
    .filter((s) => s.id && s.name);
}

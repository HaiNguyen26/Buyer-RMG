import { useEffect, useMemo, useState } from 'react';
import { Loader2, BadgeCheck } from 'lucide-react';
import { AppModal } from '../AppModal';
import type { PoDetailUi } from '../../utils/poDetailUiStrings';
import type { PoDisplayLang } from '../../utils/poDisplayLang';
import type { SupplierConfirmBody } from '../../services/buyerService';

export type SupplierConfirmLineItem = {
  id: string;
  lineNo?: number;
  description: string;
  qty: number;
  confirmedQty?: number | null;
  expectedDeliveryDate?: string | null;
};

type LineDraft = {
  poItemId: string;
  description: string;
  orderedQty: number;
  confirmedQty: string;
  expectedDeliveryDate: string;
};

type POSupplierConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  mode: 'initial' | 'update';
  items: SupplierConfirmLineItem[];
  defaultDeliveryDate?: string | null;
  onSubmit: (body: SupplierConfirmBody) => void;
  isPending?: boolean;
  lang: PoDisplayLang;
  t: PoDetailUi;
};

function defaultEta(iso: string | null | undefined): string {
  if (!iso?.trim()) return '';
  return iso.slice(0, 10);
}

function parseQty(raw: string): number | null {
  const n = parseFloat(raw.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 1000) / 1000;
}

export function POSupplierConfirmModal({
  open,
  onClose,
  mode,
  items,
  defaultDeliveryDate,
  onSubmit,
  isPending = false,
  lang,
  t,
}: POSupplierConfirmModalProps) {
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    const fallbackEta = defaultEta(defaultDeliveryDate);
    setLines(
      items.map((it) => ({
        poItemId: it.id,
        description: it.description,
        orderedQty: Number(it.qty),
        confirmedQty:
          it.confirmedQty != null
            ? String(it.confirmedQty)
            : String(it.qty),
        expectedDeliveryDate:
          defaultEta(it.expectedDeliveryDate) || fallbackEta,
      }))
    );
    setNote('');
  }, [open, items, defaultDeliveryDate]);

  const validationError = useMemo(() => {
    if (!lines.length) return t.confirmModalNoLines;
    for (const row of lines) {
      const q = parseQty(row.confirmedQty);
      if (q === null) return t.confirmModalQtyInvalid;
      if (q > row.orderedQty + 1e-6) return t.confirmModalQtyOver;
      if (q > 0 && !row.expectedDeliveryDate.trim()) return t.confirmModalEtaRequired;
    }
    const anyPositive = lines.some((r) => (parseQty(r.confirmedQty) ?? 0) > 0);
    if (!anyPositive) return t.confirmModalNeedOneLine;
    return null;
  }, [lines, t]);

  const handleSubmit = () => {
    if (validationError || isPending) return;
    const payload: SupplierConfirmBody = {
      lines: lines
        .map((row) => ({
          poItemId: row.poItemId,
          confirmedQty: parseQty(row.confirmedQty) ?? 0,
          expectedDeliveryDate: row.expectedDeliveryDate.trim(),
        }))
        .filter((l) => l.confirmedQty > 0),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    onSubmit(payload);
  };

  const title = mode === 'update' ? t.updateSupplierConfirm : t.confirmModalTitle;
  const submitLabel = mode === 'update' ? t.updateSupplierConfirmSubmit : t.confirmModalSubmit;

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="3xl"
      title={title}
      subtitle={t.confirmModalSubtitle}
      headerIcon={<BadgeCheck className="h-5 w-5 text-emerald-600" strokeWidth={2} />}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {t.cancelModalClose}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!!validationError || isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitLabel}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{t.confirmModalHint}</p>
        {validationError ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {validationError}
          </p>
        ) : null}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[720px] w-full text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-3 py-2.5 text-left">{t.thLine}</th>
                <th className="px-3 py-2.5 text-left">{t.thDesc}</th>
                <th className="px-3 py-2.5 text-right">{t.thQty}</th>
                <th className="px-3 py-2.5 text-right">{t.thConfirmedQty}</th>
                <th className="px-3 py-2.5 text-left">{t.thEta}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((row, idx) => (
                <tr key={row.poItemId}>
                  <td className="px-3 py-2 text-slate-600">{idx + 1}</td>
                  <td className="max-w-xs px-3 py-2 text-slate-800">{row.description}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{row.orderedQty}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.confirmedQty}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l) =>
                            l.poItemId === row.poItemId ? { ...l, confirmedQty: e.target.value } : l
                          )
                        )
                      }
                      className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right tabular-nums outline-none ring-emerald-500/30 focus:ring-2"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={row.expectedDeliveryDate}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l) =>
                            l.poItemId === row.poItemId
                              ? { ...l, expectedDeliveryDate: e.target.value }
                              : l
                          )
                        )
                      }
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none ring-emerald-500/30 focus:ring-2"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">{t.lblNote}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={lang === 'vi' ? 'Ghi chú xác nhận NCC (tuỳ chọn)' : 'Supplier confirmation note (optional)'}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:ring-2"
          />
        </label>
      </div>
    </AppModal>
  );
}

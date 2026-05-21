import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  Calendar,
  FileText,
  MapPin,
  Percent,
  Phone,
  Store,
  Truck,
  Wallet,
  Zap,
} from 'lucide-react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { PO_PDF_BUYER_COMPANY } from '../../utils/poPdf';
import type { PoDetailUi } from '../../utils/poDetailUiStrings';
import type { PoDisplayLang } from '../../utils/poDisplayLang';
import {
  PoCanvasDocSection,
  poCanvasLabelClass,
} from './poDetailCanvasUi';

const fieldInputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20';

const fieldLabelClass = 'mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400';

const sheetPad = 'px-6 py-6 sm:px-8';
const emptyItalicClass = 'text-sm italic text-slate-400';

/** Cột tài khoản / ngân hàng bên phải — vạch dọc mảnh như bản in PO. */
const bankAsideColumnClass =
  'space-y-3 border-t border-slate-200/90 pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0';
const bankAsideMainColumnClass = 'space-y-3 lg:pr-7';

function sheetLabels(lang: PoDisplayLang) {
  const vi = lang === 'vi';
  return {
    buyerTitle: vi ? 'BÊN MUA (BUYER)' : 'BUYER',
    supplierTitle: vi ? 'NHÀ CUNG CẤP (VENDOR)' : 'VENDOR',
    termsTitle: vi ? 'ĐIỀU KHOẢN & GIAO NHẬN' : 'TERMS & DELIVERY',
    unitName: vi ? 'Tên đơn vị' : 'Company',
    officeAddress: vi ? 'Địa chỉ văn phòng' : 'Office address',
    transactionBank: vi ? 'Ngân hàng giao dịch' : 'Transaction bank',
    paymentAccounts: vi ? 'Số tài khoản thanh toán' : 'Payment accounts',
    taxId: vi ? 'Mã số thuế (MST)' : 'Tax ID',
    branchAddress: vi ? 'Địa chỉ chi nhánh' : 'Branch address',
    supplierName: vi ? 'Tên nhà cung cấp' : 'Supplier name',
    beneficiaryBank: vi ? 'Tài khoản thụ hưởng' : 'Beneficiary bank',
    accountNo: vi ? 'Số tài khoản' : 'Account number',
    deliveryDate: vi ? 'Ngày giao hàng' : 'Delivery date',
    notUpdated: vi ? '(Chưa cập nhật)' : '(Not updated)',
    noDeliveryAddr: vi ? '(Chưa cập nhật địa chỉ kho nhận)' : '(Warehouse delivery address not set)',
    noNote: vi ? '(Không có ghi chú bổ sung)' : '(No additional notes)',
  };
}

function splitBuyerBankAccounts(raw: string): string[] {
  return raw.split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean);
}

function parseAccountPill(acc: string): { prefix: string; number: string } {
  const m = acc.match(/^(.+?)\s*\((VND|USD)\)\s*$/i);
  if (m) return { prefix: `${m[2].toUpperCase()}:`, number: m[1].trim() };
  return { prefix: '', number: acc };
}

function SheetSectionHeader({
  icon: Icon,
  iconWrapClass,
  iconClass,
  ringClass,
  title,
}: {
  icon: LucideIcon;
  iconWrapClass: string;
  iconClass: string;
  ringClass?: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={[
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1',
          iconWrapClass,
          ringClass ?? 'ring-transparent',
        ].join(' ')}
        aria-hidden
      >
        <Icon className={`h-[18px] w-[18px] ${iconClass}`} strokeWidth={2.25} />
      </span>
      <h3 className="text-sm font-bold tracking-wide text-slate-900">{title}</h3>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{children}</p>;
}

function FieldLabelRow({
  icon: Icon,
  iconWrapClass,
  iconClass,
  children,
}: {
  icon: LucideIcon;
  iconWrapClass: string;
  iconClass: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 ring-slate-100/90 ${iconWrapClass}`}
        aria-hidden
      >
        <Icon className={`h-3 w-3 ${iconClass}`} strokeWidth={2.25} />
      </span>
      <FieldLabel>{children}</FieldLabel>
    </div>
  );
}

function ValueBox({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 ${className}`}
    >
      {children}
    </div>
  );
}

function PlaceholderText({ children }: { children: ReactNode }) {
  return <span className="text-sm italic text-slate-400">{children}</span>;
}

function PoTotalHighlight({
  label,
  amount,
  currency,
  numLocale,
  className = '',
}: {
  label: string;
  amount: number | null | undefined;
  currency: string | null | undefined;
  numLocale: string;
  className?: string;
}) {
  const cur = currency ?? 'VND';
  const amountStr = amount != null ? Number(amount).toLocaleString(numLocale) : '\u2014';

  return (
    <div
      className={['w-full overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm', className].join(
        ' ',
      )}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/95 px-3 py-1.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-teal-100 ring-1 ring-teal-200/80">
          <Wallet className="h-3.5 w-3.5 text-teal-700" strokeWidth={2.25} aria-hidden />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <div className="bg-gradient-to-br from-slate-800 via-slate-800 to-teal-950 px-3.5 py-3">
        <p className="text-lg font-bold tabular-nums leading-tight tracking-tight text-slate-50 sm:text-xl">
          {amountStr}
        </p>
        <span className="mt-2 inline-flex items-center rounded-md border border-emerald-200/80 bg-emerald-50/95 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
          {cur}
        </span>
      </div>
    </div>
  );
}

function TermCard({
  label,
  value,
  highlight,
  icon,
}: {
  label: string;
  value: ReactNode;
  highlight?: boolean;
  icon?: LucideIcon;
}) {
  const Icon = icon;
  return (
    <div
      className={[
        'rounded-xl border px-3.5 py-3',
        highlight
          ? 'border-amber-200/90 bg-amber-50/60'
          : 'border-slate-100 bg-slate-50/60',
      ].join(' ')}
    >
      <div className="flex items-center gap-1.5">
        {Icon ? (
          <Icon
            className={`h-3.5 w-3.5 shrink-0 ${highlight ? 'text-amber-600' : 'text-slate-500'}`}
            aria-hidden
          />
        ) : null}
        <FieldLabel>{label}</FieldLabel>
      </div>
      <div className="mt-1.5 text-sm font-bold text-slate-900">{value}</div>
    </div>
  );
}

export type PoDetailFormState = {
  paymentTerms?: string;
  deliveryAddress?: string;
  incoterms?: string;
  projectCode?: string;
  deliveryDate?: string;
  note?: string;
  supplierName?: string;
  supplierAddress?: string;
  supplierTaxCode?: string;
  supplierPhone?: string;
  supplierBankName?: string;
  supplierBankAccount?: string;
};

type PoDetailUnifiedSheetProps = {
  lang: PoDisplayLang;
  t: PoDetailUi;
  po: {
    supplier?: {
      name?: string | null;
      address?: string | null;
      taxCode?: string | null;
      phone?: string | null;
      bankName?: string | null;
      bankAccount?: string | null;
    } | null;
    paymentTerms?: string | null;
    deliveryAddress?: string | null;
    incoterms?: string | null;
    projectCode?: string | null;
    deliveryDate?: string | null;
    note?: string | null;
    totalAmount?: number | null;
    currency?: string | null;
  };
  form: PoDetailFormState;
  setForm: Dispatch<SetStateAction<PoDetailFormState>>;
  canEdit: boolean;
  editMode: boolean;
  dateLocale: string;
  numLocale: string;
  totalLabel: string;
};

export function PoDetailUnifiedSheet({
  lang,
  t,
  po,
  form,
  setForm,
  canEdit,
  editMode,
  dateLocale,
  numLocale,
  totalLabel,
}: PoDetailUnifiedSheetProps) {
  const L = sheetLabels(lang);
  const empty = '\u2014';
  const deliveryDateDisplay = po.deliveryDate
    ? new Date(po.deliveryDate).toLocaleDateString(dateLocale)
    : empty;

  const displayOrPlaceholder = (val: string | null | undefined) => {
    const v = val?.trim();
    if (!v) return <PlaceholderText>{L.notUpdated}</PlaceholderText>;
    return v;
  };

  const buyerAccounts = splitBuyerBankAccounts(PO_PDF_BUYER_COMPANY.bankAccount);

  if (canEdit && editMode) {
    return (
      <div className="overflow-hidden" aria-label={lang === 'vi' ? 'Tờ đơn hàng PO' : 'PO sheet'}>
        <section className={`${sheetPad} border-b border-slate-100`}>
          <SheetSectionHeader
            icon={Building2}
            iconWrapClass="bg-violet-100"
            iconClass="text-violet-600"
            ringClass="ring-violet-200/80"
            title={L.buyerTitle}
          />
          <p className="mt-3 text-xs text-slate-500">
            {lang === 'vi'
              ? 'Thông tin bên mua cố định — chỉnh NCC và điều khoản bên dưới.'
              : 'Buyer info is fixed — edit supplier and terms below.'}
          </p>
        </section>

        <section className={`${sheetPad} border-b border-slate-100`}>
          <SheetSectionHeader
            icon={Store}
            iconWrapClass="bg-emerald-100"
            iconClass="text-emerald-600"
            title={L.supplierTitle}
          />
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ['supplierName', t.lblSupplierName, po.supplier?.name],
                ['supplierAddress', t.lblSupplierAddr, po.supplier?.address],
                ['supplierTaxCode', t.lblSupplierTax, po.supplier?.taxCode],
                ['supplierPhone', t.lblSupplierPhone, po.supplier?.phone],
                ['supplierBankName', t.lblSupplierBank, po.supplier?.bankName],
                ['supplierBankAccount', t.lblSupplierBankAcc, po.supplier?.bankAccount],
              ] as const
            ).map(([key, label, fallback]) => (
              <div key={key}>
                <label className={fieldLabelClass}>{label}</label>
                <input
                  type="text"
                  value={(form as Record<string, string | undefined>)[key] ?? fallback ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className={fieldInputClass}
                />
              </div>
            ))}
          </div>
        </section>

        <section className={sheetPad}>
          <SheetSectionHeader
            icon={Truck}
            iconWrapClass="bg-orange-100"
            iconClass="text-orange-600"
            title={L.termsTitle}
          />
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={fieldLabelClass}>{t.lblPaymentTerms}</label>
              <input
                type="text"
                value={form.paymentTerms ?? po.paymentTerms ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))}
                className={fieldInputClass}
              />
            </div>
            <div>
              <label className={fieldLabelClass}>{t.lblIncoterms}</label>
              <input
                type="text"
                value={form.incoterms ?? po.incoterms ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, incoterms: e.target.value }))}
                className={fieldInputClass}
              />
            </div>
            <div>
              <label className={fieldLabelClass}>{t.lblProjectCode}</label>
              <input
                type="text"
                value={form.projectCode ?? po.projectCode ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, projectCode: e.target.value }))}
                className={fieldInputClass}
              />
            </div>
            <div>
              <label className={fieldLabelClass}>{t.lblDeliveryDate}</label>
              <input
                type="date"
                value={form.deliveryDate ?? (po.deliveryDate ? po.deliveryDate.slice(0, 10) : '')}
                onChange={(e) => setForm((f) => ({ ...f, deliveryDate: e.target.value }))}
                className={fieldInputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={fieldLabelClass}>{t.lblDeliveryAddr}</label>
              <input
                type="text"
                value={form.deliveryAddress ?? po.deliveryAddress ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, deliveryAddress: e.target.value }))}
                className={fieldInputClass}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className={fieldLabelClass}>{t.lblNote}</label>
              <textarea
                value={form.note ?? po.note ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                rows={2}
                className={`${fieldInputClass} min-h-[4rem] resize-y`}
              />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={sheetPad} aria-label={lang === 'vi' ? 'Tờ đơn hàng PO' : 'PO sheet'}>
      <PoCanvasDocSection num={1} title={L.buyerTitle} icon={Building2}>
        <div className="grid grid-cols-1 gap-6 text-sm lg:grid-cols-[1fr_minmax(240px,38%)] lg:gap-0">
          <div className={bankAsideMainColumnClass}>
            <div>
              <p className={poCanvasLabelClass}>{L.unitName}</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {lang === 'vi' ? 'Công ty ' : 'Company '}
                <span className="text-rose-600">RMG</span> Vietnam Co., Ltd
              </p>
            </div>
            <div>
              <p className={poCanvasLabelClass}>{L.officeAddress}</p>
              <p className="mt-0.5 leading-relaxed text-slate-800">{PO_PDF_BUYER_COMPANY.address}</p>
            </div>
            <div>
              <p className={poCanvasLabelClass}>{L.branchAddress}</p>
              <p className="mt-0.5 leading-relaxed text-slate-800">{PO_PDF_BUYER_COMPANY.bankAddress}</p>
            </div>
            <div>
              <p className={poCanvasLabelClass}>{L.taxId}</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-slate-900">{PO_PDF_BUYER_COMPANY.taxCode}</p>
            </div>
            <div>
              <p className={poCanvasLabelClass}>{stripLabelColon(t.buyerPhone)}</p>
              <p className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Phone className="h-4 w-4 text-slate-400" strokeWidth={2} aria-hidden />
                {PO_PDF_BUYER_COMPANY.tel}
              </p>
            </div>
          </div>
          <div className={bankAsideColumnClass}>
            <div>
              <p className={poCanvasLabelClass}>
                {lang === 'vi'
                  ? 'Tài khoản thanh toán & Ngân hàng giao dịch'
                  : 'Payment accounts & bank'}
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-slate-800 marker:text-slate-300">
                <li>
                  <span className="font-bold text-slate-900">{PO_PDF_BUYER_COMPANY.bankName}</span>
                </li>
                {buyerAccounts.map((acc) => (
                  <li key={acc} className="font-mono text-sm leading-snug">
                    {acc}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </PoCanvasDocSection>

      <PoCanvasDocSection num={2} title={L.supplierTitle} icon={Store}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(240px,38%)] lg:gap-0">
          <div className={bankAsideMainColumnClass}>
            <div>
              <p className={poCanvasLabelClass}>{L.supplierName}</p>
              <p className="mt-0.5 text-base font-bold leading-snug text-slate-900">
                {po.supplier?.name?.trim() ? po.supplier.name : <PlaceholderText>{L.notUpdated}</PlaceholderText>}
              </p>
            </div>
            <div>
              <p className={poCanvasLabelClass}>{L.taxId}</p>
              <div className="mt-0.5 font-mono text-sm font-bold text-slate-900">
                {displayOrPlaceholder(po.supplier?.taxCode)}
              </div>
            </div>
            <div>
              <p className={poCanvasLabelClass}>{L.officeAddress}</p>
              <div className="mt-0.5">
                {po.supplier?.address?.trim() ? (
                  <p className="flex items-start gap-2 text-sm font-medium text-slate-800">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" strokeWidth={2} aria-hidden />
                    <span>{po.supplier.address}</span>
                  </p>
                ) : (
                  <PlaceholderText>{L.notUpdated}</PlaceholderText>
                )}
              </div>
            </div>
            <div>
              <p className={poCanvasLabelClass}>{stripLabelColon(t.lblSupplierPhone)}</p>
              <div className="mt-0.5 font-mono text-sm font-semibold text-slate-900">
                {displayOrPlaceholder(po.supplier?.phone)}
              </div>
            </div>
          </div>
          <div className={bankAsideColumnClass}>
            <div>
              <p className={poCanvasLabelClass}>{L.beneficiaryBank}</p>
              {po.supplier?.bankName?.trim() || po.supplier?.bankAccount?.trim() ? (
                <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-slate-800 marker:text-slate-300">
                  {po.supplier?.bankName?.trim() ? (
                    <li>
                      <span className="font-bold text-slate-900">{po.supplier.bankName}</span>
                    </li>
                  ) : null}
                  {po.supplier?.bankAccount?.trim() ? (
                    <li>
                      {L.accountNo}: <span className="font-mono font-bold">{po.supplier.bankAccount}</span>
                    </li>
                  ) : null}
                </ul>
              ) : (
                <PlaceholderText>{L.notUpdated}</PlaceholderText>
              )}
            </div>
          </div>
        </div>
      </PoCanvasDocSection>

      <PoCanvasDocSection num={3} title={L.termsTitle} icon={Truck}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <div>
              <p className={poCanvasLabelClass}>{L.deliveryDate}</p>
              <p className="mt-0.5 flex items-center gap-2 text-sm font-bold text-rose-600">
                <Calendar className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                {deliveryDateDisplay}
              </p>
            </div>
            <div>
              <p className={poCanvasLabelClass}>{t.lblDeliveryAddr}</p>
              <div className="mt-0.5">
                {po.deliveryAddress?.trim() ? (
                  <p className="flex items-start gap-2 text-sm font-medium text-slate-800">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
                    <span>{po.deliveryAddress}</span>
                  </p>
                ) : (
                  <PlaceholderText>{L.noDeliveryAddr}</PlaceholderText>
                )}
              </div>
            </div>
          </div>
          <div>
            <p className={poCanvasLabelClass}>{t.lblPaymentTerms}</p>
            <p className="mt-0.5 flex items-center gap-2 text-sm font-bold text-slate-900">
              <Percent className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
              {po.paymentTerms?.trim() ? po.paymentTerms : <PlaceholderText>{L.notUpdated}</PlaceholderText>}
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <p className={poCanvasLabelClass}>{t.lblIncoterms}</p>
              <p className="mt-0.5 text-sm font-bold text-slate-900">
                {po.incoterms?.trim() ? po.incoterms : <PlaceholderText>{L.notUpdated}</PlaceholderText>}
              </p>
            </div>
            {po.note?.trim() ? (
              <div>
                <p className={poCanvasLabelClass}>{t.lblNote}</p>
                <p className="mt-1 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 ring-1 ring-amber-100/90">
                  <Zap className="h-4 w-4 shrink-0 text-amber-600" strokeWidth={2} aria-hidden />
                  <span className="whitespace-pre-wrap">{po.note}</span>
                </p>
              </div>
            ) : null}
          </div>
          <div>
            <p className={poCanvasLabelClass}>{t.lblProjectCode}</p>
            <p className="mt-0.5 font-mono text-sm text-slate-800">
              {po.projectCode?.trim() ? po.projectCode : <PlaceholderText>{L.notUpdated}</PlaceholderText>}
            </p>
          </div>
        </div>
      </PoCanvasDocSection>
    </div>
  );
}

function stripLabelColon(label: string) {
  return label.replace(/:$/, '');
}

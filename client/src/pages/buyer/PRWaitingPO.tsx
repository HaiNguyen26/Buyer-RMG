import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  CircleDollarSign,
  ClipboardList,
  ExternalLink,
  Handshake,
  Inbox,
  ShoppingCart,
  UserRound,
  Users,
} from 'lucide-react';
import { buyerService } from '../../services/buyerService';
import { BuyerPageHero } from '../../components/BuyerPageHero';
import {
  CreatePOConfirmModal,
  type CreatePOConfirmTarget,
} from '../../components/CreatePOConfirmModal';
import { useToast } from '../../contexts/ToastContext';
import {
  buyerInteractiveTableClass,
  buyerInteractiveTableBodyClass,
  buyerOutletPageShellClass,
  buyerOutletCenterMinHeightClass,
  buyerTableAccentRailClass,
  buyerTableCellWrapClass,
  buyerTableCellWrapFlexClass,
  buyerTableDataRowVisual,
  buyerTableFirstCellInnerClass,
  buyerWorkspaceDataCardClass,
  buyerWorkspacePageStackClass,
  buyerWorkspaceTableTitleBarClass,
  buyerWorkspaceTableViewportClass,
} from '../../constants/buyerLayout';
import {
  DashboardV3ShimmerBlock,
  dashboardV3ErrorCardClass,
} from '../../components/dashboard/DashboardV3Chrome';

type WaitingPRRow = {
  prId: string;
  prCode: string;
  requestor: string;
  department: string;
  totalBudget: number | null;
  selectedAmount: number | null;
  currency?: string;
  supplierCount?: number;
  hasPO?: boolean;
  canCreateMorePO?: boolean;
  pendingItemCount?: number;
};

function formatMoney(amount: number | null | undefined, currency = 'VND') {
  if (amount == null) return '—';
  return `${Number(amount).toLocaleString('vi-VN')} ${currency}`;
}

function CellWithIcon({
  icon: Icon,
  iconClassName = 'text-slate-400',
  align = 'left',
  children,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  align?: 'left' | 'right';
  children: ReactNode;
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-2',
        align === 'right' ? 'ml-auto justify-end' : '',
      ].join(' ')}
    >
      <Icon className={`h-4 w-4 shrink-0 ${iconClassName}`} aria-hidden />
      {children}
    </span>
  );
}

const PRWaitingPO = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [highlightPrCode, setHighlightPrCode] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<CreatePOConfirmTarget | null>(null);
  const [isCreatingPO, setIsCreatingPO] = useState(false);

  useEffect(() => {
    const state = location.state as { highlightPrNumber?: string } | undefined;
    const prNumber = state?.highlightPrNumber;
    if (!prNumber) return;

    setHighlightPrCode(prNumber);
    const timer = setTimeout(() => {
      setHighlightPrCode(null);
    }, 2500);

    return () => clearTimeout(timer);
  }, [location.state]);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['buyer-prs-waiting-po'],
    queryFn: () => buyerService.getPRsWaitingPO(),
    staleTime: 30000,
  });

  const openCreatePOConfirm = (pr: WaitingPRRow) => {
    setConfirmTarget({
      prId: pr.prId,
      prCode: pr.prCode,
      supplierCount: pr.supplierCount,
      selectedAmount: pr.selectedAmount,
      currency: pr.currency,
    });
  };

  const closeCreatePOConfirm = () => {
    if (isCreatingPO) return;
    setConfirmTarget(null);
  };

  const handleConfirmCreatePO = async () => {
    if (!confirmTarget) return;
    setIsCreatingPO(true);
    try {
      const created = await buyerService.createDraftPOs(confirmTarget.prId);
      const poCount = Array.isArray(created?.pos) ? created.pos.length : 0;
      setConfirmTarget(null);
      showSuccess(
        poCount > 1
          ? `Đã tạo ${poCount} PO nháp (${poCount} NCC) cho ${confirmTarget.prCode}`
          : `Đã tạo PO nháp cho ${confirmTarget.prCode}`
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['buyer-po-list'] }),
        queryClient.invalidateQueries({ queryKey: ['buyer-prs-waiting-po'] }),
        queryClient.invalidateQueries({ queryKey: ['buyer-po-dashboard'] }),
      ]);
      await queryClient.refetchQueries({ queryKey: ['buyer-po-list'] });
      refetch();
      const firstPo = Array.isArray(created?.pos) ? created.pos[0] : undefined;
      navigate('/dashboard/buyer/po/list', {
        state: firstPo?.poNumber ? { highlightPoNumber: firstPo.poNumber } : undefined,
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error ||
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        'Không tạo được PO';
      showError(msg);
    } finally {
      setIsCreatingPO(false);
    }
  };

  if (isLoading) {
    return (
      <div className={buyerOutletPageShellClass}>
        <div className={buyerWorkspacePageStackClass}>
          <DashboardV3ShimmerBlock className="h-24 w-full shrink-0" />
          <DashboardV3ShimmerBlock className="h-16 w-full max-w-xl shrink-0" />
          <DashboardV3ShimmerBlock className="min-h-[280px] shrink-0" />
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className={`${buyerOutletPageShellClass} ${buyerOutletCenterMinHeightClass} items-center justify-center p-6`}>
        <div className={`max-w-lg ${dashboardV3ErrorCardClass}`}>
          <p className="text-lg font-bold text-rose-900">Lỗi khi tải danh sách</p>
          <p className="mt-2 text-sm font-medium text-rose-800/90">
            {error instanceof Error ? error.message : 'Vui lòng thử lại'}
          </p>
        </div>
      </div>
    );
  }

  const prs = data?.prs || [];

  return (
    <div className={`${buyerOutletPageShellClass} animate-fade-in-right fade-in-right-delay-0`}>
      <div className={buyerWorkspacePageStackClass}>
        <BuyerPageHero
          kicker="Buyer · PO"
          title="PR chờ tạo PO"
          description="PR đã chọn NCC, sẵn sàng tạo đơn đặt hàng — thao tác từng dòng"
          Icon={ShoppingCart}
          tint="rose"
          regionLabel="PR chờ tạo PO"
        />

        <article className={buyerWorkspaceDataCardClass}>
          <div className={buyerWorkspaceTableTitleBarClass}>
            <h2 className="text-xl font-bold text-slate-900">Danh sách ({prs.length})</h2>
          </div>
        <div className={`relative w-full ${buyerWorkspaceTableViewportClass}`}>
          <table className={`${buyerInteractiveTableClass} w-full min-w-[880px] bg-white text-sm`}>
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95">
              <tr>
                <th className="bg-slate-50/95 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Mã PR
                </th>
                <th className="bg-slate-50/95 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Requestor
                </th>
                <th className="bg-slate-50/95 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Phòng ban
                </th>
                <th className="bg-slate-50/95 px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Tổng ngân sách
                </th>
                <th className="bg-slate-50/95 px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Đã chọn (NCC)
                </th>
                <th className="bg-slate-50/95 px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Số NCC
                </th>
                <th className="bg-slate-50/95 px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className={buyerInteractiveTableBodyClass}>
              {prs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12">
                    <div className="flex flex-col items-center justify-center gap-2 text-center text-slate-500">
                      <Inbox className="h-8 w-8 text-slate-300" aria-hidden />
                      <p className="text-sm font-medium text-slate-600">Chưa có PR chờ tạo PO</p>
                    </div>
                  </td>
                </tr>
              ) : (
                prs.map((pr: WaitingPRRow, index: number) => {
                  const shouldHighlight = highlightPrCode && pr.prCode === highlightPrCode;
                  return (
                    <tr
                      key={pr.prId}
                      className={[
                        'group',
                        buyerTableDataRowVisual(index),
                        shouldHighlight
                          ? '[&>td]:!bg-amber-50/90 shadow-[inset_0_0_0_2px_rgba(251,191,36,0.45)] relative z-[1]'
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <td className="relative px-6 py-4">
                        <div aria-hidden className={buyerTableAccentRailClass} />
                        <div className={`${buyerTableFirstCellInnerClass} ${buyerTableCellWrapClass}`}>
                          <CellWithIcon icon={ClipboardList} iconClassName="text-indigo-500/80">
                            <span className="font-semibold text-slate-900">{pr.prCode}</span>
                          </CellWithIcon>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        <div className={buyerTableCellWrapClass}>
                          <CellWithIcon icon={UserRound}>{pr.requestor}</CellWithIcon>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        <div className={buyerTableCellWrapClass}>
                          <CellWithIcon icon={Building2} iconClassName="text-violet-500/70">
                            {pr.department}
                          </CellWithIcon>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-700">
                        <div className={buyerTableCellWrapClass}>
                          <CellWithIcon icon={CircleDollarSign} iconClassName="text-emerald-600/70" align="right">
                            <span className="font-semibold tabular-nums">{formatMoney(pr.totalBudget, pr.currency)}</span>
                          </CellWithIcon>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-700">
                        <div className={buyerTableCellWrapClass}>
                          <CellWithIcon icon={Handshake} iconClassName="text-violet-600/70" align="right">
                            <span className="font-semibold tabular-nums text-indigo-900">
                              {formatMoney(pr.selectedAmount, pr.currency)}
                            </span>
                          </CellWithIcon>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-slate-700">
                        <div className={buyerTableCellWrapClass}>
                          <CellWithIcon icon={Users} iconClassName="text-sky-600/80">
                            <span className="font-semibold tabular-nums">{pr.supplierCount ?? 0}</span>
                          </CellWithIcon>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`${buyerTableCellWrapFlexClass} justify-center gap-2`}>
                          <button
                            type="button"
                            onClick={() => openCreatePOConfirm(pr)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                          >
                            <ShoppingCart className="h-4 w-4" aria-hidden />
                            {pr.hasPO ? 'Tạo PO còn lại' : 'Tạo PO'}
                          </button>
                          {pr.hasPO ? (
                            <button
                              type="button"
                              onClick={() => navigate('/dashboard/buyer/po/list')}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-800 transition-colors hover:bg-indigo-100"
                            >
                              <ExternalLink className="h-4 w-4" aria-hidden />
                              Xem PO
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </article>
      </div>

      <CreatePOConfirmModal
        open={confirmTarget != null}
        target={confirmTarget}
        isPending={isCreatingPO}
        onClose={closeCreatePOConfirm}
        onConfirm={handleConfirmCreatePO}
      />
    </div>
  );
};

export default PRWaitingPO;

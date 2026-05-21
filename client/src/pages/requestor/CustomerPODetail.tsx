import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { requestorService } from '../../services/requestorService';
import { ArrowLeft, Briefcase, FileText, DollarSign, TrendingDown } from 'lucide-react';
import { RequestorPageHero } from '../../components/RequestorPageHero';
import { requestorPageStackClass, requestorPanelCardClass, requestorDataTableCardClass, requestorDataTableCardHeaderClass } from '../../constants/requestorLayout';
import { dataTableScrollWindowSingleClass } from '../../constants/dataTableLayout';

const CustomerPODetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['customer-po-detail', id],
    queryFn: () => requestorService.getCustomerPOById(id!),
    enabled: !!id,
  });

  if (isLoading || !id) {
    return (
      <div className="min-w-0 w-full">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3" />
          <div className="h-32 bg-slate-100 rounded" />
          <div className="h-24 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-w-0 w-full">
        <p className="text-rose-600">Không tìm thấy Customer PO hoặc lỗi tải dữ liệu.</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-slate-200 rounded-lg hover:bg-slate-300"
        >
          Quay lại
        </button>
      </div>
    );
  }

  const contractValue = Number(data.contractValue);
  const totalProcurementCost = Number(data.totalProcurementCost ?? 0);
  const remainingBudget = Number(data.remainingBudget ?? contractValue);
  const totalPRs = data.totalPRs ?? 0;
  const purchaseRequests = data.purchaseRequests ?? [];

  return (
    <div className="min-w-0 w-full bg-slate-50">
      <div className={requestorPageStackClass}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex w-fit items-center gap-2 rounded-xl p-2 text-sm font-medium text-slate-600 transition-all hover:bg-white hover:shadow-sm"
      >
        <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        Quay lại
      </button>

      <RequestorPageHero
        kicker="Requestor · PO khách"
        title={`Customer PO · ${data.poNumber}`}
        description={data.projectName ?? data.salesPONumber ?? 'Chi tiết hợp đồng, ngân sách và PR liên kết.'}
        Icon={Briefcase}
        tint="rose"
        regionLabel={`Customer PO ${data.poNumber}`}
      />

      <div className={`${requestorPanelCardClass} space-y-4`}>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Thông tin dự án</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div><span className="text-slate-500">Customer:</span> <span className="font-medium text-slate-900">{data.customer?.name ?? '-'}</span></div>
          <div><span className="text-slate-500">Project:</span> <span className="font-medium text-slate-900">{data.projectName ?? '-'}</span></div>
          <div><span className="text-slate-500">Project Code:</span> <span className="font-medium text-slate-900">{data.projectCode ?? '-'}</span></div>
          <div><span className="text-slate-500">Sales Owner:</span> <span className="font-medium text-slate-900">{typeof data.salesOwner === 'object' && data.salesOwner ? data.salesOwner.name : (data.salesOwner as string) ?? '-'}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-5 flex items-center gap-4">
          <div className="p-3 bg-emerald-100 rounded-xl">
            <DollarSign className="w-6 h-6 text-emerald-700" strokeWidth={2} />
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Contract Value</p>
            <p className="text-lg font-bold text-emerald-900">{contractValue.toLocaleString('vi-VN')} {data.currency}</p>
          </div>
        </div>
        <div className="rounded-2xl border-2 border-slate-200 bg-slate-50/50 p-5 flex items-center gap-4">
          <div className="p-3 bg-slate-200 rounded-xl">
            <FileText className="w-6 h-6 text-slate-700" strokeWidth={2} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Total PR</p>
            <p className="text-lg font-bold text-slate-900">{totalPRs}</p>
          </div>
        </div>
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-5 flex items-center gap-4">
          <div className="p-3 bg-amber-100 rounded-xl">
            <TrendingDown className="w-6 h-6 text-amber-700" strokeWidth={2} />
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Total Procurement Cost</p>
            <p className="text-lg font-bold text-amber-900">{totalProcurementCost.toLocaleString('vi-VN')} {data.currency}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-violet-200 bg-violet-50/50 p-5 flex items-center gap-4">
        <div className="p-3 bg-violet-100 rounded-xl">
          <DollarSign className="w-6 h-6 text-violet-700" strokeWidth={2} />
        </div>
        <div>
          <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider">Remaining Budget</p>
          <p className="text-xl font-bold text-violet-900">{remainingBudget.toLocaleString('vi-VN')} {data.currency}</p>
        </div>
      </div>

      {purchaseRequests.length > 0 && (
        <div className={requestorDataTableCardClass}>
          <div className={requestorDataTableCardHeaderClass}>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Danh sách PR liên kết</h2>
          </div>
          <div className={dataTableScrollWindowSingleClass}>
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 border-b-2 border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">PR Number</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Total Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchaseRequests.map((pr: { id: string; prNumber: string; totalAmount: number | null; status: string }) => (
                  <tr key={pr.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-900">{pr.prNumber}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{(pr.totalAmount ?? 0).toLocaleString('vi-VN')}</td>
                    <td className="px-4 py-3 text-slate-600">{pr.status}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard/requestor/pr/${pr.id}`)}
                        className="text-violet-600 hover:underline font-medium"
                      >
                        Xem
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default CustomerPODetail;

import { useQuery } from '@tanstack/react-query';
import { Globe, AlertTriangle, TrendingUp, Package } from 'lucide-react';
import { bgdService } from '../../services/bgdService';

const StrategicSupplierView = () => {
  const { data: supplierData, isLoading } = useQuery({
    queryKey: ['bgd-strategic-suppliers'],
    queryFn: bgdService.getStrategicSupplierView,
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="h-64 bg-slate-200 rounded-soft"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Strategic Supplier View</h1>
        <p className="text-slate-600">Nhìn NCC ở góc độ chiến lược</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass rounded-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-sm text-slate-600">NCC chủ lực</div>
          </div>
          <div className="text-3xl font-bold text-slate-800">
            {supplierData?.keySuppliersCount || 0}
          </div>
          <div className="text-sm text-slate-600 mt-1">NCC quan trọng</div>
        </div>

        <div className="glass rounded-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="text-sm text-slate-600">Mức độ phụ thuộc</div>
          </div>
          <div className="text-3xl font-bold text-slate-800">
            {supplierData?.dependencyLevel || 0}%
          </div>
          <div className="text-sm text-amber-600 mt-1">Cần đa dạng hóa</div>
        </div>

        <div className="glass rounded-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="text-sm text-slate-600">Rủi ro chuỗi cung ứng</div>
          </div>
          <div className="text-3xl font-bold text-slate-800">
            {supplierData?.supplyChainRisks || 0}
          </div>
          <div className="text-sm text-red-600 mt-1">Điểm cần chú ý</div>
        </div>

        <div className="glass rounded-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-sm text-slate-600">Tổng giá trị mua</div>
          </div>
          <div className="text-3xl font-bold text-slate-800">
            {((supplierData?.totalPurchaseValue || 0) / 1000000).toFixed(1)}M
          </div>
          <div className="text-sm text-slate-600 mt-1">VNĐ</div>
        </div>
      </div>

      {/* Key Suppliers */}
      <div className="glass rounded-soft p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">NCC chủ lực</h3>
        <div className="space-y-4">
          {supplierData?.keySuppliers?.map((supplier: any, idx: number) => (
            <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                      {supplier.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">{supplier.name}</div>
                      <div className="text-sm text-slate-600">{supplier.category}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-3">
                    <div>
                      <div className="text-xs text-slate-600 mb-1">Giá trị mua</div>
                      <div className="font-medium text-slate-800">
                        {(supplier.purchaseValue / 1000000).toFixed(1)}M VNĐ
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-600 mb-1">Tỷ lệ phụ thuộc</div>
                      <div className="font-medium text-slate-800">{supplier.dependencyPercent}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-600 mb-1">Số PR</div>
                      <div className="font-medium text-slate-800">{supplier.totalPRs}</div>
                    </div>
                  </div>
                </div>
                <div className="ml-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    supplier.dependencyPercent >= 50
                      ? 'bg-red-100 text-red-700'
                      : supplier.dependencyPercent >= 30
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {supplier.dependencyPercent >= 50 ? 'Rủi ro cao' : 
                     supplier.dependencyPercent >= 30 ? 'Cần chú ý' : 'Ổn định'}
                  </span>
                </div>
              </div>
            </div>
          )) || (
            <div className="text-center text-slate-500 py-8">Không có dữ liệu</div>
          )}
        </div>
      </div>

      {/* Dependency Analysis */}
      <div className="glass rounded-soft p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Mức độ phụ thuộc NCC</h3>
        <div className="space-y-4">
          {supplierData?.dependencyAnalysis?.map((item: any, idx: number) => (
            <div key={idx} className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-slate-800">{item.category}</div>
                <div className="text-sm font-semibold text-slate-700">
                  {item.dependencyPercent}% phụ thuộc
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      item.dependencyPercent >= 50
                        ? 'bg-red-500'
                        : item.dependencyPercent >= 30
                        ? 'bg-amber-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${item.dependencyPercent}%` }}
                  ></div>
                </div>
                <div className="text-xs text-slate-600 w-20 text-right">
                  {item.supplierCount} NCC
                </div>
              </div>
              {item.dependencyPercent >= 50 && (
                <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Cần đa dạng hóa nguồn cung</span>
                </div>
              )}
            </div>
          )) || (
            <div className="text-center text-slate-500 py-8">Không có dữ liệu</div>
          )}
        </div>
      </div>

      {/* Supply Chain Risks */}
      <div className="glass rounded-soft p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h3 className="text-lg font-semibold text-slate-800">Rủi ro chuỗi cung ứng</h3>
        </div>
        <div className="space-y-3">
          {supplierData?.supplyChainRiskList?.map((risk: any, idx: number) => (
            <div
              key={idx}
              className="p-4 bg-red-50 rounded-lg border border-red-200"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-slate-800 mb-1">{risk.title}</div>
                  <div className="text-sm text-slate-600 mb-2">{risk.description}</div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>Ảnh hưởng: {risk.impact}</span>
                    <span>Mức độ: {risk.severity}</span>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  risk.severity === 'High'
                    ? 'bg-red-100 text-red-700'
                    : risk.severity === 'Medium'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {risk.severity}
                </span>
              </div>
            </div>
          )) || (
            <div className="text-center text-slate-500 py-8">Không có rủi ro được phát hiện</div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      <div className="glass rounded-soft p-6 border-l-4 border-blue-500">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Đề xuất chiến lược</h3>
        <div className="space-y-3">
          {supplierData?.recommendations?.map((rec: any, idx: number) => (
            <div key={idx} className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-800 mb-1">{rec.title}</div>
                  <div className="text-sm text-slate-600">{rec.description}</div>
                </div>
              </div>
            </div>
          )) || (
            <div className="text-center text-slate-500 py-8">Không có đề xuất</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StrategicSupplierView;


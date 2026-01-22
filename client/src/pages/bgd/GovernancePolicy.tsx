import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Save, Plus, Edit2, Trash2, Shield } from 'lucide-react';
import { bgdService } from '../../services/bgdService';

const GovernancePolicy = () => {
  const queryClient = useQueryClient();
  const [editingPolicy, setEditingPolicy] = useState<any>(null);

  const { data: governanceData, isLoading } = useQuery({
    queryKey: ['bgd-governance'],
    queryFn: bgdService.getGovernancePolicy,
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
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Governance & Policy</h1>
        <p className="text-slate-600">Thiết lập nguyên tắc cấp cao</p>
      </div>

      {/* Approval Thresholds */}
      <div className="glass rounded-soft p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Ngưỡng trình duyệt BGĐ</h3>
              <p className="text-sm text-slate-600">Giá trị mua cần được BGĐ duyệt</p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            <Plus className="w-4 h-4" />
            <span>Thêm ngưỡng</span>
          </button>
        </div>
        <div className="space-y-3">
          {governanceData?.approvalThresholds?.map((threshold: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-slate-800 mb-1">{threshold.category}</div>
                <div className="text-sm text-slate-600">{threshold.description}</div>
              </div>
              <div className="text-right mr-4">
                <div className="text-lg font-bold text-purple-600">
                  {threshold.threshold.toLocaleString()} VNĐ
                </div>
                <div className="text-xs text-slate-600">Ngưỡng</div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )) || (
            <div className="text-center text-slate-500 py-8">Chưa có ngưỡng nào</div>
          )}
        </div>
      </div>

      {/* Strategic Procurement Policy */}
      <div className="glass rounded-soft p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Settings className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Chính sách mua chiến lược</h3>
              <p className="text-sm text-slate-600">Nguyên tắc và định hướng mua hàng</p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" />
            <span>Thêm chính sách</span>
          </button>
        </div>
        <div className="space-y-3">
          {governanceData?.strategicPolicies?.map((policy: any, idx: number) => (
            <div key={idx} className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-slate-800 mb-1">{policy.title}</div>
                  <div className="text-sm text-slate-600 mb-2">{policy.description}</div>
                  <div className="text-xs text-slate-500">
                    Áp dụng từ: {policy.effectiveDate} | Cập nhật: {policy.updatedAt}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )) || (
            <div className="text-center text-slate-500 py-8">Chưa có chính sách nào</div>
          )}
        </div>
      </div>

      {/* Material/Service Priority */}
      <div className="glass rounded-soft p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Định hướng ưu tiên vật tư / dịch vụ</h3>
            <p className="text-sm text-slate-600 mt-1">Thứ tự ưu tiên mua hàng</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <Plus className="w-4 h-4" />
            <span>Thêm ưu tiên</span>
          </button>
        </div>
        <div className="space-y-3">
          {governanceData?.priorityGuidelines?.map((guideline: any, idx: number) => (
            <div
              key={idx}
              className={`p-4 rounded-lg border-2 ${
                guideline.priority === 'Critical'
                  ? 'bg-red-50 border-red-200'
                  : guideline.priority === 'High'
                  ? 'bg-amber-50 border-amber-200'
                  : guideline.priority === 'Medium'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-green-50 border-green-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-white ${
                    guideline.priority === 'Critical'
                      ? 'bg-red-600'
                      : guideline.priority === 'High'
                      ? 'bg-amber-600'
                      : guideline.priority === 'Medium'
                      ? 'bg-blue-600'
                      : 'bg-green-600'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-800 mb-1">{guideline.category}</div>
                    <div className="text-sm text-slate-600 mb-2">{guideline.description}</div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>Ưu tiên: {guideline.priority}</span>
                      <span>SLA: {guideline.sla} ngày</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )) || (
            <div className="text-center text-slate-500 py-8">Chưa có định hướng ưu tiên</div>
          )}
        </div>
      </div>

      {/* Risk Management Policy */}
      <div className="glass rounded-soft p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Chính sách quản lý rủi ro</h3>
        <div className="space-y-3">
          {governanceData?.riskPolicies?.map((policy: any, idx: number) => (
            <div key={idx} className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-slate-800 mb-1">{policy.title}</div>
                  <div className="text-sm text-slate-600">{policy.description}</div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )) || (
            <div className="text-center text-slate-500 py-8">Chưa có chính sách quản lý rủi ro</div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-lg">
          <Save className="w-5 h-5" />
          <span>Lưu tất cả thay đổi</span>
        </button>
      </div>
    </div>
  );
};

export default GovernancePolicy;



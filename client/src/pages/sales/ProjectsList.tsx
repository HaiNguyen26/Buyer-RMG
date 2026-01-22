import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { salesService } from '../../services/salesService';
import { Search, Filter, FolderKanban, Eye, TrendingUp, DollarSign } from 'lucide-react';

const ProjectsList = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sales-pos', 'ACTIVE'],
    queryFn: () => salesService.getSalesPOs({ status: 'ACTIVE' }),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const filteredProjects = data?.salesPOs?.filter((po) =>
    searchQuery === '' ||
    po.salesPONumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    po.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    po.projectCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    po.customer.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="animate-slide-up">
        <h1 className="text-3xl font-bold text-slate-900">Danh sách Dự án</h1>
        <p className="text-slate-600 mt-1 font-normal">Xem tất cả các dự án / Sales PO đang Active</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up">
        <div className="bg-white rounded-soft shadow-soft p-4 border border-slate-200 card-hover">
          <p className="text-sm text-slate-600 font-medium">Tổng số dự án</p>
          <p className="number-large mt-1">{filteredProjects.length}</p>
        </div>
        <div className="bg-white rounded-soft shadow-soft p-4 border border-slate-200 card-hover">
          <p className="text-sm text-slate-600 font-medium">Tổng giá trị</p>
          <p className="number-xl mt-1">
            {formatCurrency(filteredProjects.reduce((sum, p) => sum + (p.amount || 0), 0))}
          </p>
        </div>
        <div className="bg-white rounded-soft shadow-soft p-4 border border-slate-200 card-hover">
          <p className="text-sm text-slate-600 font-medium">Tổng Actual Cost</p>
          <p className="number-xl mt-1 text-amber-600">
            {formatCurrency(filteredProjects.reduce((sum, p) => sum + (p.actualCost || 0), 0))}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-soft shadow-soft p-4 border border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" strokeWidth={2} />
          <input
            type="text"
            placeholder="Tìm kiếm theo số PO, tên dự án, mã dự án, khách hàng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent font-normal"
          />
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-slide-up">
        {filteredProjects.length > 0 ? (
          filteredProjects.map((project) => {
            const usagePercent = project.amount > 0
              ? ((project.actualCost || 0) / project.amount) * 100
              : 0;

            return (
              <div
                key={project.id}
                className="bg-white rounded-soft shadow-soft p-6 border border-slate-200 card-hover"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-soft flex items-center justify-center">
                      <FolderKanban className="w-6 h-6 text-blue-600" strokeWidth={2} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{project.salesPONumber}</h3>
                      <p className="text-sm text-slate-500 font-normal">{project.customer.name}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div>
                    <p className="text-sm text-slate-600 font-medium">Dự án</p>
                    <p className="text-base font-normal text-slate-900">
                      {project.projectName || project.projectCode || '-'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500 font-normal">Giá trị PO</p>
                      <p className="text-sm font-bold text-slate-900">{formatCurrency(project.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-normal">Actual Cost</p>
                      <p className="text-sm font-bold text-amber-600">
                        {formatCurrency(project.actualCost || 0)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-slate-500 font-normal">Tiến độ</p>
                      <p className="text-xs font-medium text-slate-700">{usagePercent.toFixed(1)}%</p>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          usagePercent >= 100
                            ? 'bg-red-500'
                            : usagePercent >= 90
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(usagePercent, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/dashboard/sales/projects/${project.id}`)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#3B82F6] text-white rounded-soft hover:bg-[#2563EB] transition-colors font-medium"
                >
                  <Eye className="w-4 h-4" strokeWidth={2} />
                  <span>Xem chi tiết</span>
                </button>
              </div>
            );
          })
        ) : (
          <div className="col-span-full text-center py-12 text-slate-500 font-normal">
            Không có dự án nào
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectsList;





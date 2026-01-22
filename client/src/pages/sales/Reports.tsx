import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { salesService } from '../../services/salesService';
import { FileBarChart, Download, FileSpreadsheet, FileText } from 'lucide-react';

const Reports = () => {
  const [reportType, setReportType] = useState<'sales-po' | 'project' | 'customer'>('sales-po');
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel');

  const handleExport = async () => {
    try {
      const blob = await salesService.exportReports(reportType, exportFormat);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${reportType}_${new Date().getTime()}.${exportFormat === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      alert('Lỗi khi xuất báo cáo');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Reports</h1>
        <p className="text-slate-600 mt-1">Trích xuất dữ liệu phục vụ báo cáo nội bộ / khách hàng</p>
      </div>

      {/* Report Configuration */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <FileBarChart className="w-6 h-6 text-[#3B82F6]" />
          <h2 className="text-xl font-semibold text-slate-800">Cấu hình báo cáo</h2>
        </div>

        {/* Report Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Loại báo cáo
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => setReportType('sales-po')}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                reportType === 'sales-po'
                  ? 'border-[#3B82F6] bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="font-medium text-slate-800">Chi phí theo Sales PO</p>
              <p className="text-sm text-slate-600 mt-1">Báo cáo chi tiết theo từng Sales PO</p>
            </button>
            <button
              onClick={() => setReportType('project')}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                reportType === 'project'
                  ? 'border-[#3B82F6] bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="font-medium text-slate-800">Chi phí theo dự án</p>
              <p className="text-sm text-slate-600 mt-1">Tổng hợp chi phí theo dự án</p>
            </button>
            <button
              onClick={() => setReportType('customer')}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                reportType === 'customer'
                  ? 'border-[#3B82F6] bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="font-medium text-slate-800">Chi phí theo khách hàng</p>
              <p className="text-sm text-slate-600 mt-1">Tổng hợp chi phí theo khách hàng</p>
            </button>
          </div>
        </div>

        {/* Export Format */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Định dạng xuất
          </label>
          <div className="flex gap-4">
            <button
              onClick={() => setExportFormat('excel')}
              className={`flex items-center gap-3 px-6 py-3 border-2 rounded-lg transition-all ${
                exportFormat === 'excel'
                  ? 'border-[#3B82F6] bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span className="font-medium">Excel</span>
            </button>
            <button
              onClick={() => setExportFormat('pdf')}
              className={`flex items-center gap-3 px-6 py-3 border-2 rounded-lg transition-all ${
                exportFormat === 'pdf'
                  ? 'border-[#3B82F6] bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <FileText className="w-5 h-5" />
              <span className="font-medium">PDF</span>
            </button>
          </div>
        </div>

        {/* Export Button */}
        <div className="pt-4 border-t border-slate-200">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-6 py-3 bg-[#3B82F6] text-white rounded-lg hover:bg-[#2563EB] transition-colors"
          >
            <Download className="w-5 h-5" />
            <span>Xuất báo cáo</span>
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Lưu ý:</strong> Tính năng xuất báo cáo sẽ được tích hợp với ExcelJS (Excel) và
          Puppeteer (PDF) trong các bước tiếp theo.
        </p>
      </div>
    </div>
  );
};

export default Reports;





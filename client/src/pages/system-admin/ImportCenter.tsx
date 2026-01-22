import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Upload, FileText, Download, AlertTriangle, CheckCircle2, X, FileSpreadsheet, Users, Building2, Briefcase, Shield } from 'lucide-react';
import { systemAdminService } from '../../services/systemAdminService';

const ImportCenter = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  const { data: historyData, isLoading, refetch } = useQuery({
    queryKey: ['system-admin-import-history'],
    queryFn: () => systemAdminService.getImportHistory({ limit: 50 }),
  });

  const previewMutation = useMutation({
    mutationFn: (file: File) => systemAdminService.previewMasterDataExcel(file),
    onSuccess: (data) => {
      setPreviewData(data);
      setShowPreviewModal(true);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => systemAdminService.importMasterDataExcel(file),
    onSuccess: (data) => {
      setSelectedFile(null);
      refetch();
      
      // Safe access to results
      const branches = data?.results?.branches || { created: 0, skipped: 0 };
      const departments = data?.results?.departments || { created: 0, skipped: 0 };
      const users = data?.results?.users || { created: 0, skipped: 0, failed: 0 };
      const roles = data?.results?.roles || { validated: 0 };
      
      const message = `Import thành công!\n\n` +
        `📊 Branches: ${branches.created} mới, ${branches.skipped} đã tồn tại\n` +
        `🏢 Departments: ${departments.created} mới, ${departments.skipped} đã tồn tại\n` +
        `👥 Users: ${users.created} thành công, ${users.skipped} bỏ qua, ${users.failed} thất bại\n` +
        `✅ Roles: ${roles.validated} validated\n\n` +
        `🔑 Mật khẩu mặc định: ${data?.defaultPassword || 'RMG123@'}`;
      alert(message);
    },
    onError: (error: any) => {
      console.error('Import error:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      alert(`Import thất bại: ${errorMessage}`);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.xlsx') || file?.name.endsWith('.xls')) {
      setSelectedFile(file);
    } else {
      alert('Vui lòng chọn file Excel (.xlsx hoặc .xls)');
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setSelectedFile(file);
    } else {
      alert('Vui lòng chọn file Excel (.xlsx hoặc .xls)');
    }
  }, []);

  const handlePreview = () => {
    if (selectedFile) {
      previewMutation.mutate(selectedFile);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      if (confirm('Bạn có chắc muốn import dữ liệu này? Quá trình này sẽ tạo Branches, Departments và Users từ file Excel.')) {
        uploadMutation.mutate(selectedFile);
      }
    }
  };

  const history = historyData?.imports || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Import Center</h1>
        <p className="text-slate-600">Import Master Data từ file Excel (Employees, Branches, Departments)</p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Import Master Data
        </h2>
        
        <div className="space-y-4">
          {/* Drag & Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : selectedFile
                ? 'border-green-300 bg-green-50'
                : 'border-slate-300 bg-slate-50'
            }`}
          >
            {selectedFile ? (
              <div className="space-y-2">
                <FileSpreadsheet className="w-12 h-12 text-green-600 mx-auto" />
                <p className="text-sm font-medium text-slate-900">{selectedFile.name}</p>
                <p className="text-xs text-slate-500">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Xóa file
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-12 h-12 text-slate-400 mx-auto" />
                <p className="text-sm font-medium text-slate-700">
                  Kéo thả file Excel vào đây
                </p>
                <p className="text-xs text-slate-500">hoặc</p>
                <label className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer text-sm font-medium">
                  Browse file
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-semibold text-blue-900">Employees</span>
              </div>
              <p className="text-xs text-blue-700">Từ file Excel</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-green-600" />
                <span className="text-sm font-semibold text-green-900">Branch</span>
              </div>
              <p className="text-xs text-green-700">Auto extract</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-semibold text-purple-900">Department</span>
              </div>
              <p className="text-xs text-purple-700">Auto extract</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-amber-600" />
                <span className="text-sm font-semibold text-amber-900">Role</span>
              </div>
              <p className="text-xs text-amber-700">Validate only</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handlePreview}
              disabled={!selectedFile || previewMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>Preview</span>
            </button>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>{uploadMutation.isPending ? 'Importing...' : 'Upload & Import'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-500">
            💡 Upload 1 lần – xử lý nhiều phần: Employees, Branches, Departments
          </p>
        </div>
      </div>

      {/* Import History */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">Import History</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-600">Đang tải...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Chưa có lịch sử import</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">File Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Import Type</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Imported By</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Success</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Failed</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Imported At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-900">{item.fileName}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          {item.importType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{item.importedBy}</td>
                      <td className="px-6 py-4 text-sm text-green-600 font-medium">{item.success}</td>
                      <td className="px-6 py-4 text-sm text-red-600 font-medium">{item.failed}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{new Date(item.importedAt).toLocaleString('vi-VN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreviewModal && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between z-10">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Preview Excel Data</h3>
                <p className="text-sm text-slate-600 mt-1">Total Rows: {previewData.totalRows}</p>
              </div>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewData(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Summary Cards */}
              {previewData.summary && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold text-blue-900">Users</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-700">{previewData.summary.users.total}</p>
                    <p className="text-xs text-blue-600">Preview: {previewData.summary.users.preview}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-5 h-5 text-green-600" />
                      <span className="font-semibold text-green-900">Branches</span>
                    </div>
                    <p className="text-2xl font-bold text-green-700">{previewData.summary.branches.total}</p>
                    <p className="text-xs text-green-600">
                      {previewData.summary.branches.existing} existing, {previewData.summary.branches.new} new
                    </p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase className="w-5 h-5 text-purple-600" />
                      <span className="font-semibold text-purple-900">Departments</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-700">{previewData.summary.departments.total}</p>
                    <p className="text-xs text-purple-600">
                      {previewData.summary.departments.existing} existing, {previewData.summary.departments.new} new
                    </p>
                  </div>
                </div>
              )}

              {/* Validation Errors */}
              {previewData.missingColumns && previewData.missingColumns.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <h4 className="font-semibold text-red-900">Thiếu các cột bắt buộc</h4>
                  </div>
                  <div className="space-y-2">
                    {previewData.missingColumns.map((col: string, index: number) => (
                      <div key={index} className="text-sm text-red-800">
                        - {col}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Table */}
              {previewData.previewRows && previewData.previewRows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border border-slate-200">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 border border-slate-200">Row</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 border border-slate-200">Employee Code</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 border border-slate-200">Full Name</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 border border-slate-200">Email</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 border border-slate-200">Branch</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 border border-slate-200">Department</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 border border-slate-200">System Roles</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700 border border-slate-200">Mapped Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.previewRows.map((row: any, index: number) => (
                        <tr key={index} className="border-b border-slate-200">
                          <td className="px-4 py-2 text-sm text-slate-700 border border-slate-200">{row.rowNumber}</td>
                          <td className="px-4 py-2 text-sm font-medium text-slate-900 border border-slate-200">{row.employee_code}</td>
                          <td className="px-4 py-2 text-sm text-slate-700 border border-slate-200">{row.full_name}</td>
                          <td className="px-4 py-2 text-sm text-slate-700 border border-slate-200">{row.email}</td>
                          <td className="px-4 py-2 text-sm text-slate-700 border border-slate-200">{row.branch_code}</td>
                          <td className="px-4 py-2 text-sm text-slate-700 border border-slate-200">{row.department_code}</td>
                          <td className="px-4 py-2 text-sm text-slate-700 border border-slate-200">{row.system_roles}</td>
                          <td className="px-4 py-2 text-sm font-medium text-blue-700 border border-slate-200">{row.mapped_role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {previewData.totalRows > (previewData.previewRows?.length || 0) && (
                <p className="text-sm text-slate-600 text-center">
                  Showing first {previewData.previewRows?.length || 0} rows of {previewData.totalRows} total rows
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportCenter;

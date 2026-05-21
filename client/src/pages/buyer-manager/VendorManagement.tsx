import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { useQueryClient } from '@tanstack/react-query';
import { buyerService } from '../../services/buyerService';
import { 
  Building2, 
  Search, 
  Filter, 
  Plus, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Star,
  Phone,
  Mail,
  MapPin,
  FileText,
  TrendingUp,
  Package,
  AlertTriangle,
  User,
  DollarSign,
  Calendar,
  Award,
  Upload,
  History,
  ShieldCheck,
  Ban,
  GitMerge,
  X,
  Briefcase,
  Landmark,
  Building,
  Tag,
  Sparkles,
  Download,
  Edit2,
  Save,
  XCircle as XIcon,
  Eye,
  Hash,
} from 'lucide-react';
import { AppModal } from '../../components/AppModal';
import { VendorDetailModalShell } from '../../components/buyer-manager/vendor-detail/VendorDetailModalShell';
import { VendorProfileTab } from '../../components/buyer-manager/vendor-detail/VendorProfileTab';
import {
  VendorDetailTabPanel,
  vendorDetailBtnPrimaryClass,
  vendorDetailBtnSecondaryClass,
  vendorDetailCardClass,
  vendorDetailInputClass,
  VendorFieldLabel,
  VendorFieldValue,
} from '../../components/buyer-manager/vendor-detail/vendorDetailUi';
import {
  dashboardPageContentInsetBottomWorkspaceClass,
  dashboardPageContentInsetXClass,
} from '../../constants/dashboardLayout';
import { requestorPageStackClass } from '../../constants/requestorLayout';
import {
  buyerInteractiveTableClass,
  buyerInteractiveTableBodyClass,
  buyerTableAccentRailClass,
  buyerTableCellWrapClass,
  buyerTableDataRowVisual,
  buyerTableFirstCellInnerClass,
  buyerWorkspaceDataCardClass,
  buyerWorkspaceFiltersCardClass,
  buyerWorkspaceTableTitleBarClass,
  buyerWorkspaceTableViewportClass,
} from '../../constants/buyerLayout';
import {
  departmentHeadTableCellContentWrapFlexClass,
} from '../../constants/departmentHeadLayout';

const pageRootClass = [
  requestorPageStackClass,
  dashboardPageContentInsetXClass,
  dashboardPageContentInsetBottomWorkspaceClass,
  'w-full min-w-0 max-w-none mx-0 bg-[#f1f5f9]',
  'animate-fade-in-right fade-in-right-delay-0',
].join(' ');

// Types
type VendorStatus = 'APPROVED' | 'PENDING' | 'BLOCKED' | 'INACTIVE';
type VendorCategory = 'Electrical' | 'Mechanical' | 'Fabrication' | 'Chemical' | 'IT' | 'Services';

/** Vỏ icon cột danh NCC — màu theo trạng thái (data-table-interactive-enterprise · hierarchy rõ). */
function vendorListAvatarShellClass(status: VendorStatus): string {
  switch (status) {
    case 'APPROVED':
      return 'bg-emerald-100 ring-1 ring-emerald-200/90 text-emerald-700 shadow-sm shadow-emerald-500/10';
    case 'PENDING':
      return 'bg-amber-100 ring-1 ring-amber-200/90 text-amber-700 shadow-sm shadow-amber-500/10';
    case 'BLOCKED':
      return 'bg-rose-100 ring-1 ring-rose-200/90 text-rose-700 shadow-sm shadow-rose-500/10';
    case 'INACTIVE':
      return 'bg-slate-100 ring-1 ring-slate-200/90 text-slate-600 shadow-sm shadow-slate-500/10';
    default:
      return 'bg-slate-100 ring-1 ring-slate-200/90 text-slate-600';
  }
}

interface Vendor {
  id: string;
  code: string;
  name: string;
  taxCode?: string;
  address: string;
  country: string;
  legalRepresentative?: string;
  capital?: string;
  registeredOffice?: string;
  category: VendorCategory[];
  supplierType: 'STANDARD' | 'CUSTOM';
  status: VendorStatus;
  rating?: number;
  lastPO?: string;
  isPreferred: boolean;
  hasContract: boolean;
  onTimeDelivery: number;
  poCount: number;
  qualityIssues: number;
  tags?: string[];
  growthInsight?: string;
  avlStatus?: string;
  bankName?: string;
  bankAccountNo?: string;
}

const COUNTRY_CODE_MAP: Record<string, string> = {
  vietnam: 'VN',
  'viet nam': 'VN',
  'việt nam': 'VN',
  vn: 'VN',
  china: 'CN',
  cn: 'CN',
  usa: 'US',
  us: 'US',
  'united states': 'US',
};

const CATEGORY_CODE_MAP: Record<string, string> = {
  electrical: 'ELE',
  'điện': 'ELE',
  dien: 'ELE',
  mechanical: 'MEC',
  'cơ khí': 'MEC',
  'co khi': 'MEC',
  fabrication: 'FAB',
  'gia công': 'FAB',
  'gia cong': 'FAB',
  services: 'SRV',
  service: 'SRV',
  'dịch vụ': 'SRV',
  'dich vu': 'SRV',
  it: 'ITE',
  technology: 'ITE',
  chemical: 'CHM',
  'hóa chất': 'CHM',
  'hoa chat': 'CHM',
};

const toCountryCode = (country?: string): string => {
  const key = (country || '').trim().toLowerCase();
  return COUNTRY_CODE_MAP[key] || 'VN';
};

const toCategoryCode = (category?: VendorCategory[]): string => {
  const key = (category?.[0] || '').trim().toLowerCase();
  return CATEGORY_CODE_MAP[key] || 'SRV';
};

const isLegacyVendorCode = (code?: string): boolean => /^VND-\d{1,5}$/i.test((code || '').trim());

const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  APPROVED: 'Đã duyệt',
  PENDING: 'Chờ duyệt',
  BLOCKED: 'Đã chặn',
  INACTIVE: 'Không hoạt động',
};

const VENDOR_CATEGORY_LABELS: Record<VendorCategory, string> = {
  Electrical: 'Điện',
  Mechanical: 'Cơ khí',
  Fabrication: 'Gia công',
  Chemical: 'Hóa chất',
  IT: 'Công nghệ',
  Services: 'Dịch vụ',
};

function vendorListEmptyHint(
  totalVendors: number,
  searchQuery: string,
  statusFilter: string,
  categoryFilter: string,
  preferredOnly: boolean,
  contractOnly: boolean,
): string {
  if (searchQuery.trim()) return 'Không có kết quả khớp từ khóa.';
  if (totalVendors === 0) return 'Chưa có nhà cung cấp. Nhấn Import NCC để thêm danh sách.';
  if (statusFilter !== 'all') return `Không có NCC ở trạng thái «${VENDOR_STATUS_LABELS[statusFilter as VendorStatus] ?? statusFilter}».`;
  if (categoryFilter !== 'all') {
    return `Không có NCC thuộc ngành «${VENDOR_CATEGORY_LABELS[categoryFilter as VendorCategory] ?? categoryFilter}».`;
  }
  if (preferredOnly) return 'Không có NCC ưu tiên khớp bộ lọc.';
  if (contractOnly) return 'Không có NCC có hợp đồng khớp bộ lọc.';
  return 'Không có nhà cung cấp khớp bộ lọc.';
}

// Helper function
const safeReferenceHref = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

// LocalStorage key
const VENDORS_STORAGE_KEY = 'buyer-manager-vendors';

const VENDOR_DETAIL_TABS = [
  { id: 'profile', label: 'Hồ sơ', icon: Building2 },
  { id: 'contacts', label: 'Liên hệ', icon: User },
  { id: 'commercial', label: 'Thương mại', icon: DollarSign },
  { id: 'performance', label: 'Hiệu suất', icon: TrendingUp },
  { id: 'documents', label: 'Tài liệu', icon: FileText },
  { id: 'history', label: 'Lịch sử', icon: History },
] as const;

const VendorManagement = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasAutoSyncedVendorsRef = useRef(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [dbSupplierCount, setDbSupplierCount] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [preferredOnly, setPreferredOnly] = useState(false);
  const [contractOnly, setContractOnly] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'contacts' | 'commercial' | 'performance' | 'documents' | 'history'>('profile');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState<any>({});
  const [isEditingCommercial, setIsEditingCommercial] = useState(false);
  const [commercialData, setCommercialData] = useState({
    paymentTerms: 'Net 30 ngày',
    leadTime: '7-10 ngày',
    moq: '1 đơn vị',
    currency: 'USD'
  });
  const [isEditingPerformance, setIsEditingPerformance] = useState(false);
  const [performanceData, setPerformanceData] = useState({
    onTimeDelivery: 0,
    poCount: 0,
    avgLeadTime: '8',
    qualityIssues: 0
  });

  const mapApiSupplierToVendor = (s: {
    id: string;
    name: string;
    code?: string | null;
    address?: string | null;
    taxCode?: string | null;
    contactPerson?: string | null;
    bankName?: string | null;
    bankAccount?: string | null;
  }): Vendor => ({
    id: s.id,
    code: s.code?.trim() || '',
    name: s.name,
    taxCode: s.taxCode ?? undefined,
    address: s.address?.trim() || '—',
    country: 'Vietnam',
    legalRepresentative: s.contactPerson ?? undefined,
    category: ['Services'],
    supplierType: 'STANDARD',
    status: 'APPROVED',
    isPreferred: false,
    hasContract: false,
    onTimeDelivery: 0,
    poCount: 0,
    qualityIssues: 0,
    bankName: s.bankName ?? undefined,
    bankAccountNo: s.bankAccount ?? undefined,
  });

  const reloadVendorsFromApi = useCallback(async () => {
    const { suppliers } = await buyerService.getSuppliers();
    setDbSupplierCount(suppliers?.length ?? 0);
    if (!suppliers?.length) return;
    setVendors(suppliers.map(mapApiSupplierToVendor));
    await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
  }, [queryClient]);

  // Load vendors from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(VENDORS_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Vendor[];
        // Migrate legacy vendor code (e.g. VND-001) to new format without requiring re-import.
        const migrated = parsed.map((vendor, index) => {
          if (!vendor.code || isLegacyVendorCode(vendor.code)) {
            const nextCode = `VND-${toCountryCode(vendor.country)}-${toCategoryCode(vendor.category)}-${String(index + 1).padStart(5, '0')}`;
            return { ...vendor, code: nextCode };
          }
          return vendor;
        });

        setVendors(migrated);
      } catch (error) {
        console.error('Failed to parse vendors from localStorage:', error);
      }
    }
  }, []);

  // Nguồn chính cho Buyer: API /suppliers (database). localStorage chỉ để bootstrap + auto-sync.
  useEffect(() => {
    void reloadVendorsFromApi().catch((err) => console.error('Load suppliers from API failed:', err));
  }, [reloadVendorsFromApi]);

  // Save vendors to localStorage whenever it changes
  useEffect(() => {
    if (vendors.length > 0) {
      localStorage.setItem(VENDORS_STORAGE_KEY, JSON.stringify(vendors));
    }
  }, [vendors]);

  // Auto-sync existing local vendors to DB once per page load.
  // This lets previously imported browser data become system-wide without re-importing the Excel file.
  useEffect(() => {
    if (hasAutoSyncedVendorsRef.current || vendors.length === 0) return;

    hasAutoSyncedVendorsRef.current = true;
    const suppliersForDb = vendors.map((vendor) => ({
      name: vendor.name,
      code: !vendor.code || isLegacyVendorCode(vendor.code) ? undefined : vendor.code,
      country: vendor.country || undefined,
      category: vendor.category?.[0] || undefined,
      address: vendor.address || undefined,
      taxCode: vendor.taxCode || undefined,
      contactPerson: vendor.legalRepresentative || undefined,
      bankName: vendor.bankName || undefined,
      bankAccount: vendor.bankAccountNo || undefined,
    }));

    buyerService.importSuppliersBulk(suppliersForDb).then((result) => {
      console.log(
        `✅ Auto-sync vendors to DB: inserted=${result.inserted}, skipped=${result.skipped}, total=${result.totalReceived}`
      );
      void reloadVendorsFromApi();
    }).catch((error) => {
      console.error('❌ Auto-sync vendors to DB failed:', error);
      // Allow next vendors change to retry if first auto-sync fails.
      hasAutoSyncedVendorsRef.current = false;
    });
  }, [vendors]);

  // Lock body scroll when import modal is open
  useEffect(() => {
    if (isImportModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isImportModalOpen]);

  useEffect(() => {
    setSelectedVendorId(null);
  }, [searchQuery, statusFilter, categoryFilter, preferredOnly, contractOnly]);

  // Update vendor field
  const updateVendorField = (vendorId: string, field: keyof Vendor, value: any) => {
    setVendors(prev => prev.map(v => 
      v.id === vendorId ? { ...v, [field]: value } : v
    ));
  };

  // Start editing a field
  const startEditing = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue || '');
  };

  // Save edited field
  const saveEdit = (field: keyof Vendor) => {
    if (selectedVendorId) {
      updateVendorField(selectedVendorId, field, editValue);
    }
    setEditingField(null);
    setEditValue('');
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  // Parse Excel file
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        // Helper function to get value from row with multiple possible column names
        const getValue = (row: any, ...keys: string[]): string => {
          for (const key of keys) {
            const value = row[key];
            if (value !== undefined && value !== null && String(value).trim() !== '') {
              return String(value).trim();
            }
          }
          return '';
        };

        if (jsonData.length === 0) {
          setImportError('File Excel trống hoặc không có dữ liệu.');
          return;
        }

        // Log column names for debugging
        const columnNames = Object.keys(jsonData[0] || {});
        console.log('Excel columns found:', columnNames);

        // Parse and validate data
        const importedVendors: Vendor[] = jsonData.map((row, index) => {
          // Parse categories (comma-separated)
          const categoriesStr = getValue(
            row, 
            'Category Supplied', 'Ngành hàng cung cấp', 'Category', 'Ngành hàng',
            'category_supplied', 'category', 'categories'
          );
          const categoryArray = categoriesStr ? categoriesStr.split(',').map((c: string) => c.trim()).filter((c: string) => c) : [];

          // Parse tags (comma-separated)
          const tagsStr = getValue(
            row, 
            'Certifications', 'Chứng chỉ', 'Tags',
            'certifications', 'tags', 'certification'
          );
          const tagsArray = tagsStr ? tagsStr.split(',').map((t: string) => t.trim()).filter((t: string) => t) : [];

          // Get fields - all optional
          const name = getValue(
            row, 
            'Vendor Name', 'Tên NCC', 'Name', 'Tên nhà cung cấp', 'Tên',
            'vendor_name', 'vendorName', 'VENDOR_NAME'
          ) || `Vendor-${index + 1}`; // Auto-generate if empty
          const taxCode = getValue(
            row, 
            'Tax Identifier', 'Mã số thuế', 'Tax Code', 'MST', 'Tax ID',
            'tax_code', 'tax_identifier', 'taxCode', 'taxIdentifier', 'TAX_CODE', 'TAX_IDENTIFIER'
          );

          const country = getValue(
            row,
            'Country', 'Quốc gia',
            'country'
          ) || 'Vietnam';
          const rawCode = getValue(
            row,
            'Vendor Code', 'Mã NCC', 'Code', 'Mã',
            'vendor_code', 'vendorCode', 'code'
          );

          return {
            id: `vendor-${Date.now()}-${index}`,
            code: rawCode,
            name,
            taxCode,
            address: getValue(
              row, 
              'Address', 'Địa chỉ',
              'address', 'addr'
            ),
            country,
            legalRepresentative: getValue(
              row, 
              'Legal Representative', 'Người đại diện pháp luật', 'ĐDPL',
              'legal_representative', 'legalRepresentative'
            ),
            capital: getValue(
              row, 
              'Capital', 'Vốn điều lệ',
              'capital'
            ),
            registeredOffice: getValue(
              row, 
              'Registered Office', 'Văn phòng đăng ký', 'VPĐK',
              'registered_office', 'registeredOffice'
            ),
            category: categoryArray as VendorCategory[],
            supplierType: (getValue(
              row, 
              'Supplier Type', 'Loại NCC', 'Type',
              'supplier_type', 'supplierType', 'type'
            ) || 'STANDARD').toUpperCase() as 'STANDARD' | 'CUSTOM',
            status: (getValue(
              row, 
              'Status', 'Trạng thái',
              'status'
            ) || 'PENDING').toUpperCase() as VendorStatus,
            avlStatus: getValue(
              row, 
              'AVL Status', 'Trạng thái AVL', 'AVL',
              'avl_status', 'avlStatus', 'avl'
            ),
            bankName: getValue(
              row,
              'Bank Name', 'Tên ngân hàng', 'Bank',
              'bank_name', 'bankName'
            ),
            bankAccountNo: getValue(
              row,
              'Bank Account No', 'Số tài khoản', 'Account No', 'Account Number',
              'bank_account_no', 'bankAccountNo', 'account_no', 'account_number'
            ),
            tags: tagsArray,
            isPreferred: false,
            hasContract: false,
            onTimeDelivery: 0,
            poCount: 0,
            qualityIssues: 0,
          };
        });

        const suppliersForDb = importedVendors.map((vendor) => ({
          name: vendor.name,
          code: !vendor.code || isLegacyVendorCode(vendor.code) ? undefined : vendor.code,
          country: vendor.country || undefined,
          category: vendor.category?.[0] || undefined,
          address: vendor.address || undefined,
          taxCode: vendor.taxCode || undefined,
          contactPerson: vendor.legalRepresentative || undefined,
          bankName: vendor.bankName || undefined,
          bankAccount: vendor.bankAccountNo || undefined,
        }));

        const importResult = await buyerService.importSuppliersBulk(suppliersForDb);
        console.log(
          `✅ Imported suppliers to DB: inserted=${importResult.inserted}, skipped=${importResult.skipped}, total=${importResult.totalReceived}`
        );

        await reloadVendorsFromApi();
        setIsImportModalOpen(false);
        setImportError(null);

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error('Excel parse error:', error);
        setImportError('Không thể đọc file Excel. Vui lòng kiểm tra định dạng file.');
      }
    };

    reader.onerror = () => {
      setImportError('Lỗi khi đọc file');
    };

    reader.readAsBinaryString(file);
  };

  // Download Excel template
  const downloadTemplate = () => {
    const template = [
      {
        'Vendor Code': 'VND-001',
        'Vendor Name': 'Tên nhà cung cấp',
        'Tax Identifier': '0123456789',
        'Legal Representative': 'Nguyễn Văn A',
        'Capital': '100,000,000,000 VND',
        'Registered Office': 'Địa chỉ đăng ký công ty',
        'Address': 'Địa chỉ liên hệ',
        'Country': 'Vietnam',
        'Category Supplied': 'Electrical,IT',
        'Supplier Type': 'STANDARD',
        'Status': 'APPROVED',
        'AVL Status': 'Verified for 2024',
        'Bank Name': 'Vietcombank',
        'Bank Account No': '1234567890',
        'Certifications': 'ISO 9001,ISO 14001',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendors');
    XLSX.writeFile(workbook, 'vendor-import-template.xlsx');
  };

  // Filtered vendors
  const filteredVendors = useMemo(() => {
    return vendors.filter(vendor => {
      const matchSearch = 
        vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vendor.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (vendor.taxCode ?? '').includes(searchQuery);
      
      const matchStatus = statusFilter === 'all' || vendor.status === statusFilter;
      const matchCategory = categoryFilter === 'all' || vendor.category.includes(categoryFilter as VendorCategory);
      const matchPreferred = !preferredOnly || vendor.isPreferred;
      const matchContract = !contractOnly || vendor.hasContract;

      return matchSearch && matchStatus && matchCategory && matchPreferred && matchContract;
    });
  }, [vendors, searchQuery, statusFilter, categoryFilter, preferredOnly, contractOnly]);

  const selectedVendor = vendors.find(v => v.id === selectedVendorId);

  const openVendorDetail = (vendorId: string) => {
    setActiveTab('profile');
    setSelectedVendorId(vendorId);
  };

  const closeVendorDetail = () => {
    setSelectedVendorId(null);
    setActiveTab('profile');
    setIsEditingProfile(false);
    setIsEditingCommercial(false);
    setIsEditingPerformance(false);
    setEditingField(null);
  };

  // Stats
  const stats = {
    total: vendors.length,
    approved: vendors.filter(v => v.status === 'APPROVED').length,
    pending: vendors.filter(v => v.status === 'PENDING').length,
    preferred: vendors.filter(v => v.isPreferred).length,
  };

  // Status badge helper
  const getStatusBadge = (status: VendorStatus) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PENDING':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'BLOCKED':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'INACTIVE':
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getStatusIcon = (status: VendorStatus) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2} aria-hidden />;
      case 'PENDING':
        return <Clock className="h-3.5 w-3.5 text-amber-600" strokeWidth={2} aria-hidden />;
      case 'BLOCKED':
        return <Ban className="h-3.5 w-3.5 text-rose-600" strokeWidth={2} aria-hidden />;
      case 'INACTIVE':
        return <XCircle className="h-3.5 w-3.5 text-slate-500" strokeWidth={2} aria-hidden />;
    }
  };

  return (
    <div className={pageRootClass}>
      {/* Banner with Summary Cards Inside */}
      <div className="page-banner-dark page-banner-dark-tint-indigo page-banner-dark-no-outer-shadow relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="page-banner-dark-kicker">Buyer Manager · Vendor Management</p>
              <h1 className="page-banner-dark-title mt-1">Quản lý nhà cung cấp</h1>
              <p className="page-banner-dark-desc mt-1 max-w-2xl">Master data, phê duyệt NCC, hiệu suất & risk control</p>
            </div>
            
            {/* Import Button */}
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 px-5 py-3 text-sm font-bold bg-white/20 backdrop-blur-sm border-2 border-white/30 text-white rounded-2xl shadow-lg hover:bg-white/30 hover:-translate-y-1 transition-all duration-300"
            >
              <Plus className="w-5 h-5" strokeWidth={2.5} />
              <span className="hidden sm:inline">Import NCC</span>
            </button>
          </div>

          {/* Summary Cards Inside Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 mt-6">
            {/* Total Vendors */}
            <div className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-4 hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                  <Building2 className="h-5 w-5 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/60">Tổng số</p>
                  <p className="text-2xl font-black text-white">{stats.total}</p>
                </div>
              </div>
            </div>

            {/* Approved */}
            <div className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-4 hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
                  <CheckCircle className="h-5 w-5 text-emerald-300" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/60">Đã duyệt</p>
                  <p className="text-2xl font-black text-white">{stats.approved}</p>
                </div>
              </div>
            </div>

            {/* Pending */}
            <div className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-4 hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
                  <Clock className="h-5 w-5 text-amber-300" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/60">Chờ duyệt</p>
                  <p className="text-2xl font-black text-white">{stats.pending}</p>
                </div>
              </div>
            </div>

            {/* Preferred */}
            <div className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-4 hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20">
                  <Star className="h-5 w-5 text-violet-300" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/60">Ưu tiên</p>
                  <p className="text-2xl font-black text-white">{stats.preferred}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative Icon */}
        <div className="page-banner-deco-icon" aria-hidden>
          <Building2 className="h-12 w-12 sm:h-14 sm:w-14" strokeWidth={1.5} />
        </div>
      </div>

        <article className={buyerWorkspaceFiltersCardClass}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative min-w-0 sm:col-span-2 lg:col-span-2">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-indigo-500"
                strokeWidth={2}
                aria-hidden
              />
              <input
                type="search"
                autoComplete="off"
                placeholder="Tìm theo tên, mã NCC, MST…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100/80 pl-10 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <Filter className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                aria-label="Lọc trạng thái NCC"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="APPROVED">Đã duyệt</option>
                <option value="PENDING">Chờ duyệt</option>
                <option value="BLOCKED">Đã chặn</option>
                <option value="INACTIVE">Không hoạt động</option>
              </select>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <Tag className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                aria-label="Lọc ngành hàng"
              >
                <option value="all">Tất cả ngành hàng</option>
                <option value="Electrical">Điện</option>
                <option value="Mechanical">Cơ khí</option>
                <option value="Fabrication">Gia công</option>
                <option value="Chemical">Hóa chất</option>
                <option value="IT">Công nghệ</option>
                <option value="Services">Dịch vụ</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
            <label className="flex cursor-pointer items-center gap-2.5">
              <div className={`relative flex h-6 w-11 items-center rounded-full transition-all ${preferredOnly ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                <input type="checkbox" checked={preferredOnly} onChange={(e) => setPreferredOnly(e.target.checked)} className="sr-only" />
                <div className={`absolute h-5 w-5 rounded-full bg-white shadow-md transition-transform ${preferredOnly ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm font-medium text-slate-700">Chỉ NCC ưu tiên</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5">
              <div className={`relative flex h-6 w-11 items-center rounded-full transition-all ${contractOnly ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                <input type="checkbox" checked={contractOnly} onChange={(e) => setContractOnly(e.target.checked)} className="sr-only" />
                <div className={`absolute h-5 w-5 rounded-full bg-white shadow-md transition-transform ${contractOnly ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm font-medium text-slate-700">Có hợp đồng</span>
            </label>
          </div>
        </article>

        <article className={`${buyerWorkspaceDataCardClass} border-indigo-100/40 ring-1 ring-indigo-100/50`}>
          <div className={`${buyerWorkspaceTableTitleBarClass} border-indigo-100/50 bg-gradient-to-r from-indigo-50/90 via-white to-violet-50/60`}>
            <h2 className="flex items-center gap-2.5 text-lg font-bold text-slate-900 sm:text-xl">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25 ring-2 ring-white/80">
                <Building2 className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
              Danh sách nhà cung cấp
              <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-sm font-bold tabular-nums text-indigo-900 shadow-sm ring-1 ring-indigo-100/80">
                {filteredVendors.length}
              </span>
            </h2>
            {dbSupplierCount != null ? (
              <p className="mt-2 text-xs font-medium text-slate-600">
                {dbSupplierCount} NCC trong database — dùng chung cho Quản lý báo giá / xuất PDF.
              </p>
            ) : null}
          </div>
          <div className={buyerWorkspaceTableViewportClass}>
            <table className={`${buyerInteractiveTableClass} w-full min-w-[960px] bg-white`}>
              <thead className="sticky top-0 z-20 border-b border-indigo-100/80 bg-gradient-to-r from-indigo-50/95 via-white to-violet-50/70 shadow-[0_1px_0_0_rgba(99,102,241,0.12)] backdrop-blur-sm">
                <tr>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-indigo-950/90 sm:px-6">
                    <span className="inline-flex items-center gap-2">
                      <Hash className="h-4 w-4 shrink-0 text-indigo-600" strokeWidth={2} aria-hidden />
                      Mã NCC
                    </span>
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-indigo-950/90 sm:px-6">Tên nhà cung cấp</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-indigo-950/90 sm:px-6">MST</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-indigo-950/90 sm:px-6">Ngành hàng</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-indigo-950/90 sm:px-6">Trạng thái</th>
                  <th className="px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wide text-indigo-950/90 sm:px-6">Thao tác</th>
                </tr>
              </thead>
              <tbody className={buyerInteractiveTableBodyClass}>
                {filteredVendors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-14 text-center text-sm font-medium text-slate-500">
                      {vendorListEmptyHint(vendors.length, searchQuery, statusFilter, categoryFilter, preferredOnly, contractOnly)}
                    </td>
                  </tr>
                ) : (
                  filteredVendors.map((vendor, index) => (
                    <tr key={vendor.id} className={`group cursor-pointer ${buyerTableDataRowVisual(index)}`} onClick={() => openVendorDetail(vendor.id)}>
                      <td className="relative whitespace-nowrap px-4 py-3 sm:px-6">
                        <div aria-hidden className={buyerTableAccentRailClass} />
                        <div className={`${buyerTableFirstCellInnerClass} ${buyerTableCellWrapClass}`}>
                          <span className="font-mono text-sm font-bold text-indigo-800">{vendor.code}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 sm:px-6">
                        <div className={`${buyerTableCellWrapClass} ${departmentHeadTableCellContentWrapFlexClass}`}>
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${vendorListAvatarShellClass(vendor.status)}`}>
                            <Building2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{vendor.name}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              {vendor.isPreferred ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                                  <Star className="h-3 w-3 fill-amber-400 text-amber-500" aria-hidden />
                                  Ưu tiên
                                </span>
                              ) : null}
                              {vendor.hasContract ? <span className="text-[10px] font-semibold text-indigo-600">HĐ</span> : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700 sm:px-6">{vendor.taxCode || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 sm:px-6">
                        <span className="line-clamp-2">{vendor.category.map((c) => VENDOR_CATEGORY_LABELS[c] ?? c).join(', ')}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 sm:px-6">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${getStatusBadge(vendor.status)}`}>
                          {getStatusIcon(vendor.status)}
                          {VENDOR_STATUS_LABELS[vendor.status]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center sm:px-6">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openVendorDetail(vendor.id); }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-800 transition hover:bg-indigo-100"
                        >
                          <Eye className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                          Xem
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

      <AppModal
        open={!!selectedVendor}
        onClose={closeVendorDetail}
        title={
          selectedVendor ? (
            <>
              <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600">
                Chi tiết nhà cung cấp
              </span>
              <span className="mt-1 block truncate text-xl font-black text-slate-900 sm:text-2xl">
                {selectedVendor.name}
              </span>
            </>
          ) : (
            'Chi tiết nhà cung cấp'
          )
        }
        subtitle={
          selectedVendor ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="font-mono text-sm font-bold text-indigo-700">{selectedVendor.code}</span>
              {selectedVendor.taxCode ? (
                <span className="text-xs text-slate-500">MST: {selectedVendor.taxCode}</span>
              ) : null}
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${getStatusBadge(selectedVendor.status)}`}
              >
                {getStatusIcon(selectedVendor.status)}
                {VENDOR_STATUS_LABELS[selectedVendor.status]}
              </span>
            </span>
          ) : undefined
        }
        size="wide"
        zIndexClass="z-[210]"
        className="[&_.modal-content]:p-0"
      >
        {selectedVendor ? (
          <VendorDetailModalShell
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as typeof activeTab)}
            tabs={[...VENDOR_DETAIL_TABS]}
          >
            {activeTab === 'profile' && (
              <VendorProfileTab
                vendor={selectedVendor}
                categoryLabels={VENDOR_CATEGORY_LABELS}
                statusLabel={VENDOR_STATUS_LABELS[selectedVendor.status]}
                statusBadgeClass={getStatusBadge(selectedVendor.status)}
                statusIcon={getStatusIcon(selectedVendor.status)}
                isEditing={isEditingProfile}
                profileData={profileData}
                onProfileDataChange={setProfileData}
                onStartEdit={() => {
                  setIsEditingProfile(true);
                  setProfileData({
                    name: selectedVendor.name,
                    taxCode: selectedVendor.taxCode || '',
                    legalRepresentative: selectedVendor.legalRepresentative || '',
                    capital: selectedVendor.capital || '',
                    registeredOffice: selectedVendor.registeredOffice || '',
                    address: selectedVendor.address,
                    country: selectedVendor.country,
                    avlStatus: selectedVendor.avlStatus || '',
                  });
                }}
                onSave={() => {
                  updateVendorField(selectedVendor.id, 'name', profileData.name);
                  updateVendorField(selectedVendor.id, 'taxCode', profileData.taxCode);
                  updateVendorField(selectedVendor.id, 'legalRepresentative', profileData.legalRepresentative);
                  updateVendorField(selectedVendor.id, 'capital', profileData.capital);
                  updateVendorField(selectedVendor.id, 'registeredOffice', profileData.registeredOffice);
                  updateVendorField(selectedVendor.id, 'address', profileData.address);
                  updateVendorField(selectedVendor.id, 'country', profileData.country);
                  updateVendorField(selectedVendor.id, 'avlStatus', profileData.avlStatus);
                  setIsEditingProfile(false);
                }}
                onCancel={() => setIsEditingProfile(false)}
              />
            )}


                  {activeTab === 'contacts' && (
              <VendorDetailTabPanel
                title="Danh bạ liên hệ"
                actions={
                  <button type="button" className={vendorDetailBtnPrimaryClass}>
                    <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
                    Thêm liên hệ
                  </button>
                }
              >
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/90 px-6 py-14">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200/80">
                    <User className="h-8 w-8 text-slate-400" strokeWidth={2} aria-hidden />
                  </div>
                  <h4 className="mb-2 text-base font-bold text-slate-800">Chưa có thông tin liên hệ</h4>
                  <p className="mb-6 max-w-md text-center text-sm text-slate-500">
                    Thêm người phụ trách bán hàng, báo giá, thanh toán…
                  </p>
                  <button type="button" className={vendorDetailBtnSecondaryClass}>
                    <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
                    Thêm liên hệ đầu tiên
                  </button>
                </div>
              </VendorDetailTabPanel>
            )}

                  {activeTab === 'commercial' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800">Điều khoản thương mại</h3>
                {!isEditingCommercial ? (
                  <button
                    onClick={() => setIsEditingCommercial(true)}
                    className={vendorDetailBtnPrimaryClass}
                  >
                    <Edit2 className="w-4 h-4" strokeWidth={2.5} />
                    Cập nhật
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setIsEditingCommercial(false)} className={vendorDetailBtnPrimaryClass}>
                      <Save className="h-4 w-4" strokeWidth={2} aria-hidden />
                      Lưu
                    </button>
                    <button type="button" onClick={() => setIsEditingCommercial(false)} className={vendorDetailBtnSecondaryClass}>
                      <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                      Hủy
                    </button>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Payment Terms */}
                <div className={`${vendorDetailCardClass} p-4`}>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Điều kiện thanh toán</label>
                  {isEditingCommercial ? (
                    <input
                      type="text"
                      value={commercialData.paymentTerms}
                      onChange={(e) => setCommercialData({...commercialData, paymentTerms: e.target.value})}
                      className={vendorDetailInputClass}
                      placeholder="Net 30 ngày, Net 60 ngày..."
                    />
                  ) : (
                    <VendorFieldValue value={commercialData.paymentTerms} />
                  )}
                </div>

                {/* Lead Time */}
                <div className={`${vendorDetailCardClass} p-4`}>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Thời gian giao hàng</label>
                  {isEditingCommercial ? (
                    <input
                      type="text"
                      value={commercialData.leadTime}
                      onChange={(e) => setCommercialData({...commercialData, leadTime: e.target.value })}
                      className={vendorDetailInputClass}
                      placeholder="7-10 ngày, 2-3 tuần..."
                    />
                  ) : (
                    <VendorFieldValue value={commercialData.leadTime} />
                  )}
                </div>

                {/* MOQ */}
                <div className={`${vendorDetailCardClass} p-4`}>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Số lượng đặt tối thiểu</label>
                  {isEditingCommercial ? (
                    <input
                      type="text"
                      value={commercialData.moq}
                      onChange={(e) => setCommercialData({ ...commercialData, moq: e.target.value })}
                      className={vendorDetailInputClass}
                      placeholder="1 đơn vị, 100 cái..."
                    />
                  ) : (
                    <VendorFieldValue value={commercialData.moq} />
                  )}
                </div>

                <div className={`${vendorDetailCardClass} p-4`}>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Đơn vị tiền tệ</label>
                  {isEditingCommercial ? (
                    <input
                      type="text"
                      value={commercialData.currency}
                      onChange={(e) => setCommercialData({ ...commercialData, currency: e.target.value })}
                      className={vendorDetailInputClass}
                      placeholder="USD, VND, EUR..."
                    />
                  ) : (
                    <VendorFieldValue value={commercialData.currency} />
                  )}
                </div>
              </div>

              <VendorDetailTabPanel title="Thông tin ngân hàng" className="mt-4">
                <div className="space-y-5">
                  <div className="group">
                    <VendorFieldLabel icon={Landmark}>Tên ngân hàng</VendorFieldLabel>
                    <div className="min-w-0">
                      {editingField === 'bankName' ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 px-3 py-2 text-base font-bold text-slate-800 bg-slate-50 border-2 border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            placeholder="Vietcombank, BIDV, Techcombank..."
                            autoFocus
                          />
                          <button
                            onClick={() => saveEdit('bankName')}
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                          >
                            <Save className="w-4 h-4" strokeWidth={2.5} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
                          >
                            <XIcon className="w-4 h-4" strokeWidth={2.5} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <VendorFieldValue value={selectedVendor.bankName} />
                          <button
                            onClick={() => startEditing('bankName', selectedVendor.bankName || '')}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Edit2 className="w-3.5 h-3.5" strokeWidth={2} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="group">
                    <VendorFieldLabel icon={DollarSign}>Số tài khoản</VendorFieldLabel>
                    <div className="min-w-0">
                      {editingField === 'bankAccountNo' ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 px-3 py-2 text-base font-bold text-slate-800 bg-slate-50 border-2 border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                            placeholder="1234567890"
                            autoFocus
                          />
                          <button
                            onClick={() => saveEdit('bankAccountNo')}
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                          >
                            <Save className="w-4 h-4" strokeWidth={2.5} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
                          >
                            <XIcon className="w-4 h-4" strokeWidth={2.5} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <VendorFieldValue value={selectedVendor.bankAccountNo} mono />
                          <button
                            onClick={() => startEditing('bankAccountNo', selectedVendor.bankAccountNo || '')}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Edit2 className="w-3.5 h-3.5" strokeWidth={2} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 ring-1 ring-slate-900/[0.03]">
                    <VendorFieldLabel icon={User}>Chủ tài khoản</VendorFieldLabel>
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedVendor.legalRepresentative || selectedVendor.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Thường là người đại diện pháp luật hoặc tên công ty</p>
                  </div>
                </div>
              </VendorDetailTabPanel>
            </div>
                  )}

                  {activeTab === 'performance' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800">Bảng hiệu suất</h3>
                {!isEditingPerformance ? (
                  <button
                    onClick={() => {
                      setIsEditingPerformance(true);
                      setPerformanceData({
                        onTimeDelivery: selectedVendor.onTimeDelivery,
                        poCount: selectedVendor.poCount,
                        avgLeadTime: '8',
                        qualityIssues: selectedVendor.qualityIssues
                      });
                    }}
                    className={vendorDetailBtnPrimaryClass}
                  >
                    <Edit2 className="w-4 h-4" strokeWidth={2.5} />
                    Cập nhật
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        updateVendorField(selectedVendor.id, 'onTimeDelivery', parseInt(performanceData.onTimeDelivery.toString()));
                        updateVendorField(selectedVendor.id, 'poCount', parseInt(performanceData.poCount.toString()));
                        updateVendorField(selectedVendor.id, 'qualityIssues', parseInt(performanceData.qualityIssues.toString()));
                        setIsEditingPerformance(false);
                      }}
                      className={vendorDetailBtnPrimaryClass}
                    >
                      <Save className="h-4 w-4" strokeWidth={2} aria-hidden />
                      Lưu
                    </button>
                    <button type="button" onClick={() => setIsEditingPerformance(false)} className={vendorDetailBtnSecondaryClass}>
                      <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                      Hủy
                    </button>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* On-time Delivery */}
                <div className="p-6 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/50 hover:scale-[1.02] transition-transform duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-200">
                      <TrendingUp className="w-6 h-6" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-800 mb-1">Giao hàng đúng hạn</p>
                      {isEditingPerformance ? (
                        <input
                          type="number"
                          value={performanceData.onTimeDelivery}
                          onChange={(e) => setPerformanceData({...performanceData, onTimeDelivery: parseInt(e.target.value) || 0})}
                          className="w-24 px-2 py-1 text-2xl font-black text-emerald-700 bg-white border-2 border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                          max="100"
                          min="0"
                        />
                      ) : (
                        <p className="text-3xl font-black text-emerald-700">{selectedVendor.onTimeDelivery}%</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-emerald-700 font-medium">Hiệu suất xuất sắc</p>
                </div>

                {/* PO Count */}
                <div className="p-6 rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50/50 hover:scale-[1.02] transition-transform duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-200">
                      <Package className="w-6 h-6" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-indigo-800 mb-1">Số đơn hàng</p>
                      {isEditingPerformance ? (
                        <input
                          type="number"
                          value={performanceData.poCount}
                          onChange={(e) => setPerformanceData({...performanceData, poCount: parseInt(e.target.value) || 0})}
                          className="w-24 px-2 py-1 text-2xl font-black text-indigo-700 bg-white border-2 border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          min="0"
                        />
                      ) : (
                        <p className="text-3xl font-black text-indigo-700">{selectedVendor.poCount}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-indigo-700 font-medium">Tổng đơn đã đặt</p>
                </div>

                {/* Avg Lead Time */}
                <div className="p-6 rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/50 hover:scale-[1.02] transition-transform duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-200">
                      <Clock className="w-6 h-6" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-amber-800 mb-1">Thời gian TB</p>
                      {isEditingPerformance ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={performanceData.avgLeadTime}
                            onChange={(e) => setPerformanceData({...performanceData, avgLeadTime: e.target.value})}
                            className="w-16 px-2 py-1 text-2xl font-black text-amber-700 bg-white border-2 border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                            min="0"
                          />
                          <span className="text-lg font-black text-amber-700">d</span>
                        </div>
                      ) : (
                        <p className="text-3xl font-black text-amber-700">8<span className="text-xl">d</span></p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-amber-700 font-medium">Thời gian giao hàng trung bình</p>
                </div>

                {/* Quality Issues */}
                <div className="p-6 rounded-2xl border-2 border-rose-200 bg-gradient-to-br from-rose-50 to-red-50/50 hover:scale-[1.02] transition-transform duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500 text-white shadow-lg shadow-rose-200">
                      <AlertTriangle className="w-6 h-6" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-rose-800 mb-1">Vấn đề chất lượng</p>
                      {isEditingPerformance ? (
                        <input
                          type="number"
                          value={performanceData.qualityIssues}
                          onChange={(e) => setPerformanceData({...performanceData, qualityIssues: parseInt(e.target.value) || 0})}
                          className="w-24 px-2 py-1 text-2xl font-black text-rose-700 bg-white border-2 border-rose-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                          min="0"
                        />
                      ) : (
                        <p className="text-3xl font-black text-rose-700">{selectedVendor.qualityIssues}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-rose-700 font-medium">Số vấn đề đã báo cáo</p>
                </div>
              </div>
            </div>
                  )}

                  {activeTab === 'documents' && (
            <VendorDetailTabPanel
              title="Thư viện tài liệu"
              actions={
                <button type="button" className={vendorDetailBtnPrimaryClass}>
                  <Upload className="h-4 w-4" strokeWidth={2} aria-hidden />
                  Tải lên
                </button>
              }
            >
              <div className="space-y-3">
                {['Hồ sơ NCC.pdf', 'Thỏa thuận bảo mật.pdf', 'Chứng chỉ chất lượng.pdf', 'Catalog sản phẩm.xlsx'].map((doc, i) => (
                  <div key={i} className={`flex items-center justify-between p-4 ${vendorDetailCardClass}`}>
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 ring-1 ring-indigo-100/90">
                        <FileText className="h-5 w-5 text-indigo-600" strokeWidth={2} aria-hidden />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{doc}</p>
                        <p className="text-xs font-medium text-slate-500">Tải lên 2 ngày trước</p>
                      </div>
                    </div>
                    <button type="button" className={vendorDetailBtnSecondaryClass}>
                      Tải xuống
                    </button>
                  </div>
                ))}
              </div>
            </VendorDetailTabPanel>
                  )}

                  {activeTab === 'history' && (
            <VendorDetailTabPanel title="Dòng thời gian hoạt động">
              <div className="relative">
                {/* Timeline Line */}
                <div className="absolute left-6 top-6 bottom-6 w-px bg-slate-200" aria-hidden />
                
                <div className="space-y-6">
                  {[
                    { icon: ShieldCheck, color: 'emerald', bgColor: 'from-emerald-500 to-emerald-600', shadowColor: 'shadow-emerald-200', title: 'NCC được phê duyệt', date: '15/01/2024' },
                    { icon: FileText, color: 'indigo', bgColor: 'from-indigo-500 to-indigo-600', shadowColor: 'shadow-indigo-200', title: 'Hợp đồng đã ký', date: '10/01/2024' },
                    { icon: User, color: 'sky', bgColor: 'from-sky-500 to-sky-600', shadowColor: 'shadow-sky-200', title: 'NCC được tạo', date: '01/01/2024' },
                  ].map((event, i) => {
                    const Icon = event.icon;
                    return (
                      <div key={i} className="relative flex items-start gap-5">
                        <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm ring-4 ring-[#f8fafc]">
                          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
                        </div>
                        <div className="flex-1 pt-2">
                          <p className="text-sm font-black text-slate-800">{event.title}</p>
                          <p className="text-xs font-medium text-slate-500 mt-1">{event.date}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </VendorDetailTabPanel>
                  )}
          </VendorDetailModalShell>
        ) : null}
      </AppModal>

      {/* Import Modal */}
      {isImportModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] animate-modal-enter flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 sm:p-8 border-b-2 border-slate-100 shrink-0">
              <div>
                <h2 className="text-2xl font-black text-slate-800">Import nhà cung cấp</h2>
                <p className="text-sm font-medium text-slate-500 mt-1">Tải lên file Excel chứa danh sách NCC</p>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportError(null);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            {/* Body - Scrollable */}
            <div className="overflow-y-auto flex-1 p-6 sm:p-8 space-y-6">
              {/* Download Template */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 border-2 border-indigo-100">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-200 shrink-0">
                    <Download className="w-6 h-6" strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-black text-slate-800 mb-1">Bước 1: Tải file mẫu</h3>
                    <p className="text-sm font-medium text-slate-600 mb-3">Tải xuống file Excel mẫu và điền thông tin NCC</p>
                    <button
                      onClick={downloadTemplate}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold bg-white text-indigo-600 rounded-xl border-2 border-indigo-200 hover:bg-indigo-50 transition-colors"
                    >
                      <Download className="w-4 h-4" strokeWidth={2.5} />
                      Tải file mẫu (.xlsx)
                    </button>
                  </div>
                </div>
              </div>

              {/* Upload Area */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-white border-2 border-dashed border-slate-300 hover:border-indigo-400 transition-colors">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 mb-4">
                    <Upload className="w-8 h-8" strokeWidth={2} />
                  </div>
                  <h3 className="text-base font-black text-slate-800 mb-1">Bước 2: Tải lên file Excel</h3>
                  <p className="text-sm font-medium text-slate-500 mb-4">Chọn file .xlsx hoặc .xls đã điền đầy đủ thông tin</p>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="vendor-file-upload"
                  />
                  <label
                    htmlFor="vendor-file-upload"
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold bg-gradient-to-r from-indigo-600 to-violet-500 text-white rounded-2xl shadow-lg shadow-indigo-200 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" strokeWidth={2.5} />
                    Chọn file Excel
                  </label>
                </div>
              </div>

              {/* Error Message */}
              {importError && (
                <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-200 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" strokeWidth={2} />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-rose-900">Lỗi import</p>
                    <div className="text-sm font-medium text-rose-700 mt-1 whitespace-pre-line">
                      {importError}
                    </div>
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="p-4 rounded-xl bg-sky-50 border-2 border-sky-200">
                <p className="text-xs font-bold text-sky-900 mb-2">📋 Lưu ý:</p>
                <ul className="text-xs font-medium text-sky-800 space-y-1 ml-4 list-disc">
                  <li>File Excel phải có các cột theo file mẫu (download ở trên)</li>
                  <li><strong>Tất cả các trường đều có thể để trống</strong>, bổ sung sau bằng cách edit</li>
                  <li>Hỗ trợ cả tên cột tiếng Anh, tiếng Việt và snake_case (vd: vendor_name)</li>
                  <li>Ngành hàng và Chứng chỉ có thể nhập nhiều giá trị, cách nhau bởi dấu phẩy</li>
                  <li>Trạng thái: APPROVED, PENDING, BLOCKED, INACTIVE (mặc định: PENDING)</li>
                  <li>Loại NCC: STANDARD hoặc CUSTOM (mặc định: STANDARD)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default VendorManagement;

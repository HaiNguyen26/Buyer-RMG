import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './contexts/ToastContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BuyerManageDashboard from './pages/BuyerManageDashboard';
import DashboardHome from './pages/buyer-manage/DashboardHome';
import PROverview from './pages/buyer-manage/PROverview';
import SupplierOverview from './pages/buyer-manage/SupplierOverview';
import BuyerPerformance from './pages/buyer-manage/BuyerPerformance';
import Reports from './pages/buyer-manage/Reports';
import SystemConfiguration from './pages/buyer-manage/SystemConfiguration';
import ManagerNotifications from './pages/buyer-manage/Notifications';
import RequestorDashboard from './pages/RequestorDashboard';
import RequestorDashboardHome from './pages/requestor/DashboardHome';
import MyPurchaseRequests from './pages/requestor/MyPurchaseRequests';
import MyStockIssues from './pages/requestor/MyStockIssues';
import CreateStockIssue from './pages/requestor/CreateStockIssue';
import RequestorStockIssueDetail from './pages/requestor/RequestorStockIssueDetail';
import CreatePR from './pages/requestor/CreatePR';
import CustomerPODetail from './pages/requestor/CustomerPODetail';
import PRStatusTracking from './pages/requestor/PRStatusTracking';
import PRTracking from './pages/requestor/PRTracking';
import RequestorNotifications from './pages/requestor/Notifications';
import BuyerDashboard from './pages/BuyerDashboard';
import BuyerDashboardHome from './pages/buyer/DashboardHome';
import AssignedPR from './pages/buyer/AssignedPR';
import CreateQuotation from './pages/buyer/CreateQuotation';
import RFQManagement from './pages/buyer/RFQManagement';
import RFQDetail from './pages/buyer/RFQDetail';
import RFQEdit from './pages/buyer/RFQEdit';
import QuotationManagement from './pages/buyer/QuotationManagement';
import ProjectCostReference from './pages/buyer/ProjectCostReference';
import BuyerNotifications from './pages/buyer/Notifications';
import PriceComparison from './pages/buyer/PriceComparison';
import PRWaitingPO from './pages/buyer/PRWaitingPO';
import POList from './pages/buyer/POList';
import PODetail from './pages/buyer/PODetail';
import BranchManagerDashboard from './pages/BranchManagerDashboard';
import BranchManagerDashboardHome from './pages/branch-manager/DashboardHome';
import PRApproval from './pages/branch-manager/PRApproval';
import DepartmentHeadDashboard from './pages/DepartmentHeadDashboard';
import DepartmentHeadDashboardHome from './pages/department-head/DashboardHome';
import DepartmentHeadPRApproval from './pages/department-head/PRApproval';
import DepartmentHeadMyPurchaseRequests from './pages/department-head/MyPurchaseRequests';
import DepartmentHeadMyPRDashboard from './pages/department-head/MyPRDashboard';
import DepartmentOverview from './pages/department-head/DepartmentOverview';
import DepartmentHeadComingSoon from './pages/department-head/DepartmentHeadComingSoon';
import BudgetExceptionApproval from './pages/branch-manager/BudgetExceptionApproval';
import PRHistory from './pages/branch-manager/PRHistory';
import BranchOverview from './pages/branch-manager/BranchOverview';
import BranchManagerNotifications from './pages/branch-manager/Notifications';
import BuyerManagerDashboard from './pages/BuyerManagerDashboard';
import BuyerManagerDashboardHome from './pages/buyer-manager/DashboardHome';
import BuyerLeaderDashboard from './pages/BuyerLeaderDashboard';
import BuyerLeaderDashboardHome from './pages/buyer-leader/DashboardHome';
import PendingAssignments from './pages/buyer-leader/PendingAssignments';
import AssignmentsHistory from './pages/buyer-leader/AssignmentsHistory';
import BuyerLeaderPRTracking from './pages/buyer-leader/PRTracking';
import RFQMonitoring from './pages/buyer-leader/RFQMonitoring';
import ComparisonQueue from './pages/buyer-leader/ComparisonQueue';
import SelectSupplier from './pages/buyer-leader/SelectSupplier';
import CompareAwardWorkspace, {
  CompareAwardTabAllocation,
  CompareAwardTabCompare,
  CompareAwardTabExceptions,
  CompareAwardTabVendorHistory,
} from './pages/buyer-leader/CompareAwardWorkspace';
import SupplierProfile from './pages/buyer-leader/SupplierProfile';
import OverBudgetPRs from './pages/buyer-leader/OverBudgetPRs';
import BuyerLeaderNotifications from './pages/buyer-leader/Notifications';
import TeamManagement from './pages/buyer-manager/TeamManagement';
import POApproval from './pages/buyer-manager/POApproval';
import VendorManagement from './pages/buyer-manager/VendorManagement';
import ProcurementMonitoringDashboard from './pages/shared/ProcurementMonitoringDashboard';
import ExceptionMonitoring from './pages/buyer-manager/ExceptionMonitoring';
import UserManagement from './pages/buyer-manager/UserManagement';
import ReportsAnalytics from './pages/buyer-manager/ReportsAnalytics';
import SystemConfig from './pages/buyer-manager/SystemConfig';
import BGDDashboard from './pages/BGDDashboard';
import BGDDashboardHome from './pages/bgd/DashboardHome';
import BusinessOverview from './pages/bgd/BusinessOverview';
import ExceptionApproval from './pages/bgd/ExceptionApproval';
import StrategicSupplierView from './pages/bgd/StrategicSupplierView';
import ExecutiveReports from './pages/bgd/ExecutiveReports';
import CriticalAlerts from './pages/bgd/CriticalAlerts';
import GovernancePolicy from './pages/bgd/GovernancePolicy';
import SystemAdminDashboard from './pages/SystemAdminDashboard';
import SystemAdminDashboardHome from './pages/system-admin/DashboardHome';
import SystemAdminUserManagement from './pages/system-admin/UserManagement';
import SystemAdminApprovalConfig from './pages/system-admin/ApprovalConfiguration';
import SystemAdminOrganization from './pages/system-admin/OrganizationManagement';
import SystemAdminImportCenter from './pages/system-admin/ImportCenter';
import WarehouseDashboard from './pages/WarehouseDashboard';
import WarehouseDashboardHome from './pages/warehouse/DashboardHome';
import InventoryManagement from './pages/warehouse/InventoryManagement';
import StockIssuesInbox from './pages/warehouse/StockIssuesInbox';
import IncomingPurchaseOrders from './pages/warehouse/IncomingPurchaseOrders';
import GrnReceive from './pages/warehouse/GrnReceive';
import IncomingPoView from './pages/warehouse/IncomingPoView';
import GrnHistory from './pages/warehouse/GrnHistory';
import SalesDashboard from './pages/SalesDashboard';
import SalesDashboardHome from './pages/sales/SalesDashboardHome';
import CustomerPOList from './pages/sales/CustomerPOList';
import CreateCustomerPO from './pages/sales/CreateCustomerPO';
import SalesOrderWorkspace from './pages/sales/SalesOrderWorkspace';
import SalesPRView from './pages/sales/SalesPRView';
import './App.css';

function SalesLegacyOrderRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/dashboard/sales/orders/${id}`} replace />;
}

function WarehouseStockIssueDetailRedirect() {
  const { issueId } = useParams<{ issueId: string }>();
  const q = encodeURIComponent(issueId || '');
  return <Navigate to={`/dashboard/warehouse/stock-issues?detail=${q}`} replace />;
}

function RequestorStockIssueDetailRedirect() {
  const { id } = useParams<{ id: string }>();
  const q = encodeURIComponent(id || '');
  return <Navigate to={`/dashboard/requestor/stock-issues?detail=${q}`} replace />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000, // 30 seconds - data is fresh for 30s
      gcTime: 5 * 60 * 1000, // 5 minutes - cache for 5 minutes (formerly cacheTime)
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard/buyer-manage" element={<BuyerManageDashboard />}>
            <Route index element={<DashboardHome />} />
            <Route path="pr-overview" element={<PROverview />} />
            <Route path="supplier-overview" element={<SupplierOverview />} />
            <Route path="buyer-performance" element={<BuyerPerformance />} />
            <Route path="reports" element={<Reports />} />
            <Route path="system-config" element={<SystemConfiguration />} />
            <Route path="notifications" element={<ManagerNotifications />} />
            <Route
              path="procurement-monitoring"
              element={<ProcurementMonitoringDashboard apiBase="manager" />}
            />
          </Route>
          <Route path="/dashboard/warehouse" element={<WarehouseDashboard />}>
            <Route index element={<WarehouseDashboardHome />} />
            <Route path="incoming" element={<IncomingPurchaseOrders />} />
            <Route path="grn" element={<Navigate to="/dashboard/warehouse/incoming" replace />} />
            <Route path="incoming/:poId/view" element={<IncomingPoView />} />
            <Route path="incoming/:poId/grn" element={<GrnReceive />} />
            <Route path="grn-history" element={<GrnHistory />} />
            <Route path="inventory" element={<InventoryManagement />} />
            <Route path="stock-issues" element={<StockIssuesInbox />} />
            <Route path="stock-issues/:issueId" element={<WarehouseStockIssueDetailRedirect />} />
            <Route
              path="profile"
              element={
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
                  <h2 className="text-xl font-bold text-slate-900">Hồ sơ</h2>
                  <p className="text-slate-500 mt-2">Tính năng sắp ra mắt.</p>
                </div>
              }
            />
          </Route>
          <Route path="/dashboard/sales" element={<SalesDashboard />}>
            <Route index element={<SalesDashboardHome />} />
            <Route path="orders" element={<CustomerPOList />} />
            <Route path="orders/create" element={<CreateCustomerPO />} />
            <Route path="orders/:id" element={<SalesOrderWorkspace />} />
            <Route path="customer-po" element={<Navigate to="/dashboard/sales/orders" replace />} />
            <Route path="customer-po/create" element={<Navigate to="/dashboard/sales/orders/create" replace />} />
            <Route path="customer-po/:id" element={<SalesLegacyOrderRedirect />} />
            <Route path="pr" element={<SalesPRView />} />
            <Route path="profile" element={<div className="p-6"><h2 className="text-xl font-bold text-slate-900">Profile</h2><p className="text-slate-500 mt-2">Sắp ra mắt...</p></div>} />
          </Route>
          <Route path="/dashboard/requestor" element={<RequestorDashboard />}>
            <Route index element={<RequestorDashboardHome />} />
            <Route path="stock-issues" element={<MyStockIssues />} />
            <Route path="stock-issues/create" element={<CreateStockIssue />} />
            <Route path="stock-issues/:id/edit" element={<CreateStockIssue />} />
            <Route path="stock-issues/:id" element={<RequestorStockIssueDetailRedirect />} />
            <Route path="pr" element={<MyPurchaseRequests />} />
            <Route path="pr/create" element={<CreatePR />} />
            <Route path="pr/:id" element={<PRStatusTracking />} />
            <Route path="customer-po/:id" element={<CustomerPODetail />} />
            <Route path="tracking" element={<PRTracking />} />
            <Route path="notifications" element={<RequestorNotifications />} />
          </Route>
          <Route path="/dashboard/buyer" element={<BuyerDashboard />}>
            <Route index element={<BuyerDashboardHome />} />
            <Route path="assigned-prs" element={<AssignedPR />} />
            <Route path="assigned-prs/:prId" element={<AssignedPR />} />
            <Route path="assigned-prs/:prId/quotation/create" element={<CreateQuotation />} />
            <Route path="rfq" element={<RFQManagement />} />
            <Route path="rfq/:id" element={<RFQDetail />} />
            <Route path="rfq/:id/edit" element={<RFQEdit />} />
            <Route path="quotation" element={<QuotationManagement />} />
            <Route path="price-comparison" element={<PriceComparison />} />
            <Route path="project-cost" element={<ProjectCostReference />} />
            <Route path="notifications" element={<BuyerNotifications />} />
            <Route path="po/prs-waiting" element={<PRWaitingPO />} />
            <Route path="po/list" element={<POList />} />
            <Route path="po/:poId" element={<PODetail />} />
            <Route path="po/:poId/edit" element={<PODetail />} />
          </Route>
          <Route path="/dashboard/department-head" element={<DepartmentHeadDashboard />}>
            <Route index element={<DepartmentHeadDashboardHome />} />
            <Route path="my-prs" element={<DepartmentHeadMyPurchaseRequests />} />
            <Route path="my-prs/create" element={<CreatePR />} />
            <Route path="my-prs/:id" element={<PRStatusTracking />} />
            <Route path="my-prs/:id/edit" element={<CreatePR />} />
            <Route path="stock-issues" element={<MyStockIssues />} />
            <Route path="stock-issues/create" element={<CreateStockIssue />} />
            <Route path="stock-issues/:id/edit" element={<CreateStockIssue />} />
            <Route path="stock-issues/:id" element={<RequestorStockIssueDetail />} />
            <Route path="my-dashboard" element={<DepartmentHeadMyPRDashboard />} />
            <Route path="pr-approval" element={<DepartmentHeadPRApproval />} />
            <Route path="department-overview" element={<DepartmentOverview />} />
            <Route
              path="procurement-monitoring"
              element={<ProcurementMonitoringDashboard apiBase="department-head" />}
            />
            <Route
              path="notifications"
              element={<DepartmentHeadComingSoon title="Thông báo" description="Thông báo hệ thống" />}
            />
            <Route path="pr-history" element={<DepartmentHeadComingSoon title="Lịch sử PR" />} />
            <Route
              path="profile"
              element={<DepartmentHeadComingSoon title="Hồ sơ cá nhân" description="Thông tin tài khoản" />}
            />
          </Route>
          <Route path="/dashboard/branch-manager" element={<BranchManagerDashboard />}>
            <Route index element={<BranchManagerDashboardHome />} />
            <Route path="pr-approval" element={<PRApproval />} />
            <Route path="budget-exception" element={<BudgetExceptionApproval />} />
            <Route path="pr-history" element={<PRHistory />} />
            <Route path="branch-overview" element={<BranchOverview />} />
            <Route path="notifications" element={<BranchManagerNotifications />} />
            <Route
              path="procurement-monitoring"
              element={<ProcurementMonitoringDashboard apiBase="branch-manager" />}
            />
          </Route>
          <Route path="/dashboard/buyer-manager" element={<BuyerManagerDashboard />}>
            <Route index element={<BuyerManagerDashboardHome />} />
            <Route path="team-management" element={<TeamManagement />} />
            <Route path="vendor-management" element={<VendorManagement />} />
            <Route
              path="pr-monitoring"
              element={<Navigate to="/dashboard/buyer-manager/procurement-monitoring" replace />}
            />
            <Route
              path="procurement-monitoring"
              element={<ProcurementMonitoringDashboard apiBase="buyer-manager" />}
            />
            <Route path="exceptions" element={<ExceptionMonitoring />} />
            <Route path="user-management" element={<UserManagement />} />
            <Route path="reports" element={<ReportsAnalytics />} />
            <Route path="system-config" element={<SystemConfig />} />
            <Route path="po-approval" element={<POApproval />} />
          </Route>
          <Route path="/dashboard/buyer-leader" element={<BuyerLeaderDashboard />}>
            <Route index element={<BuyerLeaderDashboardHome />} />
            <Route path="pending-assignments" element={<PendingAssignments />} />
            <Route path="assignments" element={<AssignmentsHistory />} />
            <Route path="pr-tracking" element={<BuyerLeaderPRTracking />} />
            <Route path="rfq-monitoring" element={<RFQMonitoring />} />
            <Route path="compare-queue" element={<ComparisonQueue />} />
            {/* PR-centric supplier pick (?prId= & rfqId=); legacy parity with CompareAwardWorkspace */}
            <Route path="select-supplier" element={<SelectSupplier />} />
            <Route path="compare-quotations/:rfqId" element={<CompareAwardWorkspace />}>
              <Route index element={<Navigate to="compare" replace />} />
              <Route path="compare" element={<CompareAwardTabCompare />} />
              <Route path="allocation" element={<CompareAwardTabAllocation />} />
              <Route path="exceptions" element={<CompareAwardTabExceptions />} />
              <Route path="history" element={<CompareAwardTabVendorHistory />} />
            </Route>
            <Route path="supplier/:id" element={<SupplierProfile />} />
            <Route path="over-budget-prs" element={<OverBudgetPRs />} />
            <Route path="po-approval" element={<Navigate to="/dashboard/buyer-manager/po-approval" replace />} />
            <Route path="notifications" element={<BuyerLeaderNotifications />} />
          </Route>
          <Route path="/dashboard/bgd" element={<BGDDashboard />}>
            <Route index element={<BGDDashboardHome />} />
            <Route path="business-overview" element={<BusinessOverview />} />
            <Route path="exception-approval" element={<ExceptionApproval />} />
            <Route path="strategic-suppliers" element={<StrategicSupplierView />} />
            <Route path="reports" element={<ExecutiveReports />} />
            <Route path="alerts" element={<CriticalAlerts />} />
            <Route path="governance" element={<GovernancePolicy />} />
          </Route>
          <Route path="/dashboard/system-admin" element={<SystemAdminDashboard />}>
            <Route index element={<SystemAdminDashboardHome />} />
            <Route path="users" element={<SystemAdminUserManagement />} />
            <Route path="approval-config" element={<SystemAdminApprovalConfig />} />
            <Route path="organization" element={<SystemAdminOrganization />} />
            <Route path="import" element={<SystemAdminImportCenter />} />
            <Route path="settings" element={<div className="h-full p-6"><h2>Cài đặt hệ thống</h2><p>Sắp ra mắt...</p></div>} />
            <Route path="notifications" element={<div className="h-full p-6"><h2>Thông báo</h2><p>Sắp ra mắt...</p></div>} />
          </Route>
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;

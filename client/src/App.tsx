import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import SalesDashboard from './pages/SalesDashboard';
import SalesDashboardHome from './pages/sales/DashboardHome';
import SalesPOManagement from './pages/sales/SalesPOManagement';
import CreateSalesPO from './pages/sales/CreateSalesPO';
import EditSalesPO from './pages/sales/EditSalesPO';
import ProjectsList from './pages/sales/ProjectsList';
import ProjectDetail from './pages/sales/ProjectDetail';
import CostOverview from './pages/sales/CostOverview';
import SalesReports from './pages/sales/Reports';
import Notifications from './pages/sales/Notifications';
import RequestorDashboard from './pages/RequestorDashboard';
import RequestorDashboardHome from './pages/requestor/DashboardHome';
import MyPurchaseRequests from './pages/requestor/MyPurchaseRequests';
import CreatePR from './pages/requestor/CreatePR';
import PRStatusTracking from './pages/requestor/PRStatusTracking';
import PRTracking from './pages/requestor/PRTracking';
import RequestorNotifications from './pages/requestor/Notifications';
import BuyerDashboard from './pages/BuyerDashboard';
import BuyerDashboardHome from './pages/buyer/DashboardHome';
import AssignedPR from './pages/buyer/AssignedPR';
import RFQManagement from './pages/buyer/RFQManagement';
import QuotationManagement from './pages/buyer/QuotationManagement';
import ProjectCostReference from './pages/buyer/ProjectCostReference';
import BuyerNotifications from './pages/buyer/Notifications';
import OverBudgetAlerts from './pages/buyer/OverBudgetAlerts';
import PriceComparison from './pages/buyer/PriceComparison';
import BranchManagerDashboard from './pages/BranchManagerDashboard';
import BranchManagerDashboardHome from './pages/branch-manager/DashboardHome';
import PRApproval from './pages/branch-manager/PRApproval';
import DepartmentHeadDashboard from './pages/DepartmentHeadDashboard';
import DepartmentHeadDashboardHome from './pages/department-head/DashboardHome';
import DepartmentHeadPRApproval from './pages/department-head/PRApproval';
import DepartmentHeadMyPurchaseRequests from './pages/department-head/MyPurchaseRequests';
import DepartmentHeadMyPRDashboard from './pages/department-head/MyPRDashboard';
import DepartmentOverview from './pages/department-head/DepartmentOverview';
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
import CompareQuotations from './pages/buyer-leader/CompareQuotations';
import SelectSupplier from './pages/buyer-leader/SelectSupplier';
import OverBudgetPRs from './pages/buyer-leader/OverBudgetPRs';
import BuyerLeaderNotifications from './pages/buyer-leader/Notifications';
import TeamManagement from './pages/buyer-manager/TeamManagement';
import PRMonitoring from './pages/buyer-manager/PRMonitoring';
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
import './App.css';

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
          </Route>
          <Route path="/dashboard/sales" element={<SalesDashboard />}>
            <Route index element={<SalesDashboardHome />} />
            <Route path="sales-pos" element={<SalesPOManagement />} />
            <Route path="sales-pos/new" element={<CreateSalesPO />} />
            <Route path="sales-pos/:id/edit" element={<EditSalesPO />} />
            <Route path="projects" element={<ProjectsList />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="cost-overview" element={<CostOverview />} />
            <Route path="reports" element={<SalesReports />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>
          <Route path="/dashboard/requestor" element={<RequestorDashboard />}>
            <Route index element={<RequestorDashboardHome />} />
            <Route path="pr" element={<MyPurchaseRequests />} />
            <Route path="pr/create" element={<CreatePR />} />
            <Route path="pr/:id" element={<PRStatusTracking />} />
            <Route path="tracking" element={<PRTracking />} />
            <Route path="notifications" element={<RequestorNotifications />} />
          </Route>
          <Route path="/dashboard/buyer" element={<BuyerDashboard />}>
            <Route index element={<BuyerDashboardHome />} />
            <Route path="assigned-pr" element={<AssignedPR />} />
            <Route path="assigned-pr/:id" element={<AssignedPR />} />
            <Route path="rfq" element={<RFQManagement />} />
            <Route path="rfq/create" element={<RFQManagement />} />
            <Route path="rfq/:id" element={<RFQManagement />} />
            <Route path="rfq/:id/edit" element={<RFQManagement />} />
            <Route path="quotation" element={<QuotationManagement />} />
            <Route path="price-comparison" element={<PriceComparison />} />
            <Route path="over-budget" element={<OverBudgetAlerts />} />
            <Route path="project-cost" element={<ProjectCostReference />} />
            <Route path="notifications" element={<BuyerNotifications />} />
          </Route>
          <Route path="/dashboard/department-head" element={<DepartmentHeadDashboard />}>
            <Route index element={<DepartmentHeadDashboardHome />} />
            <Route path="my-prs" element={<DepartmentHeadMyPurchaseRequests />} />
            <Route path="my-prs/create" element={<CreatePR />} />
            <Route path="my-prs/:id" element={<PRStatusTracking />} />
            <Route path="my-prs/:id/edit" element={<CreatePR />} />
            <Route path="my-dashboard" element={<DepartmentHeadMyPRDashboard />} />
            <Route path="pr-approval" element={<DepartmentHeadPRApproval />} />
            <Route path="department-overview" element={<DepartmentOverview />} />
            <Route path="notifications" element={<div className="h-full p-6"><h2>Notifications</h2><p>Coming soon...</p></div>} />
            <Route path="pr-history" element={<div className="h-full p-6"><h2>PR History</h2><p>Coming soon...</p></div>} />
            <Route path="profile" element={<div className="h-full p-6"><h2>Profile</h2><p>Coming soon...</p></div>} />
          </Route>
          <Route path="/dashboard/branch-manager" element={<BranchManagerDashboard />}>
            <Route index element={<BranchManagerDashboardHome />} />
            <Route path="pr-approval" element={<PRApproval />} />
            <Route path="budget-exception" element={<BudgetExceptionApproval />} />
            <Route path="pr-history" element={<PRHistory />} />
            <Route path="branch-overview" element={<BranchOverview />} />
            <Route path="notifications" element={<BranchManagerNotifications />} />
          </Route>
          <Route path="/dashboard/buyer-manager" element={<BuyerManagerDashboard />}>
            <Route index element={<BuyerManagerDashboardHome />} />
            <Route path="team-management" element={<TeamManagement />} />
            <Route path="pr-monitoring" element={<PRMonitoring />} />
            <Route path="exceptions" element={<ExceptionMonitoring />} />
            <Route path="user-management" element={<UserManagement />} />
            <Route path="reports" element={<ReportsAnalytics />} />
            <Route path="system-config" element={<SystemConfig />} />
          </Route>
          <Route path="/dashboard/buyer-leader" element={<BuyerLeaderDashboard />}>
            <Route index element={<BuyerLeaderDashboardHome />} />
            <Route path="pending-assignments" element={<PendingAssignments />} />
            <Route path="assignments" element={<AssignmentsHistory />} />
            <Route path="compare-quotations" element={<CompareQuotations />} />
            <Route path="select-supplier" element={<SelectSupplier />} />
            <Route path="over-budget-prs" element={<OverBudgetPRs />} />
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
            <Route path="settings" element={<div className="h-full p-6"><h2>System Settings</h2><p>Coming soon...</p></div>} />
            <Route path="notifications" element={<div className="h-full p-6"><h2>Notifications</h2><p>Coming soon...</p></div>} />
          </Route>
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;

# WORKFLOW PHASE 1 – SPEC & STATUS (AUTHORITATIVE)

## Tổng quan
Phase 1 bao phủ quy trình từ Requestor tạo PR đến Buyer xử lý báo giá, chọn NCC và xử lý vượt ngân sách.

## Trạng thái PR (đã chuẩn hóa)
- `DRAFT` → `MANAGER_PENDING`
- `MANAGER_PENDING` → `BRANCH_MANAGER_PENDING` (nếu chi nhánh cần)
- `MANAGER_PENDING` → `BUYER_LEADER_PENDING` (nếu chi nhánh không cần)
- `BRANCH_MANAGER_PENDING` → `BUYER_LEADER_PENDING`
- `BUYER_LEADER_PENDING` → `ASSIGNED_TO_BUYER`
- `ASSIGNED_TO_BUYER` → `RFQ_IN_PROGRESS` → `QUOTATION_RECEIVED` → `SUPPLIER_SELECTED`
- `SUPPLIER_SELECTED` → `BUDGET_EXCEPTION` (nếu vượt ngân sách)
- `BUDGET_EXCEPTION` → `BUDGET_APPROVED` / `BUDGET_REJECTED`

Legacy được migrate:
- `DEPARTMENT_HEAD_*` → `MANAGER_*`
- `BRANCH_MANAGER_APPROVED` / `APPROVED_BY_BRANCH` → `BUYER_LEADER_PENDING`

## Đã hoàn thành
### 1) Database schema
- Models: `PRApproval`, `PRAssignment`, `RFQ`, `Quotation`, `QuotationItem`, `SupplierSelection`, `BudgetException`
- Enums bổ sung: `PRStatus`, `ApprovalAction`, `AssignmentScope`, `RFQStatus`, `QuotationStatus`, `BudgetExceptionStatus`, `BudgetExceptionAction`
- Fields mới trong PR: `currency`, `tax`, `totalAmount`

### 2) Controllers & routes
**Requestor**
- Submit PR (`POST /api/requestor/prs/:id/submit`)

**Branch Manager**
- Approve/Reject/Return PR
- Budget exception approve/reject/request negotiation

**Buyer Leader**
- Pending assignments, assign PR
- Compare quotations, recommendations
- Select supplier (auto budget check)

**Buyer**
- RFQ CRUD + send
- Quotation CRUD + validate

**Supplier**
- CRUD + search/filter + soft delete

### 3) Business logic
- Tự động tính `totalAmount` từ items
- RFQ number auto-generate
- Recommendation scoring (price/lead time/payment terms)
- Auto update status khi đủ báo giá
- Auto budget exception khi vượt ngân sách
- Audit log + notifications cho các bước chính

## API tóm tắt (core)
- Requestor: `POST /api/requestor/prs`, `PUT /api/requestor/prs/:id`, `POST /api/requestor/prs/:id/submit`
- Manager: `GET /api/department-head/pending-prs`, `POST /api/department-head/prs/:id/approve|reject|return`
- Branch Manager: `GET /api/branch-manager/pending-prs`, `POST /api/branch-manager/prs/:id/approve|reject|return`
- Buyer Leader: `GET /api/buyer-leader/pending-assignments`, `POST /api/buyer-leader/prs/:prId/assign`
- Buyer: `POST /api/buyer/rfqs`, `POST /api/buyer/quotations`
- Supplier: `GET/POST/PUT/DELETE /api/suppliers`

## Status
✅ Phase 1 đã hoàn thành backend & schema, sẵn sàng test + tích hợp frontend.


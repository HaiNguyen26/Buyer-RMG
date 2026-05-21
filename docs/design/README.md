# Design System Documentation

Tài liệu thiết kế Buying-RMG (Enterprise SaaS). Mỗi chủ đề lớn nằm trong **file riêng** để dễ tra cứu khi refactor.

---

## Mục lục

### 1. [Dashboard V3 Design Philosophy](./dashboard-v3-design-philosophy.md)

Bento canvas, đảo (`island`), `SectionHeader`, **`StatCard`** (Tầng 1: `bento` / `compact` / **`embedded`** + **`activity`** active|zero), **`ActionKpiCard`** (Tầng 3 — KPI + visualization, `compact`), token `DashboardV3Chrome`.

**Khi nào dùng:** Trang dashboard theo vai trò; chỉ số tầng 1–3.

**Không chứa:** Chi tiết cấu trúc từng ô bảng (xem file bảng) hay full-viewport shell (xem Layout shell).

---

### 2. [Data Table Interactive Enterprise](./data-table-interactive-enterprise.md)

**Bảng danh sách:** `border-separate`, **`tr.group`**, wrapper trong **`td`**, vạch accent, nền hàng **`indigo-50/40`**, bo góc ô đầu/cuối, cụm nút (**Action cluster**).

**Token code:** `client/src/constants/departmentHeadLayout.ts`, `client/src/constants/saasDataTable.ts`.

**Khi nào dùng:** Mọi table list có hover hàng và thao tác (Requestor PR, Xuất kho, Trưởng phòng, v.v.).

---

### 3. [Layout Shell & Viewport Wrapper](./layout-shell-viewport-wrapper.md)

Chuỗi **flex full viewport**, **một scroll**, **§2 Trang Tổng quan (mọi role)** (`dashboardOverview*`), workspace/list, **hai lớp shadow** card, màn neo **`100dvh`** (Buyer Leader queue).

**Khi nào dùng:** Tạo/sửa **bất kỳ** dashboard home role nào; tránh cắt nội dung / double scroll; card bảng `module-*`.

---

### 4. [Modal Design System](./modal-design-system.md)

Glass header, zoom, shadow sâu, layout 2 cột, hierarchy nút.

**Khi nào dùng:** Modal chi tiết PR/PO, xác nhận, form lớn.

---

### 5. [SLA & Liquid Performance](./sla-liquid-performance.md)

Thanh SLA “liquid”, bubble, gradient theo mood thời gian.

**Khi nào dùng:** Deadline / còn bao giờ / quá hạn — **không** dùng cho progress % chung hoặc budget bar.

---

### 6. [Process Timeline Energy](./process-timeline-energy.md)

Timeline workflow: đường năng lượng, pulse node hiện tại.

**Khi nào dùng:** 3–8 bước có “current step” rõ.

---

### 7. [Table Filter & Toolbar](./table-filter-toolbar.md)

Đảo lọc phía trên bảng: search, dropdown «Tất cả», approval queue, count sau lọc, empty hint theo filter.

**Khi nào dùng:** Màn list PR/RFQ/PO; Duyệt PR Trưởng phòng & Chi nhánh.

**Token:** `approvalQueueFilter.ts`, `buyerWorkspaceFiltersCardClass`.

---

### 8. [Page Content Spacing](./page-content-spacing.md)

Lề ngang **inset**, padding đáy safe-area, `space-y` stack, spacer sau Outlet — bổ sung layout shell.

**Khi nào dùng:** Trang outlet mới; chỉnh “dính mép” / thiếu khoảng thở dưới cùng.

**Token:** `dashboardLayout.ts`, `buyerPageContentClass`, `requestorMainShellPaddingClass`.

---

### 9. [Detail Content Blocks](./detail-content-blocks.md)

Card chi tiết, section header + badge góc phải, field grid, empty state CTA secondary, bảng document trong RFQ/PO.

**Khi nào dùng:** Trang chi tiết đọc (RFQ, snapshot PR) — không thay modal fullscreen.

**Code:** `RfqDetailBlocks.tsx`, `RFQDetail.tsx`.

---

### 10. [Charts & Dashboard Visualization](./charts-dashboard.md)

Donut / bar Recharts, màu PR theo loại, animation sector, StatCard + reveal viewport.

**Khi nào dùng:** Tầng 2 dashboard overview; không dùng cho SLA deadline bar.

**Code:** `rechartsDonut.tsx`, `prTypeChartColors.ts`.

---

## Cây quyết định nhanh

| Bạn làm gì | Đọc |
|-------------|-----|
| Layout dashboard / cards / Hero | [Dashboard V3](./dashboard-v3-design-philosophy.md) |
| Hàng bảng, badge, nút icon trong ô | [Data Table](./data-table-interactive-enterprise.md) |
| Main/outlet/full height/tránh 2 scrollbar | [Layout shell](./layout-shell-viewport-wrapper.md) |
| Modal chi tiết | [Modal](./modal-design-system.md) |
| SLA / thời hạn trong modal hoặc card | [SLA Liquid](./sla-liquid-performance.md) |
| Luồng bước (RFQ tracking…) | [Process Timeline](./process-timeline-energy.md) |
| Ô lọc + search trên bảng | [Table Filter](./table-filter-toolbar.md) |
| Lề trang / pb đáy / space-y stack | [Page Spacing](./page-content-spacing.md) |
| Trang chi tiết (card, empty CTA) | [Detail Blocks](./detail-content-blocks.md) |
| Donut / bar dashboard | [Charts](./charts-dashboard.md) |

---

## Animation (tham khảo nhanh)

| Khóa animation | Duration / gợi ý | Trong doc |
|----------------|------------------|-----------|
| Modal vào | ~220ms | Modal |
| Row / wrap translate | 300ms `ease-out` | Data Table |
| Liquid SLA | 2–3s | SLA |
| Node timeline | ~2s pulse | Timeline |

Chi tiết bảng giờ không thuộc Dashboard V3 để tránh trùng lặp — xem từng file trên.

---

## Phiên bản ghi nhận

- **2026-05 (b)**: Thêm `table-filter-toolbar.md`, `page-content-spacing.md`, `detail-content-blocks.md`, `charts-dashboard.md`.
- **2026-05 (a)**: Tách bảng + shell viewport khỏi `dashboard-v3-design-philosophy.md`; thêm `data-table-interactive-enterprise.md`, `layout-shell-viewport-wrapper.md`; README làm hub.
- Trước đó: tách SLA / Timeline / Modal (xem footer các file chi tiết).

---

## Bắt đầu

1. **Dashboard mới** → [dashboard-v3-design-philosophy.md](./dashboard-v3-design-philosophy.md)  
2. **Cột bảng mới** → [data-table-interactive-enterprise.md](./data-table-interactive-enterprise.md)  
3. **Trang full viewport** → [layout-shell-viewport-wrapper.md](./layout-shell-viewport-wrapper.md)  
4. **Modal / SLA / Timeline** → các link mục lục trên  
5. **List + filter** → [table-filter-toolbar.md](./table-filter-toolbar.md)  
6. **Lề & khoảng cách trang** → [page-content-spacing.md](./page-content-spacing.md)  
7. **Chi tiết RFQ/PO (card)** → [detail-content-blocks.md](./detail-content-blocks.md)  
8. **Biểu đồ dashboard** → [charts-dashboard.md](./charts-dashboard.md)  

**Quy tắc vàng:** đọc đúng file trước khi nhân đôi pattern trong JSX.

# Triết lý thiết kế Dashboard V3 (Bento)

Tài liệu này mô tả **nguyên tắc** và **khối dựng** dùng chung cho các màn dashboard theo hướng **V3** trong repo (nền `#F8FAFC`, “đảo” nội dung bo lớn, progressive disclosure theo tầng). Mục tiêu: nhìn một lượt nắm tình hình, drill-down có trật tự, trải nghiệm nhất quán giữa các vai trò.

**Bảng dữ liệu**, **viewport/shell**, **Buyer Leader queue** đã được tách sang các file riêng — xem [mục 8](#8-tài-liệu-chuyên-sâu-đã-tách).

---

## 1. Mục tiêu trải nghiệm

- **Tổng quan trước, chi tiết sau:** Người dùng thấy chỉ số và tín hiệu rủi ro trước; bảng danh sách và biểu đồ đi sau, không chen lấn visual weight.
- **Một “canvas” yên:** Nền trang xám rất nhạt (`#F8FAFC`) để nội dung nổi bật; tránh nhiều khối trắng phẳng cạnh nhau không phân cấp.
- **Khối nội dung = đảo (island):** Mỗi chủ đề lớn nằm trong một vùng bo tròn lớn, có elevation nhẹ và glass nhẹ — tạo cảm giác “bento”, dễ quét mắt theo cột dọc.
- **Hành động rõ ràng:** CTA chuyển trang (Xem tất cả, Danh sách PO…) dùng style thứ cấp thống nhất (indigo, **`rounded-xl`** hoặc `rounded-2xl` — **không** `rounded-full` / pill trên dashboard V3). Token: `dashboardV3CtaLinkClass` hoặc role-specific (vd. `buyerDashboardOverviewCtaClass`).

---

## 2. Phân tầng nội dung (Tầng 1 · 2 · 3)

Không phải quy tắc cứng cho mọi trang, nhưng **khuyến nghị** để đồng bộ mental model:

| Tầng | Vai trò gợi ý | Nội dung điển hình |
|------|----------------|---------------------|
| **Tầng 1 · Cốt lõi** | “Tôi có gì trên bàn?” | `StatCard` dạng bento: số lượng, tỷ lệ, giá trị tổng hợp, lead time… |
| **Tầng 2 · Phân tích / Hàng đợi** | “Luồng việc hoặc xu hướng?” | Bảng rút gọn, completion bar, biểu đồ so sánh, hàng đợi cần xử lý |
| **Tầng 3 · Hành động / Chi tiết** | “Tôi làm gì tiếp / xem sâu?” | CTA, **`ActionKpiCard`** (KPI có visualization), snapshot phụ, drill-down bổ sung |

**Eyebrow** (dòng nhỏ uppercase phía trên tiêu đề), ví dụ `Tầng 1 · Cốt lõi`, giúp người đọc lướt nhanh và map được vị trí trên trang — dùng component `SectionHeader` (kèm `Icon`, `title`, `description` tùy chọn).

---

## 3. Token & module dùng chung

Toàn bộ class/shimmer CTA nên lấy từ **`client/src/components/dashboard/DashboardV3Chrome.tsx`** để tránh phân mảnh:

| Export | Ý nghĩa |
|--------|---------|
| `dashboardV3PageBgClass` | Nền trang: `bg-[#F8FAFC]` |
| `dashboardV3StackYClass` | Khoảng cách dọc giữa các đảo: `space-y-6 md:space-y-8` |
| `dashboardV3IslandClass` | Vỏ đảo: bo `28px`, viền slate nhạt, nền trắng bán trong suốt, blur nhẹ, shadow ambient |
| `dashboardV3IslandOpaqueClass` | Ghép sau island: nền trắng đặc, tắt blur — KPI/bảng dày, tránh canvas lòi góc bo |
| `dashboardV3CtaLinkClass` | Nút/link CTA thứ cấp (indigo, `rounded-2xl`, hover lift nhẹ) |
| `DashboardV3ShimmerBlock` | Khối skeleton shimmer (bo tròn, animation `animate-shimmer`) |

**Gợi ý cấu trúc trang (UI bên trong outlet):**

```text
dashboardOverviewPageShellClass
  └─ dashboardOverviewContentStackClass (+ compact tùy role)
       ├─ Hero theo role (PageHero)
       ├─ <article className={dashboardV3IslandClass}> … Tầng 1 …
       ├─ Tầng 2 (panel / bảng rút gọn)
       └─ Tầng 3 (ActionKpiCard …) — tùy role
```

**Shell viewport, scroll, outlet:** không copy-paste class từ từng role — đọc [Layout Shell §2](./layout-shell-viewport-wrapper.md#2-trang-tổng-quan--dashboard-home-mọi-role--chuẩn-chung) và token `dashboardOverview*` trong `dashboardLayout.ts`.

---

## 4. Chỉ số: `StatCard` (variant `bento`)

Component: `client/src/components/buyer-manager/StatCard.tsx`.

### 4.1 Chế độ hiển thị

| Prop | Khi nào | Giao diện |
|------|---------|-----------|
| `variant="bento"` (mặc định Tầng 1) | Ô KPI độc lập / trong lưới rộng | Thẻ trắng, bo `24–28px`, shadow ambient, hover lift |
| **`compact`** | Hàng 4 cột dày, hero đã cao | Thu padding, icon, cỡ số một bước; vẫn là thẻ trắng riêng |
| **`embedded`** | KPI **bên trong** một `dashboardV3IslandClass` | **Không** lồng thẻ trắng + bóng — chỉ tile nhẹ trong đảo |
| **`activity`** (chỉ với `embedded`) | Phân cấp “có việc” vs “trống” | Xem [§4.3](#43-embedded--activity-active--zero) |

**Quy tắc đảo:** Một chủ đề Tầng 1 = **một** `<article>` island; nhiều nhóm KPI (vd. Cốt lõi + PO) dùng `border-t` + `SectionHeader` con — **không** tách thành hai đảo trắng cạnh nhau (tránh “card trong card” và gray washout).

**Mẫu Tổng quan (UI):** `client/src/pages/buyer/DashboardHome.tsx` — island KPI gộp + `StatCard` `embedded` / `activity` (role có thể có token KPI riêng trong `*Layout.ts`).

### 4.2 Hierarchy & accent

- **Accent** (`emerald`, `indigo`, `amber`, `rose`, `violet`, `slate`, …) map **ý nghĩa dữ liệu**, không trang trí.
- Mỗi ô: nhãn uppercase → **số lớn** → hint một dòng (nguồn / định nghĩa).
- Có `onClick`: render **`<button type="button">`**, `title="Nhấp để mở chi tiết"`, icon **`ChevronRight`** góc phải (hiện khi hover).

### 4.3 `embedded` + `activity` (`active` | `zero`)

Truyền từ số đếm API, ví dụ: `activity={count > 0 ? 'active' : 'zero'}`.

| `activity` | Ý nghĩa UX | Style |
|------------|------------|--------|
| **`active`** | Cần chú ý / có việc | Nền pastel + viền theo accent; số `font-black`; hover glow accent; chevron accent khi hover |
| **`zero`** | Không có hàng đợi | Nền xám nhạt, `opacity` giảm; số `text-slate-300` + `font-semibold`; icon/hint muted — lướt mắt bỏ qua |

**Cấm:** Hiển thị `0` với cùng độ tương phản như `1+` (gây mất thời gian đọc nhãn).

### 4.4 Token Buyer (Tầng 1 gọn)

Trong `client/src/constants/buyerLayout.ts`:

| Token | Vai trò |
|-------|---------|
| `buyerDashboardKpiIslandPaddingClass` | Thu bo/padding đảo KPI (`!rounded-[24px] !p-4 md:!p-5`) |
| `buyerDashboardKpiGridClass` | Lưới 2×4: `gap-2 md:gap-2.5` |
| `buyerDashboardOverviewCtaClass` | CTA phụ Tổng quan: `rounded-xl`, indigo |

Ghép island: `dashboardV3IslandClass` + `dashboardV3IslandOpaqueClass` + padding token.

### 4.5 Mở rộng Tầng 1 (tùy chọn)

Prop `extension` + widget `StatCardTier1Visuals.tsx` (pipeline, lead-time funnel, risk heatmap) — dữ liệu Buyer Manager `/buyer-manager/dashboard`.

---

## 4b. Tầng 3: `ActionKpiCard` (Action KPI / metric card có visualization)

**Không** dùng `StatCard` cho Tầng 3 — đó là Tầng 1 (số tổng hợp, không cần widget phức tạp).

| Khái niệm | Trong repo |
|-----------|------------|
| Tên gợi ý (UI) | **Action KPI card**, **metric card with actionable viz** |
| Component shell | `client/src/components/buyer-manager/ActionKpiCard.tsx` |
| Widget góc phải | `client/src/components/buyer-manager/ActionKpiVisuals.tsx` (`KpiSparklineTrend`, `ThresholdAlertMeter`, `SlaResolutionClock`, `TeamAllocationGrid`) |
| Mẫu triển khai | `client/src/pages/buyer-manager/DashboardHome.tsx` — mục **Theo dõi & điều phối** |

**Cấu trúc thẻ:** icon + nhãn uppercase + badge trạng thái → số chính → `topRight` (visual đọc được) → progress (tùy chọn) → hint một dòng.

**`compact`:** Thu padding, icon, cỡ số và progress bar — dùng khi lưới Tầng 3 dày trên dashboard (cùng module `buyerMgrOverviewModuleClass`).

**Layout lưới 2×2 (khuyến nghị):** bốn thẻ là **con trực tiếp** của `grid md:grid-cols-2` (cùng `gap-x-8`), không bọc hai cột lồng nhau — để mọi ô cùng `1fr` và **cùng chiều rộng**. Nhãn nhóm (`Nhà cung cấp (snapshot)` / `Buyer workload`) đặt hàng riêng phía trên.

**Nguyên tắc visualization:** mỗi `topRight` phải trả lời một câu hỏi cụ thể (xu hướng, ngưỡng an toàn, SLA, phân bổ đội) — **cấm** hình trang trí không gắn số liệu (gradient slope / tam giác vô nghĩa).

**Accent:** `strategic` \| `alert` \| `overload` \| `capacity` — map semantic, đồng bộ màu progress/icon.

---

## 5. Trạng thái tải & lỗi

- **Đang tải:** Ưu tiên **layout shimmer** (khối + lưới placeholder) trên nền V3, thay vì chỉ một spinner giữa trang — giữ đúng khung mental layout và giảm nhấp nháy khi data về.
- **Lỗi:** Một **thẻ rose** (viền rose, nền rose nhạt, typography đậm/nhạt phân cấp) trong cùng hệ spacing với các đảo — không dùng toast thay cho lỗi toàn trang nếu user cần đọc message và thử lại.

---

## 6. Nguyên tắc kỹ thuật UI

- **`min-w-0`** trên flex children chứa bảng/biểu đồ để tránh tràn ngang không mong muốn.
- **Bảng trong đảo:** Header strip nhạt (`#F8FAFC`); chi tiết **hover hàng**, **wrapper ô**, typography badge — đọc [Data Table Interactive Enterprise](./data-table-interactive-enterprise.md).
- **Không nhân đôi token:** Nếu thêm pattern mới (ví dụ CTA loại 3), cân nhắc mở rộng `DashboardV3Chrome` thay vì copy-paste class dài trong từng page.

---

## 7. Tham chiếu triển khai trong repo

Các màn đã/can hướng V3 (tham khảo khi làm trang mới):

- `client/src/components/dashboard/DashboardV3Chrome.tsx` — nguồn token.
- `client/src/pages/buyer-manager/DashboardHome.tsx` — mẫu đầy đủ tầng 1–3 + `ActionKpiCard` + `StatCard` extension.
- `client/src/pages/buyer/DashboardHome.tsx` — Tầng 1: island gộp, `StatCard` `embedded` + `activity`, Tầng 2: `BuyerOverviewPanel`.
- `client/src/pages/buyer-manager/POApproval.tsx` — workspace: filter card + data card hai lớp bóng (xem [table-filter-toolbar](./table-filter-toolbar.md)).
- `client/src/pages/department-head/DashboardHome.tsx`, `DepartmentOverview.tsx`.
- `client/src/pages/branch-manager/DashboardHome.tsx`.

Khi thêm dashboard role mới: **áp dụng cùng stack** (nền + stack + đảo + SectionHeader + StatCard bento + shimmer/rose) để người dùng không phải học lại layout cho từng vai trò.

---

## 8. Tài liệu chuyên sâu (đã tách)

| Chủ đề | File | Khi đọc |
|--------|------|---------|
| Bảng tương tác SaaS (`group`, wrapper `td`, accent rail, token `departmentHeadLayout` / `saasDataTable`) | [data-table-interactive-enterprise.md](./data-table-interactive-enterprise.md) | Làm/refactor danh sách PR, phiếu, hàng đợi trong bảng |
| Shell viewport, scroll một nguồn, Requestor / Trưởng phòng, card bảng, Buyer Leader queue | [layout-shell-viewport-wrapper.md](./layout-shell-viewport-wrapper.md) | Full-height layout, tránh double scroll / vệt xám |
| Modal chi tiết | [modal-design-system.md](./modal-design-system.md) | PR detail, fullscreen |
| Biểu đồ & StatCard Tầng 1–2 | [charts-dashboard.md](./charts-dashboard.md) | Recharts, CountUp, không lẫn với ActionKpiCard |
| SLA & Liquid | [sla-liquid-performance.md](./sla-liquid-performance.md) | Thanh thời hạn |
| Timeline workflow | [process-timeline-energy.md](./process-timeline-energy.md) | PR tracking trong modal/page |
| Filter toolbar (search, queue) | [table-filter-toolbar.md](./table-filter-toolbar.md) | List + duyệt PR |
| Page inset & stack spacing | [page-content-spacing.md](./page-content-spacing.md) | Lề trang, pb safe-area |
| Detail cards & empty CTA | [detail-content-blocks.md](./detail-content-blocks.md) | RFQ/PO chi tiết |
| Charts (donut, bar) | [charts-dashboard.md](./charts-dashboard.md) | Overview Tầng 2 |

Tham chiếu nhanh tất cả: [README](./README.md).

---

## Version History

- **2026-05**: `StatCard` — `embedded`, `activity` (active|zero); token overview chung `dashboardOverview*` (`dashboardLayout.ts`); `ActionKpiCard` `compact`; CTA `rounded-xl`.

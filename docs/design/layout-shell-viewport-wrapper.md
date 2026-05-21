# Layout Shell — Viewport, wrapper & continuity

Tài liệu **tách riêng** khỏi triết lý Dashboard Bento: mô tả **chuỗi flex full viewport**, **một luồng scroll**, padding đặt ở đâu, **card bảng (module)**, và trường hợp **Buyer Leader — hàng đợi/Chọn NCC**.

Liên quan:

- Nội dung ô bảng & hover row: [Data Table Interactive Enterprise](./data-table-interactive-enterprise.md).
- Đảo hero StatCard spacing: [Dashboard V3 Design Philosophy](./dashboard-v3-design-philosophy.md).
- Spacing inset stack: [Page Content Spacing](./page-content-spacing.md).

> **Tài liệu gốc** khi tạo/sửa trang dashboard: §2 (Tổng quan) và §3 (workspace) — áp dụng **mọi role**, không chỉ Buyer.

---

## 1. Nguyên tắc hình học (bắt buộc)

- **Shell dashboard**: `h-[100dvh]`, cột flex — header `shrink-0`, vùng cuộn `flex-1 min-h-0 overflow-y-auto` (**một** nguồn cuộn dọc cho trang thường).
- **Outlet / route root**: tùy **loại trang** (xem §2 Tổng quan vs §3 Workspace) — **không** copy một bộ class cho mọi route.
- **Padding ngang shell vs outlet mép trong**: scroll thường có `dashboardMainPaddingXClass` để chừa scrollbar; **`dashboardOutletWorkspaceFlexClass` đã gộp `dashboardMainHorizontalBleedClass`** để `.dashboard-outlet` kéo full bề ngang vùng main (hết khe xám hai bên). Typography / cột nội dung giới hạn bằng `max-w` + `mx-auto` *bên trong* route, không để padding shell tạo “ống nhìn”.
- **Bleed + inset (mọi role dùng bleed outlet)**: khi outlet có `dashboardMainHorizontalBleedClass`, **bắt buộc** `dashboardPageContentInsetXClass` trên root trang / content stack. Khác `dashboardMainPaddingXClass` (thêm bước lg/xl trên shell).
- **Đệm đáy**: workspace/list → `dashboardPageContentInsetBottomWorkspaceClass`; Tổng quan → `dashboardPageContentInsetBottomOverviewClass` (đã gộp trong `dashboardOverviewContentStackClass`).
- **Spacer sau `<Outlet>`**: `dashboardScrollEndSpacerClass` trong vùng cuộn `flex flex-col` (role có thể thêm nền canvas trên spacer nếu cần).
- **Padding chỉ trên container nội dung** (“content stack”) khi không dùng bleed ở outlet — hoặc dùng bleed ở outlet rồi canh lại padding trong trang (**inset ngang `dashboardPageContentInsetXClass` + đệm đáy tương ứng như trên**).
- Cuộn ngang chỉ cục bộ (wrapper bảng) khi cần; **tránh hai thanh cuộn dọc song song** không cần thiết trên các màn list đã chuẩn hóa Requestor.
- **Thanh tab / pill có `shadow` trong `overflow-x-auto`**: bóng bị **cắt** khi không đủ **padding dưới (và một chút trên)** trên khối cuộn — thêm cỡ `pb-5`/`pb-6`+ (và `-mx-1 px-1` hai bên đỡ cắt mép đầu), hoặc dùng `ring-*`/`border` làm nhấn nhẹ thay chỉ shadow; **đừng** mong `overflow-y:visible` vá được khi cùng cặp `overflow-x-auto` (đặc điểm layout engine).
- **Hai cột master–detail (vd. Vendor)**: tránh ghép **`min-h` ~ full viewport** + **`h-full`** trên wrapper con + **`items-stretch` / `self-stretch`** — dễ kéo khối trắng **dính mép dưới** và cắt bo góc dưới; ưu tiên **`lg:items-start`**, chiều cao theo nội dung / sync có chủ đích (ResizeObserver), và **`pb-*` lớn** dưới khối 2 cột để luôn thấy nền canvas.

---

## 2. Trang Tổng quan / Dashboard home (mọi role) — **chuẩn chung**

Áp dụng khi route là **màn chủ** của role: KPI, đảo V3, panel hàng đợi, hero — nội dung **cao hơn viewport** phải **cuộn trên main**, không bị cắt.

### 2.1 Cây DOM chuẩn

```text
*Dashboard.tsx (100dvh)
  └─ header (shrink-0)
  └─ main scroll [flex-1 min-h-0 overflow-y-auto] + nền canvas (vd. #F8FAFC hoặc #f1f5f9)
       ├─ .dashboard-outlet  ← dashboardOverviewOutletClass
       │    └─ page root     ← dashboardOverviewPageShellClass
       │         └─ content stack ← dashboardOverviewContentStackClass (+ compact tùy role)
       │              ├─ Hero
       │              ├─ article dashboardV3IslandClass …
       │              └─ Tầng 2 panels / bảng rút gọn
       └─ scroll end spacer   ← dashboardScrollEndSpacerClass (không `bg-*`; cùng màu scroll)
```

### 2.2 Token chung (`dashboardLayout.ts`)

| Token | Vai trò |
|-------|---------|
| `dashboardOverviewOutletClass` | Outlet: `min-h-full`, `shrink-0`, bleed; **không** `h-full` / `flex-1` / `basis-0` |
| `dashboardOverviewPageShellClass` | Root trang: `min-h-full` — **không** `flex-1` |
| `dashboardOverviewContentStackClass` | Inset X + `space-y-6` + pb overview |
| `dashboardOverviewScrollColumnClass` | Bọc outlet: `flex-1 min-h-full` — phủ viewport, vẫn cuộn khi dài |
| `dashboardV3PageBgClass` | Nền canvas V3 `#F8FAFC` — gán trên **main scroll** khi route overview |
| `dashboardPageContentInsetBottomOverviewClass` | Đã nhúng trong content stack |

Role layout (`buyerLayout.ts`, `departmentHeadLayout.ts`, …) **alias** hoặc mở rộng token trên — không định nghĩa lại công thức outlet/page trừ khi có lý do nghiệp vụ.

### 2.3 Quy tắc / anti-pattern

| ✅ Đúng | ❌ Sai (cắt nội dung — phải zoom out mới thấy hết) |
|--------|-----------------------------------------------------|
| Cuộn trên `main` (`overflow-y-auto`) | Cuộn thứ hai trên page root không cần thiết |
| Outlet `flex-1 min-h-full` (không `h-full`/`basis-0`) + cột scroll | Outlet `h-full flex-1 basis-0` + `min-h-0` flush |
| Spacer **không** `bg-*` (kế thừa scroll) | Spacer `bg-[#f1f5f9]` trên scroll `#F8FAFC` → vệt dưới |
| Page root chỉ `min-h-full` | Page root / stack thêm `flex-1` khóa chiều cao viewport |
| Nội dung cao → outlet **cao theo nội dung** | `overflow-hidden` trên outlet/page che phần dưới |

**Nền khi nội dung ngắn:** `min-h-full` trên outlet + page root kéo canvas tối thiểu một màn; không cần `flex-1` trên stack.

**Nội dung UI (Bento, StatCard, bảng):** [Dashboard V3 Design Philosophy](./dashboard-v3-design-philosophy.md) — file này chỉ quy định **shell & scroll**.

### 2.4 Tham chiếu triển khai (ví dụ)

| Role | `*Dashboard.tsx` (scroll nền) | Trang Tổng quan |
|------|------------------------------|-----------------|
| Buyer | `dashboardV3PageBgClass` khi `/dashboard/buyer` | `buyer/DashboardHome.tsx` |
| Department Head | `#f1f5f9` trên scroll | `department-head/DashboardHome.tsx` — `pageRootClass = w-full min-h-full` |
| Branch Manager | tương tự DH | `branch-manager/DashboardHome.tsx` |
| Buyer Manager | `bg-slate-50` | `buyer-manager/DashboardHome.tsx` |

Khi **tạo hoặc sửa** trang Tổng quan role mới: bắt đầu từ §2.1–2.2, sau đó map token role nếu cần alias.

---

## 3. Workspace / danh sách / chi tiết (một scroll, cao theo nội dung)

- Outlet: `dashboardOutletWorkspaceFlexClass` hoặc `shrink-0 min-h-full` + bleed — **không** `flex-1 basis-0` trừ màn neo `100dvh` đặc biệt (§9).
- Page root: thường **không** `min-h-full` — để `pb` trên main scroll có hiệu lực.
- Token đáy: `dashboardPageContentInsetBottomWorkspaceClass`.

Chi tiết spacing: [page-content-spacing.md](./page-content-spacing.md) §3.4.

---

## 4. Requestor — công thức (~2026-04)

- Container: `mx-auto w-full max-w-[1800px]` (điều chỉnh theo role).
- `overflow-y-auto` trên khối scroll chính; `overflow-x-hidden` ở shell nếu không cần ngang page.
- **Một scroll dọc** cho list routes (PR list, Stock issues, tracking) — bảng **không** khóa `max-h-*` ép scroll thứ hai trừ khi nghiệp vụ bắt buộc.
- **Không sticky** các khối mô tả “Bảng điều khiển” mặc định overview (tránh gãy chiều cao và double scroll).

Chi tiết trang và scope đã áp dụng: xem changelog trong các PR liên quan `DashboardHome`, `MyPurchaseRequests`, `MyStockIssues`, `PRTracking`.

---

## 5. Department Head — tinh chỉnh ngang

- Content: `max-w-none` + padding ngang nhỏ `px-1 sm:px-1.5 md:px-3` để grid “nở” gần mép ngoài.
- **Một nền nhất quán** trên shell/outlet/page (ví dụ `#f1f5f9`) — không trộn `#F8FAFC` và `#f1f5f9` chồng lớp không cố ý để tránh vệt màu.
- Khoảng đệm đáy: ưu tiên **`pb`** trên content container.

---

## 6. Hai lớp bóng + bo góc (card danh sách)

- **Outer**: có thể `overflow-visible` + shadow (giữ halo).
- **Inner**: `rounded-*`, `overflow-hidden`, `border`/`bg` để crop nội dung và giữ mép trong.
- Không ép một DOM duy nhất vừa clip vừa shadow nếu dễ mất một trong hai hiệu ứng.

Mẫu thường gặp: `module-container` + `module-content` (đã dùng ở nhiều trang Requestor/Buyer).

---

## 7. “Double-layer shield” & visual continuity

Khi skeleton → dữ liệu:

1. Skeleton giữ khung đúng cột/padding/`72px`.
2. Nền trắng cố định (`#FFFFFF`) trong vùng bảng trong suốt refetch (`visibility`/raf tuỳ page).
3. Tránh chồng overlay xám không đồng bộ giữa `html/body/#root`.

---

## 8. Hover policy cards (wrapper ngoài bảng)

Trên các màn Requestor V3 đã chuẩn hóa: **shadow card tĩnh**; tránh **`hover:shadow-*`** mạnh trên đảo filter/card nếu không cần nhấn nhá.

Đổi sắc nền hover nhẹ trên tile/shortcut vẫn được; chi tiết từng màn không lặp ở đây.

---

## 9. Buyer Leader — màn có card bảng bám chiều cao viewport (`ComparisonQueue`)

Mục đích: bảng lớn, filter + hero + shell dashboard vẫn ổn định trên **`100dvh`**.

Điểm chính (tham khảo code):

- **Outlet/page**: stack dọc, `min-w-0`, `overflow-hidden` thích hợp; có thể chỉnh `clamp` chiều cao card để tránh viền trắng dưới màn neo.
- **Card**: `rounded-3xl`, border slate, shadow ambient; khối scroll `min-h-0 flex-1` + thead sticky trong cùng scroller khi được thiết kế như vậy.
- Bảng: `table-fixed` + `colgroup` khi cần ô rộng ổn định; `overflow-x-auto` cục bộ.
- Màn tham chiếu:  
  `client/src/pages/buyer-leader/ComparisonQueue.tsx`,  
  `client/src/pages/buyer-leader/PendingAssignments.tsx` (smart filter grid).

Chi tiết tương tác **từng hàng**: vẫn dùng chuẩn [data-table-interactive-enterprise.md](./data-table-interactive-enterprise.md) khi bảng chuyển sang token **`departmentHead*`** .

---

## 10. Summary card Recipe (Requestor — tham khảo nhanh)

- Bo `rounded-[2rem]`; nền trắng; viền 1px theo chủ đề.
- Shadow tĩnh (`shadow-sm`/custom nhẹ).
- Palette gợi ý trong doc Dashboard (tổng quan/chờ duyệt/trả về…).

Đầy đủ typography card: đọc lại Dashboard V3 nếu cần bổ sung icon/trend ornament.

---

## 11. Ngoại lệ — Buyer Leader

- Scroll main (`BuyerLeaderDashboard`) hiện **không** gắn `dashboardMainPaddingXClass`; outlet không dùng `dashboardMainHorizontalBleedClass`. Nền route đã sát mép theo thiết kế riêng.
- Muốn cùng công thức bleed như các role khác: thêm bộ `px-*` đồng bộ lên shell cuộn, rồi gộp bleed trên `.dashboard-outlet`.

---

## Version History

- **2026-05**: §2 **Trang Tổng quan (mọi role)** — token `dashboardOverview*`; anti-pattern `h-full`/`flex-1` cắt nội dung; tách §3 workspace.

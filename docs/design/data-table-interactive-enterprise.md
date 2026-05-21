# Bảng dữ liệu tương tác (Enterprise SaaS)

Tài liệu mô tả **chuẩn triển khai** cho bảng danh sách trong app: typography SaaS, hover hàng có **nhóm (`group`)**, **wrapper** trong ô, vạch accent, **badge** và **icon thao tác**.  
Nguồn code: `client/src/constants/departmentHeadLayout.ts`, `client/src/constants/saasDataTable.ts`, `client/index.css` (viewport cuộn Trưởng phòng).

Tham chiếu chéo:

- Shell trang / scroll / card bảng: [Layout Shell & Viewport Wrapper](./layout-shell-viewport-wrapper.md).
- Modal chi tiết: [Modal Design System](./modal-design-system.md).
- Dashboard Bento / đảo / StatCard: [Dashboard V3 Design Philosophy](./dashboard-v3-design-philosophy.md).

---

## 1. Bảng nền (layout không vỡ hover)

### 1.1 `border-separate` + `border-spacing-0`

- Dùng trên `<table>` khi có **đổ bóng / transform / bo góc theo ô** để không bị lệch sau `border-collapse`.
- Token:
  - `departmentHeadInteractiveTableClass` — `min-w-[800px]`.
  - `departmentHeadInteractiveTableFixed880Class` — thêm `table-fixed min-w-[880px]` khi cần cột cố định.

### 1.2 Cao dòng (~72px)

- `departmentHeadTableDataRowClasses(index, { h72: true })` khi muốn hàng **`h-[72px]`** cố định (Breathable Grid).

---

## 2. Mô hình `group` (Tailwind)

| Thành phần | Vai trò |
|-------------|---------|
| **`<tr class="group">`** | Cha: điều khiển nền toàn hàng (`group-hover:` trên các `td`), shadow mép ô đầu/cuối; `transition-all duration-300 ease-out`. |
| **Vạch accent** | **Con**, `opacity-0` → `group-hover:opacity-100`; **không** nằm trong wrapper có `translate-x` (rail `absolute`, `aria-hidden`). |
| **Wrapper nội dung ô** | **Con**, chứa mọi text/component; **`group-hover:translate-x-1`** + `ease-out` trên **block/flex**. |

**Không** dùng transform trực tiếp trên `display: table-cell` cho chuyển động chính — **luôn** bọc một lớp `div` trong `td`.

---

## 3. Vạch chỉ báo (Accent Rail)

Vạch dọc `3px`, indigo, **absolute** trong **ô đầu** (`relative` trên `<td>`), không chiếm cột Layout:

- Class: `departmentHeadTableAccentRailClass`.
- Thuộc tính gợi ý: `inset-y-2 left-0`, `rounded-r-full`, `opacity-0 scale-y-50` → `group-hover:opacity-100 group-hover:scale-y-100`, `duration-300 ease-out`.

`div` mang vạch dùng `aria-hidden` để chỉ báo không ảnh hưởng SR.

---

## 4. Wrapper mỗi ô (`td`)

Luôn cấu trúc:

```tsx
<td className="...">
  {/* Ô đầu: rail + khối nội dung */}
  <div aria-hidden className={departmentHeadTableAccentRailClass} />
  <div className={`${departmentHeadTableFirstCellInnerClass} ${departmentHeadTableCellContentWrapClass}`}>
    {/* mã PR, … */}
  </div>
</td>

<td className="...">
  <div className={departmentHeadTableCellContentWrapClass}>
    {/* text hoặc component */}
  </div>
</td>
```

Exports:

| Token | Khi nào |
|--------|---------|
| `departmentHeadTableCellContentWrapClass` | Đại đa số ô: `block min-w-0` + translate + easing. |
| `departmentHeadTableCellContentWrapFlexClass` | Ô chứa `flex`/nhiều nút; có thể thêm `justify-end ml-auto`. |
| `departmentHeadTableFirstCellInnerClass` | Chồng **cùng** wrap ô đầu (sau rail). |

Lý do: text thuần hay component fragment đều nằm trong một **khối** → transform mượt, đồng bộ **mọi cột**.

---

## 5. Nền hàng & “nổi” mép

Trên **`tr`** (qua `departmentHeadTableDataRowClasses`):

- **Zebra** `td`: `white` / `#FBFCFE`.
- **`group-hover:[&>td]:bg-indigo-50/40`** — tint brand không gắt.
- **`rounded-l-2xl` / `rounded-r-2xl`** trên ô **đầu / cuối** .
- Shadow **nhẹ chỉ ô đầu/cuối** khi hover hàng (`group-hover` + arbitrary shadow trái/phải) để gợi “dải phẳng”, không ép shadow giữa cả hàng như một card.

Giảm chuyển động: `motion-reduce` tắt shadow hover; các wrapper tắt transform khi có `motion-reduce`.

---

## 6. Typography & badge SaaS (`saasDataTable.ts`)

- `saasTableRootClass` — typography Inter/sans nhất quán.
- `saasTableHeadCellClass` — header uppercase nhỏ.
- `saasTableCodeCellClass` / `saasTableNumericStrongClass` — số mã và tiền.
- Status PR: `saasPrStatusBadgeClass`, `saasPrStatusLabel`; stock issue tương tự có helper badge.
- Nút ô thao tác: `saasTableIconBtnView`, `saasTableIconBtnEdit`, `saasTableIconBtnDelete` (kích thước `h-9 w-9`, hover nền).

---

## 7. Cụm nút (Action cluster)

Export: `departmentHeadTableActionClusterClass`.

Ý đồ UX: vào nhẹ (**opacity** + **`translate-y-1`** → **`0`** khi **`group-hover`**), tránh nút **nhảy** đột.  
Vì **toolbar phải thấy khi điều hướng bàn phím**, bổ sung:

- **`group-focus-within:opacity-100`** và **`translate-y-0`**.
- **`motion-reduce`**: luôn hiện, không animate.

Bọc trong `departmentHeadTableCellContentWrapFlexClass` và canh phải (`justify-end` / `ml-auto`) trên ô thao tác.  
**`stopPropagation`** trên ô nút khi `tr` có `onClick`.

---

## 8. Phiên bản cuộn (Trưởng phòng)

Class CSS toàn cục: **`department-head-table-scroll-viewport`** trong `client/src/index.css` — giới hạn chiều cao vùng bảng, **scroll nội bộ**, `thead sticky`.

Token trong layout:

- `departmentHeadListTableScrollClass`
- `departmentHeadTableScrollViewportThinBars`

---

## 9. Áp dụng trong repo (tham khảo)

Các file đại diện:

- Requestor PR list: `client/src/pages/requestor/MyPurchaseRequests.tsx`
- Xuất kho: `client/src/pages/requestor/MyStockIssues.tsx`
- Trưởng phòng — Mua hàng / Duyệt: `department-head/MyPurchaseRequests.tsx`, `department-head/PRApproval.tsx`
- Hàng đợi dashboard: `department-head/DashboardHome.tsx`

---

## 10. Checklist khi thêm bảng mới

- [ ] `<table>` dùng `border-separate border-spacing-0` (qua token interaction).
- [ ] `<tr>` dùng `departmentHeadTableDataRowClasses` hoặc `departmentHeadDashboardDataRowInteractive` (+ `cursor-pointer` khi đủ vai trò).
- [ ] Mỗi `td`: một **wrapper** (`CellContentWrap` / `WrapFlex`).
- [ ] Ô đầu: **`relative`** + rail `aria-hidden` + body `FirstCellInner` + **`CellContentWrap`**.
- [ ] Typography/badge/icon từ **`saasDataTable`** khi có.
- [ ] Icon thao tác trong **`ActionCluster`** nếu cần hiệu ứng vào/out.
- [ ] Skeleton header/body nhất quán với **`saasTableHeadCellClass`** (nếu có overlay loading).

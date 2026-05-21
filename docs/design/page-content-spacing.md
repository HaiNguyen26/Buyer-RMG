# Page Content Spacing — Shell, inset & stack

Tài liệu **bổ sung** [Layout Shell & Viewport Wrapper](./layout-shell-viewport-wrapper.md): quy ước **lề ngang**, **padding dọc**, **khoảng giữa khối**, và **đệm đáy** cho nội dung trong `<Outlet>` — để trang “thở”, không dính mép viewport, đồng bộ giữa Requestor / Buyer / Trưởng phòng.

**Nguồn token:** `client/src/constants/dashboardLayout.ts`, `requestorLayout.ts`, `buyerLayout.ts`, `departmentHeadLayout.ts` (re-export).

---

## 1. Hai lớp padding (quan trọng)

| Lớp | Đặt ở đâu | Vai trò |
|-----|-----------|---------|
| **Shell** (`dashboardMainPaddingXClass`) | `<main>` scroll | Chừa scrollbar, bleed full width |
| **Content inset** (`dashboardPageContentInsetXClass`) | Root trang / stack trong outlet | Lề **nội dung** thật khi outlet đã bleed |

Khi outlet dùng `dashboardMainHorizontalBleedClass`, **bắt buộc** inset trên trang con:

```ts
// dashboardLayout.ts
export const dashboardPageContentInsetXClass = 'px-1 sm:px-1.5 md:px-3';
```

**Buyer parity:**

```ts
// buyerLayout.ts
export const buyerPageContentClass = [
  `mx-auto min-h-0 w-full max-w-none min-w-0 space-y-6 ${dashboardPageContentInsetXClass} pt-3 sm:pt-4`,
  dashboardPageContentInsetBottomWorkspaceClass,
].join(' ');
```

---

## 2. Bảng token spacing

### 2.1 Ngang (X)

| Token | Class | Ghi chú |
|-------|-------|---------|
| Shell X | `dashboardMainPaddingXClass` | `px-1` → `2xl:px-3` (nhiều bước hơn inset) |
| Content inset X | `dashboardPageContentInsetXClass` | `px-1 sm:px-1.5 md:px-3` |
| Bleed | `dashboardMainHorizontalBleedClass` | Mở rộng full width main — kèm inset bên trong |

### 2.2 Dọc — đầu trang

| Token | Class |
|-------|-------|
| Shell top (thường) | `dashboardMainPaddingTopClass` → `pt-3 sm:pt-4` |
| Shell top (gọn) | `dashboardMainPaddingTopTightClass` → `pt-2 sm:pt-2.5` |
| Requestor shell | `requestorMainShellPaddingClass` (gộp top tight + bottom overview) |

### 2.3 Dọc — đáy trang (safe-area)

| Ngữ cảnh | Token |
|----------|-------|
| Workspace / list | `dashboardPageContentInsetBottomWorkspaceClass` — `pb` + `env(safe-area-inset-bottom)` |
| Dashboard overview | `dashboardPageContentInsetBottomOverviewClass` — nhẹ hơn |
| Main scroll (dự phòng) | `dashboardMainPaddingBottomClass` — khi không dùng inset trên từng trang |

**Buyer workspace đáy scroll:**

```ts
export const buyerDashboardWorkspaceScrollBottomClass =
  'pb-[max(1rem,calc(env(safe-area-inset-bottom,0px)+0.5rem))] sm:pb-4 md:pb-5';
```

### 2.4 Stack giữa các khối

| Token | Class |
|-------|-------|
| Dashboard V3 | `dashboardV3StackYClass` → `space-y-6 md:space-y-8` |
| Requestor page | `requestorPageStackClass` → `space-y-4 sm:space-y-5 md:space-y-6` |
| Buyer / Dept workspace | `space-y-6` trong `buyerPageContentClass` / `pageContentClass` |

---

## 3. Công thức trang chuẩn

### 3.1 Requestor list / overview

```text
main (scroll, requestorMainShellPaddingClass)
  └─ max-w-[1800px] mx-auto (tùy route)
       └─ requestorPageStackClass
            ├─ Hero / panels
            └─ data table card
```

- **Một scroll dọc** — không `max-h` ép scroll thứ hai trên list đã chuẩn.
- Nền canvas: `#F8FAFC` (dashboard) hoặc `#f1f5f9` (một số role workspace).

### 3.2 Department Head / Branch — approval & overview

```ts
const pageShellClass = 'w-full min-h-full min-w-0 bg-[#f1f5f9]';
const pageContentClass =
  'mx-auto w-full max-w-none min-w-0 space-y-6 px-1 pt-3 pb-4 sm:px-1.5 sm:pt-4 sm:pb-5 md:px-3';
```

- `max-w-none` — grid nở gần mép; padding nhỏ đồng bộ inset.
- **Một nền** `#f1f5f9` trên shell + page — tránh vệt `#F8FAFC` chồng lớp.

### 3.3 Trang Tổng quan / dashboard home (mọi role)

**Shell & scroll:** [layout-shell-viewport-wrapper.md §2](./layout-shell-viewport-wrapper.md#2-trang-tổng-quan--dashboard-home-mọi-role--chuẩn-chung).

```tsx
// dashboardLayout.ts — token gốc
dashboardOverviewOutletClass
dashboardOverviewPageShellClass
dashboardOverviewContentStackClass  // + role compact: space-y-4 nếu cần
```

Ví dụ alias role:

```tsx
// buyerLayout.ts
buyerDashboardOverviewOutletClass      // = dashboardOverviewOutletClass
buyerDashboardOverviewPageShellClass
buyerDashboardOverviewStackClass       // = dashboardOverviewContentStackClass
buyerDashboardOverviewStackCompactClass
```

- Nền scroll Tổng quan V3: `dashboardV3PageBgClass` trên **main scroll** (`*Dashboard.tsx` khi route home).
- **Không** `flex-1` trên page root / content stack.
- UI Bento/KPI: [dashboard-v3-design-philosophy.md](./dashboard-v3-design-philosophy.md).

### 3.4 Workspace outlet (danh sách / chi tiết — mọi role)

```tsx
<div className={buyerOutletPageShellClass}>  {/* bg #f1f5f9 */}
  <div className={buyerPageContentClass}>   {/* space-y-6 + inset */}
    <BuyerPageHero />
    …
  </div>
</div>
```

- Root **không** `min-h-full` — cao theo nội dung để `pb` main scroll có hiệu lực.
- Chi tiết RFQ: cùng shell; stack `dashboardV3StackYClass` + `px-2 sm:px-3` bổ sung trong hero region nếu cần.

### 3.5 Dashboard V3 — khối UI trong stack Tổng quan

Sau khi đã áp dụng shell §3.3:

```tsx
<div className={dashboardOverviewContentStackClass}>
  <article className={dashboardV3IslandClass}>…</article>
</div>
```

Spacing giữa đảo: `dashboardV3StackYClass` hoặc `space-y-*` trong stack role.

---

## 4. Spacer sau `<Outlet>`

Khi chuỗi flex + `h-full` làm DOM không “nhô” đủ để thấy nền dưới cùng:

```ts
export const dashboardScrollEndSpacerClass = [
  'pointer-events-none w-full min-w-0 shrink-0 select-none',
  'min-h-[max(0.5rem,calc(env(safe-area-inset-bottom,0px)*0.35))]',
  'sm:min-h-3',
].join(' ');
```

Buyer: `buyerDashboardMainScrollEndSpacerClass` (+ nền canvas).

---

## 5. Padding trong card / panel

| Thành phần | Gợi ý |
|------------|--------|
| Panel Requestor | `requestorPanelCardClass` → `p-4 sm:p-5` |
| Table card header | `requestorDataTableCardHeaderClass` → `p-4 sm:p-6` |
| Detail card body | `rfqDetailCardBodyClass` → `p-5 md:p-6` |
| Field box | `px-4 py-3.5`, label `mt-2` trên value |

**Nguyên tắc:** chữ không dính viền hộp; label uppercase `text-[11px]` + value `text-sm` cách nhau ít nhất `mt-1.5`–`mt-2`.

---

## 6. Full viewport vs content-height

| Pattern | Khi dùng |
|---------|----------|
| Nội dung cao tự nhiên + scroll main | Requestor PR list, RFQ detail, approval |
| `h-[clamp(...)]` + flex-1 table | Buyer Leader queue, ComparisonQueue |
| Tránh `min-h-[100dvh]` + `h-full` + `items-stretch` trên 2 cột | Master–detail Vendor — dính mép dưới |

Chi tiết viewport: [layout-shell-viewport-wrapper.md](./layout-shell-viewport-wrapper.md).

---

## 7. Checklist trang mới

- [ ] Xác định bleed: outlet có `dashboardMainHorizontalBleedClass` không?
- [ ] Nếu bleed → `dashboardPageContentInsetXClass` trên root trang
- [ ] Chọn bottom: `workspace` vs `overview` vs main `pb`
- [ ] `space-y-*` stack thống nhất role (4–6 hoặc 6–8)
- [ ] `min-w-0` trên flex children chứa bảng/chart
- [ ] Spacer sau outlet nếu dashboard shell dùng flex column
- [ ] Một màu nền canvas xuyên suốt shell → page

---

## 8. Tham chiếu code

| File | Vai trò |
|------|---------|
| `constants/dashboardLayout.ts` | Inset, bleed, outlet, spacer |
| `constants/requestorLayout.ts` | Requestor shell + stack |
| `constants/buyerLayout.ts` | Buyer page + workspace |
| `department-head/PRApproval.tsx` | `pageContentClass` mẫu |
| `buyer/RFQDetail.tsx` | Chi tiết + stack |
| `components/dashboard/DashboardV3Chrome.tsx` | `dashboardV3StackYClass`, island |

---

## Version History

- **2026-05**: Tách spec spacing/inset khỏi layout-shell; bảng token + công thức theo role.

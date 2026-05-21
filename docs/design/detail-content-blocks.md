# Detail Content Blocks — Card, section, empty state

Tài liệu cho trang **chi tiết / workspace đọc** (RFQ, PO, PR snapshot): khối card 16px, header section, field grid, badge đếm trên header, empty state **action-driven**, và phân biệt bảng **document** vs **interactive**.

**Không thay thế:** [Modal Design System](./modal-design-system.md) (overlay fullscreen), [Dashboard V3](./dashboard-v3-design-philosophy.md) (bento overview).

**Code mẫu:** `client/src/components/buyer/RfqDetailBlocks.tsx`, `client/src/pages/buyer/RFQDetail.tsx`.

---

## 1. Mục tiêu UX (Consumer-grade Enterprise)

| Trụ cột | Thực hành |
|---------|-----------|
| Phân cấp rõ | Tiêu đề `#1E293B`, mô tả `#64748B`, accent tối thiểu |
| Card = đảo | Bo `rounded-2xl`, shadow ambient, `ring-1` slate mảnh |
| Hành động tại chỗ | Empty state có **CTA secondary**, không chỉ chữ hướng dẫn |
| Badge đếm | Góc phải **section header** (Linear/Notion pattern) |
| Bảng đọc | Phẳng, có hover rail — **không** bo góc ô kiểu list |

---

## 2. Token card & body

```ts
// RfqDetailBlocks.tsx
export const rfqDetailCardClass =
  'overflow-hidden rounded-2xl border border-slate-200/55 bg-white shadow-[0_12px_40px_-18px_rgba(15,23,42,0.1),0_4px_16px_-8px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.03]';

export const rfqDetailCardBodyClass = 'p-5 md:p-6';

export const rfqDetailFieldBoxClass =
  'rounded-xl border border-slate-100/90 bg-[#F8FAFC] px-4 py-3.5 …';
```

**Stack trang:**

```tsx
<div className={buyerOutletPageShellClass}>
  <div className={`… ${dashboardV3StackYClass}`}>
    <BuyerPageHero />
    <article className={rfqDetailCardClass}>…</article>
  </div>
</div>
```

---

## 3. Section header

Component: `RfqDetailSectionHeader`

| Prop | Ý nghĩa |
|------|---------|
| `Icon` | Squircle `h-11 w-11`, tone map (indigo/cyan/sky/violet/…) |
| `title` | `text-base font-bold` → `md:text-[1.0625rem]` |
| `description` | Micro-copy tường minh — **một câu** giải thích khối |
| `trailing` | Badge đếm, nút primary (Gửi duyệt), chip trạng thái |

**Ví dụ micro-copy (RFQ):**

- Trạng thái: *「Badge trạng thái RFQ, số dòng hàng và báo giá NCC đã ghi nhận.」*
- Danh mục hàng: *「Mô tả, mã linh kiện, số lượng và đơn vị — không hiển thị đơn giá.」*

**Icon định danh:** khối luồng dùng `Target`; liên kết PR dùng `RadioTower`; hàng `Package`; báo giá `Building2` — tránh một icon chung mọi khối.

### 3.1 Count badge (header phải)

```tsx
<RfqDetailCountBadge count={quoteCount} tone="violet" />
<RfqDetailCountBadge count={itemCount} tone="sky" label={`${itemCount} dòng`} />
```

Tone map: `violet` | `sky` | `indigo` — `rounded-full`, `text-xs font-bold`, nền `/[0.08]`.

**Không** lặp cùng số ở body nếu đã có trên header — body chỉ giữ badge trạng thái nghiệp vụ (RFQ status pill).

---

## 4. Field grid (`RfqDetailField`)

```tsx
<dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
  <RfqDetailField label="Số RFQ" icon={Hash} iconClass="text-indigo-500">
    {rfqNumber}
  </RfqDetailField>
</dl>
```

- Label: `text-[11px] uppercase tracking-wide text-[#64748B]`
- Value: `text-sm font-semibold text-[#1E293B]`, icon `h-3.5` cạnh text
- Ghi chú dài: `sm:col-span-2`, `whitespace-pre-wrap`

---

## 5. Empty state — action-driven

Component: `RfqDetailEmptyState`

```tsx
<RfqDetailEmptyState
  Icon={Building2}
  title="Chưa có báo giá"
  description="Thêm báo giá trong mục Quản lý báo giá khi có phản hồi từ nhà cung cấp."
  action={
    <button type="button" className={rfqDetailSecondaryButtonClass} onClick={…}>
      Mở Quản lý báo giá
      <ChevronRight className="h-4 w-4 opacity-70" />
    </button>
  }
/>
```

**Secondary CTA:**

```ts
export const rfqDetailSecondaryButtonClass =
  'inline-flex … rounded-xl border border-violet-200/90 bg-white … text-violet-800 …';
```

| Loại | Dùng |
|------|------|
| Secondary (viền tím) | Điều hướng trong empty state |
| `dashboardV3CtaLinkClass` | Link indigo pill — hero / quay lại danh sách |
| Primary indigo filled | Một hành động chính / duyệt (header trailing) |

Khung empty: `border-dashed`, `py-12 sm:py-14`, icon `h-14` trong ô trắng.

---

## 6. Bảng trong khối chi tiết

### 6.1 Viewport ~10 dòng

```ts
// buyerLayout.ts + index.css .buyer-rfq-items-table-viewport
export const buyerRfqItemsTableViewportClass = '… buyer-rfq-items-table-viewport …';
```

- **Max-height** ~ `3rem + 72px × 10`, clamp `56dvh`
- **Không min-height** — ít dòng thì khung co theo bảng

### 6.2 Hàng document + hover

```ts
buyerTableDocumentRowClass(index)  // hover indigo, vạch rail, KHÔNG bo ô
buyerTableAccentRailClass
buyerTableCellWrapClass            // translate-x nhẹ khi hover
```

Tách khỏi `buyerTableDataRowVisual` (có `rounded-l/r-2xl`) dùng cho **list workspace**.

### 6.3 Header bảng sticky

`dashboardV3TableHeaderStripClass` trên `thead` trong viewport cuộn.

---

## 7. Banner phụ (insight / policy)

Ví dụ “Đơn giá — chỉ Buyer Leader”:

```tsx
<div className="flex gap-3.5 bg-indigo-500/[0.04] px-5 py-4 md:px-6 md:py-5">
  <span className="flex h-10 w-10 … rounded-2xl bg-indigo-500/10">…</span>
  <div>
    <p className="text-sm font-semibold text-[#1E293B]">…</p>
    <p className="mt-1 text-xs text-[#64748B]">…</p>
  </div>
</div>
```

Không thay section card — là **callout** trong card trạng thái.

---

## 8. CTA hàng đầu trang

Dưới hero, nhóm nút phụ:

- Quay lại: `dashboardV3CtaLinkClass` + `ArrowLeft`
- Điều hướng module: secondary outline slate hoặc `rfqDetailSecondaryButtonClass` tùy nhấn mạnh

---

## 9. Checklist trang chi tiết mới

- [ ] `buyerOutletPageShellClass` / nền canvas role
- [ ] Hero role (`*PageHero`) + stack `space-y-6`
- [ ] Mỗi chủ đề = `rfqDetailCardClass` (hoặc alias tương đương)
- [ ] `RfqDetailSectionHeader` + `trailing` badge/action
- [ ] Field grid `gap-4`, field box `py-3.5`
- [ ] Empty có `action` CTA khi user có bước tiếp theo rõ
- [ ] Bảng: chọn document vs interactive row class
- [ ] Viewport scroll nếu > ~10 dòng

---

## 10. Tham chiếu triển khai

| Màn | File |
|-----|------|
| RFQ chi tiết Buyer | `pages/buyer/RFQDetail.tsx` |
| Building blocks | `components/buyer/RfqDetailBlocks.tsx` |
| Buyer overview panels | `components/buyer/BuyerOverviewPanel.tsx` |
| Modal (khác pattern) | `components/AppModal.tsx` + modal-design-system |

---

## Version History

- **2026-05**: Tách spec detail blocks; empty CTA secondary; badge header; bảng document RFQ.

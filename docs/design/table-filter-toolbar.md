# Table Filter & Toolbar — Enterprise SaaS

Tài liệu mô tả **đảo lọc** (filter bar) phía trên bảng danh sách: layout grid, ô tìm kiếm, dropdown trạng thái, hành vi empty state theo filter, và token code trong repo.

**Liên quan:**

- Bảng bên dưới filter: [Data Table Interactive Enterprise](./data-table-interactive-enterprise.md)
- Shell trang / scroll: [Layout Shell & Viewport Wrapper](./layout-shell-viewport-wrapper.md)
- Badge trạng thái trong bảng: `client/src/constants/saasDataTable.ts`

---

## 1. Vai trò UX

| Mục tiêu | Cách đạt |
|----------|----------|
| Lọc nhanh không rời trang | Filter **cố định trên** card bảng, không ẩn trong menu |
| Một mental model | Search (text) + Queue/Status (enum) + (tùy) Date/Dept |
| Phản hồi rõ | Số dòng hiển thị trên **title bar bảng** hoặc **hero slot** |
| Không “chết” khi trống | Empty hint **theo filter đang chọn**, không chỉ “Không có dữ liệu” |

---

## 2. Anatomy — Filter bar

```text
[ Page Hero ]
[ Filter card — đảo riêng, shadow tĩnh ]
    ├─ Search (flex-1, icon trái)
    ├─ Queue / Status select (+ icon Filter)
    └─ (optional) Date, Dept, Reset — grid responsive
[ Data card — module 2 lớp ]
    ├─ Title bar (+ count badge)
    └─ Table viewport
```

### 2.1 Filter card (đảo)

**Chuẩn phê duyệt (glass nhẹ):**

```ts
const filterBarClass =
  'rounded-2xl border border-slate-200/60 bg-white/90 p-4 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/5 backdrop-blur-sm sm:p-5';
```

**Chuẩn workspace Buyer (đơn giản, bóng tĩnh):**

```ts
// buyerLayout.ts
export const buyerWorkspaceFiltersCardClass =
  'rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm';
```

**Quy tắc:**

- **Không** `hover:shadow-xl` trên đảo filter — tránh “nhảy” layout khi di chuột (xem layout-shell §6).
- Tách **filter card** và **data card** — user quét: lọc → kết quả.

### 2.2 Grid responsive

```tsx
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
  {/* Search — chiếm 2 cột trên lg */}
  <div className="relative min-w-0 sm:col-span-2 lg:col-span-2">…</div>
  {/* Queue select */}
  <div className="flex min-w-0 items-center gap-2">…</div>
</div>
```

Buyer list (1 hàng flex):

```tsx
<div className="flex flex-col gap-4 md:flex-row md:items-end">
  <div className="relative min-w-0 flex-1">…search…</div>
  <div className="flex w-full min-w-0 items-center gap-2 md:w-auto md:max-w-xs">…select…</div>
</div>
```

---

## 3. Ô tìm kiếm (Search)

| Thuộc tính | Giá trị gợi ý |
|------------|----------------|
| Chiều cao | `h-11` (approval) hoặc `py-2.5` (buyer workspace) |
| Bo | `rounded-xl` |
| Nền | `bg-slate-100/80` → `focus:bg-white` |
| Icon | `Search` absolute `left-3`, `pointer-events-none`, `text-slate-400` hoặc accent role (`text-cyan-600`) |
| Focus | `focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20` (hoặc cyan cho Buyer) |
| Placeholder | Mô tả **trường được search**: mã PR, mô tả, người yêu cầu… |

```tsx
<input
  type="search"
  autoComplete="off"
  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100/80 pl-10 pr-3 text-sm …"
/>
```

**Client-side:** `useMemo` filter sau khi data về; **server-side:** đưa `queue` / `status` vào `queryKey` + API params.

---

## 4. Dropdown trạng thái / hàng đợi

### 4.1 Option «Tất cả»

- Giá trị API: `'all'` — map sang `undefined` khi gọi service nếu backend không nhận `all`.
- Nhãn: **「Tất cả」** hoặc **「Tất cả trạng thái」** — thống nhất trong module.

### 4.2 Approval queue (Trưởng phòng / GĐ chi nhánh)

**File:** `client/src/constants/approvalQueueFilter.ts`

| `queue` | Nhãn UI | Ghi chú |
|---------|---------|---------|
| `all` | Tất cả | Mặc định `APPROVAL_QUEUE_DEFAULT` |
| `pending` | Chờ duyệt | Chỉ queue này cho phép duyệt/từ chối |
| `approved` | Đã duyệt | Read-only list |
| `partial` | Duyệt một phần | Dept head only |
| `rejected` / `returned` | Từ chối / Trả PR | |

```ts
export function canActOnApprovalQueue(queue: ApprovalQueueFilter): boolean {
  return queue === 'pending';
}

export function approvalQueueEmptyHint(queue: ApprovalQueueFilter): string;
```

**UX:** Đổi queue → đóng modal chi tiết (`setDetailPrId(null)`); disable nút duyệt khi `!canActOnApprovalQueue(queue)`.

### 4.3 RFQ / PR status filters

- RFQ: `statusLabels` + options trong `RFQManagement.tsx`
- PR: `PR_STATUS_FILTER_OPTIONS` trong `statusLabels.ts` khi cần dropdown chung

### 4.4 Component select

- **Native `<select>`** — approval pages (đủ cho 5–7 option).
- **`CustomSelect`** — Buyer workspace khi cần đồng bộ style với form khác.

Icon `Filter` `h-5 w-5 shrink-0` cạnh select — nhận diện nhóm lọc.

---

## 5. Count & phản hồi

| Vị trí | Pattern |
|--------|---------|
| **Hero `rightSlot`** | Số PR/RFQ “theo bộ lọc hiện tại” — glass pill trên hero |
| **Title bar bảng** | `rounded-full` badge cạnh tiêu đề (`{filteredRFQs.length}`) |
| **Section header (detail)** | `RfqDetailCountBadge` góc phải — xem [Detail Content Blocks](./detail-content-blocks.md) |

Không nhân đôi cùng một con số ở 3 chỗ — chọn **hero** hoặc **title bar**, thêm chỗ thứ ba chỉ khi vai trò khác (tổng vs đã lọc).

---

## 6. Empty state theo filter

```tsx
{filteredPRs.length === 0 ? (
  <tr>
    <td colSpan={n} className="… text-center …">
      {searchQuery.trim()
        ? 'Không có kết quả khớp từ khóa.'
        : approvalQueueEmptyHint(queueFilter)}
    </td>
  </tr>
) : …}
```

**Không** hiển thị nút “Xóa bộ lọc” riêng nếu đã có «Tất cả» + clear search — tránh clutter (quyết định product 2026-04 approval queue).

---

## 7. Thứ tự DOM chuẩn (workspace Buyer)

```text
buyerOutletPageShellClass
  └─ buyerWorkspacePageStackClass (space-y-6 + inset)
       ├─ BuyerPageHero
       ├─ article.buyerWorkspaceFiltersCardClass
       └─ article.buyerWorkspaceDataCardClass
            ├─ buyerWorkspaceTableTitleBarClass
            └─ buyerWorkspaceTableViewportClass + table
```

Tham chiếu: `RFQManagement.tsx`, `AssignedPR.tsx`, `POList.tsx`.

---

## 8. Smart filter grid (Buyer Leader)

Màn phân công / hàng đợi phức tạp: grid nhiều cột filter trên `100dvh` — xem `PendingAssignments.tsx` và [Layout shell §7](./layout-shell-viewport-wrapper.md#7-buyer-leader--màn-có-card-bảng-bám-chiều-cao-viewport-comparisonqueue).

---

## 9. Checklist màn list mới

- [ ] Filter card tách khỏi data card; shadow **tĩnh**
- [ ] Search + ít nhất một enum filter; option **「Tất cả」**
- [ ] `queryKey` gồm filter gửi server (nếu có)
- [ ] Count hiển thị sau lọc (title bar hoặc hero)
- [ ] Empty message **theo filter** + theo search
- [ ] Đổi filter đóng panel/modal chi tiết đang mở
- [ ] Hành động bulk/duyệt chỉ khi queue = `pending` (nếu áp dụng)

---

## 10. Tham chiếu code

| Màn / module | File |
|--------------|------|
| Duyệt PR Trưởng phòng | `department-head/PRApproval.tsx` |
| Duyệt PR Chi nhánh | `branch-manager/PRApproval.tsx` |
| RFQ Buyer | `buyer/RFQManagement.tsx` |
| Duyệt PO Buyer Manager | `buyer-manager/POApproval.tsx` — `buyerWorkspaceFiltersCardClass` + outer `poApprovalDataCardOuterClass` (hai lớp bóng data card) |
| Queue filter constants | `constants/approvalQueueFilter.ts` |
| Token filter card Buyer | `constants/buyerLayout.ts` → `buyerWorkspaceFiltersCardClass`, `buyerWorkspaceDataCardClass` |

---

## Version History

- **2026-05**: Tách từ hub README; chuẩn hóa approval queue, Buyer workspace, empty hint.
- **2026-05**: Thêm mẫu `buyer-manager/POApproval.tsx` (filter + bảng chờ duyệt PO).

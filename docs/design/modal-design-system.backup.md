# Modal Design System — Enterprise SaaS Pattern

## Tổng quan

Hệ thống modal được thiết kế theo phong cách **Enterprise SaaS** với 3 nguyên tắc cốt lõi:
1. **Glassmorphism & Hierarchy** — header nổi bật, sticky, blur để tách biệt khi cuộn
2. **Information Architecture** — 2-column layout: cột chính (nội dung/timeline), cột phụ (metadata/actions)
3. **Motion & Depth** — zoom-in animation, deep shadow, backdrop blur

---

## Anatomy của Modal Chi tiết (Detail Modal)

### 1. Overlay & Container

```tsx
<div
  className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
  style={{ 
    backdropFilter: 'blur(8px)', 
    backgroundColor: 'rgba(15,23,42,0.6)' 
  }}
  onClick={handleClose}
>
  <div
    className="modal-popup-panel flex max-h-[min(96dvh,100dvh)] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-2xl"
    style={{ 
      boxShadow: '0 32px 64px -12px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.06) inset',
      animation: 'modalZoomIn 0.22s cubic-bezier(0.16,1,0.3,1)' 
    }}
    onClick={(e) => e.stopPropagation()}
  >
    <style>{`@keyframes modalZoomIn{from{opacity:0;transform:scale(0.94) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    
    {/* Nội dung modal */}
  </div>
</div>
```

**Key Points:**
- **Overlay backdrop**: `blur(8px)` + `rgba(15,23,42,0.6)` — đậm hơn blur nhẹ truyền thống
- **Deep shadow**: `0 32px 64px -12px` — offset Y lớn, blur sâu → cảm giác "nổi" ra khỏi trang
- **Inset highlight**: `0 0 0 1px rgba(255,255,255,0.06) inset` — viền sáng mỏng tạo chiều sâu
- **Zoom animation**: `scale(0.94→1) + translateY(8px→0)` trong 220ms — smooth, không quá nhanh
- **Mobile**: `rounded-t-3xl` (chỉ bo góc trên) + `items-end` — slide từ dưới lên; desktop: `rounded-2xl` + `items-center`

---

### 2. Glassmorphism Header (Sticky)

```tsx
<div
  className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 border-b border-slate-200/60 px-5 py-4 sm:px-6"
  style={{ 
    background: 'rgba(255,255,255,0.82)', 
    backdropFilter: 'blur(14px)' 
  }}
>
  <div className="min-w-0 flex-1">
    {/* Kicker text */}
    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-500">
      Purchase Request
    </p>
    
    {/* Mã chứng từ — tâm điểm */}
    <h2 className="mt-0.5 font-mono text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
      {prNumber}
    </h2>
    
    {/* Meta inline: status badge + ngày + phòng ban */}
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold">
        <StatusIcon />
        {statusLabel}
      </span>
      <span className="text-xs text-slate-400">{dateCreated}</span>
      <span className="flex items-center gap-1 text-xs text-slate-500">
        <Building2 className="h-3 w-3" />
        {department}
      </span>
    </div>
  </div>
  
  {/* Close button */}
  <button className="shrink-0 rounded-xl border border-slate-200 bg-white p-2 text-slate-400 shadow-sm transition hover:border-slate-300 hover:text-slate-700">
    <X className="h-4 w-4" strokeWidth={2} />
  </button>
</div>
```

**Key Points:**
- `sticky top-0` + `backdropFilter: blur(14px)` — luôn thấy header khi cuộn, nội dung phía sau bị mờ
- Mã chứng từ `font-mono text-3xl font-black` — **trung tâm chú ý**, không cần label "Mã PR:"
- Kicker text `10px uppercase tracking-widest` — nhãn ngữ cảnh nhỏ, không chiếm không gian
- Inline metadata (status + date + dept) — không cần grid riêng, tiết kiệm chiều cao header
- Close button `rounded-xl border` — không nổi quá, không đè lên hierarchy

---

### 3. Insight Cards (High-Value Information)

```tsx
<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
  {/* Card 1: Giá trị — Xanh dương */}
  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-4 text-white shadow-md shadow-blue-500/20">
    <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
    <p className="text-[10px] font-bold uppercase tracking-widest text-blue-100">Giá trị PR</p>
    <p className="mt-1 text-xl font-black tabular-nums leading-tight">
      {formatCurrency(amount)}
    </p>
    <DollarSign className="absolute bottom-3 right-3 h-6 w-6 text-white/20" strokeWidth={1.5} />
  </div>

  {/* Card 2: Mục đích — Tím */}
  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 p-4 text-white shadow-md shadow-violet-500/20">
    <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
    <p className="text-[10px] font-bold uppercase tracking-widest text-violet-100">Mục đích</p>
    <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">
      {purpose}
    </p>
    <Info className="absolute bottom-3 right-3 h-6 w-6 text-white/20" strokeWidth={1.5} />
  </div>

  {/* Card 3: SLA/Deadline — Cam */}
  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 p-4 text-white shadow-md shadow-amber-500/20">
    <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
    <p className="text-[10px] font-bold uppercase tracking-widest text-orange-100">Ngày cần</p>
    <p className="mt-1 text-lg font-black leading-tight">
      {requiredDate}
    </p>
    <Calendar className="absolute bottom-3 right-3 h-6 w-6 text-white/20" strokeWidth={1.5} />
  </div>
</div>
```

**Key Points:**
- **Gradient pastel** (from-X-500/600 to-Y-600) — thu hút mắt nhưng không chói
- **Circle decoration** góc trên phải (`-right-3 -top-3 bg-white/10`) — tạo chiều sâu
- **Icon watermark** góc dưới phải (`text-white/20`) — nhấn nhá không làm xao nhãng
- **Shadow tinted** (`shadow-blue-500/20`) — hơi xanh/tím/cam theo màu card
- **3 cột responsive**: `grid-cols-1 sm:grid-cols-3` — mobile xếp dọc, desktop ngang
- **Typography**: kicker `10px uppercase tracking-widest`, value `text-xl font-black tabular-nums`

**Khi nào dùng:**
- Modal có 2-3 metric quan trọng cần highlight ngay (giá trị, deadline, count, status)
- Nếu chỉ 1 metric → dùng 1 card full-width
- Nếu > 3 → chọn 3 quan trọng nhất, phần còn lại để trong cột phụ (detail list)

---

### 4. Two-Column Layout

```tsx
<div className="flex flex-col gap-0 md:flex-row md:min-h-full">
  
  {/* Cột chính (Timeline / Content / Table) */}
  <div className="min-w-0 flex-[3] space-y-4 p-4 sm:p-5 md:border-r md:border-slate-200/60">
    {/* Insight cards */}
    {/* Timeline / Process */}
    {/* Notes */}
    {/* Items table */}
    {/* Attachments */}
  </div>

  {/* Cột phụ (Metadata / Actions) */}
  <div className="flex flex-col gap-4 bg-gradient-to-b from-slate-50 to-white p-4 sm:p-5 md:w-64 md:shrink-0 md:border-t-0">
    
    {/* Khối chứng từ — Indigo-900 */}
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 to-indigo-800 text-white shadow-lg shadow-indigo-900/30">
      <div className="border-b border-indigo-700/50 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-300">
          Thông tin chứng từ
        </p>
      </div>
      <dl className="divide-y divide-indigo-700/30 px-4 py-0 text-sm">
        <div className="flex items-center justify-between gap-2 py-3">
          <dt className="flex items-center gap-1.5 text-xs text-indigo-300">
            <Icon />Label
          </dt>
          <dd className="font-semibold text-white">Value</dd>
        </div>
        {/* More rows */}
      </dl>
    </div>

    {/* Action buttons */}
    <div className="mt-auto flex flex-col gap-2">
      <button className="rounded-xl bg-amber-500 text-white">Primary Action</button>
      <button className="rounded-xl border border-rose-200 bg-rose-50 text-rose-600">Danger Action</button>
      <button className="rounded-xl border border-slate-200 bg-white text-slate-600">Close</button>
    </div>
  </div>
</div>
```

**Key Points:**
- **Mobile-first**: `flex-col` mặc định, `md:flex-row` từ tablet — mobile xếp dọc, desktop 2 cột
- **Flex ratio**: cột chính `flex-[3]`, cột phụ `w-64 shrink-0` — tỉ lệ ~3:1
- **Border phân cách**: `md:border-r` trên cột chính thay vì border-left cột phụ — khớp reading flow
- **Khối chứng từ**: `indigo-900` để tạo "anchor" đậm, thông tin tĩnh quan trọng (người tạo, ngày tạo, status)
- **Actions `mt-auto`**: luôn nằm đáy cột phụ, hierarchy rõ (primary → danger → secondary → close)

**Khi nào dùng 2-column:**
- Modal có > 5 field metadata + timeline/process + table/list lớn
- Cần tách rõ "nội dung" vs "chứng từ/actions"
- Nếu modal đơn giản (< 5 field) → dùng 1 cột, không chia

---

### 5. Content Blocks (Cột chính)

#### a) Ghi chú

```tsx
<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
  <div className="mb-2 flex items-center gap-2">
    <FileText className="h-4 w-4 text-slate-500" strokeWidth={2} />
    <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Ghi chú</p>
  </div>
  <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
    {notes}
  </p>
</div>
```

#### b) Bảng compact (với scroll nội bộ)

```tsx
<div className="rounded-xl border border-slate-200 bg-white shadow-sm">
  <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
    <Package className="h-4 w-4 text-slate-500" strokeWidth={2} />
    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
      Danh sách vật tư ({count})
    </h3>
  </div>
  
  {/* Scroll wrapper — giới hạn ~5-6 dòng */}
  <div className="max-h-60 overflow-auto [scrollbar-width:thin]">
    <table className="w-full min-w-[640px] border-collapse text-sm">
      <thead className="sticky top-0 bg-slate-50">
        <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <th className="px-4 py-2.5 text-left">#</th>
          <th className="px-4 py-2.5 text-left">Mã / Tên</th>
          {/* ... */}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        <tr className="bg-white">
          <td className="px-4 py-2.5 text-xs tabular-nums text-slate-400">1</td>
          {/* ... */}
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

**Key Points:**
- **max-h-60** (~240px, ~5-6 dòng) + `overflow-auto` — cuộn nội bộ, không đẩy dài modal
- **thead sticky** — cột luôn thấy khi cuộn bảng
- **min-w-[640px]** — đảm bảo đủ rộng, wrapper ngoài `overflow-auto` → cuộn ngang nếu cần
- **text-sm** (14px) cho tbody, `text-xs` (11-12px) cho header — compact nhưng đọc được
- **row zebra nhẹ**: `bg-white` / `bg-slate-50/40` — không chói

#### c) Tài liệu đính kèm

```tsx
<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
  <div className="mb-3 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Paperclip className="h-4 w-4 text-slate-500" strokeWidth={2} />
      <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Tài liệu đính kèm</p>
    </div>
    <button className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100">
      <Paperclip className="h-3 w-3" />Upload thêm
    </button>
  </div>
  
  <div className="space-y-1.5">
    <a href="#" className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100">
      <ExternalLink className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      <span className="truncate text-xs">filename.pdf</span>
    </a>
  </div>
</div>
```

---

### 6. Sidebar Metadata Block (Indigo-900)

```tsx
<div className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 to-indigo-800 text-white shadow-lg shadow-indigo-900/30">
  <div className="border-b border-indigo-700/50 px-4 py-3">
    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-300">
      Thông tin chứng từ
    </p>
  </div>
  
  <dl className="divide-y divide-indigo-700/30 px-4 py-0 text-sm">
    <div className="flex items-center justify-between gap-2 py-3">
      <dt className="flex items-center gap-1.5 text-xs text-indigo-300">
        <User className="h-3 w-3" strokeWidth={2} />Người tạo
      </dt>
      <dd className="font-semibold text-white">username</dd>
    </div>
    
    <div className="flex items-center justify-between gap-2 py-3">
      <dt className="flex items-center gap-1.5 text-xs text-indigo-300">
        <Calendar className="h-3 w-3" strokeWidth={2} />Ngày tạo
      </dt>
      <dd className="font-semibold tabular-nums text-white">23/04/2026</dd>
    </div>
    
    {/* Trạng thái — full width, có badge */}
    <div className="flex flex-col gap-1 py-3">
      <dt className="text-xs text-indigo-300">Trạng thái</dt>
      <dd>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/20">
          <Icon className="h-3 w-3" />Label
        </span>
      </dd>
    </div>
  </dl>
</div>
```

**Tại sao indigo-900?**
- **Tạo "anchor"** đậm giữa nền trắng/pastel — điểm neo mắt
- **Tương phản cao** → metadata quan trọng (người tạo, ngày tạo) dễ đọc
- **Cảm giác "tin cậy"** — màu tối gắn với chứng từ/legal context trong SaaS

**Alternative:**
- Nếu brand không dùng indigo → thay `slate-800`, `gray-900`, hoặc primary brand color đậm

---

### 7. Action Buttons (Sidebar Footer)

```tsx
<div className="mt-auto flex flex-col gap-2">
  {/* Primary */}
  <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600">
    <Edit className="h-4 w-4" strokeWidth={2} />
    Chỉnh sửa
  </button>
  
  {/* Secondary positive */}
  <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
    <PackageOpen className="h-4 w-4" strokeWidth={2} />
    Tạo phiếu xuất
  </button>
  
  {/* Danger */}
  <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-600 hover:text-white">
    <Trash2 className="h-4 w-4" strokeWidth={2} />
    Xóa PR
  </button>
  
  {/* Close (ghost) */}
  <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
    Đóng
  </button>
</div>
```

**Hierarchy:**
1. **Primary action** (amber/blue solid) — hành động chính người dùng hay làm nhất
2. **Secondary positive** (emerald solid) — hành động phụ nhưng vẫn quan trọng
3. **Danger** (rose border + fill white → hover fill solid) — nguy hiểm, cần phân biệt
4. **Close** (slate ghost) — luôn cuối, không thu hút chú ý

**`mt-auto`** → luôn đẩy xuống đáy sidebar, không dính sát metadata phía trên.

---

## Timeline / Process Flow Pattern

Dùng khi modal thể hiện workflow có nhiều bước (PR approval, Order tracking):

```tsx
<div>
  <h3 className="text-sm font-semibold text-slate-900 sm:text-base">
    Tiến trình xử lý
  </h3>
  <ol className="m-0 list-none p-0">
    {stages.map((stage, index) => {
      const isCompleted = stage.completed;
      const isCurrent = stage.current;
      const isLast = index === stages.length - 1;
      const showTopWire = index > 0;
      const showBottomWire = !isLast;

      return (
        <li key={stage.key} className="flex gap-0">
          {/* Wire + Icon column */}
          <div className="flex w-8 shrink-0 flex-col items-center sm:w-9">
            {showTopWire && (
              <div className="h-2 w-px shrink-0 rounded-full bg-slate-200/90" />
            )}
            
            <div className={`relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-white shadow-sm transition-colors ${
              isCompleted
                ? 'border-emerald-500 bg-emerald-500 text-white shadow-emerald-500/20'
                : isCurrent
                  ? 'border-indigo-500 text-indigo-600 shadow-sm shadow-indigo-500/10 ring-2 ring-indigo-100'
                  : 'border-slate-200 text-slate-300'
            }`}>
              {isCompleted ? <Check className="h-3 w-3" strokeWidth={2.75} /> : <StageIcon className="h-3 w-3" strokeWidth={2} />}
            </div>
            
            {showBottomWire && (
              <div className="mt-0.5 h-5 w-px shrink-0 rounded-full bg-slate-200/90" />
            )}
          </div>

          {/* Content */}
          <div className={`min-w-0 flex-1 pl-2 sm:pl-2.5 ${isLast ? 'pb-0' : 'pb-2 sm:pb-2.5'}`}>
            <div className={`rounded-lg px-2 py-1.5 sm:px-2.5 sm:py-2 ${
              isCurrent
                ? 'border border-indigo-200/70 bg-gradient-to-br from-indigo-50/90 to-violet-50/50 shadow-sm'
                : isCompleted
                  ? 'border border-transparent'
                  : 'border border-transparent opacity-[0.72]'
            }`}>
              <h4 className="text-xs font-semibold leading-tight sm:text-[13px]">
                {stage.label}
              </h4>
            </div>
          </div>
        </li>
      );
    })}
  </ol>
</div>
```

**Key Points:**
- **Icon state**: Completed (emerald check), Current (indigo ring), Pending (slate ghost)
- **Wire connector**: `w-px bg-slate-200/90 rounded-full` — mảnh, mịn, không quá nổi
- **Current highlight**: `bg-gradient-to-br from-indigo-50/90` — nhẹ nhàng, không chói
- **Opacity pending**: `opacity-[0.72]` — bước chưa tới bị mờ, tạo depth perception

---

## SLA Modal: "The Time Precision" (Độ chính xác thời gian)

Triết lý này ưu tiên **minh bạch thời gian**, **cảnh báo sớm**, và **micro-interactions có ngữ nghĩa** để người dùng cảm nhận được mức độ khẩn cấp mà không cần đọc quá nhiều text.

### 1) SLA Tracker (Trọng tâm thị giác)

#### Mood-Based Coloring
- Card SLA đổi mood theo trạng thái:
  - **Indigo**: Bình thường
  - **Amber**: Cảnh báo
  - **Rose**: Nguy hiểm / quá hạn
- Mục tiêu: giúp não bộ nhận mức ưu tiên bằng màu trước khi đọc nhãn.

#### Motion Semantics
- Icon `Timer`/`Clock` dùng animation quay chậm (`animate-spin-slow`) để truyền tải ý niệm **thời gian đang trôi**.
- Motion phải nhẹ, không gây xao nhãng; dùng cho **current SLA state** là chính.

```tsx
<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
  <div className="flex items-center justify-between">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">SLA</p>
    <Clock className="h-4 w-4 animate-spin-slow text-indigo-600" strokeWidth={1.8} />
  </div>
  <p className="mt-2 text-lg font-black text-slate-900">Còn 12 giờ</p>
</div>
```

### 2) Timeline Hierarchy (Phân cấp tiến trình)

#### The Shadow Path
- Dùng đường timeline mờ (`bg-slate-200/80`) kết hợp icon node có shadow rõ hơn để tạo chiều sâu.
- Node không cần quá to; ưu tiên tương phản và spacing đều.

#### Current State Highlight
- Bước hiện tại được nhấn bằng:
  - `ring-8` (halo)
  - dịch chuyển nhẹ `translate-x-2`
  - border/color mạnh hơn node còn lại
- Mục tiêu: tách biệt hoàn toàn bước hiện tại khỏi bước completed/pending.

```tsx
<li className="flex">
  <div className="mr-3 flex flex-col items-center">
    <div className="h-3 w-px rounded-full bg-slate-200/80" />
    <div className="translate-x-2 rounded-full border-2 border-indigo-500 bg-white p-1.5 ring-8 ring-indigo-100 shadow-lg">
      <Clock className="h-3.5 w-3.5 text-indigo-600" />
    </div>
    <div className="h-6 w-px rounded-full bg-slate-200/80" />
  </div>
  <div className="pt-0.5">
    <p className="text-sm font-semibold text-slate-900">Đang chờ duyệt SLA</p>
  </div>
</li>
```

### 3) High-Contrast Detail Block (Anchor point)

- Khối thông tin quan trọng ở cột phải dùng nền tối `slate-900` để tạo điểm neo mắt.
- Kết hợp đường viền mờ kiểu glass (`border-white/10`, `bg-white/5`) để giữ cảm giác hiện đại, không “đặc” quá.

```tsx
<div className="rounded-2xl bg-slate-900 p-4 text-white shadow-xl">
  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300">SLA Summary</p>
  <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-300">Deadline</span>
      <span className="font-semibold text-white">24/04/2026 17:00</span>
    </div>
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-300">Mức độ</span>
      <span className="font-semibold text-amber-300">Cảnh báo</span>
    </div>
  </div>
</div>
```

### Checklist nhanh cho SLA Modal
- [ ] Có SLA card đổi màu theo mood (indigo/amber/rose)
- [ ] Có motion semantics cho icon thời gian (`spin-slow`)
- [ ] Timeline có shadow path và current state highlight (`ring-8`, `translate-x-2`)
- [ ] Có high-contrast anchor block (`slate-900`) ở cột phụ
- [ ] Halo/animation chỉ dùng cho state hiện tại, tránh lạm dụng

---

## Liquid SLA Performance (Hiệu ứng Chảy)

Biến thanh tiến trình khô khan thành **"ống năng lượng"** sống động — điểm nhấn công nghệ của giao diện.

### 1) Lớp nền (Base Layer)

Sử dụng `via-color` trong gradient để tạo cảm giác **ống kính quang học** chứa chất lỏng:

```tsx
<div className="relative h-10 overflow-hidden rounded-full bg-slate-200">
  <div
    className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-blue-600 transition-all duration-700 ease-out"
    style={{ width: `${progress}%` }}
  />
</div>
```

**Key colors combo:**
- **Indigo-Cyan-Blue**: Công nghệ, tin cậy
- **Emerald-Teal-Green**: Tăng trưởng, hoàn thành
- **Amber-Orange-Rose**: Cảnh báo, khẩn cấp

### 2) Luồng sáng chảy (Flow Animation)

Tạo dải sáng mờ chạy liên tục trên thanh để mô phỏng **dòng chảy dữ liệu/thời gian**:

```tsx
<div className="relative h-10 overflow-hidden rounded-full bg-slate-200">
  {/* Base gradient bar */}
  <div
    className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-blue-600 transition-all duration-700"
    style={{ width: `${progress}%` }}
  >
    {/* Flowing shine overlay */}
    <div
      className="absolute inset-0 animate-liquid-flow"
      style={{
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
        backgroundSize: '200% 100%',
      }}
    />
  </div>
</div>

<style>{`
  @keyframes liquid-flow {
    from {
      transform: translateX(-200%);
    }
    to {
      transform: translateX(300%);
    }
  }
  .animate-liquid-flow {
    animation: liquid-flow 3s linear infinite;
  }
`}</style>
```

**Timing:**
- Duration: `3s` — không quá nhanh, tạo cảm giác smooth
- Easing: `linear` — dòng chảy đều, không giật
- Infinite: luôn chuyển động khi bar hiển thị

### 3) Bọt khí (Micro-Bubbles)

Đặt các chấm tròn nhỏ pulse ngẫu nhiên bên trong thanh để tăng tính chân thực:

```tsx
<div className="relative h-12 overflow-hidden rounded-full bg-slate-200">
  <div
    className="relative h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-blue-600"
    style={{ width: `${progress}%` }}
  >
    {/* Flow shine */}
    <div className="absolute inset-0 animate-liquid-flow" style={{background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)',backgroundSize:'200% 100%'}} />
    
    {/* Micro bubbles */}
    {progress > 20 && (
      <>
        <div className="absolute left-[15%] top-2 h-1.5 w-1.5 animate-pulse rounded-full bg-white/40" style={{animationDuration:'2.2s'}} />
        <div className="absolute left-[45%] top-4 h-1 w-1 animate-pulse rounded-full bg-white/30" style={{animationDuration:'2.8s'}} />
        <div className="absolute left-[75%] top-3 h-2 w-2 animate-pulse rounded-full bg-white/35" style={{animationDuration:'3.1s'}} />
      </>
    )}
  </div>
</div>
```

**Tips:**
- Chỉ render bubbles khi `progress > 20%` để tránh hiệu ứng bị cắt
- Dùng `animationDuration` khác nhau (2.2s, 2.8s, 3.1s) để tạo nhịp ngẫu nhiên
- Opacity nhẹ (`bg-white/30-40`) để không "đóng băng" flow

### 4) Combined Example (Full Implementation)

```tsx
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">SLA Progress</p>
    <span className="text-sm font-black tabular-nums text-indigo-600">{progress}%</span>
  </div>

  <div className="relative h-12 overflow-hidden rounded-full bg-slate-200 shadow-inner">
    <div
      className="relative h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-blue-600 transition-all duration-700 ease-out"
      style={{ width: `${progress}%` }}
    >
      {/* Flowing shine */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
          backgroundSize: '200% 100%',
          animation: 'liquid-flow 3s linear infinite',
        }}
      />
      
      {/* Micro bubbles */}
      {progress > 20 && (
        <>
          <div className="absolute left-[15%] top-2 h-1.5 w-1.5 animate-pulse rounded-full bg-white/40" style={{animationDuration:'2.2s'}} />
          <div className="absolute left-[45%] top-4 h-1 w-1 animate-pulse rounded-full bg-white/30" style={{animationDuration:'2.8s'}} />
          <div className="absolute left-[75%] top-3 h-2 w-2 animate-pulse rounded-full bg-white/35" style={{animationDuration:'3.1s'}} />
        </>
      )}
    </div>
  </div>

  <p className="text-xs text-slate-500">
    Đang xử lý — dự kiến hoàn thành trong 2 giờ
  </p>
</div>

<style>{`
  @keyframes liquid-flow {
    from { transform: translateX(-200%); }
    to { transform: translateX(300%); }
  }
`}</style>
```

### 5) Mood Variants (Liquid Colors)

| Mood | Gradient | Use Case |
|------|----------|----------|
| **Progress** | `from-indigo-500 via-cyan-400 to-blue-600` | Đang tiến hành bình thường |
| **Success** | `from-emerald-500 via-teal-400 to-green-600` | Hoàn thành, đạt target |
| **Warning** | `from-amber-500 via-yellow-400 to-orange-500` | Cảnh báo, gần deadline |
| **Danger** | `from-rose-500 via-red-500 to-pink-600` | Quá hạn, critical |

### 6) Performance Notes

- **Flow animation** có chi phí rendering nhẹ → chỉ dùng cho **1-2 bar quan trọng nhất** trong modal
- Tránh dùng flow cho > 5 bars cùng lúc (tốn GPU)
- Nếu bar không hiển thị (`width: 0%`), đừng render bubbles/flow để tiết kiệm render
- Có thể pause animation khi modal không active (user switch tab)

### Checklist Liquid SLA
- [ ] Gradient có `via-color` (3 điểm màu)
- [ ] Có `animate-liquid-flow` overlay (shine chạy)
- [ ] Có micro-bubbles với `animate-pulse` khác nhịp
- [ ] Chỉ render bubbles khi `progress > 20%`
- [ ] Bar container có `overflow-hidden` để cắt sạch effect
- [ ] Transition `duration-700` cho width change — mượt mà khi data update

---

## Modal Variants

### A. Detail Modal (Large)
- **Use case**: PR detail, PO detail, RFQ detail
- **Pattern**: Glassmorphism header + Insight cards + 2-column (timeline + metadata)
- **Width**: `max-w-4xl` (1024px)
- **Height**: `max-h-[96dvh]`

### B. Confirmation Modal (Small)
- **Use case**: Delete confirm, Create PR confirm, Submit confirm
- **Pattern**: Simple header + message + actions row
- **Width**: `max-w-md` (448px)
- **No**: insight cards, no 2-column, no timeline

```tsx
<div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{backdropFilter:'blur(6px)',backgroundColor:'rgba(15,23,42,0.5)'}}>
  <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" style={{animation:'modalZoomIn 0.18s cubic-bezier(0.16,1,0.3,1)'}}>
    <h3 className="text-lg font-bold text-slate-900">Xác nhận</h3>
    <p className="mt-2 text-sm text-slate-600">Message</p>
    <div className="mt-5 flex gap-2 justify-end">
      <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600">Hủy</button>
      <button className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Xác nhận</button>
    </div>
  </div>
</div>
```

### C. Form Modal (Medium)
- **Use case**: Create quotation, Add item, Edit field
- **Pattern**: Header + form fields + action buttons
- **Width**: `max-w-2xl` (672px)
- **Body scroll**: `overflow-y-auto` nếu form dài

---

## Loading & Error States

### Loading

```tsx
<div className="flex items-center justify-center py-16">
  <div className="text-center">
    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
    <p className="text-sm text-slate-500">Đang tải…</p>
  </div>
</div>
```

### Error

```tsx
<div className="flex items-center justify-center py-16 px-6">
  <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
    <X className="mx-auto mb-3 h-8 w-8 text-red-500" strokeWidth={2} />
    <p className="font-semibold text-red-700">Không tải được dữ liệu</p>
    <p className="mt-1 text-sm text-red-500">{error.message}</p>
  </div>
</div>
```

---

## Color Palette (Semantic)

| Context | Gradient | Shadow | Use case |
|---------|----------|--------|----------|
| **Value / Money** | `from-blue-600 to-indigo-600` | `shadow-blue-500/20` | Giá trị, tổng tiền, budget |
| **Purpose / Info** | `from-violet-500 to-purple-600` | `shadow-violet-500/20` | Mục đích, mô tả, context |
| **Deadline / Time** | `from-orange-500 to-amber-500` | `shadow-amber-500/20` | Ngày cần, SLA, warning |
| **Success / Complete** | `from-emerald-500 to-green-600` | `shadow-emerald-500/20` | Hoàn thành, đã duyệt |
| **Alert / Danger** | `from-rose-500 to-red-600` | `shadow-rose-500/20` | Quá hạn, từ chối, error |
| **Metadata / Document** | `from-indigo-900 to-indigo-800` | `shadow-indigo-900/30` | Chứng từ, legal info |

---

## Responsive Breakpoints

| Screen | Behavior |
|--------|----------|
| **< 640px (mobile)** | - Modal full-width, `rounded-t-3xl` chỉ góc trên<br>- 2-column → 1 column stack<br>- Insight cards 1 column<br>- `items-end` (slide từ dưới) |
| **≥ 640px (sm)** | - Padding tăng (`px-5 py-4`)<br>- Font size tăng nhẹ |
| **≥ 768px (md)** | - 2-column layout kích hoạt<br>- `items-center` (center modal) |
| **≥ 1024px (lg)** | - Insight cards có thể 3-4 cột nếu cần |

---

## Animation Timing

```css
@keyframes modalZoomIn {
  from {
    opacity: 0;
    transform: scale(0.94) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
```

**Duration**: `0.22s` cho detail modal, `0.18s` cho confirm modal  
**Easing**: `cubic-bezier(0.16, 1, 0.3, 1)` — ease-out mượt, không bounce

**Fade out** (khi đóng): Không cần animation riêng, dùng React unmount tự nhiên hoặc thêm `opacity-0 duration-150` nếu muốn.

---

## Implementation Checklist

Khi tạo modal mới hoặc refactor modal cũ, check:

- [ ] Overlay backdrop `blur(8px)` + `rgba(15,23,42,0.6)`
- [ ] Container shadow `0 32px 64px -12px` + inset highlight
- [ ] Zoom animation `scale(0.94→1) translateY(8px→0)` trong 220ms
- [ ] Header glassmorphism `bg-white/82` + `backdrop-filter blur(14px)` + `sticky top-0`
- [ ] Mã chứng từ `font-mono text-3xl font-black` làm title chính
- [ ] 2-column layout (cột chính `flex-[3]`, cột phụ `w-64`) nếu modal lớn
- [ ] 3 insight cards (xanh/tím/cam) nếu có metric quan trọng
- [ ] Khối metadata `indigo-900` trong sidebar
- [ ] Actions `mt-auto` + hierarchy rõ (primary → danger → close)
- [ ] Table compact `max-h-60` + `thead sticky` nếu có bảng dài
- [ ] Loading spinner `border-indigo-600 border-t-transparent`
- [ ] Error state `bg-red-50 border-red-200`

---

## Don'ts (Tránh)

❌ **Header có footer riêng** — làm modal dài, lãng phí chiều cao; actions nên nằm sidebar hoặc inline  
❌ **Quá nhiều màu** — insight cards > 4 cái làm loạn; chỉ highlight 2-3 metric quan trọng nhất  
❌ **Shadow quá dài** (offset Y > 10px) — bóng "rủ" xuống, không bám góc bo  
❌ **Animation quá nhanh** (< 150ms) — giật, không smooth  
❌ **Blur quá nhẹ** (< 6px) — không tách biệt rõ với background  
❌ **Text quá to trong modal** — modal là "dense UI", dùng `text-sm` / `text-xs` để fit nhiều info  
❌ **Bảng không có max-height** — 50 dòng đẩy dài modal, UX tệ  
❌ **Padding không nhất quán** — dùng `p-4 sm:p-5` hoặc `px-4 py-3 sm:px-5 sm:py-4`, không lẫn lộn

---

## Code Examples

### Minimal Confirmation Modal

```tsx
{showConfirm && createPortal(
  <div 
    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    style={{backdropFilter:'blur(6px)',backgroundColor:'rgba(15,23,42,0.5)'}}
    onClick={onClose}
  >
    <div 
      className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      style={{animation:'modalZoomIn 0.18s cubic-bezier(0.16,1,0.3,1)'}}
      onClick={e => e.stopPropagation()}
    >
      <style>{`@keyframes modalZoomIn{from{opacity:0;transform:scale(0.94) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
      
      <h3 className="text-lg font-bold text-slate-900">Xác nhận hành động</h3>
      <p className="mt-2 text-sm text-slate-600 leading-relaxed">
        Bạn chắc chắn muốn thực hiện hành động này?
      </p>
      
      <div className="mt-5 flex gap-2 justify-end">
        <button 
          onClick={onClose}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Hủy
        </button>
        <button 
          onClick={onConfirm}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Xác nhận
        </button>
      </div>
    </div>
  </div>,
  document.body
)}
```

### Full Detail Modal (Template)

```tsx
{showDetail && createPortal(
  <div
    className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
    style={{backdropFilter:'blur(8px)',backgroundColor:'rgba(15,23,42,0.6)'}}
    onClick={onClose}
  >
    <div
      className="modal-popup-panel flex max-h-[min(96dvh,100dvh)] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-2xl"
      style={{boxShadow:'0 32px 64px -12px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.06) inset',animation:'modalZoomIn 0.22s cubic-bezier(0.16,1,0.3,1)'}}
      onClick={e => e.stopPropagation()}
    >
      <style>{`@keyframes modalZoomIn{from{opacity:0;transform:scale(0.94) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>

      {/* Header glassmorphism */}
      <div className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 border-b border-slate-200/60 px-5 py-4 sm:px-6" style={{background:'rgba(255,255,255,0.82)',backdropFilter:'blur(14px)'}}>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-500">Document Type</p>
          <h2 className="mt-0.5 font-mono text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{docNumber}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {/* Status badge, date, etc */}
          </div>
        </div>
        <button onClick={onClose} className="shrink-0 rounded-xl border border-slate-200 bg-white p-2 text-slate-400 shadow-sm hover:text-slate-700">
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 [scrollbar-width:thin]">
        {loading ? <LoadingState /> : error ? <ErrorState /> : (
          <div className="flex flex-col gap-0 md:flex-row md:min-h-full">
            
            {/* Main column */}
            <div className="min-w-0 flex-[3] space-y-4 p-4 sm:p-5 md:border-r md:border-slate-200/60">
              {/* 3 insight cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {/* Blue card */}
                {/* Purple card */}
                {/* Orange card */}
              </div>

              {/* Timeline or content blocks */}
            </div>

            {/* Sidebar */}
            <div className="flex flex-col gap-4 bg-gradient-to-b from-slate-50 to-white p-4 sm:p-5 md:w-64 md:shrink-0">
              {/* Indigo-900 metadata block */}
              <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 to-indigo-800 text-white shadow-lg shadow-indigo-900/30">
                {/* ... */}
              </div>

              {/* Actions */}
              <div className="mt-auto flex flex-col gap-2">
                {/* Buttons */}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>,
  document.body
)}
```

---

## Accessibility Notes

- **role="dialog"** + **aria-modal="true"** trên container chính
- **aria-labelledby** trỏ tới `id` của `<h2>` (mã chứng từ)
- **aria-describedby** (optional) trỏ tới mô tả context nếu có
- Close button cần **aria-label="Đóng"**
- Overlay `onClick` đóng modal — nhưng container `e.stopPropagation()` để click vào nội dung không đóng
- **Keyboard**: ESC đóng modal, focus trap trong modal khi mở

```tsx
useEffect(() => {
  if (!isOpen) return;
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, [isOpen, onClose]);
```

---

## Performance Tips

1. **createPortal** vào `document.body` — tránh z-index conflict với parent
2. **Style inline** cho backdrop blur — Tailwind arbitrary values có thể bị purge
3. **Animation trong `<style>` tag** — tránh tạo class global
4. **`max-h-[96dvh]`** thay vì `100dvh` — tránh tràn safe area (notch, iOS bottom bar)
5. **`[scrollbar-width:thin]`** — scrollbar mỏng, không chiếm không gian
6. **Loading state** trong body, không unmount modal → tránh flash khi fetch lại data

---

## Migration Guide

### Từ modal cũ sang pattern mới:

**Before:**
```tsx
<div className="fixed inset-0 bg-black/50">
  <div className="bg-white rounded-lg p-6 max-w-2xl">
    <h2>Chi tiết</h2>
    <div>{content}</div>
    <button onClick={onClose}>Đóng</button>
  </div>
</div>
```

**After:**
```tsx
<div style={{backdropFilter:'blur(8px)',backgroundColor:'rgba(15,23,42,0.6)'}} className="fixed inset-0 z-[100] flex items-center justify-center p-4">
  <div 
    className="w-full max-w-4xl flex flex-col overflow-hidden rounded-2xl bg-white" 
    style={{boxShadow:'0 32px 64px -12px rgba(0,0,0,0.30)',animation:'modalZoomIn 0.22s cubic-bezier(0.16,1,0.3,1)'}}
  >
    <style>{`@keyframes modalZoomIn{from{opacity:0;transform:scale(0.94) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    
    {/* Glassmorphism header */}
    <div className="sticky top-0 z-10" style={{background:'rgba(255,255,255,0.82)',backdropFilter:'blur(14px)'}}>
      <h2 className="font-mono text-3xl font-black">{id}</h2>
    </div>
    
    {/* Body với 2-column nếu cần */}
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col md:flex-row">
        <div className="flex-[3] p-5">{content}</div>
        <div className="md:w-64 p-5">{metadata + actions}</div>
      </div>
    </div>
  </div>
</div>
```

**Các bước:**
1. Thêm backdrop blur + darker overlay
2. Thêm deep shadow + zoom animation
3. Header: glassmorphism + mã chứng từ font-black
4. Body: chia 2 cột nếu modal lớn
5. Insight cards nếu có 2-3 metric quan trọng
6. Sidebar: indigo-900 metadata + actions mt-auto

---

## Version History

- **v1.0** (2026-04-23): Initial pattern từ refactor PR detail modal trong MyPurchaseRequests
- **Source**: `client/src/pages/requestor/MyPurchaseRequests.tsx` modal block

---

## Related Documentation

- [Dashboard V3 Design Philosophy](./dashboard-v3-design-philosophy.md) — card design, grid layout, color system
- Các modal đã áp dụng pattern:
  - `MyPurchaseRequests` — PR detail modal
  - `PRTracking` — PR tracking detail modal (có timeline)

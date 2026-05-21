# SLA & Liquid Performance Design System

## Tổng quan

Hệ thống thiết kế cho **SLA tracking** và **Liquid animations** — biến các metrics thời gian khô khan thành các "ống năng lượng" sống động, giúp người dùng cảm nhận được mức độ khẩn cấp qua màu sắc và chuyển động.

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
- Kết hợp đường viền mờ kiểu glass (`border-white/10`, `bg-white/5`) để giữ cảm giác hiện đại, không "đặc" quá.

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

### 6) Dynamic Speed (Tốc độ động)

Cho các trường hợp khẩn cấp, tăng tốc flow để tạo cảm giác cấp bách:

```tsx
{/* Normal speed - 3s */}
<div className="animate-liquid-flow" />

{/* Fast speed - 2s (overdue) */}
<div className="animate-liquid-flow-fast" />

<style>{`
  @keyframes liquid-flow-fast {
    from { transform: translateX(-200%); }
    to { transform: translateX(300%); }
  }
  .animate-liquid-flow-fast {
    animation: liquid-flow-fast 2s linear infinite;
  }
`}</style>
```

**Use case:**
- **3s**: SLA bình thường, on-time, warning
- **2s**: Overdue, critical, danger — chạy nhanh hơn = khẩn cấp hơn

### 7) Performance Notes

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
- [ ] Tốc độ động (3s normal, 2s fast) cho trạng thái khẩn cấp

---

## Animation Timing Reference

| Hiệu ứng | Tốc độ | Mô tả |
|----------|--------|-------|
| **liquid-flow** | 3s | Dải sáng trắng chạy qua thanh SLA (bình thường) |
| **liquid-flow-fast** | 2s | Dải sáng chạy nhanh (overdue - khẩn cấp) |
| **micro-bubbles** | 2.2s, 2.8s, 3.1s | Bọt khí pulse với nhịp ngẫu nhiên |
| **spin-slow** | 8s | Icon Clock quay chậm (SLA tracker) |

---

## Khi nào dùng Liquid SLA?

### ✅ Dùng cho:
- **SLA timeline bars** — thời gian còn lại/quá hạn
- **Progress bars quan trọng** — workflow % của PR cards
- **Footer energy bars** — vùng "Còn X ngày" có background flow
- Các metric **time-sensitive** cần highlight

### ❌ Không dùng cho:
- Progress bars thông thường (completion %)
- Budget usage bars (không phải timeline)
- Charts/graphs (quá nhiều animation gây rối)
- Loading spinners (đã có animation riêng)

---

## Related Documentation

- [Process Timeline Energy](./process-timeline-energy.md) — Timeline/workflow với energy path
- [Modal Design System](./modal-design-system.md) — Modal structure, layout, patterns
- [Dashboard V3 Design Philosophy](./dashboard-v3-design-philosophy.md) — Cards, metrics, color system

---

## Version History

- **v1.0** (2026-04-23): Extracted from modal-design-system.md
- **Source**: Implemented in `requestor/PRTracking.tsx`, `requestor/PRStatusTracking.tsx`

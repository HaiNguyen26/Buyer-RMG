# Process Timeline Energy Design System

## Tổng quan

Hệ thống thiết kế cho **workflow timeline** — biến các vòng tròn tĩnh thành hệ thống "dẫn truyền năng lượng" với đường dẫn sáng, nodes pulse, và hiệu ứng glow.

---

## Timeline / Process Flow Pattern

Dùng khi modal/page thể hiện workflow có nhiều bước (PR approval, Order tracking, RFQ progress):

### 1) Basic Structure

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

**Key Points (Basic):**
- **Icon state**: Completed (emerald check), Current (indigo ring), Pending (slate ghost)
- **Wire connector**: `w-px bg-slate-200/90 rounded-full` — mảnh, mịn, không quá nổi
- **Current highlight**: `bg-gradient-to-br from-indigo-50/90` — nhẹ nhàng, không chói
- **Opacity pending**: `opacity-[0.72]` — bước chưa tới bị mờ, tạo depth perception

---

## Energy Timeline (Nâng cấp với Animation)

Biến timeline tĩnh thành hệ thống **dẫn truyền năng lượng** với 4 nguyên tắc thiết kế:

### A. Đường dẫn năng lượng (The Energy Line)

Đường nối giữa các nút không phải là đường xám tĩnh. Các đoạn đã hoàn thành có **dòng chảy năng lượng**:

```tsx
{showTopWire && (
  <div 
    className={`relative h-2 w-1 shrink-0 overflow-hidden rounded-full ${
      isCompleted 
        ? 'bg-gradient-to-b from-indigo-500 to-cyan-400 shadow-sm shadow-cyan-300' 
        : 'bg-slate-200/90'
    }`}
  >
    {isCompleted && (
      <>
        {/* Hiệu ứng "Chảy" - tia sáng chạy dọc theo đường */}
        <div 
          className="absolute inset-0 bg-gradient-to-b from-transparent via-white/60 to-transparent animate-linear-flow"
          style={{ backgroundSize: '100% 200%' }}
        />
        {/* Glow pulsing */}
        <div className="absolute inset-0 animate-path-glow" />
      </>
    )}
  </div>
)}
```

**Key changes:**
- Width: `w-px` → `w-1` (4px) — rõ hơn, thể hiện "ống dẫn"
- Gradient: `from-indigo-500 to-cyan-400` — biểu thị năng lượng
- **Flowing Light**: Lớp `via-white/60` chạy từ trên xuống với `animate-linear-flow` (2s) — mô phỏng dòng dữ liệu luân chuyển
- Shadow: `shadow-cyan-300` — ánh sáng lan tỏa
- Animation: `animate-path-glow` — brightness pulsing

### B. Nút trạng thái đa tầng (Multi-layer Nodes)

#### Bước đã xong (Success)
```tsx
<div className="relative border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 animate-bounce-in">
  <Check className="h-3 w-3" strokeWidth={2.75} />
</div>
```
- **Shadow rực rỡ**: `shadow-lg shadow-emerald-500/40` — bóng đổ lan tỏa mạnh
- **Bounce-in**: `animate-bounce-in` (0.5s) — hiệu ứng xuất hiện khi bước được phê duyệt

#### Bước hiện tại (Active - với Halo)
```tsx
<div className="relative border-indigo-500 text-indigo-600 shadow-md shadow-indigo-500/20 ring-4 ring-indigo-100 animate-halo-glow">
  <Clock className="h-3.5 w-3.5 animate-[spin_10s_linear_infinite]" strokeWidth={2} />
</div>
```
- **Vòng hào quang (Halo)**: `ring-4 ring-indigo-100` — tỏa sáng xung quanh
- **Pulse**: `animate-halo-glow` (1.5s) — co dãn nhẹ, thu hút sự chú ý
- **Spinning Icon**: Icon Clock quay chậm để tạo cảm giác thời gian thực

#### Bước chưa tới (Ghost)
```tsx
<div className="border-slate-200 text-slate-300 opacity-60">
  <StageIcon className="h-3 w-3" strokeWidth={2} />
</div>
```
- **Biểu tượng mờ (outline)**: opacity thấp để tạo tương phản với các bước đã xong

### C. Thẻ nội dung thông minh (Contextual Cards)

Thông tin bước hiện tại được đặt trong thẻ **Glassmorphism** để nổi bật:

```tsx
<div className={`rounded-3xl px-2 py-1.5 sm:px-2.5 sm:py-2 backdrop-blur-sm transition-all duration-300 ${
  isCurrent
    ? 'border border-indigo-200/70 bg-gradient-to-br from-indigo-50/90 to-violet-50/50 shadow-md'
    : isCompleted
      ? 'border border-transparent'
      : 'border border-transparent opacity-[0.72]'
}`}>
  <h4 className="text-xs font-semibold leading-tight sm:text-[13px]">
    {stage.label}
  </h4>
  {isCurrent && (
    <div className="mt-1 space-y-0.5 text-[11px] text-slate-600">
      <p>Người duyệt: {stage.approver}</p>
      <p>Thời gian: {stage.timestamp}</p>
    </div>
  )}
</div>
```

**Key changes:**
- **Bo góc lớn**: `rounded-lg` → `rounded-3xl` — tạo cảm giác mềm mại, hiện đại
- **Backdrop blur**: `backdrop-blur-sm` — effect glass nhẹ, nền trắng mờ
- **Shadow**: `shadow-md` cho bước hiện tại — tách biệt với các bước khác
- **Chi tiết động**: Chỉ hiển thị thông tin người duyệt/thời gian cho bước hiện tại, giảm nhiễu loạn thị giác

### D. Micro-Interactions

Tăng tính tương tác và phản hồi trực quan:

```tsx
<li 
  key={stage.key} 
  className="group flex gap-0 cursor-pointer transition-all"
  onMouseEnter={() => setHoveredStage(stage.key)}
  onMouseLeave={() => setHoveredStage(null)}
>
  <div className="flex w-8 shrink-0 flex-col items-center sm:w-9">
    {showTopWire && (
      <div 
        className={`h-2 w-1 shrink-0 rounded-full transition-all duration-300 ${
          isCompleted || hoveredStage === stage.key
            ? 'bg-gradient-to-b from-indigo-500 to-cyan-400 shadow-lg shadow-cyan-400/60' 
            : 'bg-slate-200/90'
        }`}
      />
    )}
    
    <div className={`relative transition-transform duration-200 group-hover:scale-110 ...`}>
      {/* Node content */}
    </div>
  </div>
  
  <div className="group-hover:translate-x-1 transition-transform duration-200">
    {/* Content card */}
  </div>
</li>
```

**Key interactions:**
- **Hover glow**: Khi hover vào bước, đường nối sáng rực lên (`shadow-lg shadow-cyan-400/60`)
- **Node scale**: Node phóng to nhẹ 1.1x khi hover (`group-hover:scale-110`)
- **Content shift**: Thẻ nội dung dịch sang phải nhẹ khi hover (`group-hover:translate-x-1`)
- **Smooth transition**: Tất cả hiệu ứng đều có `transition-all duration-200-300` để mượt mà

---

## Animation Keyframes

### Bảng tổng hợp

| Thành phần | Hiệu ứng | Tốc độ | Ý nghĩa |
|-----------|----------|--------|---------|
| **Connector** | `linear-flow` | 2s | Dòng năng lượng chảy giữa các bước |
| **Active Node** | `halo-glow` | 1.5s | Vòng hào quang tỏa sáng tại bước hiện tại |
| **Complete Step** | `bounce-in` | 0.5s | Hiệu ứng xuất hiện khi bước được phê duyệt |
| **Path Glow** | `path-glow` | 1.5s | Brightness pulsing cho đường nối |

---

### a) Linear Flow (Dòng năng lượng chảy)

```css
@keyframes linear-flow {
  0% {
    background-position: 0% 0%;
  }
  100% {
    background-position: 0% 200%;
  }
}
.animate-linear-flow {
  animation: linear-flow 2s linear infinite;
}
```

**Effect:**
- Tia sáng chạy từ trên xuống dọc theo connector
- Duration: 2s (nhịp độ vừa phải, mô phỏng dòng dữ liệu)
- Linear timing — không tăng tốc/giảm tốc

### b) Halo Glow (Vòng hào quang tỏa sáng)

```css
@keyframes halo-glow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(99, 102, 241, 0.1);
    transform: scale(1.05);
  }
}
.animate-halo-glow {
  animation: halo-glow 1.5s ease-in-out infinite;
}
```

**Effect:** 
- Box-shadow tỏa ra từ 0 → 6px (halo lớn hơn)
- Node scale lên 1.05x tại peak
- Duration: 1.5s (nhanh hơn, thu hút sự chú ý)

### c) Bounce In (Hiệu ứng xuất hiện)

```css
@keyframes bounce-in {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}
.animate-bounce-in {
  animation: bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
```

**Effect:**
- Scale từ 0.3 → 1.1 → 1 (overshoot nhẹ)
- Opacity từ 0 → 1
- Duration: 0.5s (nhanh, tạo cảm giác "pop")
- Cubic-bezier cho bounce effect tự nhiên

### d) Path Glow (Ánh sáng pulsing)

```css
@keyframes path-glow {
  0%, 100% {
    opacity: 0.6;
    filter: brightness(1);
  }
  50% {
    opacity: 1;
    filter: brightness(1.3);
  }
}
.animate-path-glow {
  animation: path-glow 1.5s ease-in-out infinite;
}
```

**Effect:**
- Opacity dao động 0.6 ↔ 1
- Brightness tăng lên 1.3x tại peak
- Duration: 1.5s (đồng bộ với halo-glow)

---

## Full Energy Timeline Example

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
          {/* Energy Path + Node */}
          <div className="flex w-8 shrink-0 flex-col items-center sm:w-9">
            {showTopWire && (
              <div 
                className={`h-2 w-1 shrink-0 rounded-full ${
                  isCompleted 
                    ? 'bg-gradient-to-b from-indigo-500 to-cyan-400 shadow-sm shadow-indigo-300 animate-path-glow' 
                    : 'bg-slate-200/90'
                }`} 
              />
            )}
            
            <div
              className={`relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-white transition-all ${
                isCompleted
                  ? 'border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/40'
                  : isCurrent
                    ? 'border-indigo-500 text-indigo-600 shadow-md shadow-indigo-500/20 ring-4 ring-indigo-100 animate-node-pulse'
                    : 'border-slate-200 text-slate-300'
              }`}
            >
              {isCompleted ? (
                <Check className="h-3 w-3" strokeWidth={2.75} />
              ) : (
                <StageIcon className={`${isCurrent ? 'animate-[spin_10s_linear_infinite]' : ''} h-3 w-3`} strokeWidth={2} />
              )}
            </div>
            
            {showBottomWire && (
              <div 
                className={`mt-0.5 h-5 w-1 shrink-0 rounded-full ${
                  isCompleted 
                    ? 'bg-gradient-to-b from-indigo-500 to-cyan-400 shadow-sm shadow-cyan-300 animate-path-glow' 
                    : 'bg-slate-200/90'
                }`} 
              />
            )}
          </div>

          {/* Content Card */}
          <div className={`min-w-0 flex-1 pl-2 sm:pl-2.5 ${isLast ? 'pb-0' : 'pb-2 sm:pb-2.5'}`}>
            <div
              className={`rounded-2xl px-2 py-1.5 sm:px-2.5 sm:py-2 backdrop-blur-sm transition-all ${
                isCurrent
                  ? 'border border-indigo-200/70 bg-gradient-to-br from-indigo-50/90 to-violet-50/50 shadow-md'
                  : isCompleted
                    ? 'border border-transparent'
                    : 'border border-transparent opacity-[0.72]'
              }`}
            >
              <h4
                className={`text-xs font-semibold leading-tight sm:text-[13px] ${
                  isCompleted
                    ? 'text-slate-700'
                    : isCurrent
                      ? 'text-slate-900'
                      : 'text-slate-500'
                }`}
              >
                {stage.label}
              </h4>
            </div>
          </div>
        </li>
      );
    })}
  </ol>
</div>

{/* Animation Styles */}
<style>{`
  @keyframes node-pulse {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4);
      transform: scale(1);
    }
    50% {
      box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
      transform: scale(1.05);
    }
  }
  .animate-node-pulse {
    animation: node-pulse 2s ease-in-out infinite;
  }
  
  @keyframes path-glow {
    0%, 100% {
      opacity: 0.6;
      filter: brightness(1);
    }
    50% {
      opacity: 1;
      filter: brightness(1.3);
    }
  }
  .animate-path-glow {
    animation: path-glow 1.5s ease-in-out infinite;
  }
`}</style>
```

---

## Animation Timing Reference

| Hiệu ứng | Tốc độ | Mô tả |
|----------|--------|-------|
| **node-pulse** | 2s | Vòng hào quang co dãn tại bước hiện tại |
| **path-glow** | 1.5s | Ánh sáng chạy dọc đường nối Timeline |
| **icon-spin-slow** | 10s | Icon Clock quay chậm ở node hiện tại |

---

## Color System

### Energy Path Gradients
- **Indigo → Cyan**: `from-indigo-500 to-cyan-400` — dòng chảy công nghệ
- **Shadow**: `shadow-indigo-300` (top wire), `shadow-cyan-300` (bottom wire)

### Node States
- **Completed**: `bg-emerald-500` + `shadow-emerald-500/40`
- **Current**: `border-indigo-500` + `ring-4 ring-indigo-100` + `shadow-indigo-500/20`
- **Pending**: `border-slate-200 text-slate-300`

### Content Card
- **Current**: `from-indigo-50/90 to-violet-50/50` + `shadow-md`
- **Other**: transparent background

---

## Performance Tips

1. **Chỉ animate current node** — completed/pending nodes giữ tĩnh
2. **Limit path-glow** — chỉ cho paths đã completed, không dùng cho pending
3. **Conditional icon spin** — chỉ Clock icon ở current step quay, không phải tất cả icons
4. **GPU acceleration** — animations dùng `transform` và `opacity`, tránh `width`/`height`

---

## Khi nào dùng Energy Timeline?

### ✅ Dùng cho:
- **Modal chi tiết** có workflow nhiều bước (PR tracking, Order tracking)
- **Page tracking** theo dõi tiến độ (RFQ monitoring, PR progress)
- Timeline có **3-8 bước** — ít hơn quá đơn giản, nhiều hơn quá dài

### ❌ Không dùng cho:
- Timeline > 10 bước (quá dài, khó nhìn)
- Simple status display (chỉ 2 states: pending/done)
- Timeline không rõ current step (tất cả pending hoặc tất cả completed)

---

## Checklist Energy Timeline

- [ ] Path width `w-1` (4px) thay vì `w-px`
- [ ] Gradient `from-indigo-500 to-cyan-400` cho completed paths
- [ ] Shadow `shadow-indigo-300`/`shadow-cyan-300` cho glow effect
- [ ] Animation `path-glow` (1.5s) cho completed paths
- [ ] Current node có `ring-4 ring-indigo-100` + `animate-node-pulse` (2s)
- [ ] Icon Clock ở current node có `spin_10s` animation
- [ ] Content card `rounded-2xl` + `backdrop-blur-sm`
- [ ] Shadow `shadow-md` cho current card
- [ ] Completed nodes có `shadow-lg shadow-emerald-500/40`

---

## Related Documentation

- [SLA & Liquid Performance](./sla-liquid-performance.md) — SLA bars, liquid flow, micro-bubbles
- [Modal Design System](./modal-design-system.md) — Modal structure, 2-column layout
- [Dashboard V3 Design Philosophy](./dashboard-v3-design-philosophy.md) — Cards, grids, color tokens

---

## Version History

- **v1.0** (2026-04-23): Extracted from modal-design-system.md
- **Source**: Implemented in `requestor/PRTracking.tsx` modal timeline

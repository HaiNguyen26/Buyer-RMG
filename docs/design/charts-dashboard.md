# Charts & Dashboard Visualization

Tài liệu cho **biểu đồ trên dashboard / overview**: donut PR theo loại, bar phòng ban, token màu, animation Recharts, và cách đặt chart trong **đảo Bento**.

**Liên quan:**

- Khung dashboard: [Dashboard V3 Design Philosophy](./dashboard-v3-design-philosophy.md)
- Spacing / island: [Page Content Spacing](./page-content-spacing.md)
- **Không** dùng liquid SLA cho % progress chung — [SLA Liquid](./sla-liquid-performance.md)

**Code:** `client/src/utils/rechartsDonut.tsx`, `prTypeChartColors.ts`, `useIntersectionVisible`, `CountUpNumber`, `MetricCard`.

---

## 1. Khi nào dùng chart

| ✅ Dùng | ❌ Tránh |
|--------|---------|
| Tổng quan xu hướng / cơ cấu (PR theo loại, theo phòng) | Thay thế bảng chi tiết có sort/filter |
| Tầng 2 dashboard (sau StatCard) | Chart quá nhỏ < 200px chiều cao |
| Có legend + tooltip rõ | Quá 8–10 slice donut không legend |

---

## 2. Vị trí trong Dashboard V3

```text
Tầng 1 · StatCard (bento, CountUp)
Tầng 2 · SectionContainer / island
         ├─ Donut (cơ cấu)
         └─ Bar (so sánh)
Tầng 3 · Bảng rút gọn / CTA
```

- bọc chart trong `dashboardV3IslandClass` hoặc card trắng `rounded-2xl` + `p-4 sm:p-5`.
- Parent flex child: **`min-w-0`** + chiều cao cố định hoặc `aspect` — tránh Recharts 0×0.

---

## 3. Donut (PR theo loại)

### 3.1 Thư viện & wrapper

```tsx
<ResponsiveContainer width="100%" height="100%" key={`dept-type-${generation}`}>
  <PieChart margin={{ top: 12, right: 8, bottom: 20, left: 8 }}>
    <Pie
      data={slices}
      innerRadius="58%"
      outerRadius="82%"
      paddingAngle={donutPaddingAngleDeg(outerRadiusPx)}
      cornerRadius={DONUT_CORNER_RADIUS}
      shape={donutSectorShape}
      …
    />
    <Tooltip contentStyle={DONUT_DARK_TOOLTIP_CONTENT_STYLE} />
    <Legend />
  </PieChart>
</ResponsiveContainer>
```

**Utils:** `rechartsDonut.tsx`

| Constant | Ý nghĩa |
|----------|---------|
| `DONUT_CORNER_RADIUS` | Bo mép slice (~20) |
| `donutPaddingAngleDeg` | Khe giữa lát (~4–10°) |
| `donutSectorShape` | Hover “explode” translate theo bán kính |
| `DONUT_ANIMATION_DURATION_MS` | 600ms load |
| `DONUT_HOVER_TRANSITION_MS` | 600ms hover ease |

### 3.2 Màu slice

**File:** `prTypeChartColors.ts` — `getPrTypeSliceColor(label, index)`

| Loại PR (gợi ý) | Màu |
|-------------------|-----|
| Sản xuất | `#2563eb` |
| Văn phòng | `#22c55e` |
| Dịch vụ | `#f97316` |
| Kho vận | `#cbd5e1` |
| Khác | palette `extras[index]` |

Đồng bộ **legend** và **tooltip** với cùng hàm màu — không hard-code rời từng file.

### 3.3 Reveal khi scroll

```ts
// departmentHeadLayout.ts
export const departmentHeadChartIntersectionOptions = {
  rootMargin: '0px',
  resetWhenOutOfView: true,
  minIntersectionRatio: 0.4,
};
```

Tăng `generation` key khi vào viewport → animate lại Pie (pattern Branch/Dept overview).

---

## 4. Bar chart (phòng ban / tháng)

Tham chiếu: `branch-manager/BranchOverviewChartCards.tsx`, `DashboardHome.tsx` (branch).

| Gợi ý | Giá trị |
|-------|---------|
| Chiều cao | `ResponsiveContainer` `height={300}` hoặc grid `min-h-[280px]` |
| Grid | `CartesianGrid` stroke nhạt `stroke="#e2e8f0"` |
| Trục | `XAxis` / `YAxis` font 11–12px, `tick={{ fill: '#64748B' }}` |
| Tooltip | Nền trắng hoặc dark đồng bộ donut |
| Animation | `BRANCH_OVERVIEW_CHART_DURATION_MS` = 1500 cho overview |

---

## 5. StatCard & số động

- **`StatCard`** `variant="bento"` — Tầng 1; accent semantic (`emerald`, `amber`, `rose`…).
- **`embedded`** — KPI **trong** đảo V3 (không thẻ trắng lồng); kèm **`activity="active" | "zero"`** khi có ngưỡng đếm (pastel + glow vs số xám mờ). Chi tiết: [Dashboard V3 §4](./dashboard-v3-design-philosophy.md#4-chỉ-số-statcard-variant-bento).
- **`compact`** — thu kích thước ô; vẫn có thể là thẻ độc lập hoặc kết hợp `embedded`.
- **`CountUpNumber`** — count-up khi metric vào viewport (dashboard home); truyền vào prop `value` của `StatCard`.
- **`MetricCard`** / **`SectionContainer`** — tiêu đề section + lưới con (khác `StatCard`).

**Không lẫn:** `ActionKpiCard` (Tầng 3, có `topRight` viz) — xem Dashboard V3 §4b.

Eyebrow tầng: `Tầng 1 · Cốt lõi` qua `SectionHeader` (`stackDescription` khi mô tả dài).

---

## 6. Typography & màu chart

| Element | Token |
|---------|-------|
| Tiêu đề chart | `text-base font-semibold text-indigo-950` (SectionContainer) |
| Phụ đề | `text-sm text-slate-600` |
| Trục / legend | `text-slate-500`, 11–12px |
| Tooltip dark | `DONUT_DARK_*` trong `rechartsDonut.tsx` |

Nền card chart: trắng hoặc `#F8FAFC` — **không** gradient mạnh sau chart area.

---

## 7. Loading & empty chart

| Trạng thái | Pattern |
|------------|---------|
| Loading | `DashboardV3ShimmerBlock` giữ khung cao chart |
| Không data | Một dòng `text-sm text-slate-500` **trong** card — không để trục trống |
| Lỗi | `dashboardV3ErrorCardClass` (rose) cùng tầng dashboard |

---

## 8. Performance

- `key={generation}` chỉ khi cần replay animation — tránh re-mount liên tục.
- `willChange: transform` trên sector hover (đã có trong `donutSectorShape`).
- `motion-reduce`: cân nhắc tắt animation Pie (`isAnimationActive={false}`) nếu thêm a11y pass.
- Donut > 12 slice → gộp “Khác” hoặc chuyển bar ngang.

---

## 9. Checklist chart mới

- [ ] Xác định tầng (1 stat vs 2 chart vs 3 table)
- [ ] `getPrTypeSliceColor` hoặc palette semantic cố định
- [ ] `ResponsiveContainer` + parent `min-h-*` / `min-w-0`
- [ ] Tooltip + legend accessible (text, không chỉ màu)
- [ ] Intersection reveal nếu dashboard dài
- [ ] Shimmer/error/empty trong cùng card footprint

---

## 10. Tham chiếu code

| Màn / file | Nội dung |
|------------|----------|
| `department-head/DepartmentOverview.tsx` | Donut PR type |
| `branch-manager/BranchOverviewChartCards.tsx` | Bar + donut |
| `branch-manager/DashboardHome.tsx` | Chart trong dashboard |
| `utils/rechartsDonut.tsx` | Sector, tooltip, timing |
| `utils/prTypeChartColors.ts` | Màu loại PR |
| `utils/prStatusChartBuckets.ts` | Bucket trạng thái (nếu chart status) |
| `components/dashboard/MetricCard.tsx` | Card metric |
| `hooks/useIntersectionVisible.ts` | Reveal |

---

## Version History

- **2026-05**: Tách spec chart khỏi Dashboard V3; donut utils + màu PR + Recharts patterns.

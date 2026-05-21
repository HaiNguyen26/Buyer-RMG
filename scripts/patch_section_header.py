# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(r"d:\Buying-RMG\client\src\components\RfqExportPdfModal.tsx")
t = p.read_text(encoding="utf-8")

start = t.find("function SectionHeader({")
end = t.find("\nfunction SubSectionTitle", start)
if start == -1 or end == -1:
    raise SystemExit("markers not found")

new_fn = r'''function SectionHeader({
  icon,
  iconTone = 'indigo',
  title,
  description,
  locked,
}: {
  icon: LucideIcon;
  iconTone?: IconTone;
  title: string;
  description?: string;
  locked?: boolean;
}) {
  const Icon = icon;
  return (
    <div className={`relative overflow-hidden px-4 py-3.5 sm:px-5 ${HEADER_GLASS_SHELL[iconTone]}`}>
      <motion.div className={`pointer-events-none absolute inset-0 ${HEADER_GLASS_GLOW[iconTone]}`} aria-hidden />
      <motion.div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/50 via-transparent to-transparent"
        aria-hidden
      />
      <motion.div className="relative flex flex-wrap items-start justify-between gap-3">
        <motion.div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${HEADER_ICON_GRADIENT[iconTone]}`}
            aria-hidden
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>
          <motion.div className="min-w-0 pt-0.5">
            <h3 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
            {description ? (
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600/90">{description}</p>
            ) : null}
          </motion.div>
        </motion.div>
        {locked ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 shadow-sm backdrop-blur-md">
            <Lock className="h-3 w-3 text-slate-500" aria-hidden />
            Khóa
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-800 shadow-sm backdrop-blur-md">
            <Pencil className="h-3 w-3 text-indigo-600" aria-hidden />
            Có thể chỉnh
          </span>
        )}
      </motion.div>
    </motion.div>
  );
}
'''

new_fn = new_fn.replace("motion.div", "div")

t = t[:start] + new_fn + t[end:]
p.write_text(t, encoding="utf-8")
print("ok")

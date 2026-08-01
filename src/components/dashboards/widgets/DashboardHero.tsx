import type { ReactNode } from "react";
import { motion } from "motion/react";

/**
 * Shared dashboard hero. Presentation only — every role dashboard uses this so
 * the eyebrow / title / chip row reads identically across the portal.
 */
export function DashboardHero({
  eyebrow,
  title,
  subtitle,
  chips,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  chips?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-2xl bg-hero-gradient p-6 text-white shadow-elegant md:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-gold/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-10 size-56 rounded-full bg-white/10 blur-3xl"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/70">{eyebrow}</div>
          <h1 className="mt-2 font-serif text-2xl font-bold text-balance-tight sm:text-3xl md:text-4xl">
            {title}
          </h1>
          <div className="mt-3 h-px w-16 bg-gradient-to-r from-gold to-transparent" />
          {subtitle ? <p className="mt-3 max-w-2xl text-sm text-white/80">{subtitle}</p> : null}
          {chips ? <div className="mt-4 flex flex-wrap items-center gap-2">{chips}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </motion.section>
  );
}

export function HeroChip({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/85 backdrop-blur-sm">
      {label} <b className="ml-1 text-gold">{value}</b>
    </span>
  );
}

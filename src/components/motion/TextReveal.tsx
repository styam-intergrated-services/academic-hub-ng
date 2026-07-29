import type { ElementType, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Word-by-word masked text reveal. Purely presentational.
 */
export function TextReveal({
  text,
  as: Tag = "h1",
  className,
  delay = 0,
  stagger = 0.055,
  highlight,
  highlightClassName = "text-gradient-gold",
}: {
  text: string;
  as?: ElementType;
  className?: string;
  delay?: number;
  stagger?: number;
  /** words (case-insensitive) that should be rendered with the highlight style */
  highlight?: string[];
  highlightClassName?: string;
}) {
  const reduced = useReducedMotion();
  const words = text.split(" ");
  const hi = new Set((highlight ?? []).map((w) => w.toLowerCase()));

  const MotionTag = motion.create(Tag as ElementType);

  return (
    <MotionTag
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : stagger, delayChildren: delay } } }}
    >
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className="inline-block overflow-hidden align-bottom">
          <motion.span
            className={`inline-block ${hi.has(word.toLowerCase().replace(/[^a-z]/gi, "")) ? highlightClassName : ""}`}
            variants={{
              hidden: { y: "110%", opacity: 0 },
              show: { y: "0%", opacity: 1, transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            {word}
            {i < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        </span>
      ))}
    </MotionTag>
  );
}

export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

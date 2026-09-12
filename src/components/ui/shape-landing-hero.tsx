"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

function ElegantShape({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  gradient = "from-white/[0.08]",
}: {
  className?: string;
  delay?: number;
  width?: number;
  height?: number;
  rotate?: number;
  gradient?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -150, rotate: rotate - 15 }}
      animate={{ opacity: 1, y: 0, rotate }}
      transition={{
        duration: 2.4,
        delay,
        ease: [0.23, 0.86, 0.39, 0.96],
        opacity: { duration: 1.2 },
      }}
      className={cn("absolute", className)}
    >
      <motion.div
        animate={{ y: [0, 15, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        style={{ width, height }}
        className="relative"
      >
        <div
          className={cn(
            "absolute inset-0 rounded-full",
            "bg-gradient-to-r to-transparent",
            gradient,
            "backdrop-blur-[2px] border border-white/[0.08]",
            "shadow-[0_8px_32px_0_rgba(255,255,255,0.05)]",
            "after:absolute after:inset-0 after:rounded-full",
            "after:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_70%)]"
          )}
        />
      </motion.div>
    </motion.div>
  );
}

const fadeUpVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 1,
      delay: 0.5 + i * 0.2,
      ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number],
    },
  }),
};

/**
 * Floating shapes are deferred to avoid blocking LCP.
 * They render only after the first paint via a useEffect flag.
 */
function HeroGeometric({ children }: { children?: ReactNode }) {
  const [showShapes, setShowShapes] = useState(false);

  useEffect(() => {
    // Defer shapes to next frame so they don't block initial render / LCP
    const id = requestAnimationFrame(() => setShowShapes(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="relative w-full flex items-center justify-center overflow-hidden py-24 md:py-32">
      {/* Floating shapes — deferred */}
      {showShapes && (
        <div className="absolute inset-0 overflow-hidden">
          <ElegantShape
            delay={0.3} width={600} height={140} rotate={12}
            gradient="from-teal-400/[0.12]"
            className="left-[-10%] md:left-[-5%] top-[15%] md:top-[20%]"
          />
          <ElegantShape
            delay={0.5} width={500} height={120} rotate={-15}
            gradient="from-emerald-400/[0.10]"
            className="right-[-5%] md:right-[0%] top-[70%] md:top-[75%]"
          />
          <ElegantShape
            delay={0.4} width={300} height={80} rotate={-8}
            gradient="from-teal-300/[0.08]"
            className="left-[5%] md:left-[10%] bottom-[5%] md:bottom-[10%]"
          />
          <ElegantShape
            delay={0.6} width={200} height={60} rotate={20}
            gradient="from-emerald-300/[0.08]"
            className="right-[15%] md:right-[20%] top-[10%] md:top-[15%]"
          />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 text-center">
        <div className="mx-auto max-w-3xl">
          {children}
        </div>
      </div>
    </div>
  );
}

export { HeroGeometric, ElegantShape, fadeUpVariants };

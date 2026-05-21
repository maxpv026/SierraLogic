"use client";

import { motion } from "framer-motion";

/**
 * Fixed full-viewport mesh gradient using four richly-coloured, heavily-blurred
 * orbs that drift slowly. Semi-transparent surfaces (glass headers, sidebar)
 * let the colour bleed through for the liquid-glass SaaS aesthetic.
 */
export function AnimatedBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Deep violet / indigo — top-left, dominant anchor */}
      <motion.div
        className="absolute -left-80 -top-80 h-[780px] w-[780px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(109,40,217,0.55) 0%, rgba(79,70,229,0.35) 50%, transparent 75%)", filter: "blur(90px)" }}
        animate={{ x: [0, 55, -25, 40, 0], y: [0, -35, 50, -20, 0], scale: [1, 1.08, 0.94, 1.05, 1] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Vivid blue — top-right accent */}
      <motion.div
        className="absolute -right-48 -top-32 h-[560px] w-[560px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(37,99,235,0.40) 0%, rgba(99,102,241,0.22) 55%, transparent 75%)", filter: "blur(80px)" }}
        animate={{ x: [0, -40, 20, -30, 0], y: [0, 30, -20, 15, 0], scale: [1, 0.95, 1.1, 0.97, 1] }}
        transition={{ duration: 34, repeat: Infinity, ease: "easeInOut", delay: 6 }}
      />

      {/* Emerald — bottom-right, contrasting warmth */}
      <motion.div
        className="absolute -bottom-80 -right-80 h-[700px] w-[700px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(5,150,105,0.42) 0%, rgba(16,185,129,0.25) 50%, transparent 75%)", filter: "blur(90px)" }}
        animate={{ x: [0, -45, 25, -35, 0], y: [0, 40, -50, 25, 0], scale: [1, 0.92, 1.1, 0.97, 1] }}
        transition={{ duration: 36, repeat: Infinity, ease: "easeInOut", delay: 12 }}
      />

      {/* Rose / pink — bottom-left, warmth balance */}
      <motion.div
        className="absolute -bottom-40 -left-40 h-[480px] w-[480px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(219,39,119,0.28) 0%, rgba(244,114,182,0.15) 55%, transparent 75%)", filter: "blur(80px)" }}
        animate={{ x: [0, 30, -15, 25, 0], y: [0, -25, 35, -15, 0], scale: [1, 1.05, 0.93, 1.03, 1] }}
        transition={{ duration: 42, repeat: Infinity, ease: "easeInOut", delay: 20 }}
      />

      {/* Subtle centre violet pulse — depth layer */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)", filter: "blur(70px)" }}
        animate={{ scale: [1, 1.18, 0.88, 1.1, 1] }}
        transition={{ duration: 50, repeat: Infinity, ease: "easeInOut", delay: 30 }}
      />
    </div>
  );
}

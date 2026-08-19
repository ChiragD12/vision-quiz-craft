import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ProgressRing({
  percent,
  size = 156,
  strokeWidth = 10,
  trackClassName = "stroke-white/10",
  progressClassName = "stroke-primary",
  glowClassName = "bg-primary/25",
  children,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  trackClassName?: string;
  progressClassName?: string;
  glowClassName?: string;
  children?: ReactNode;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;

  // Compute end-cap position for the brighter dot at the leading edge of progress.
  const angle = (clamped / 100) * 2 * Math.PI - Math.PI / 2;
  const cx = size / 2 + r * Math.cos(angle);
  const cy = size / 2 + r * Math.sin(angle);
  const filterId = `pr-inset-${size}-${strokeWidth}`;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* Soft glow behind the ring */}
      <div
        className={cn("absolute inset-3 rounded-full blur-2xl", glowClassName)}
        aria-hidden
      />
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
      >
        <defs>
          {/* Engraved inner shadow filter for the track */}
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" />
            <feOffset dy="1" result="offsetblur" />
            <feFlood floodColor="#000" floodOpacity="0.55" />
            <feComposite in2="offsetblur" operator="in" />
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
        </defs>
        {/* Bevel underlay — a thin lighter ring behind the track to sell depth in light theme */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth + 1.5}
          stroke="rgba(255,255,255,0.14)"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          className={trackClassName}
          style={{ filter: `url(#${filterId})` }}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={progressClassName}
          style={{ strokeDasharray: circumference }}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
        {/* Bright end-cap at leading edge of progress */}
        {clamped > 0 && clamped < 100 && (
          <motion.circle
            cx={cx}
            cy={cy}
            r={strokeWidth * 0.7}
            className={progressClassName}
            fill="currentColor"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 1.4 }}
            style={{
              filter: "drop-shadow(0 0 6px currentColor) drop-shadow(0 0 12px currentColor)",
            }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

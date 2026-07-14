import Flame from "@/components/Flame";
import { TIER_COLOR } from "@/domain/streak";
import { motion } from "framer-motion";
import type { CSSProperties } from "react";
type Props = {
  rewardProgress: number;
  size?: number;
  flameScale?: number;
  stroke?: number;
  gap?: number;
};

const ORDER = ["bronze", "silver", "gold", "gem"] as const;

// rewardProgress here is treated as continuous reward progress (0..125+).
// Ring tiers map to 25 / 50 / 100 / 125 milestones on that same scale.
export function StreakRing({
  rewardProgress,
  size = 96,
  flameScale = 0.9,
  stroke = 3,
  gap = 4,
}: Props) {
  
  const outerR = size / 2 - stroke;

  const flameUnlocked = rewardProgress >= 125;

  return (
    <div
      className="relative shrink-0 [--ring-track-opacity:0.42] [--ring-track-filter:saturate(1.15)_contrast(1.05)] [--ring-width-boost:0.4px] [--ring-fill-filter:brightness(1.12)_contrast(1.04)_saturate(1.12)_drop-shadow(0_0_2px_color-mix(in_srgb,var(--tier-color)_70%,transparent))_drop-shadow(0_0_5px_color-mix(in_srgb,var(--tier-color)_40%,transparent))] dark:[--ring-track-opacity:0.60] dark:[--ring-track-filter:none] dark:[--ring-width-boost:0.4px] dark:[--ring-fill-filter:none]"
      style={{ width: size, height: size }}
      aria-label={`Reward progress: ${Math.min(rewardProgress, 125)} of 125`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        {ORDER.map((tier, i) => {
          const innerR = outerR - (ORDER.length - 1) * (stroke + gap);
          const r = innerR + i * (stroke + gap);

          if (r <= 6) return null;

          let progress = 0;

          switch (tier) {
            case "bronze":
  progress = Math.min(rewardProgress / 25, 1);
  break;

case "silver":
  progress = Math.min(Math.max((rewardProgress - 25) / 25, 0), 1);
  break;

case "gold":
  progress = Math.min(Math.max((rewardProgress - 50) / 50, 0), 1);
  break;

case "gem":
  progress = Math.min(Math.max((rewardProgress - 100) / 25, 0), 1);
  break;
          }


          const color = TIER_COLOR[tier];
          const circumference = 2 * Math.PI * r;

          return (
            <g key={tier} style={{ "--tier-color": color } as CSSProperties}>
              {/* Background ring */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={color}
                strokeWidth={stroke}
                style={{
                  strokeOpacity: "var(--ring-track-opacity)",
                  strokeWidth: `calc(${stroke}px + var(--ring-width-boost))`,
                  filter: "var(--ring-track-filter)",
                }}
              />

              {/* Progress ring */}
              {progress > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={color}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={`${circumference * progress} ${circumference}`}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  style={{
                    transition: "stroke-dasharray 400ms cubic-bezier(.22,1,.36,1)",
                    strokeWidth: `calc(${stroke}px + var(--ring-width-boost))`,
                    filter: "var(--ring-fill-filter)",
                  }}
                />
              )}
            </g>
          );
        })}
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
  animate={
  flameUnlocked
    ? {
        rotate: [0, -0.8, 1.4, -1.1, 0.6, 0],
        y: [0, -2.2, -1, -2.8, -1.1, 0],
        scale: [1, 1.06, 1.02, 1.08, 1.03, 1],
        filter: [
          "drop-shadow(0 0 6px rgba(255,220,120,.75)) drop-shadow(0 0 18px rgba(255,140,20,.55)) drop-shadow(0 0 36px rgba(255,90,0,.35))",
          "drop-shadow(0 0 12px rgba(255,240,180,.95)) drop-shadow(0 0 30px rgba(255,160,40,.75)) drop-shadow(0 0 60px rgba(255,90,0,.55))",
          "drop-shadow(0 0 6px rgba(255,220,120,.75)) drop-shadow(0 0 18px rgba(255,140,20,.55)) drop-shadow(0 0 36px rgba(255,90,0,.35))",
        ],
      }
    : {
        rotate: 0,
        x: 0,
        y: 0,
        scale: 1,
        filter: "none",
      }
}
transition={{
  duration: 1.9,
  ease: "easeInOut",
  repeat: Infinity,
  repeatType: "loop",
}}
  style={{
  width: `${(flameUnlocked ? 54 : 48) * flameScale}px`,
  height: `${(flameUnlocked ? 54 : 48) * flameScale}px`,
  filter:
    rewardProgress >= 125
      ? "drop-shadow(0 0 8px rgba(255,220,120,.7)) drop-shadow(0 0 20px rgba(255,140,30,.45))"
      : "grayscale(100%)",
  opacity: rewardProgress >= 125 ? 1 : 0.5,
  transformOrigin: "50% 100%",
}}
>
  <Flame
  animate={flameUnlocked}
  style={{
    filter: flameUnlocked ? "none" : "grayscale(100%)",
  }}
  width="100%"
  height="100%"
/>
</motion.div>
      </div>
    </div>
  );
}

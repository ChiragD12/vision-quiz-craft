import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { LockedDevItem } from "@/lib/gallery/gallery-types";

const CURTAIN_IMAGE = "/curtain.png";

export function LockedDevTile({
  meta,
  developerPreviewActive,
  onSelect,
}: {
  meta: LockedDevItem;
  developerPreviewActive: boolean;
  onSelect: () => void;
}) {
  const tileImageSrc = developerPreviewActive ? meta.src : CURTAIN_IMAGE;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="overflow-hidden rounded-2xl border-amber-500/20 bg-neutral-950 shadow-2xl">
        <div
          onClick={developerPreviewActive ? onSelect : undefined}
          className={`relative aspect-[3/4] overflow-hidden ${
            developerPreviewActive ? "cursor-pointer" : "cursor-default"
          }`}
        >
          <img
            src={tileImageSrc}
            alt={meta.label}
            className="absolute inset-0 h-full w-full object-cover"
          />

          {!developerPreviewActive && (
            <div
              className="absolute inset-0"
              style={{
                backdropFilter: "blur(22px) saturate(120%)",
                background:
                  "linear-gradient(180deg, rgba(10,10,14,0.55), rgba(10,10,14,0.75))",
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden">
            <motion.div
              animate={{
                opacity: [0.65, 1, 0.65],
                scale: [1, 1.08, 1],
              }}
              transition={{
                duration: 2.6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{
                filter:
                  "drop-shadow(0 0 10px rgba(251,191,36,0.6)) drop-shadow(0 0 24px rgba(251,191,36,0.3))",
              }}
            >
              <Lock className="h-12 w-12 text-amber-300" strokeWidth={1.75} />
            </motion.div>
            {/* Occasional shine sweep across the lock */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              initial={{ x: "-120%" }}
              animate={{ x: ["-120%", "120%", "120%"] }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
                times: [0, 0.35, 1],
              }}
              style={{
                background:
                  "linear-gradient(75deg, transparent 40%, rgba(255,235,180,0.22) 50%, transparent 60%)",
              }}
            />

            <span className="px-4 text-center text-[11px] text-neutral-200 line-clamp-2">
              {meta.label}
            </span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
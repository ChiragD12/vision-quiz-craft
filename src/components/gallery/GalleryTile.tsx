import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { GalleryItem } from "@/lib/gallery/gallery-types";

export function GalleryTile({
  item,
  index,
  vipMode,
  onSelect,
  onDelete,
}: {
  item: GalleryItem;
  index: number;
  vipMode: boolean;
  onSelect: () => void;
  onDelete: (userMediaId: string) => void;
}) {
  return (
    <motion.div
      key={item.userMediaId ?? item.src}
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.6,
        delay: Math.min(index * 0.04, 0.28),
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={{
        y: -6,
        scale: 1.02,
        transition: { type: "spring", stiffness: 320, damping: 22 },
      }}
      whileTap={{ scale: 0.985, transition: { duration: 0.12 } }}
      className="group cursor-pointer relative"
      onClick={onSelect}
    >
      <Card
        className="bg-neutral-950 border-amber-500/20 group-hover:border-amber-300/70 transition-all duration-300 overflow-hidden shadow-xl group-hover:shadow-2xl rounded-2xl"
        onMouseEnter={(e) => {
          if (!vipMode) return;
          (e.currentTarget as HTMLElement).style.boxShadow =
            "0 0 30px rgba(236,72,153,0.35), 0 0 60px rgba(88,28,135,0.25), 0 0 12px rgba(251,191,36,0.2)";
        }}
        onMouseLeave={(e) => {
          if (!vipMode) return;
          (e.currentTarget as HTMLElement).style.boxShadow = "";
        }}
      >
        <div className="relative aspect-[3/4] overflow-hidden">
          {item.type === "image" ? (
            <img
              src={item.src}
              alt=""
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <video
              src={item.src}
              className="w-full h-full object-cover"
              preload="metadata"
              muted
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          {item.userMediaId && (
            <>
              <div className="absolute top-2 left-2 rounded-full bg-amber-500/80 text-black text-[10px] font-semibold px-2 py-0.5 tracking-wide">
                YOURS
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Delete this item?"))
                    onDelete(item.userMediaId!);
                }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition"
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

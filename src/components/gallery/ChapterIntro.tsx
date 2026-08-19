import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

type ChapterIntroProps = {
  chapter: {
    title: string;
    subtitle?: string;
    description?: string;
    coverUrl?: string;
  } | null;
  onClose: () => void;
};

export function ChapterIntro({
  chapter,
  onClose,
}: ChapterIntroProps) {
  return (
    <AnimatePresence>
      {chapter && (
        <motion.div
  drag="y"
  dragDirectionLock
  dragConstraints={{ top: 0, bottom: 0 }}
  dragElastic={0.18}
  onDragEnd={(_, info) => {
    if (info.offset.y > 120 || info.velocity.y > 700) {
      onClose();
    }
  }}
  initial={{ opacity: 0 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: 200 }}
  transition={{ type: "spring", stiffness: 260, damping: 28 }}
  className="fixed inset-0 z-50 bg-black overflow-hidden"
>
          <button
            onClick={onClose}
            className="fixed top-6 right-6 z-50 rounded-full bg-black/60 p-3 text-white backdrop-blur"
          >
            <X size={22} />
          </button>

          <div className="mx-auto flex h-full max-w-6xl flex-col overflow-y-auto px-4 md:px-8 py-4">
            {chapter.coverUrl && (
              <img
  src={chapter.coverUrl}
  alt={chapter.title}
  className="w-full h-[58vh] md:h-[65vh] rounded-3xl object-cover cursor-zoom-in"
  onClick={() => window.open(chapter.coverUrl, "_blank")}
/>
            )}

            <div className="mx-auto mt-12 max-w-2xl text-center">
              <h1 className="text-5xl md:text-6xl font-bold text-white tracking-wide">
                {chapter.title}
              </h1>

              {chapter.subtitle && (
                <p className="mt-4 text-xl italic text-neutral-300">
                  {chapter.subtitle}
                </p>
              )}

              {chapter.description && (
                <p className="mt-12 text-xl leading-10 text-neutral-200 whitespace-pre-line">
                  {chapter.description}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
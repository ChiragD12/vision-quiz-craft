import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -16, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-6 left-6 z-50"
    >
      <button
        type="button"
        onClick={onClick}
        aria-label="Back"
        className="flex h-12 w-12 items-center justify-center rounded-full
                   bg-neutral-900/80 backdrop-blur-xl
                   border border-neutral-700
                   text-white
                   transition-all duration-300
                   hover:scale-110
                   hover:border-pink-500
                   hover:shadow-[0_0_20px_rgba(236,72,153,0.35)]"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
    </motion.div>
  );
}

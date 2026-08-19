import { useTypingEffect } from "@/hooks/use-typing-effect";
import { LOADING_ARTWORK } from "@/lib/loading-assets";
import { useEffect, useRef, useState } from "react";

type LoadingScreenProps = {
  mode?: "quiz" | "notes";
};

// Curated set of quiz-loading images. Add/remove entries here to change the
// pool — nothing else about the cycling/crossfade logic needs to change.


// How often to switch images while generation is running.
const IMAGE_SWITCH_INTERVAL_MS = 4000;
// Duration of the opacity crossfade between images.
const CROSSFADE_DURATION_MS = 2000;

function randomIndex(length: number, exclude?: number) {
  if (length <= 1) return 0;
  let idx = Math.floor(Math.random() * length);
  while (idx === exclude) {
    idx = Math.floor(Math.random() * length);
  }
  return idx;
}

/**
 * Cycles through `images`, crossfading between a random starting image and
 * subsequent random images (never repeating the same one consecutively).
 * Uses two stacked, absolutely-positioned <img> "slots" so the crossfade is a
 * pure opacity transition with no layout thrash, and stops all timers as soon
 * as it unmounts.
 */
function QuizLoadingImages({ images }: { images: string[] }) {
  const [state, setState] = useState(() => {
    const startIndex = randomIndex(images.length);
    const first = images[startIndex];
    return {
      slots: [first, first] as [string, string],
      active: 0 as 0 | 1,
      currentIndex: startIndex,
    };
  });

  // Preload every image once so crossfades never reveal a blank/loading frame.
  useEffect(() => {
    images.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, [images]);

  useEffect(() => {
    if (images.length <= 1) return;

    const interval = setInterval(() => {
      setState((prev) => {
        const inactive = prev.active === 0 ? 1 : 0;
        const nextIndex = randomIndex(images.length, prev.currentIndex);
        const slots = [...prev.slots] as [string, string];
        slots[inactive] = images[nextIndex];
        return { slots, active: inactive, currentIndex: nextIndex };
      });
    }, IMAGE_SWITCH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [images]);

  return (
    <>
      {state.slots.map((src, slot) => (
        <img
          key={slot}
          src={src}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover ${
  src.includes("loading5")
    ? "object-[center_5%]"
    : "object-[center_5%]"
}`}
          style={{
            opacity: state.active === slot ? 1 : 0,
            transition: `opacity ${CROSSFADE_DURATION_MS}ms ease-in-out`,
          }}
        />
      ))}
    </>
  );
}

export function LoadingScreen({
  mode = "quiz",
}: LoadingScreenProps) {
  const quizTyping = useTypingEffect();
  const text =
  mode === "notes"
    ? "Analyzing your notes..."
    : quizTyping.text;

const isTyping =
  mode === "notes"
    ? false
    : quizTyping.isTyping;

  const notesVideoSrc = useRef("/loading-video-notes.mp4").current;

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center">
      {mode === "notes" ? (
  <video
    src={notesVideoSrc}
    autoPlay
    muted
    loop
    playsInline
    className="h-full w-full object-cover"
  />
) : (
  <QuizLoadingImages images={LOADING_ARTWORK} />
)}
      <div className="absolute inset-0 z-0 bg-black/25" />

      <div className="absolute inset-x-0 bottom-[8%] z-10 flex items-center justify-center px-4">
        <style>{`
          @keyframes rotate-linear {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .animate-chakra {
            animation: rotate-linear 3s linear infinite;
          }
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
          .cursor-blink {
            animation: blink 1s step-end infinite;
          }
        `}</style>

        {mode === "quiz" ? (
  <div className="flex items-center gap-[14px]">
    <div className="relative h-7 w-7">
  <div className="absolute inset-0 rounded-full border-2 border-white/15" />
  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white border-r-white animate-spin" />
</div>

    <div className="text-white/90 text-base font-medium tracking-wide">
      {text}
      <span
        className={`cursor-blink ${
          isTyping ? "visible" : "invisible"
        }`}
      >
        |
      </span>
    </div>
  </div>
) : (
  <div className="flex flex-col items-center gap-5 text-center">
    <div className="h-10 w-10 rounded-full border-4 border-white/20 border-t-white animate-spin" />

   <div className="text-white text-xl font-semibold tracking-wide">
  Analyzing your notes...
</div>

<div className="text-white/70 text-sm">
  Preparing your study material...
</div>
  </div>
)}
      </div>
    </div>
  );
}

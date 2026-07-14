// Journey — data-driven progression layer on top of the existing reward
// engine. Every screen consumes these manifests + selectors; nothing here
// mutates state. Reward unlock (125-correct → 1 story image) is unchanged
// and still owned by src/lib/store.ts + src/lib/rewards.ts.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";

import { CHAPTERS } from "@/lib/journey/chapters";
import { STORY_IMAGES } from "@/lib/journey/story";
import { storyImageUrl, chapterCoverUrl } from "@/lib/journey/assets";

import { api } from "@/lib/store";
import {
  addUserMedia,
  deleteUserMedia,
  type UserMediaTier,
} from "@/lib/user-media";

import { useDB, useUserMedia } from "@/lib/gallery/gallery-hooks";
import type { GalleryItem, LockedDevItem, SelectedMedia } from "@/lib/gallery/gallery-types";

import { SecretAmbient } from "@/components/gallery/SecretAmbient";
import { VipBurst } from "@/components/gallery/VipBurst";
import { DevPreviewBadge } from "@/components/gallery/DevPreviewBadge";
import { BackButton } from "@/components/gallery/BackButton";
import { GalleryHero } from "@/components/gallery/GalleryHero";
import { GallerySection } from "@/components/gallery/GallerySection";
import { GalleryLightbox } from "@/components/gallery/GalleryLightbox";
import { feedback, FEEDBACK } from "@/lib/feedback";


const VIP_SESSION_KEY = "upsc-secret-vip";

export const Route = createFileRoute("/gallery")({
  component: GalleryPage,
});

function GalleryPage() {
  const navigate = useNavigate();
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(null);
  const userMedia = useUserMedia();
  useDB();

  // Entering the Secret Gallery (this page mounting) is the "gallery-entry"
  // moment — not opening any individual image inside it. Fires exactly
  // once per mount; empty deps means it never replays on re-renders or
  // when navigating between images in the lightbox.
  useEffect(() => {
    feedback(FEEDBACK.GALLERY_OPEN);
  }, []);

  // Hidden interactions: 5 clicks → VIP mode, 10 clicks → Developer Preview
  // (session-based: active only while this Secret Gallery instance is
  // mounted and the page is visible; never persisted).
  const [vipMode, setVipMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(VIP_SESSION_KEY) === "1";
  });
  const [vipBurst, setVipBurst] = useState(0);
  const [devPreviewActive, setDevPreviewActive] = useState(false);
  const clickCountRef = useRef(0);

  const activateVip = useCallback(() => {
    setVipMode(true);
    setVipBurst((b) => b + 1);
    try {
      sessionStorage.setItem(VIP_SESSION_KEY, "1");
    } catch {
      // ignore
    }
  }, []);

  const activateDevPreview = useCallback(() => {
    setDevPreviewActive(true);
  }, []);

  const endDevPreview = useCallback(() => {
    setDevPreviewActive(false);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Ignore clicks that land on interactive form/upload elements.
      const t = e.target as HTMLElement | null;
      if (t?.closest("input,button,a,video,textarea,select,[role='button']")) {
        // still count so users can reach 5/10 while browsing naturally
      }
      clickCountRef.current += 1;
      if (clickCountRef.current === 5 && !vipMode) activateVip();
      if (clickCountRef.current >= 10) {
        activateDevPreview();
        clickCountRef.current = 0;
      }
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [vipMode, activateVip, activateDevPreview]);

  // Developer Preview ends immediately if the page is backgrounded/hidden,
  // and ends when this Secret Gallery instance unmounts (i.e. the user
  // navigates away). Nothing here is persisted, so closing the app/browser
  // or relaunching always starts with Developer Preview off.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) endDevPreview();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      endDevPreview();
    };
  }, [endDevPreview]);

  const closeLightbox = useCallback(() => setSelectedMedia(null), []);

  // Chapter Cover now opens exactly like a Journey image: it becomes a
  // single-item SelectedMedia and reuses the existing GalleryLightbox
  // (same animation, swipe, and close behavior) instead of a separate
  // ChapterIntro viewer.
  const openChapter = useCallback(
    (chapter: { title: string; description?: string; coverUrl?: string }) => {
      if (!chapter.coverUrl) return;
      setSelectedMedia({
        src: chapter.coverUrl,
        type: "image",
        title: chapter.title,
        description: chapter.description,
        section: chapter.title,
        index: 0,
        items: [
          {
            src: chapter.coverUrl,
            type: "image",
            title: chapter.title,
            description: chapter.description,
          },
        ],
      });
    },
    [],
  );

  const goBack = useCallback(() => {
    if (selectedMedia) {
      closeLightbox();
      return;
    }
    endDevPreview();
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      navigate({ to: "/" });
    }
  }, [selectedMedia, closeLightbox, endDevPreview, navigate]);

  const goPrev = useCallback(() => {
    setSelectedMedia((cur) => {
      if (!cur) return cur;
      const idx = (cur.index - 1 + cur.items.length) % cur.items.length;
      const item = cur.items[idx];
      return {
  ...cur,
  index: idx,
  src: item.src,
  type: item.type,
  title: item.title,
  description: item.description,
};
    });
  }, []);

  const goNext = useCallback(() => {
  setSelectedMedia((cur) => {
    if (!cur) return cur;

    const idx = (cur.index + 1) % cur.items.length;
    const item = cur.items[idx];

    return {
      ...cur,
      index: idx,
      src: item.src,
      type: item.type,
      title: item.title,
      description: item.description,
    };
  });
}, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [closeLightbox, goPrev, goNext]);


  const unlockedImages = api.unlockedImageCount();

  // If a reward was previously downloaded via Developer Preview (and is now
  // unlocked normally through quiz progression), reuse that cached local
  // copy instead of re-fetching it. This only ever *reads* the isolated
  // dev-preview cache and only ever affects which URL an already-unlocked
  // item points at — it does not change unlock state in any way.

  const applyDevCacheOverride = useCallback(
  (item: GalleryItem): GalleryItem => item,
  [],
);

  const sections = CHAPTERS.map((chapter) => {
  const stories = STORY_IMAGES.filter((s) => s.chapterId === chapter.id);
  // Journey locking: a story is visible once its id is within the
  // player's unlocked-image count; everything past that is still locked.
  const unlockedStories = stories.filter((s) => s.id <= unlockedImages);
  const lockedStories = stories.filter((s) => s.id > unlockedImages);

  // Locked scenes carry their real story image URL up front (the scene
  // art isn't secret, only its unlocked status is), so the locked tile's
  // Preview/Download actions can use it directly — no separate media
  // fetch/cache system involved.
  const lockedDevItems: LockedDevItem[] = lockedStories.map((story) => ({
  key: `journey-locked-${story.id}`,
  label: story.title,
  description: story.description,
  src: storyImageUrl(story.id),
  type: "image" as const,
}));

  // User uploads are stored under one shared compatibility tier
  // ("3-stars") rather than per chapter, so there's no field to key a
  // chapter attribution off — every chapter surfaces the same uploaded
  // set. ASSUMPTION: useUserMedia() items expose { id, tier, type, url }.
  const uploadedItems: GalleryItem[] = userMedia
    .filter((um) => um.tier === "3-stars" && um.type === "image")
    .map((um) => ({
      src: um.url,
      type: "image" as const,
      userMediaId: um.id,
    }));

  return {
    title: chapter.title,
    subtitle: chapter.subtitle,
    description: chapter.description,
    coverUrl: chapterCoverUrl(chapter.id),
    emoji: "📖",
    uploadTier: "3-stars" as UserMediaTier,
    accepts: "image" as const,
    builtinUnlocked: unlockedStories.length,
    totalBuiltin: stories.length,
    lockedCount: lockedStories.length,
    lockedDevItems,
    items: [
      ...unlockedStories.map((story) => ({
  src: storyImageUrl(story.id),
  type: "image" as const,
  title: story.title,
  description: story.description,
  userMediaId: undefined,
})),
      ...uploadedItems,
    ],
  };
});

  const handleUpload = async (
    tier: UserMediaTier,
    accepts: "image" | "video",
    files: FileList | null,
  ) => {
    if (!files || files.length === 0) return;
    for (const f of Array.from(files)) {
      const isVid = f.type.startsWith("video/");
      const isImg = f.type.startsWith("image/");
      if (accepts === "image" && !isImg) continue;
      if (accepts === "video" && !isVid) continue;
      await addUserMedia({
        tier,
        type: accepts,
        blob: f,
        mime: f.type,
        source: "upload",
      });
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-x-hidden">
      <SecretAmbient vip={vipMode} />
      <VipBurst key={vipBurst} trigger={vipBurst} />
      <AnimatePresence>
        {devPreviewActive && <DevPreviewBadge />}
      </AnimatePresence>

      <BackButton onClick={goBack} />

      <GalleryHero
        vipMode={vipMode}
        unlockedImages={unlockedImages}
        uploadedCount={userMedia.length}
      />

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 space-y-24">
        {sections.map((section) => (
          <GallerySection
            key={section.title}
            section={section}
            vipMode={vipMode}
            devPreviewActive={devPreviewActive}
            applyDevCacheOverride={applyDevCacheOverride}
            onUpload={(files) =>
              handleUpload(section.uploadTier ?? "3-stars", section.accepts, files)
            }
            onSelectMedia={setSelectedMedia}
            onDeleteMedia={(id) => deleteUserMedia(id)}
onOpenChapter={openChapter}
/>
        ))}

        <div className="pt-6 flex justify-center"></div>
      </main>

      {/* Fullscreen Lightbox */}
      <GalleryLightbox
  selectedMedia={selectedMedia}
  onClose={closeLightbox}
  onPrev={goPrev}
  onNext={goNext}
/>
    </div>
  );
}

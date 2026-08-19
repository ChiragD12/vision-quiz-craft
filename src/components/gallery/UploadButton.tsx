import { useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UserMediaTier } from "@/lib/user-media";

export function UploadButton({
  tier,
  accepts,
  onFiles,
}: {
  tier: UserMediaTier;
  accepts: "image" | "video";
  onFiles: (files: FileList | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accepts === "image" ? "image/*" : "video/*"}
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <Button
        onClick={() => inputRef.current?.click()}
        variant="outline"
        size="sm"
        className="border-amber-500/30 text-amber-200 hover:bg-amber-500/10 hover:text-amber-100"
      >
        <Plus className="h-4 w-4 mr-1" />
        Add {accepts === "image" ? "Image" : "Video"}
        <span className="sr-only">to {tier}</span>
      </Button>
    </>
  );
}

import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_PHOTOS_PER_ITEM } from "@/lib/image";

const fileKey = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;

/**
 * Drag-and-drop / click-to-pick photo selector with thumbnails.
 * Holds File objects only — actual uploads happen later (e.g. on form submit).
 */
export function PhotoDropzone({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    const urls: Record<string, string> = {};
    for (const f of files) urls[fileKey(f)] = URL.createObjectURL(f);
    setPreviews(urls);
    return () => {
      for (const url of Object.values(urls)) URL.revokeObjectURL(url);
    };
  }, [files]);

  const addFiles = (incoming: FileList | File[]) => {
    if (disabled) return;
    const images = Array.from(incoming).filter((f) => f.type.startsWith("image/"));
    const room = MAX_PHOTOS_PER_ITEM - files.length;
    if (room <= 0) return;
    onChange([...files, ...images.slice(0, room)]);
  };

  const remove = (key: string) => {
    onChange(files.filter((f) => fileKey(f) !== key));
  };

  return (
    <div
      className={cn("grid gap-3", disabled && "pointer-events-none opacity-60")}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        addFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {files.map((f) => {
            const key = fileKey(f);
            return (
              <div
                key={key}
                className="group relative aspect-square overflow-hidden rounded-lg border"
              >
                <img
                  src={previews[key]}
                  alt={f.name}
                  className="size-full object-cover"
                />
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => remove(key)}
                  className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-destructive hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {files.length < MAX_PHOTOS_PER_ITEM && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/40 hover:text-foreground",
            dragging && "border-primary bg-primary/5 text-foreground"
          )}
        >
          <ImagePlus className="size-6" />
          <span className="text-[13px] font-medium">
            {dragging ? "Drop to add photos" : "Add photos"}
          </span>
          <span className="text-[12px]">
            Up to {MAX_PHOTOS_PER_ITEM} · drag & drop or click to browse
          </span>
        </button>
      )}
    </div>
  );
}

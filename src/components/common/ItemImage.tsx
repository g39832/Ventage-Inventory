import { useState } from "react";
import { Shirt } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

export function ItemImage({
  src,
  alt,
  name,
  className,
  imgClassName,
}: {
  src: string;
  alt: string;
  name: string;
  className?: string;
  imgClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-tan/60 via-clay-soft to-secondary text-foreground/50",
          className
        )}
        role="img"
        aria-label={alt}
      >
        <div className="flex flex-col items-center gap-1">
          <Shirt className="size-5 opacity-50" />
          <span className="text-xs font-semibold tracking-wide">
            {initials(name)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden bg-muted", className)}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn("size-full object-cover", imgClassName)}
      />
    </div>
  );
}

import { useRef, type SyntheticEvent } from "react";
import { Centered } from "./centered.tsx";

const EXPIRED_AFTER = 10 * 60 * 1000; // URLs last 15 minutes, so a failure later than this may be that

/** A long video can outlive its URL, so a late failure gets a new one and carries on from the same spot. */
export function MediaPreview({
  tag: Tag,
  url,
  loadedAt,
  refresh,
  onFail,
}: {
  tag: "video" | "audio";
  url: string;
  loadedAt: number;
  refresh: () => void;
  onFail: () => void;
}) {
  const position = useRef(0);

  return (
    <Centered>
      <Tag
        controls
        src={url}
        preload="metadata"
        className={Tag === "video" ? "max-h-[80svh] w-full" : "w-full max-w-lg"}
        onTimeUpdate={(e: SyntheticEvent<HTMLMediaElement>) => {
          position.current = e.currentTarget.currentTime;
        }}
        onLoadedMetadata={(e: SyntheticEvent<HTMLMediaElement>) => {
          e.currentTarget.currentTime = position.current;
        }}
        onError={() => (Date.now() - loadedAt > EXPIRED_AFTER ? refresh() : onFail())}
      />
    </Centered>
  );
}

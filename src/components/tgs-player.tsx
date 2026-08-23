import { useEffect, useRef, useState } from "react";
import { ungzip } from "pako";

type TgsPlayerProps = {
  src: string;
  fallback?: string;
  className?: string;
};

function dataUrlBytes(src: string) {
  const marker = ";base64,";
  const index = src.indexOf(marker);
  if (index < 0) throw new Error("Unsupported TGS preview source.");
  const binary = atob(src.slice(index + marker.length));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function parseTgs(src: string) {
  const bytes = dataUrlBytes(src);
  const inflated = bytes[0] === 0x1f && bytes[1] === 0x8b ? ungzip(bytes) : bytes;
  const json = new TextDecoder().decode(inflated);
  return JSON.parse(json) as Record<string, unknown>;
}

export function TgsPlayer({ src, fallback = "⭐", className = "" }: TgsPlayerProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting === true),
      { rootMargin: "96px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let animation: { destroy: () => void } | null = null;
    setFailed(false);
    void import("lottie-web")
      .then((lottie) => {
        if (cancelled || !ref.current) return;
        console.info("CUSTOM_EMOJI_RENDER_FORMAT", { format: "tgs" });
        const lottieApi = lottie.default ?? lottie;
        animation = lottieApi.loadAnimation({
          container: ref.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData: parseTgs(src),
        });
      })
      .catch((error) => {
        console.warn("CUSTOM_EMOJI_PREVIEW_ERROR", { stage: "tgs_render", error: error instanceof Error ? error.message : "TGS render failed" });
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      animation?.destroy();
    };
  }, [src, visible]);

  if (failed) return <span className={className}>{fallback}</span>;
  return <div ref={ref} className={className} aria-label={fallback} />;
}

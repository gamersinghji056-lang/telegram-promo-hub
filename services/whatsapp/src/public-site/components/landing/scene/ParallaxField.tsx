import { useEffect, useRef } from "react";

type ParallaxLayer = {
  element: HTMLElement;
  depth: number;
  base: string;
  rotateX: number;
  rotateY: number;
};

function toNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function LandingParallax() {
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const touchQuery = window.matchMedia("(pointer: coarse)");
    if (motionQuery.matches || touchQuery.matches) return;

    const root = document.querySelector(".landing-root");
    if (!root) return;

    const layers = Array.from(root.querySelectorAll<HTMLElement>("[data-parallax-depth]")).map((element) => ({
      element,
      depth: toNumber(element.dataset.parallaxDepth, 0),
      base: element.dataset.parallaxBase || "",
      rotateX: toNumber(element.dataset.parallaxRotateX, 0),
      rotateY: toNumber(element.dataset.parallaxRotateY, 0),
    }));

    const ambient = Array.from(root.querySelectorAll<HTMLElement>("[data-ambient-depth]")).map((element) => ({
      element,
      depth: toNumber(element.dataset.ambientDepth, 0),
    }));

    const mark8 = root.querySelector<HTMLElement>(".mark8-emblem");
    const mark8Base = mark8?.dataset.parallaxBase || "translate(-50%, -50%)";
    const scene = root.querySelector<HTMLElement>(".scene");
    let mouseX = 0.5;
    let mouseY = 0.5;
    let scrollY = 0;
    let stopped = false;
    let rafLoop = 0;

    const setLayerTransform = (layer: ParallaxLayer, x: number, y: number) => {
      const tx = (x - 0.5) * layer.depth;
      const ty = (y - 0.5) * layer.depth;
      const extra = ` translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
      const rotate = `rotateX(${(layer.rotateX * (y - 0.5)).toFixed(2)}deg) rotateY(${(
        layer.rotateY * (x - 0.5)
      ).toFixed(2)}deg)`;

      layer.element.style.transform = layer.base ? `${layer.base} ${extra} ${rotate}` : `${extra} ${rotate}`;
    };

    const onMouseMove = (event: MouseEvent) => {
      const rect = root.getBoundingClientRect();
      mouseX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      mouseY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      if (!stopped && !rafLoop) {
        rafLoop = requestAnimationFrame(render);
      }
    };

    const render = () => {
      rafLoop = 0;
      if (stopped) return;

      ambient.forEach(({ element, depth }) => {
        const tx = (mouseX - 0.5) * depth;
        const ty = (mouseY - 0.5) * depth;
        element.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
      });

      layers.forEach((layer) => setLayerTransform(layer, mouseX * 1.4, mouseY * 1.3));

      if (mark8) {
        const tx = (mouseX - 0.5) * 26;
        const ty = (mouseY - 0.5) * 16 + scrollY * 0.1;
        const rot = (mouseX - 0.5) * 4;
        mark8.style.transform = `${mark8Base} translate3d(${tx}px, ${ty}px, 0) rotate(${rot.toFixed(2)}deg)`;
      }

      if (scene) {
        const rotateX = (mouseY - 0.5) * -6;
        const rotateY = (mouseX - 0.5) * 14 - 11;
        const rotateZ = (mouseX - 0.5) * 1.5;
        const base = scene.dataset.sceneBase || "rotateX(7deg) rotateY(-11deg) rotateZ(1deg)";
        scene.style.transform = `rotateX(${7 + rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`;
      }
    };

    const onScroll = () => {
      scrollY = window.scrollY;
      if (!stopped && !rafLoop) {
        rafLoop = requestAnimationFrame(render);
      }
    };

    const onResize = () => {
      if (!stopped && !rafLoop) {
        rafLoop = requestAnimationFrame(render);
      }
    };

    const onVisibilityChange = () => {
      stopped = document.visibilityState !== "visible";
      if (!stopped) {
        rafLoop = requestAnimationFrame(render);
      }
    };

    stopped = false;
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibilityChange);

    rafLoop = requestAnimationFrame(render);

    return () => {
      stopped = true;
      if (rafLoop) cancelAnimationFrame(rafLoop);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      layers.forEach(({ element, base }) => {
        if (base) {
          element.style.transform = base;
        } else {
          element.style.transform = "";
        }
      });
      ambient.forEach(({ element }) => {
        element.style.transform = "";
      });
      if (mark8) {
        mark8.style.transform = mark8Base;
      }
      if (scene) {
        scene.style.transform = scene.dataset.sceneBase || "rotateX(7deg) rotateY(-11deg) rotateZ(1deg)";
      }
    };
  }, []);

  return null;
}

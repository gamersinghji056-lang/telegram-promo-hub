import { useEffect } from "react";

export function LandingParallax() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;

    const root = document.querySelector<HTMLElement>(".landing-root");
    const hero = document.querySelector<HTMLElement>(".hero");
    const scene = document.getElementById("scene");
    const stage = document.getElementById("stage");
    const mark8 = document.querySelector<HTMLElement>(".mark8-emblem");

    if (!root) return;

    const cleanups: Array<() => void> = [];

    const listen = <K extends keyof WindowEventMap>(
      target: Window,
      type: K,
      handler: (event: WindowEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, handler as EventListener, options);
      cleanups.push(() => target.removeEventListener(type, handler as EventListener));
    };

    const listenEl = (
      target: HTMLElement | Document,
      type: string,
      handler: EventListener,
      options?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, handler, options);
      cleanups.push(() => target.removeEventListener(type, handler));
    };

    // Exact V6 stage tilt: move the dashboard as the pointer moves over the 3D scene.
    if (scene && stage) {
      const onSceneMove = (event: MouseEvent) => {
        const r = scene.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const x = (event.clientX - r.left) / r.width - 0.5;
        const y = (event.clientY - r.top) / r.height - 0.5;
        stage.style.transform =
          `rotateX(${7 - y * 8}deg) rotateY(${-11 + x * 14}deg) rotateZ(${x * 1.6}deg)`;
      };
      const onSceneLeave = () => {
        stage.style.transform = "rotateX(7deg) rotateY(-11deg) rotateZ(1deg)";
      };
      listenEl(scene, "mousemove", onSceneMove as EventListener, { passive: true });
      listenEl(scene, "mouseleave", onSceneLeave as EventListener);
    }

    // Ambient glows follow the cursor across the whole viewport.
    const ambient = Array.from(
      document.querySelectorAll<HTMLElement>("[data-ambient-depth]"),
    );
    const onAmbientMove = (event: MouseEvent) => {
      ambient.forEach((el) => {
        const depth = Number(el.dataset.ambientDepth || 20);
        const x = ((event.clientX - window.innerWidth / 2) / window.innerWidth) * depth;
        const y = ((event.clientY - window.innerHeight / 2) / window.innerHeight) * depth;
        el.style.transform = `translate3d(${x}px,${y}px,0)`;
      });
    };
    listen(window, "mousemove", onAmbientMove, { passive: true });

    // Exact V6 hero parallax: laptop, floating cards, dashboard metrics, chart and AI panel.
    if (hero) {
      const onHeroMove = (event: MouseEvent) => {
        const r = hero.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const x = (event.clientX - r.left) / r.width - 0.5;
        const y = (event.clientY - r.top) / r.height - 0.5;

        const mw = document.querySelector<HTMLElement>(".main-window");
        const f1 = document.querySelector<HTMLElement>(".fc1");
        const f2 = document.querySelector<HTMLElement>(".fc2");
        const f3 = document.querySelector<HTMLElement>(".fc3");

        if (mw) mw.style.transform = `translateZ(25px) translate3d(${x * 12}px,${y * 8}px,0)`;
        if (f1) {
          f1.style.transform =
            `translateZ(110px) rotateY(${-5 + x * 10}deg) translate3d(${x * 28}px,${y * 20}px,0)`;
        }
        if (f2) {
          f2.style.transform =
            `translateZ(125px) rotateY(${7 + x * 8}deg) translate3d(${x * -22}px,${y * -14}px,0)`;
        }
        if (f3) {
          f3.style.transform = `translateZ(155px) translate3d(${x * 34}px,${y * -24}px,0)`;
        }

        document.querySelectorAll<HTMLElement>(".metric").forEach((metric, index) => {
          metric.style.transform =
            `translate3d(${x * (4 + index * 2)}px,${y * (3 + index)}px,0)`;
        });

        const chart = document.querySelector<HTMLElement>(".chart");
        const assist = document.querySelector<HTMLElement>(".assist");
        if (chart) chart.style.transform = `translate3d(${x * 8}px,${y * 6}px,0)`;
        if (assist) assist.style.transform = `translate3d(${x * -10}px,${y * 8}px,0)`;
      };
      listenEl(hero, "mousemove", onHeroMove as EventListener, { passive: true });
    }

    // Interactive logo, badges and buttons nudge toward the cursor.
    document.querySelectorAll<HTMLElement>(".v6-logo,.badge,.btn").forEach((el) => {
      const onMove = (raw: Event) => {
        const event = raw as MouseEvent;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const x = (event.clientX - r.left) / r.width - 0.5;
        const y = (event.clientY - r.top) / r.height - 0.5;
        el.style.transform = `translate3d(${x * 6}px,${y * 5}px,0)`;
      };
      const onLeave = () => {
        el.style.transform = "";
      };
      listenEl(el, "mousemove", onMove, { passive: true });
      listenEl(el, "mouseleave", onLeave as EventListener);
    });

    // MARK8 infinity background follows cursor and scroll, same as approved V6 HTML.
    if (mark8) {
      let mx = 0;
      let my = 0;
      let sy = window.scrollY;

      const renderMark8 = () => {
        const x = mx * 22;
        const y = my * 16 + sy * 0.1;
        const rot = mx * 4;
        mark8.style.transform =
          `translate(-50%,-50%) translate3d(${x}px,${y}px,0) rotate(${rot}deg)`;
      };

      const onMarkMove = (event: MouseEvent) => {
        mx = event.clientX / window.innerWidth - 0.5;
        my = event.clientY / window.innerHeight - 0.5;
        renderMark8();
      };
      const onScroll = () => {
        sy = window.scrollY;
        renderMark8();
      };

      listen(window, "mousemove", onMarkMove, { passive: true });
      listen(window, "scroll", onScroll, { passive: true });
      renderMark8();
    }

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return null;
}

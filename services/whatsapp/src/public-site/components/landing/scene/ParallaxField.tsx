import { useEffect } from "react";

export function LandingParallax() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cleanups: Array<() => void> = [];

    const on = (
      target: Window | Document | HTMLElement,
      type: string,
      listener: EventListener,
      options?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, listener, options);
      cleanups.push(() => target.removeEventListener(type, listener));
    };

    const scene = document.getElementById("scene");
    const stage = document.getElementById("stage");

    if (scene && stage) {
      on(
        scene,
        "mousemove",
        ((raw: Event) => {
          const e = raw as MouseEvent;
          const r = scene.getBoundingClientRect();
          if (!r.width || !r.height) return;
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          stage.style.transform =
            `rotateX(${7 - y * 8}deg) rotateY(${-11 + x * 14}deg) rotateZ(${x * 1.6}deg)`;
        }) as EventListener,
        { passive: true },
      );

      on(
        scene,
        "mouseleave",
        (() => {
          stage.style.transform = "rotateX(7deg) rotateY(-11deg) rotateZ(1deg)";
        }) as EventListener,
      );
    }

    const hero = document.querySelector<HTMLElement>(".hero");
    if (hero) {
      on(
        hero,
        "mousemove",
        ((raw: Event) => {
          const e = raw as MouseEvent;
          const r = hero.getBoundingClientRect();
          if (!r.width || !r.height) return;
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;

          const mw = document.querySelector<HTMLElement>(".main-window");
          const f1 = document.querySelector<HTMLElement>(".fc1");
          const f2 = document.querySelector<HTMLElement>(".fc2");
          const f3 = document.querySelector<HTMLElement>(".fc3");

          if (mw) mw.style.transform = `translateZ(25px) translate3d(${x * 12}px,${y * 8}px,0)`;
          if (f1) f1.style.transform = `translateZ(110px) rotateY(${-5 + x * 10}deg) translate3d(${x * 28}px,${y * 20}px,0)`;
          if (f2) f2.style.transform = `translateZ(125px) rotateY(${7 + x * 8}deg) translate3d(${x * -22}px,${y * -14}px,0)`;
          if (f3) f3.style.transform = `translateZ(155px) translate3d(${x * 34}px,${y * -24}px,0)`;

          document.querySelectorAll<HTMLElement>(".metric").forEach((m, i) => {
            m.style.transform = `translate3d(${x * (4 + i * 2)}px,${y * (3 + i)}px,0)`;
          });

          const chart = document.querySelector<HTMLElement>(".chart");
          const assist = document.querySelector<HTMLElement>(".assist");
          if (chart) chart.style.transform = `translate3d(${x * 8}px,${y * 6}px,0)`;
          if (assist) assist.style.transform = `translate3d(${x * -10}px,${y * 8}px,0)`;
        }) as EventListener,
        { passive: true },
      );
    }

    document.querySelectorAll<HTMLElement>(".v6-logo,.badge,.btn").forEach((el) => {
      on(
        el,
        "mousemove",
        ((raw: Event) => {
          const e = raw as MouseEvent;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return;
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          el.style.transform = `translate3d(${x * 6}px,${y * 5}px,0)`;
        }) as EventListener,
        { passive: true },
      );
      on(el, "mouseleave", (() => (el.style.transform = "")) as EventListener);
    });

    const emblem = document.querySelector<HTMLElement>(".mark8-emblem");
    if (emblem) {
      let mx = 0;
      let my = 0;
      let sy = window.scrollY;

      const render = () => {
        const x = mx * 22;
        const y = my * 16 + sy * 0.1;
        const rot = mx * 4;
        emblem.style.transform =
          `translate(-50%,-50%) translate3d(${x}px,${y}px,0) rotate(${rot}deg)`;
      };

      on(
        window,
        "mousemove",
        ((raw: Event) => {
          const e = raw as MouseEvent;
          mx = e.clientX / window.innerWidth - 0.5;
          my = e.clientY / window.innerHeight - 0.5;
          render();
        }) as EventListener,
        { passive: true },
      );

      on(
        window,
        "scroll",
        (() => {
          sy = window.scrollY;
          render();
        }) as EventListener,
        { passive: true },
      );

      render();
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}

"use client";

/**
 * ServiceWorkerRegister — registers public/sw.js (#130, offline support).
 *
 * WHY after `load` + idle: the audience is low-end phones on slow
 * connections. Installing the worker kicks off its precache downloads, so it
 * waits until everything the visitor came for has loaded, then for the
 * browser to go idle (setTimeout fallback where requestIdleCallback is
 * missing, e.g. Safari).
 *
 * WHY production only: `next dev` serves unhashed, constantly-changing
 * chunks; a caching worker there just serves stale code. Outside production
 * this also unregisters any worker left behind by a local `next start` run
 * on the same origin, for the same reason.
 *
 * `updateViaCache: "none"` makes the browser skip its HTTP cache when
 * checking /sw.js for updates (public/_headers also sends no-cache), so a
 * deploy's new worker — or the kill switch — reaches visitors on their next
 * page load.
 */

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    let idleId: number | undefined;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
          // Offline support is a bonus; a failed registration changes nothing visible.
        });
    };
    const whenIdle = () => {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(register, { timeout: 5000 });
      } else {
        timer = setTimeout(register, 1000);
      }
    };

    if (document.readyState === "complete") whenIdle();
    else window.addEventListener("load", whenIdle, { once: true });

    return () => {
      window.removeEventListener("load", whenIdle);
      if (timer !== undefined) clearTimeout(timer);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
    };
  }, []);

  return null;
}

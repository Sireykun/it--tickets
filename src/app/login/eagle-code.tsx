"use client";

import { useEffect } from "react";

/** Runs the original code-drop eagle canvas engine from the supplied HTML. */
export function EagleCode() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/login/eagle-engine.js";
    script.async = true;
    document.body.appendChild(script);
    return () => script.remove();
  }, []);

  return (
    <canvas
      id="codeDropEagleCanvas"
      aria-label="Animated eagle made from falling binary code"
      role="img"
      className="absolute inset-0 block h-full w-full cursor-crosshair"
    />
  );
}

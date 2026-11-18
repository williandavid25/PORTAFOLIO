"use client";

import { useEffect } from "react";
import { isRunning, unlockAudio } from "./sfx";

/**
 * Sonido automático (sin botón visible): se intenta activar al cargar la página.
 * Si el navegador lo bloquea (regla de reproducción automática), se activa con el
 * primer toque, clic o tecla en cualquier parte.
 */
export default function SoundToggle() {
  useEffect(() => {
    unlockAudio();
    const evs = ["pointerdown", "keydown", "touchstart", "touchend", "mousedown"] as const;
    const first = () => {
      unlockAudio();
      if (isRunning()) evs.forEach((e) => window.removeEventListener(e, first, true));
    };
    evs.forEach((e) => window.addEventListener(e, first, true));
    return () => evs.forEach((e) => window.removeEventListener(e, first, true));
  }, []);
  return null;
}

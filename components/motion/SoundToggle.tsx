"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { isMuted, onMuteChange, setMuted, unlockAudio } from "./sfx";

/**
 * Botón de sonido (esquina inferior izquierda). El audio se activa con el primer
 * toque, clic o tecla en cualquier parte (regla de los navegadores); aquí se puede
 * silenciar o volver a activar, y la elección se recuerda.
 */
export default function SoundToggle() {
  const muted = useSyncExternalStore(onMuteChange, isMuted, () => false);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const first = (e: Event) => {
      // Si el primer gesto es sobre este botón, lo maneja su onClick.
      if ((e.target as Element | null)?.closest?.(".sound-toggle")) return;
      if (!isMuted()) unlockAudio();
      setLive(true);
      window.removeEventListener("pointerdown", first, true);
      window.removeEventListener("keydown", first, true);
      window.removeEventListener("touchstart", first, true);
    };
    window.addEventListener("pointerdown", first, true);
    window.addEventListener("keydown", first, true);
    window.addEventListener("touchstart", first, true);
    return () => {
      window.removeEventListener("pointerdown", first, true);
      window.removeEventListener("keydown", first, true);
      window.removeEventListener("touchstart", first, true);
    };
  }, []);

  const on = !muted && live;
  return (
    <button
      type="button"
      className={`sound-toggle${on ? " on" : ""}`}
      aria-label={muted ? "Activar sonido" : "Silenciar sonido"}
      aria-pressed={!muted}
      title={muted ? "Activar sonido" : "Silenciar sonido"}
      onClick={() => { if (!live) { setLive(true); setMuted(false); } else setMuted(!muted); }}
    >
      <span className="eq" aria-hidden="true"><i /><i /><i /><i /></span>
      <span className="lbl">{muted ? "Sonido off" : live ? "Sonido" : "Activar sonido"}</span>
    </button>
  );
}

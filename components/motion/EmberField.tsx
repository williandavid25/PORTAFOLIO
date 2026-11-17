"use client";

import { useEffect, useRef } from "react";

/**
 * Brasas naranjas que flotan en el hero y reaccionan a TODOS los punteros a la vez
 * (mouse, lápiz y cada dedo en pantallas táctiles: multitáctil real).
 *
 * Rendimiento: canvas 2D sin filtros, resolución limitada (DPR ≤ 1.5), cantidad
 * según tamaño y núcleos del equipo, baja sola si los fotogramas van lentos y se
 * pausa cuando el hero no está en pantalla o la pestaña está oculta.
 */
type P = { x: number; y: number; vx: number; vy: number; r: number; life: number; max: number; hue: number };
type Ptr = { x: number; y: number; vx: number; vy: number; down: boolean; seen: number };

export default function EmberField({ className = "embers" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    const host = canvas.parentElement ?? canvas;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cores = navigator.hardwareConcurrency || 4;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0, h = 0, budget = 0;
    const parts: P[] = [];
    const ptrs = new Map<number, Ptr>();

    const resize = () => {
      const r = host.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const area = (w * h) / 10000;
      budget = Math.round(Math.min(cores >= 8 ? 170 : cores >= 4 ? 120 : 70, area * 0.9) * (reduced ? 0.4 : 1));
    };

    const spawn = (x?: number, y?: number, burst = false): P => {
      const max = 220 + Math.random() * 360;
      return {
        x: x ?? Math.random() * w,
        y: y ?? h + Math.random() * 40,
        vx: burst ? (Math.random() - 0.5) * 3.2 : (Math.random() - 0.5) * 0.3,
        vy: burst ? -Math.random() * 3 - 0.6 : -(0.25 + Math.random() * 0.75),
        r: 0.6 + Math.random() * 2.1,
        life: burst ? 0 : Math.random() * max,
        max: burst ? 70 + Math.random() * 70 : max,
        hue: 16 + Math.random() * 22,
      };
    };

    resize();
    for (let i = 0; i < budget; i++) parts.push(spawn(Math.random() * w, Math.random() * h));

    // ---- Punteros (cada pointerId por separado = multitáctil) ----
    const local = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onMove = (e: PointerEvent) => {
      const { x, y } = local(e);
      if (x < -50 || y < -50 || x > w + 50 || y > h + 50) return void ptrs.delete(e.pointerId);
      const prev = ptrs.get(e.pointerId);
      ptrs.set(e.pointerId, { x, y, vx: prev ? x - prev.x : 0, vy: prev ? y - prev.y : 0, down: prev?.down ?? e.pointerType !== "mouse", seen: performance.now() });
    };
    const onDown = (e: PointerEvent) => {
      onMove(e);
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      p.down = true;
      for (let i = 0; i < 18; i++) parts.push(spawn(p.x, p.y, true)); // chispazo al tocar
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === "mouse") { const p = ptrs.get(e.pointerId); if (p) p.down = false; }
      else ptrs.delete(e.pointerId);
    };
    const onLeave = (e: PointerEvent) => ptrs.delete(e.pointerId);
    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onLeave, { passive: true });
    host.addEventListener("pointerleave", onLeave, { passive: true });

    // ---- Bucle con pausa fuera de pantalla y calidad adaptable ----
    let raf = 0, running = false, visible = true, last = performance.now(), slow = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(2.5, (now - last) / 16.67);
      last = now;
      if (dt > 1.6) { if (++slow > 40 && budget > 40) { budget = Math.round(budget * 0.8); slow = 0; } } else slow = Math.max(0, slow - 1);

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      // Punteros sin movimiento por un rato dejan de influir.
      ptrs.forEach((p, id) => { if (now - p.seen > 2500 && !p.down) ptrs.delete(id); });
      const plist = Array.from(ptrs.values());

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        for (const q of plist) {
          const dx = p.x - q.x, dy = p.y - q.y;
          const d2 = dx * dx + dy * dy;
          const R = q.down ? 190 : 140;
          if (d2 < R * R && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const f = (1 - d / R) * (q.down ? 1.1 : 0.55) * dt;
            // Repele y arrastra en la dirección en que se mueve el puntero.
            p.vx += (dx / d) * f + q.vx * 0.012 * f;
            p.vy += (dy / d) * f + q.vy * 0.012 * f;
          }
        }
        p.vx *= 0.975; p.vy = p.vy * 0.975 - 0.012 * dt;
        p.x += p.vx * dt + Math.sin((p.life + i) * 0.02) * 0.25;
        p.y += p.vy * dt;
        p.life += dt;
        const t = p.life / p.max;
        if (t >= 1 || p.y < -20 || p.x < -40 || p.x > w + 40) {
          if (parts.length > budget) parts.splice(i, 1);
          else parts[i] = spawn();
          continue;
        }
        const a = Math.sin(Math.PI * t) * 0.9;
        const rr = p.r * (1 + (1 - t) * 0.6);
        ctx.fillStyle = `hsla(${p.hue},100%,${55 + (1 - t) * 15}%,${a * 0.18})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, rr * 3.2, 0, 6.283); ctx.fill();
        ctx.fillStyle = `hsla(${p.hue + 10},100%,72%,${a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.283); ctx.fill();
      }
      while (parts.length < budget) parts.push(spawn());

      // Halo suave bajo cada puntero activo.
      for (const q of plist) {
        const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.down ? 120 : 80);
        g.addColorStop(0, "rgba(255,120,40,0.16)");
        g.addColorStop(1, "rgba(255,120,40,0)");
        ctx.fillStyle = g;
        ctx.fillRect(q.x - 130, q.y - 130, 260, 260);
      }
      ctx.globalCompositeOperation = "source-over";
    };
    const start = () => { if (!running && visible && !document.hidden) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); else stop(); }, { threshold: 0 });
    io.observe(host);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    start();

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onLeave);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

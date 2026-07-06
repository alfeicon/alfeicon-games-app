import { useEffect } from "react";

/**
 * Bloquea el scroll del fondo mientras `active` es true (para hojas/modales).
 * Restaura el valor previo de overflow al cerrar o desmontar.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [active]);
}

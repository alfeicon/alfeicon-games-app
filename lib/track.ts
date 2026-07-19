// Registro de visitas de la tienda. Es "fire and forget": si falla, la tienda
// no se entera. Nunca debe interrumpir una compra por una métrica.
export function trackView(
  path: string,
  item?: { id: string; esPack?: boolean },
) {
  if (typeof window === "undefined") return;
  try {
    fetch("/api/track-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path,
        item_id: item?.id,
        item_type: item ? (item.esPack ? "pack" : "game") : undefined,
        // De dónde llegó. El servidor lo reduce a un nombre de red; la URL
        // completa nunca se guarda.
        ref: document.referrer || undefined,
        // utm_source de la campaña, si viene en la URL de la página.
        utm: new URLSearchParams(window.location.search).get("utm_source") || undefined,
      }),
      // keepalive: la petición sobrevive si el usuario navega enseguida.
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* sin analítica se sigue igual */
  }
}

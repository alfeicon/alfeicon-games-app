// Garantía de la entrega. Es la misma regla que ve el cliente en la boleta y
// la que decide hasta cuándo sigue abierto el enlace /entrega/[codigo]: el
// ticket dura exactamente lo que dura la garantía.
//
// Los packs duran menos porque son cuentas compartidas entre varios juegos:
// mientras más juegos, más rápido se agota la ventana de reposición.

/** Días de garantía según el tipo de compra. */
export const DIAS_GARANTIA_JUEGO = 7;
export const DIAS_GARANTIA_PACK = 3;

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * La garantía se cuenta por CUENTA entregada, es decir por `order_items`. Se
 * acepta también la orden completa para las pantallas que aún no migran a
 * ítems (y para las órdenes viejas, que son todas de un solo ítem).
 */
type OrdenGarantia = {
  /** Plazo congelado al entregar. Manda por sobre el tipo. */
  dias_garantia?: number | null;
  item_type?: 'game' | 'pack';
  pack_ids?: string[] | null;
  completed_at?: string | null;
  created_at: string;
};

export function esPack(orden: OrdenGarantia): boolean {
  if (orden.item_type) return orden.item_type === 'pack';
  return (orden.pack_ids?.length ?? 0) > 0;
}

export function diasGarantia(orden: OrdenGarantia): number {
  // El plazo guardado en el ítem es el que se le prometió al cliente: cambiar
  // los días en Ajustes no le recorta la garantía a nadie que ya compró.
  if (orden.dias_garantia && orden.dias_garantia > 0) return orden.dias_garantia;
  return esPack(orden) ? DIAS_GARANTIA_PACK : DIAS_GARANTIA_JUEGO;
}

/**
 * La garantía corre desde que el cliente confirmó la entrega. Las órdenes
 * anteriores a la columna `completed_at` caen en `created_at`, que para ellas
 * es prácticamente el mismo día.
 */
export function inicioGarantia(orden: OrdenGarantia): Date {
  return new Date(orden.completed_at || orden.created_at);
}

export function vencimientoGarantia(orden: OrdenGarantia): Date {
  return new Date(inicioGarantia(orden).getTime() + diasGarantia(orden) * DIA_MS);
}

/** Días completos que quedan (0 = vence hoy). Nunca negativo. */
export function diasRestantesGarantia(orden: OrdenGarantia, ahora = Date.now()): number {
  const restante = vencimientoGarantia(orden).getTime() - ahora;
  return restante <= 0 ? 0 : Math.ceil(restante / DIA_MS);
}

export function garantiaVencida(orden: OrdenGarantia, ahora = Date.now()): boolean {
  return vencimientoGarantia(orden).getTime() <= ahora;
}

export function fechaVencimientoLegible(orden: OrdenGarantia): string {
  return vencimientoGarantia(orden).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

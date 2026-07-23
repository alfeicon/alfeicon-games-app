// Validación de códigos de descuento. El navegador manda el carrito y la base
// responde cuánto se descuenta: así el monto no depende de lo que diga la
// página, que se puede editar.
import { supabase } from "@/lib/supabase/client";
import type { CatalogItem } from "@/lib/catalog";

export type DescuentoAplicado = { code: string; monto: number };

type Respuesta =
  | { ok: true; descuento: DescuentoAplicado }
  | { ok: false; motivo: string };

/** Subtotales por tipo: hay códigos que aplican solo a juegos o solo a packs. */
export function subtotales(items: CatalogItem[]) {
  return items.reduce(
    (acc, item) => {
      if (item.esPack) acc.packs += item.precio;
      else acc.juegos += item.precio;
      return acc;
    },
    { juegos: 0, packs: 0 },
  );
}

export async function validarCodigo(code: string, items: CatalogItem[]): Promise<Respuesta> {
  const limpio = code.trim().toUpperCase();
  if (!limpio) return { ok: false, motivo: "Escribe un código." };
  if (!supabase) return { ok: false, motivo: "Sin conexión. Inténtalo de nuevo." };

  const { juegos, packs } = subtotales(items);
  const { data, error } = await supabase.rpc("validar_codigo", {
    p_code: limpio,
    p_total_juegos: juegos,
    p_total_packs: packs,
  });

  if (error) {
    console.error("[descuento] no se pudo validar", error);
    return { ok: false, motivo: "No pudimos validar el código. Inténtalo de nuevo." };
  }

  // La función devuelve una fila; supabase-js la entrega como arreglo.
  const fila = Array.isArray(data) ? data[0] : data;
  if (!fila?.valido) return { ok: false, motivo: fila?.motivo || "Ese código no es válido." };

  return { ok: true, descuento: { code: limpio, monto: Number(fila.descuento) || 0 } };
}

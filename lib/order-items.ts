// Crea los renglones de una orden a partir del carrito. Cada producto es una
// cuenta distinta que el cliente instala por separado, así que un pack + un
// juego son dos ítems (y el pack completo, uno solo).
import { supabase } from "@/lib/supabase/client";
import type { CatalogItem } from "@/lib/catalog";

type Dias = { garantiaJuegoDias: number; garantiaPackDias: number };

/**
 * Se llama justo después de crear la orden. Si falla, la compra NO se cae: la
 * orden ya existe y el admin puede cargar las cuentas a mano desde el panel.
 * Por eso solo avisa por consola.
 */
export async function crearItemsDeOrden(orderId: string, items: CatalogItem[], dias: Dias) {
  if (!supabase || items.length === 0) return;

  const filas = items.map((item, i) => ({
    order_id: orderId,
    kind: "compra" as const,
    item_type: item.esPack ? ("pack" as const) : ("game" as const),
    item_id: item.id,
    title: item.titulo,
    sale_price: item.precio,
    // El costo lo pone el admin al conseguir la cuenta; aquí todavía no se sabe.
    cost_price: 0,
    dias_garantia: item.esPack ? dias.garantiaPackDias : dias.garantiaJuegoDias,
    sort_order: i,
  }));

  const { error } = await supabase.from("order_items").insert(filas);
  if (error) console.error("[checkout] no se pudieron crear los ítems de la orden", error);
}

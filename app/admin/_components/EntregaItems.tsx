"use client";

// Cuentas de una entrega. Cada renglón de `order_items` es UNA cuenta: un pack
// entero es un solo ítem, pero un pack + un juego son dos, y el cliente instala
// cada uno por su lado desde el mismo enlace.
//
// Aquí también se cuelga la recuperación cuando se resuelve un ticket: es un
// ítem más de la misma orden, con su costo, que baja la ganancia de esa venta.
import { useCallback, useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, LifeBuoy, Plus, ShieldCheck, Trash2, Search } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { diasRestantesGarantia, garantiaVencida } from "@/lib/garantia";
import type { OrderItem, AdminGame, AdminPack } from "../_types";

const INPUT = "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-bold text-white outline-none transition-colors focus:border-yellow-500/50";
const MINI_LABEL = "mb-1 block text-[9px] font-black uppercase tracking-widest text-gray-500";

type Props = {
  orderId: string;
  /** Títulos de la orden, para prellenar el ítem nuevo. */
  gameName: string;
  garantiaJuegoDias: number;
  garantiaPackDias: number;
  showNotice: (type: "success" | "error" | "info", text: string, playSound?: boolean) => void;
  /** Cuántas cuentas tiene la orden, costo total, y si hay credenciales listas. */
  onItemsLoad?: (count: number, totalCost: number, hasCreds: boolean) => void;
  games?: AdminGame[];
  packs?: AdminPack[];
};

export function EntregaItems({ orderId, gameName, garantiaJuegoDias, garantiaPackDias, showNotice, onItemsLoad, games, packs }: Props) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  // Ediciones locales por ítem: no se guarda en cada tecla.
  const [borrador, setBorrador] = useState<Record<string, Partial<OrderItem>>>({});
  // En un ref y no en las dependencias de `cargar`: si el padre pasa una función
  // nueva en cada render, incluirla ahí dispararía una recarga infinita.
  const onItemsLoadRef = useRef(onItemsLoad);
  onItemsLoadRef.current = onItemsLoad;

  const cargar = useCallback(async () => {
    if (!supabase) return;
    setCargando(true);
    const { data, error } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .order("sort_order", { ascending: true });
    setCargando(false);
    if (error) { showNotice("error", `No se pudieron cargar los ítems: ${error.message}`); return; }
    const lista = (data || []) as OrderItem[];
    setItems(lista);
    setBorrador({});
    const totalCost = lista.reduce((acc, it) => acc + (Number(it.cost_price) || 0), 0);
    const hasCreds = lista.some(it => it.account_email && it.account_password);
    onItemsLoadRef.current?.(lista.length, totalCost, hasCreds);
  }, [orderId, showNotice]);

  useEffect(() => { cargar(); }, [cargar]);

  const valor = (item: OrderItem, campo: keyof OrderItem) =>
    (borrador[item.id]?.[campo] ?? item[campo] ?? "") as string | number;

  const editar = (id: string, campo: keyof OrderItem, v: string | number) =>
    setBorrador(b => ({ ...b, [id]: { ...b[id], [campo]: v } }));

  // Auto-guardado con debounce
  useEffect(() => {
    const idsSucios = Object.keys(borrador);
    if (idsSucios.length === 0) return;

    const timer = setTimeout(async () => {
      if (!supabase) return;
      const currentBorrador = { ...borrador };
      
      for (const id of idsSucios) {
        const cambios = currentBorrador[id];
        if (!cambios) continue;
        
        setGuardando(id);
        const { error } = await supabase.from("order_items").update(cambios).eq("id", id);
        
        if (error) {
          showNotice("error", `Error al auto-guardar cuenta: ${error.message}`);
        } else {
          setItems(prev => prev.map(it => it.id === id ? { ...it, ...cambios } : it));
        }
        setGuardando(null);
      }
      
      setBorrador(prev => {
        const next = { ...prev };
        for (const id of idsSucios) {
          if (next[id] === currentBorrador[id]) {
            delete next[id];
          }
        }
        return next;
      });

      // Recalcular total
      const { data } = await supabase.from("order_items").select("*").eq("order_id", orderId);
      if (data) {
         const lista = data as OrderItem[];
         const totalCost = lista.reduce((acc, it) => acc + (Number(it.cost_price) || 0), 0);
         const hasCreds = lista.some(it => it.account_email && it.account_password);
         onItemsLoadRef.current?.(lista.length, totalCost, hasCreds);
      }
    }, 800); // 800ms debounce

    return () => clearTimeout(timer);
  }, [borrador, orderId, showNotice]);

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addType, setAddType] = useState<OrderItem["item_type"]>("game");
  const [addKind, setAddKind] = useState<OrderItem["kind"]>("compra");

  const confirmarAgregar = async () => {
    if (!addTitle.trim()) { showNotice("error", "Escribe el nombre del juego o pack"); return; }
    if (!supabase) return;
    setGuardando("nuevo");
    const { error } = await supabase.from("order_items").insert({
      order_id: orderId,
      kind: addKind,
      item_type: addType,
      title: addKind === "recuperacion" ? `Recuperación · ${addTitle.trim()}` : addTitle.trim(),
      sale_price: 0,
      dias_garantia: addType === "pack" ? garantiaPackDias : garantiaJuegoDias,
      sort_order: items.length,
    });
    setGuardando(null);
    if (error) { showNotice("error", `No se pudo agregar: ${error.message}`); return; }
    setShowAddMenu(false);
    await cargar();
  };

  const eliminar = async (item: OrderItem) => {
    if (!supabase) return;
    if (!window.confirm(`¿Eliminar "${item.title}" de esta entrega?`)) return;
    const { error } = await supabase.from("order_items").delete().eq("id", item.id);
    if (error) { showNotice("error", `No se pudo eliminar: ${error.message}`); return; }
    await cargar();
  };

  const estado = (item: OrderItem) => {
    if (!item.completed_at) {
      return item.account_email
        ? { texto: "Cuenta lista · esperando al cliente", clase: "text-yellow-500" }
        : { texto: "Falta cargar la cuenta", clase: "text-gray-500" };
    }
    if (garantiaVencida(item)) return { texto: "Garantía vencida · cuenta liberada", clase: "text-gray-600" };
    const dias = diasRestantesGarantia(item);
    return { texto: `Entregado · ${dias} ${dias === 1 ? "día" : "días"} de garantía`, clase: "text-green-500" };
  };

  return (
    <div className="mt-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <div className="mb-3 flex items-center gap-2">
        <KeyRound size={13} className="text-yellow-500" />
        <p className="text-[10px] font-black uppercase tracking-widest text-white">Cuentas de la entrega</p>
        {cargando && <Loader2 size={12} className="animate-spin text-gray-500" />}
      </div>

      {!cargando && items.length === 0 && (
        <p className="mb-3 text-[11px] leading-relaxed text-gray-600">
          Esta orden no tiene cuentas cargadas. Agrega una por cada cuenta distinta que le
          entregues al cliente (un pack completo va en una sola).
        </p>
      )}

      <div className="space-y-2">
        {items.map((item, i) => {
          const e = estado(item);
          const sucio = !!borrador[item.id];
          return (
            <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
              <div className="mb-2.5 flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/10 text-[10px] font-black text-white">
                  {guardando === item.id ? <Loader2 size={10} className="animate-spin text-yellow-500" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <input value={valor(item, "title") as string}
                    onChange={ev => editar(item.id, "title", ev.target.value)}
                    className="w-full bg-transparent text-[13px] font-black leading-tight text-white outline-none" />
                  <p className={`mt-0.5 text-[10px] font-bold ${e.clase}`}>{e.texto}</p>
                </div>
                {item.kind === "recuperacion" && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-blue-400">
                    <LifeBuoy size={10} /> Garantía
                  </span>
                )}
                <button type="button" onClick={() => eliminar(item)} title="Eliminar ítem"
                  className="shrink-0 rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-red-500/15 hover:text-red-400">
                  <Trash2 size={12} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <label>
                  <span className={MINI_LABEL}>Código (5 dígitos)</span>
                  <input inputMode="numeric" maxLength={5} placeholder="12345"
                    value={valor(item, "account_email") as string}
                    onChange={ev => editar(item.id, "account_email", ev.target.value.replace(/\D/g, "").slice(0, 5))}
                    className={INPUT + " text-center font-mono tracking-[0.3em]"} />
                </label>
                <label>
                  <span className={MINI_LABEL}>Contraseña</span>
                  <input value={valor(item, "account_password") as string}
                    onChange={ev => editar(item.id, "account_password", ev.target.value)}
                    placeholder="Contraseña123" className={INPUT} />
                </label>
                <label>
                  <span className={MINI_LABEL}>Costo (CLP)</span>
                  <input inputMode="numeric" value={valor(item, "cost_price") as number}
                    onChange={ev => editar(item.id, "cost_price", Number(ev.target.value.replace(/[^0-9]/g, "")) || 0)}
                    className={INPUT} />
                </label>
                <label>
                  <span className={MINI_LABEL}>Garantía (días)</span>
                  <div className="relative">
                    <input inputMode="numeric" value={valor(item, "dias_garantia") as number}
                      onChange={ev => editar(item.id, "dias_garantia", Number(ev.target.value.replace(/[^0-9]/g, "")) || 0)}
                      className={INPUT + " pl-8"} />
                    <ShieldCheck size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
                  </div>
                </label>
              </div>

              {/* El botón de GUARDAR CAMBIOS fue eliminado a favor del auto-guardado */}
            </div>
          );
        })}
      </div>

      {showAddMenu ? (
        <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
          <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-white">Agregar nueva cuenta</p>
          
          <label className="mb-3 block relative">
             <span className={MINI_LABEL}>Nombre del título</span>
             <Search size={13} className="absolute left-3 bottom-2.5 text-gray-500 pointer-events-none" />
             <input list="catalog-list" value={addTitle} onChange={e => setAddTitle(e.target.value)} placeholder="Busca o escribe el nombre..." className={INPUT + " pl-8"} />
             <datalist id="catalog-list">
                {games?.map(g => <option key={g.id} value={g.title} />)}
                {packs?.map(p => <option key={p.id} value={p.title} />)}
             </datalist>
          </label>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <div>
              <span className={MINI_LABEL}>Contenido</span>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setAddType("game")} className={`flex-1 rounded-lg border py-1.5 text-[10px] font-bold uppercase transition-colors ${addType === "game" ? "border-white/20 bg-white/10 text-white" : "border-white/5 bg-transparent text-gray-500 hover:bg-white/5"}`}>Juego</button>
                <button type="button" onClick={() => setAddType("pack")} className={`flex-1 rounded-lg border py-1.5 text-[10px] font-bold uppercase transition-colors ${addType === "pack" ? "border-white/20 bg-white/10 text-white" : "border-white/5 bg-transparent text-gray-500 hover:bg-white/5"}`}>Pack</button>
              </div>
            </div>
            <div>
              <span className={MINI_LABEL}>Categoría</span>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setAddKind("compra")} className={`flex-1 rounded-lg border py-1.5 text-[10px] font-bold uppercase transition-colors ${addKind === "compra" ? "border-white/20 bg-white/10 text-white" : "border-white/5 bg-transparent text-gray-500 hover:bg-white/5"}`}>Venta</button>
                <button type="button" onClick={() => setAddKind("recuperacion")} className={`flex-1 rounded-lg border py-1.5 text-[10px] font-bold uppercase transition-colors ${addKind === "recuperacion" ? "border-blue-500/30 bg-blue-500/15 text-blue-400" : "border-white/5 bg-transparent text-gray-500 hover:bg-white/5"}`}>Reposición</button>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowAddMenu(false)} className="flex-1 rounded-lg bg-white/5 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400 transition-colors hover:bg-white/10">Cancelar</button>
            <button type="button" onClick={confirmarAgregar} disabled={!!guardando} className="flex-1 flex justify-center items-center gap-1 rounded-lg bg-yellow-500 py-2 text-[10px] font-black uppercase tracking-widest text-black transition-colors hover:bg-yellow-400 disabled:opacity-50">
              {guardando === "nuevo" && <Loader2 size={11} className="animate-spin" />}
              Confirmar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <button type="button" onClick={() => { setAddTitle(gameName); setAddType("game"); setAddKind("compra"); setShowAddMenu(true); }} disabled={!!guardando}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 bg-white/5 py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-400 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white disabled:opacity-50">
            <Plus size={13} /> Agregar Cuenta
          </button>
        </div>
      )}

      <p className="mt-2.5 text-[10px] leading-relaxed text-gray-600">
        La recuperación no suma a la venta, solo su costo: la ganancia de esta orden se
        recalcula sola. Al vencer la garantía de un ítem, su cuenta se borra automáticamente.
      </p>
    </div>
  );
}

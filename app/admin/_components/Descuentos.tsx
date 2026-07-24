"use client";

// Códigos de descuento. Sirven para promociones abiertas y para descuentos
// puntuales — por ejemplo, el que se le ofrece a un cliente que ya usó su
// garantía y quiere reponer el juego pagando menos.
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Tag, Ticket, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { DiscountCode } from "../_types";

const LABEL = "mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-600";
const INPUT = "premium-control w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:border-white/40";

// Sin vocales ni caracteres que se confundan al dictarlo o escribirlo (0/O, 1/I).
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const generarCodigo = (prefijo = "ALF") => {
  let s = "";
  for (let i = 0; i < 5; i++) s += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  return `${prefijo}${s}`;
};

const VACIO = {
  code: "",
  tipo: "porcentaje" as DiscountCode["tipo"],
  valor: "",
  aplica_a: "todo" as DiscountCode["aplica_a"],
  max_usos: "1",
  expira_dias: "",
  nota: "",
};

type Props = {
  loading: boolean;
  setLoading: (v: boolean) => void;
  showNotice: (type: "success" | "error" | "info", text: string, playSound?: boolean) => void;
};

export function Descuentos({ loading, setLoading, showNotice }: Props) {
  const [codigos, setCodigos] = useState<DiscountCode[]>([]);
  const [form, setForm] = useState(VACIO);

  const cargar = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("discount_codes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { console.error("[descuentos]", error); return; }
    setCodigos((data || []) as DiscountCode[]);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const code = (form.code.trim() || generarCodigo()).toUpperCase();
    const valor = Number(String(form.valor).replace(/[^0-9]/g, ""));
    if (!valor || valor <= 0) { showNotice("error", "Ponle un valor al descuento."); return; }
    if (form.tipo === "porcentaje" && valor > 100) { showNotice("error", "Un porcentaje no puede pasar de 100."); return; }

    const dias = Number(form.expira_dias);
    setLoading(true);
    const { error } = await supabase.from("discount_codes").insert({
      code,
      tipo: form.tipo,
      valor,
      aplica_a: form.aplica_a,
      // Vacío = sin límite de usos.
      max_usos: form.max_usos.trim() === "" ? null : Number(form.max_usos) || 1,
      expira_at: dias > 0 ? new Date(Date.now() + dias * 86400000).toISOString() : null,
      nota: form.nota.trim() || null,
    });
    setLoading(false);
    if (error) {
      showNotice("error", error.code === "23505" ? "Ese código ya existe." : `No se pudo crear: ${error.message}`);
      return;
    }
    showNotice("success", `Código ${code} creado.`);
    setForm(VACIO);
    await cargar();
  };

  const alternar = async (c: DiscountCode) => {
    if (!supabase) return;
    const { error } = await supabase.from("discount_codes").update({ activo: !c.activo }).eq("id", c.id);
    if (error) { showNotice("error", `No se pudo cambiar: ${error.message}`); return; }
    await cargar();
  };

  const eliminar = async (c: DiscountCode) => {
    if (!supabase) return;
    if (!window.confirm(`¿Eliminar el código ${c.code}?`)) return;
    const { error } = await supabase.from("discount_codes").delete().eq("id", c.id);
    if (error) { showNotice("error", `No se pudo eliminar: ${error.message}`); return; }
    await cargar();
  };

  const resumen = (c: DiscountCode) => {
    const cuanto = c.tipo === "porcentaje" ? `${c.valor}%` : `$${c.valor.toLocaleString("es-CL")}`;
    const donde = c.aplica_a === "todo" ? "todo el carrito" : `solo ${c.aplica_a}`;
    const usos = c.max_usos == null ? `${c.usos} usos` : `${c.usos} de ${c.max_usos}`;
    return `${cuanto} en ${donde} · ${usos}`;
  };

  const agotado = (c: DiscountCode) =>
    (c.max_usos != null && c.usos >= c.max_usos) ||
    (c.expira_at != null && new Date(c.expira_at) < new Date());

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-yellow-500/12">
          <Ticket size={14} className="text-yellow-400" />
        </div>
        <div>
          <h2 className="text-xs font-black uppercase tracking-widest">Códigos de descuento</h2>
          <p className="text-[10px] text-gray-600">El cliente los escribe en el carrito antes de pagar</p>
        </div>
      </div>

      <form onSubmit={crear} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL}>Código</span>
            <div className="flex gap-2">
              <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="Se genera solo" className={INPUT} />
              <button type="button" onClick={() => setForm({ ...form, code: generarCodigo() })}
                className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 text-[10px] font-black uppercase tracking-widest text-gray-300 transition-colors hover:bg-white/10">
                Generar
              </button>
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={LABEL}>Tipo</span>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as DiscountCode["tipo"] })}
                className={INPUT + " cursor-pointer appearance-none"}>
                <option value="porcentaje">Porcentaje</option>
                <option value="monto">Monto fijo</option>
              </select>
            </label>
            <label className="block">
              <span className={LABEL}>{form.tipo === "porcentaje" ? "Descuento (%)" : "Descuento (CLP)"}</span>
              <input value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })}
                inputMode="numeric" className={INPUT} />
            </label>
          </div>

          <label className="block">
            <span className={LABEL}>Aplica a</span>
            <select value={form.aplica_a} onChange={e => setForm({ ...form, aplica_a: e.target.value as DiscountCode["aplica_a"] })}
              className={INPUT + " cursor-pointer appearance-none"}>
              <option value="todo">Todo el carrito</option>
              <option value="juegos">Solo juegos</option>
              <option value="packs">Solo packs</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={LABEL}>Usos</span>
              <input value={form.max_usos} onChange={e => setForm({ ...form, max_usos: e.target.value })}
                inputMode="numeric" placeholder="vacío = sin límite" className={INPUT} />
            </label>
            <label className="block">
              <span className={LABEL}>Vence en (días)</span>
              <input value={form.expira_dias} onChange={e => setForm({ ...form, expira_dias: e.target.value })}
                inputMode="numeric" placeholder="sin vencimiento" className={INPUT} />
            </label>
          </div>
        </div>

        <label className="block">
          <span className={LABEL}>Nota (solo para ti)</span>
          <input value={form.nota} onChange={e => setForm({ ...form, nota: e.target.value })}
            placeholder="Ej: reposición Juan · orden ALF-X8K2" className={INPUT} />
        </label>

        <button disabled={loading}
          className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-black uppercase tracking-widest text-black transition-all hover:bg-white/90 disabled:opacity-60 active:scale-95">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Crear código
        </button>
      </form>

      {codigos.length > 0 && (
        <div className="mt-5 space-y-2 border-t border-white/5 pt-4">
          {codigos.map(c => (
            <div key={c.id}
              className={`flex items-center gap-3 rounded-xl border p-3 ${
                !c.activo || agotado(c) ? "border-white/5 bg-white/[0.01] opacity-50" : "border-white/10 bg-white/[0.03]"
              }`}>
              <Tag size={13} className="shrink-0 text-yellow-500" />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-black tracking-widest text-white">{c.code}</p>
                <p className="text-[10px] text-gray-500">
                  {resumen(c)}
                  {agotado(c) && <span className="ml-1.5 font-black text-gray-600">· agotado</span>}
                </p>
                {c.nota && <p className="mt-0.5 truncate text-[10px] italic text-gray-600">{c.nota}</p>}
              </div>
              <button type="button" onClick={() => alternar(c)}
                className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-gray-400 transition-colors hover:bg-white/10">
                {c.activo ? "Pausar" : "Activar"}
              </button>
              <button type="button" onClick={() => eliminar(c)}
                className="shrink-0 rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-red-500/15 hover:text-red-400">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

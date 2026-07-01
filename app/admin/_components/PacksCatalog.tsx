"use client";

import { FormEvent, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  ChevronDown, ChevronUp, Eye, EyeOff, Gamepad2, Gift, HardDrive, ImagePlus, Loader2, Package, Plus, Save, Tag, Trash2, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import GameCard from "@/components/GameCard";
import type { AdminPack } from "../_types";
import { fmt, toPrice, findImage } from "../_helpers";

type PackItem = { title: string; sort_order: number };
type PackForm = {
  title: string; price: string; cost_price: string; image_url: string;
  console: "switch" | "switch2"; is_new: boolean; is_active: boolean;
  items: PackItem[];
};

const emptyForm: PackForm = {
  title: "", price: "", cost_price: "", image_url: "", console: "switch",
  is_new: true, is_active: true, items: [],
};

const toForm = (p: AdminPack): PackForm => ({
  title: p.title, price: String(p.price),
  cost_price: p.cost_price ? String(p.cost_price) : "",
  image_url: p.image_url || "",
  console: p.console === "switch2" ? "switch2" : "switch",
  is_new: p.is_new, is_active: p.is_active,
  items: p.pack_items ? [...p.pack_items].sort((a, b) => a.sort_order - b.sort_order) : [],
});

const LABEL = "mb-1.5 block text-[9px] font-black uppercase tracking-widest text-gray-600";
const INPUT = "w-full rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-all duration-150 placeholder:text-gray-700 focus:border-purple-500/50 focus:bg-white/7";

type Props = {
  packs: AdminPack[];
  loading: boolean;
  setLoading: (v: boolean) => void;
  showNotice: (type: "success" | "error", text: string) => void;
  onReload: () => Promise<void>;
};

export function PacksCatalog({ packs, loading, setLoading, showNotice, onReload }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "new">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<PackForm>(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");

  const counts = useMemo(() => ({
    active: packs.filter(p => p.is_active).length,
    inactive: packs.filter(p => !p.is_active).length,
    isNew: packs.filter(p => p.is_new).length,
  }), [packs]);

  const filtered = useMemo(() => {
    let list = packs;
    const t = query.trim().toLowerCase();
    if (t) list = list.filter(p => p.title.toLowerCase().includes(t));
    if (filter === "active") list = list.filter(p => p.is_active);
    if (filter === "inactive") list = list.filter(p => !p.is_active);
    if (filter === "new") list = list.filter(p => p.is_new);
    return list;
  }, [packs, query, filter]);

  const select = (p: AdminPack) => { setSelectedId(p.id); setForm(toForm(p)); setModalOpen(true); };
  const newPack = () => { setSelectedId(null); setForm(emptyForm); setModalOpen(true); };
  const close = () => { setModalOpen(false); setSelectedId(null); };

  const fillImg = () => {
    const m = findImage(form.title);
    if (!m) { showNotice("error", "Sin imagen para ese nombre."); return; }
    setForm(f => ({ ...f, image_url: m.url }));
    showNotice("success", `Imagen: ${m.name}`);
  };

  const addItem = () => {
    const t = newItemTitle.trim();
    if (!t) return;
    setForm(f => ({ ...f, items: [...f.items, { title: t, sort_order: f.items.length }] }));
    setNewItemTitle("");
  };

  const removeItem = (i: number) =>
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, sort_order: idx })) }));

  const moveItem = (i: number, dir: -1 | 1) => {
    const ni = i + dir;
    setForm(f => {
      const items = [...f.items];
      [items[i], items[ni]] = [items[ni], items[i]];
      return { ...f, items: items.map((it, idx) => ({ ...it, sort_order: idx })) };
    });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault(); if (!supabase) return;
    const payload = {
      title: form.title.trim(), price: toPrice(form.price),
      cost_price: toPrice(form.cost_price),
      image_url: form.image_url.trim() || null,
      console: form.console, is_new: form.is_new, is_active: form.is_active,
    };
    if (!payload.title || payload.price <= 0) { showNotice("error", "Falta nombre o precio."); return; }
    setLoading(true);
    try {
      if (selectedId) {
        const { error } = await supabase.from("packs").update(payload).eq("id", selectedId);
        if (error) throw error;
        await supabase.from("pack_items").delete().eq("pack_id", selectedId);
        if (form.items.length > 0) {
          const { error: ie } = await supabase.from("pack_items").insert(
            form.items.map(it => ({ pack_id: selectedId, title: it.title, sort_order: it.sort_order }))
          );
          if (ie) throw ie;
        }
      } else {
        const { data, error } = await supabase.from("packs").insert(payload).select("id").single();
        if (error || !data) throw error;
        if (form.items.length > 0) {
          await supabase.from("pack_items").insert(
            form.items.map(it => ({ pack_id: data.id, title: it.title, sort_order: it.sort_order }))
          );
        }
      }
      showNotice("success", selectedId ? "Pack actualizado." : "Pack creado.");
      close(); await onReload();
    } catch {
      showNotice("error", "No se pudo guardar.");
    } finally {
      setLoading(false);
    }
  };

  const del = async () => {
    if (!supabase || !selectedId) return;
    const pack = packs.find(p => p.id === selectedId);
    if (!window.confirm(`¿Eliminar "${pack?.title}"?`)) return;
    setLoading(true);
    await supabase.from("pack_items").delete().eq("pack_id", selectedId);
    const { error } = await supabase.from("packs").delete().eq("id", selectedId);
    setLoading(false);
    if (error) { showNotice("error", "No se pudo eliminar."); return; }
    showNotice("success", "Pack eliminado."); close(); await onReload();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden pt-14 md:pt-0">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-4 border-b border-white/[0.06] px-6 py-4">
        <div className="flex-1">
          <h1 className="text-base font-black uppercase tracking-[0.15em] text-white">Packs</h1>
          <p className="mt-0.5 text-[10px] text-gray-600">{packs.length} en catálogo · {counts.active} activos</p>
        </div>
        <button onClick={newPack}
          className="flex items-center gap-1.5 rounded-full bg-purple-500 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all duration-200 hover:bg-purple-400 active:scale-95">
          <Plus size={12} strokeWidth={3} /> Nuevo pack
        </button>
      </div>

      {/* ── List (always full width) ────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Search + filters */}
        <div className="shrink-0 border-b border-white/[0.05] px-4 py-3 space-y-2.5">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar pack…"
            className="w-full rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-sm text-white outline-none transition-all focus:border-purple-500/30 focus:bg-white/6 placeholder:text-gray-700" />
          <div className="flex gap-1 flex-wrap">
            {([
              ["all", "Todos", packs.length],
              ["active", "Activos", counts.active],
              ["inactive", "Inactivos", counts.inactive],
              ["new", "Nuevos", counts.isNew],
            ] as [typeof filter, string, number][]).map(([f, label, count]) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all duration-200 ${
                  filter === f ? "bg-white/12 text-white" : "text-gray-700 hover:text-gray-500"
                }`}>
                {label}
                <span className={`ml-1 transition-opacity duration-200 ${filter === f ? "opacity-60" : "opacity-40"}`}>
                  · {count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto pb-32 md:pb-0">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Gift size={24} className="text-gray-800" />
              <p className="text-xs text-gray-700">Sin resultados</p>
            </div>
          )}
          {filtered.map(pack => {
            const itemCount = pack.pack_items?.length ?? 0;
            return (
              <button key={pack.id} onClick={() => select(pack)}
                className="group relative flex w-full items-center gap-3 px-4 py-3 text-left transition-all duration-150 hover:bg-white/[0.04]">
                {/* Status dot */}
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-200 ${pack.is_active ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-white/15"}`} />

                {/* Thumbnail */}
                <div className="relative h-10 w-[3.25rem] shrink-0 overflow-hidden rounded-lg bg-white/[0.04] transition-transform duration-200 group-hover:scale-[1.04]">
                  {pack.image_url
                    ? <Image src={pack.image_url} alt={pack.title} fill className="object-cover" sizes="52px" />
                    : <Tag className="m-auto mt-2.5 text-gray-800" size={13} />}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[13px] font-bold leading-tight text-white">{pack.title}</p>
                    {pack.is_new && (
                      <span className="shrink-0 rounded-full bg-purple-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-purple-300">Nuevo</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] text-gray-600">
                    {itemCount} juego{itemCount !== 1 ? "s" : ""} · {pack.console === "switch2" ? "Solo Switch 2" : "Switch 1 y 2"}
                  </p>
                </div>

                {/* Price */}
                <p className="shrink-0 text-[13px] font-black text-white">${fmt(pack.price)}</p>

                {/* Visibility */}
                <div className="shrink-0">
                  {pack.is_active
                    ? <Eye size={11} className="text-white/20 transition-all group-hover:text-white/40" />
                    : <EyeOff size={11} className="text-white/10" />}
                </div>

                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/[0.04]" />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Edit modal (portal: escapes the animated section wrapper so it isn't trapped in its stacking context) ── */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-6">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={close} />

          {/* Sheet */}
          <div className="animate-soft-in relative z-10 flex h-full w-full overflow-hidden sm:h-[94vh] sm:max-w-5xl sm:rounded-3xl sm:border sm:border-white/[0.07]"
            style={{ background: "rgb(9,9,11)" }}>

            {/* ── Left: form ──────────────────────────────────────── */}
            <div className="flex w-full flex-col overflow-hidden lg:w-[54%] lg:border-r lg:border-white/[0.06]">
              {/* Header */}
              <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.05] bg-white/[0.02] px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-purple-400">
                    {selectedId ? "Editando pack" : "Nuevo pack"}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-black text-white">{form.title || "Sin título"}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {selectedId && (
                    <button onClick={del}
                      className="rounded-xl border border-red-500/15 p-2 text-red-500/50 transition-all hover:border-red-500/30 hover:bg-red-500/8 hover:text-red-400 active:scale-95">
                      <Trash2 size={13} />
                    </button>
                  )}
                  <button onClick={close}
                    className="rounded-xl border border-white/8 p-2 text-gray-600 transition-all hover:border-white/14 hover:bg-white/5 hover:text-white active:scale-95">
                    <X size={13} />
                  </button>
                </div>
              </div>

              {/* Form */}
              <div className="flex-1 overflow-y-auto pb-6">
                <form onSubmit={save} className="space-y-5 p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="sm:col-span-2">
                      <span className={LABEL}>Nombre</span>
                      <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                        className={INPUT} placeholder="Nombre del pack" />
                    </label>
                    <label>
                      <span className={LABEL}>Precio venta CLP</span>
                      <input value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                        inputMode="numeric" className={INPUT} placeholder="0" />
                    </label>
                    <label>
                      <span className={LABEL}>Costo (lo que pagaste)</span>
                      <input value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })}
                        inputMode="numeric" className={INPUT} placeholder="0" />
                      {form.price && form.cost_price && toPrice(form.price) > 0 && toPrice(form.cost_price) > 0 && (
                        <p className="mt-1 text-[10px] font-bold text-green-500">
                          Ganancia: ${(toPrice(form.price) - toPrice(form.cost_price)).toLocaleString("es-CL")}
                          {" "}({Math.round((1 - toPrice(form.cost_price) / toPrice(form.price)) * 100)}%)
                        </p>
                      )}
                    </label>

                    {/* Console toggle */}
                    <div>
                      <span className={LABEL}>Consola</span>
                      <div className="relative mt-1.5 flex overflow-hidden rounded-xl border border-white/8 bg-white/4 p-0.5">
                        <span className={`absolute bottom-0.5 top-0.5 w-[calc(50%-0.125rem)] rounded-[10px] bg-white/10 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${form.console === "switch2" ? "translate-x-[calc(100%+0.25rem)]" : "translate-x-0"}`} />
                        {(["switch", "switch2"] as const).map(c => (
                          <button key={c} type="button" onClick={() => setForm({ ...form, console: c })}
                            className={`relative z-10 flex-1 rounded-[10px] py-2 text-[9px] font-black uppercase tracking-widest transition-colors duration-200 ${form.console === c ? "text-white" : "text-gray-700 hover:text-gray-500"}`}>
                            {c === "switch" ? "Switch 1 y 2" : "Solo Switch 2"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Image URL */}
                    <label className="sm:col-span-2">
                      <span className={LABEL}>Imagen URL</span>
                      <div className="mt-1.5 flex gap-2">
                        <input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })}
                          className="min-w-0 flex-1 rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-purple-500/30 placeholder:text-gray-700"
                          placeholder="https://…" />
                        <button type="button" onClick={fillImg} disabled={!form.title.trim()}
                          className="shrink-0 rounded-xl border border-white/8 bg-white/4 p-2.5 text-gray-500 transition-all hover:border-white/14 hover:bg-white/8 hover:text-white disabled:opacity-30 active:scale-95">
                          <ImagePlus size={15} />
                        </button>
                      </div>
                    </label>
                  </div>

                  {/* Flags */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "is_active", label: "Activo", checked: form.is_active, onChange: (v: boolean) => setForm(f => ({ ...f, is_active: v })) },
                      { key: "is_new",    label: "Nuevo",  checked: form.is_new,    onChange: (v: boolean) => setForm(f => ({ ...f, is_new: v })) },
                    ].map(({ key, label, checked, onChange }) => (
                      <label key={key} className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/3 px-3 py-3 transition-all hover:bg-white/5">
                        <span className="text-[10px] font-bold text-gray-400">{label}</span>
                        <div className={`relative h-4 w-7 rounded-full transition-all duration-200 ${checked ? "bg-purple-500" : "bg-white/10"}`}
                          onClick={() => onChange(!checked)}>
                          <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform duration-200 ${checked ? "translate-x-3.5" : "translate-x-0.5"}`} />
                        </div>
                        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only" />
                      </label>
                    ))}
                  </div>

                  {/* Pack items */}
                  <div>
                    <div className="mb-2 flex items-center gap-1.5">
                      <Package size={11} className="text-purple-400" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                        Juegos del pack ({form.items.length})
                      </span>
                    </div>
                    <div className="space-y-1">
                      {form.items.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-xl border border-white/6 bg-white/3 px-3 py-2">
                          <span className="w-4 shrink-0 text-[9px] font-black text-gray-700">{i + 1}</span>
                          <p className="min-w-0 flex-1 truncate text-xs font-semibold text-white">{item.title}</p>
                          <div className="flex shrink-0 gap-0.5">
                            <button type="button" onClick={() => moveItem(i, -1)} disabled={i === 0}
                              className="rounded p-1 text-gray-700 hover:text-white disabled:opacity-30 transition-colors">
                              <ChevronUp size={11} />
                            </button>
                            <button type="button" onClick={() => moveItem(i, 1)} disabled={i === form.items.length - 1}
                              className="rounded p-1 text-gray-700 hover:text-white disabled:opacity-30 transition-colors">
                              <ChevronDown size={11} />
                            </button>
                            <button type="button" onClick={() => removeItem(i)}
                              className="rounded p-1 text-gray-700 hover:text-red-400 transition-colors">
                              <X size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
                        placeholder="Agregar juego al pack…"
                        className="min-w-0 flex-1 rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-sm text-white outline-none transition-all focus:border-purple-500/40 placeholder:text-gray-700" />
                      <button type="button" onClick={addItem} disabled={!newItemTitle.trim()}
                        className="shrink-0 rounded-xl border border-purple-500/20 bg-purple-500/10 px-3 py-2 text-purple-400 disabled:opacity-40 hover:bg-purple-500/20 transition-colors active:scale-95">
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {!form.is_active && (
                    <p className="rounded-xl border border-yellow-500/15 bg-yellow-500/8 px-3 py-2.5 text-[11px] font-semibold text-yellow-400">
                      Inactivo · no aparece en la tienda pública
                    </p>
                  )}

                  <button disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-purple-500 py-3 text-xs font-black uppercase tracking-widest text-white transition-all duration-200 hover:bg-purple-400 disabled:opacity-50 active:scale-[0.98]">
                    {loading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    {loading ? "Guardando…" : "Guardar cambios"}
                  </button>
                </form>
              </div>
            </div>

            {/* ── Right: store preview ────────────────────────────── */}
            <div className="hidden w-[46%] flex-col overflow-hidden lg:flex">
              {/* Preview header */}
              <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.05] bg-white/[0.02] px-5 py-4">
                <Gift size={12} className="text-purple-400" />
                <p className="text-[9px] font-black uppercase tracking-widest text-purple-400">Vista previa · Tienda</p>
              </div>

              {/* Preview body */}
              <div className="flex flex-1 flex-col overflow-y-auto">
                {/* Simulated store background */}
                <div className="relative flex flex-col items-center justify-center gap-5 px-6 py-10"
                  style={{ background: "linear-gradient(160deg, rgb(6,6,10) 0%, rgb(12,10,18) 100%)" }}>
                  {/* Subtle glow */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-48 w-48 rounded-full blur-3xl"
                      style={{ background: "rgba(168,85,247,0.06)" }} />
                  </div>

                  <div className="relative z-10 w-full max-w-[240px]">
                    <GameCard
                      titulo={form.title || "Nombre del pack"}
                      precio={toPrice(form.price)}
                      precioOriginal={null}
                      img={form.image_url || null}
                      ahorro={form.is_new ? "¡NUEVO! ✨" : null}
                      esPack={true}
                      juegosIncluidos={form.items.map(i => i.title)}
                      consoleName={form.console}
                      storageRequired={null}
                      onAdd={() => {}}
                    />
                  </div>
                </div>

                {/* Metadata chips */}
                <div className="border-t border-white/[0.05] p-5 space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-700">Detalles en tienda</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                      <Gamepad2 size={11} className="mb-1.5 text-purple-400" />
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-700">Consola</p>
                      <p className="mt-0.5 text-[11px] font-bold text-white">{form.console === "switch2" ? "Solo Switch 2" : "Switch 1 y 2"}</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                      <Package size={11} className="mb-1.5 text-purple-400" />
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-700">Juegos</p>
                      <p className="mt-0.5 text-[11px] font-bold text-white">{form.items.length} incluidos</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-700 mb-1">Precio</p>
                      <p className="text-[13px] font-black text-white">${fmt(toPrice(form.price))}</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-700 mb-1.5">Estado</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${form.is_active ? "bg-green-500/12 text-green-400" : "bg-white/8 text-gray-500"}`}>
                        <span className={`h-1 w-1 rounded-full ${form.is_active ? "bg-green-400" : "bg-gray-600"}`} />
                        {form.is_active ? "Visible" : "Oculto"}
                      </span>
                    </div>
                  </div>

                  {form.items.length > 0 && (
                    <div className="rounded-xl border border-purple-500/12 bg-purple-500/5 p-3">
                      <div className="mb-2 flex items-center gap-1.5">
                        <HardDrive size={10} className="text-purple-400" />
                        <p className="text-[9px] font-black uppercase tracking-widest text-purple-400">Contenido del pack</p>
                      </div>
                      <div className="space-y-1">
                        {form.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-purple-500/60">{i + 1}.</span>
                            <p className="text-[11px] text-gray-400">{item.title}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {form.is_new && (
                    <div className="rounded-xl border border-purple-500/15 bg-purple-500/6 px-3 py-2.5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-purple-400 mb-0.5">Etiqueta activa</p>
                      <p className="text-[11px] text-purple-300/80">Aparece con badge "NUEVO" en tienda</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

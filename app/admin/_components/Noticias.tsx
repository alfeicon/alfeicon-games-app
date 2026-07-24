"use client";

import { FormEvent, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  Eye, EyeOff, Loader2, Megaphone, Newspaper, Plus, RefreshCw, Save, Trash2, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { AdminNews } from "../_types";
import { fmtDate } from "../_helpers";

type NewsForm = {
  title: string;
  description: string;
  image_url: string;
  sort_order: string;
  is_active: boolean;
};

const emptyForm: NewsForm = {
  title: "", description: "", image_url: "", sort_order: "0", is_active: true,
};

const toForm = (n: AdminNews): NewsForm => ({
  title: n.title,
  description: n.description || "",
  image_url: n.image_url || "",
  sort_order: String(n.sort_order),
  is_active: n.is_active,
});

const LABEL = "mb-1.5 block text-[9px] font-black uppercase tracking-widest text-gray-600";
const INPUT = "w-full rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-all duration-150 placeholder:text-gray-700 focus:border-orange-500/50 focus:bg-white/7";

type Props = {
  news: AdminNews[];
  newsTableExists: boolean | null;
  loading: boolean;
  setLoading: (v: boolean) => void;
  showNotice: (type: "success" | "error" | "info", text: string, playSound?: boolean) => void;
  onReload: () => Promise<void>;
};

export function Noticias({ news, newsTableExists, loading, setLoading, showNotice, onReload }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<NewsForm>(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);

  const counts = useMemo(() => ({
    active: news.filter(n => n.is_active).length,
  }), [news]);

  const select = (n: AdminNews) => { setSelectedId(n.id); setForm(toForm(n)); setModalOpen(true); };
  const newNews = () => { setSelectedId(null); setForm(emptyForm); setModalOpen(true); };
  const close = () => { setModalOpen(false); setSelectedId(null); };

  const save = async (e: FormEvent) => {
    e.preventDefault(); if (!supabase) return;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      sort_order: Number(form.sort_order.replace(/[^0-9-]/g, "")) || 0,
      is_active: form.is_active,
    };
    if (!payload.title) { showNotice("error", "Falta el título."); return; }
    setLoading(true);
    try {
      if (selectedId) {
        const { error } = await supabase.from("news").update(payload).eq("id", selectedId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("news").insert(payload);
        if (error) throw error;
      }
      showNotice("success", selectedId ? "Noticia actualizada." : "Noticia creada.");
      close(); await onReload();
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setLoading(false);
    }
  };

  const del = async () => {
    if (!supabase || !selectedId) return;
    const item = news.find(n => n.id === selectedId);
    if (!window.confirm(`¿Eliminar "${item?.title}"?`)) return;
    setLoading(true);
    const { error } = await supabase.from("news").delete().eq("id", selectedId);
    setLoading(false);
    if (error) { showNotice("error", "No se pudo eliminar."); return; }
    showNotice("success", "Noticia eliminada."); close(); await onReload();
  };

  if (newsTableExists === false) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 pt-20 text-center md:pt-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/8 bg-white/4">
          <Newspaper size={22} className="text-gray-600" />
        </div>
        <div>
          <p className="text-lg font-black">Tabla no configurada</p>
          <p className="mt-2 max-w-sm text-sm text-gray-600">
            La tabla <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-mono">news</code> no existe aún.
            Corre <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-mono">supabase/news-table.sql</code> en el SQL Editor de Supabase.
          </p>
        </div>
        <button onClick={onReload} disabled={loading}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-white/10 disabled:opacity-50 active:scale-95">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {loading ? "Verificando…" : "Ya la creé · Reintentar"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden pt-14 md:pt-0">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-4 border-b border-white/[0.06] px-6 py-4">
        <div className="flex-1">
          <h1 className="text-base font-black uppercase tracking-[0.15em] text-white">Noticias</h1>
          <p className="mt-0.5 text-[10px] text-gray-600">{news.length} publicadas · {counts.active} visibles</p>
        </div>
        <button onClick={newNews}
          className="flex items-center gap-1.5 rounded-full bg-orange-500 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all duration-200 hover:bg-orange-400 active:scale-95">
          <Plus size={12} strokeWidth={3} /> Nueva noticia
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-32 md:pb-0">
        {news.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Megaphone size={24} className="text-gray-800" />
            <p className="text-xs text-gray-700">Sin noticias todavía</p>
          </div>
        )}
        {news.map(item => (
          <button key={item.id} onClick={() => select(item)}
            className="group relative flex w-full items-center gap-3 px-4 py-3 text-left transition-all duration-150 hover:bg-white/[0.04]">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-200 ${item.is_active ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-white/15"}`} />

            <div className="relative h-10 w-[3.25rem] shrink-0 overflow-hidden rounded-lg bg-white/[0.04]">
              {item.image_url
                ? <Image src={item.image_url} alt={item.title} fill className="object-cover" sizes="52px" />
                : <Newspaper className="m-auto mt-2.5 text-gray-800" size={13} />}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold leading-tight text-white">{item.title}</p>
              <p className="mt-0.5 truncate text-[10px] text-gray-600">
                {item.description || "Sin descripción"} · {fmtDate(item.created_at)}
              </p>
            </div>

            <div className="shrink-0">
              {item.is_active
                ? <Eye size={11} className="text-white/20 transition-all group-hover:text-white/40" />
                : <EyeOff size={11} className="text-white/10" />}
            </div>

            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/[0.04]" />
          </button>
        ))}
      </div>

      {/* Edit modal */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={close} />

          <div className="animate-soft-in relative z-10 flex h-full w-full max-w-2xl flex-col overflow-hidden sm:h-auto sm:max-h-[90vh] sm:rounded-3xl sm:border sm:border-white/[0.07]"
            style={{ background: "rgb(9,9,11)" }}>
            <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.05] bg-white/[0.02] px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-orange-400">
                  {selectedId ? "Editando noticia" : "Nueva noticia"}
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

            <div className="flex-1 overflow-y-auto">
              <form onSubmit={save} className="space-y-5 p-5">
                <label>
                  <span className={LABEL}>Título</span>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    className={INPUT} placeholder="Ej: 2x1 en packs este finde" />
                </label>

                <label>
                  <span className={LABEL}>Descripción (opcional)</span>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={3} className={INPUT + " resize-none"} placeholder="Detalle corto de la promo o noticia" />
                </label>

                <label>
                  <span className={LABEL}>Imagen URL</span>
                  <input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })}
                    className={INPUT} placeholder="https://…" />
                </label>

                <label className="block max-w-[140px]">
                  <span className={LABEL}>Orden</span>
                  <input value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })}
                    inputMode="numeric" className={INPUT} placeholder="0" />
                  <p className="mt-1 text-[10px] text-gray-700">Menor número aparece primero</p>
                </label>

                <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/3 px-3 py-3 transition-all hover:bg-white/5">
                  <span className="text-[10px] font-bold text-gray-400">Visible en la web</span>
                  <div className={`relative h-4 w-7 rounded-full transition-all duration-200 ${form.is_active ? "bg-orange-500" : "bg-white/10"}`}
                    onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}>
                    <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform duration-200 ${form.is_active ? "translate-x-3.5" : "translate-x-0.5"}`} />
                  </div>
                  <input type="checkbox" checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="sr-only" />
                </label>

                {/* Preview */}
                <div>
                  <span className={LABEL}>Vista previa</span>
                  <div className="w-[240px] overflow-hidden rounded-2xl border border-white/8 bg-white/[0.04]">
                    <div className="relative aspect-video w-full bg-white/[0.06]">
                      {form.image_url ? (
                        <Image src={form.image_url} alt="" fill className="object-cover" sizes="240px" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center">
                          <Newspaper size={20} className="text-white/25" />
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-[13px] font-extrabold text-white">{form.title || "Título de la noticia"}</p>
                      {form.description && (
                        <p className="mt-1 line-clamp-2 text-[11px] text-gray-500">{form.description}</p>
                      )}
                    </div>
                  </div>
                </div>

                {!form.is_active && (
                  <p className="rounded-xl border border-yellow-500/15 bg-yellow-500/8 px-3 py-2.5 text-[11px] font-semibold text-yellow-400">
                    Oculta · no aparece en la tienda pública
                  </p>
                )}

                <button disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-orange-500 py-3 text-xs font-black uppercase tracking-widest text-white transition-all duration-200 hover:bg-orange-400 disabled:opacity-50 active:scale-[0.98]">
                  {loading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {loading ? "Guardando…" : "Guardar cambios"}
                </button>
              </form>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

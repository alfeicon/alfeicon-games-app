"use client";

import { FormEvent, useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Gamepad2, HardDrive, ImagePlus, Loader2, Plus, Save, Search, Trash2, X, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import GameCard from "@/components/GameCard";
import GameStoreCard from "@/components/app-store/GameStoreCard";
import type { AdminGame } from "../_types";
import { fmt, toPrice, findImage } from "../_helpers";

type GameForm = {
  title: string; price: string; cost_price: string; eshop_price: string; image_url: string;
  storage_required: string; console: "switch" | "switch2";
  is_offer: boolean; offer_price: string; is_active: boolean;
};

const emptyForm: GameForm = {
  title: "", price: "", cost_price: "", eshop_price: "", image_url: "", storage_required: "",
  console: "switch", is_offer: false, offer_price: "", is_active: true,
};

const toForm = (g: AdminGame): GameForm => ({
  title: g.title, price: String(g.price),
  cost_price: g.cost_price ? String(g.cost_price) : "",
  eshop_price: g.eshop_price ? String(g.eshop_price) : "",
  image_url: g.image_url || "",
  storage_required: g.storage_required || "",
  console: g.console === "switch2" ? "switch2" : "switch",
  is_offer: g.is_offer, offer_price: g.offer_price ? String(g.offer_price) : "",
  is_active: g.is_active,
});

const LABEL = "mb-1.5 block text-[9px] font-black uppercase tracking-widest text-gray-600";
const INPUT = "w-full rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-all duration-150 placeholder:text-gray-700 focus:border-white/20 focus:bg-white/7";

const FILTERS = [
  { id: "all",      label: "Todos" },
  { id: "active",   label: "Activos" },
  { id: "inactive", label: "Inactivos" },
  { id: "offer",    label: "Ofertas" },
] as const;
type FilterId = typeof FILTERS[number]["id"];

type Props = {
  games: AdminGame[];
  loading: boolean;
  setLoading: (v: boolean) => void;
  showNotice: (type: "success" | "error" | "info", text: string, playSound?: boolean) => void;
  onReload: () => Promise<void>;
};

export function JuegosCatalog({ games, loading, setLoading, showNotice, onReload }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<GameForm>(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingEshop, setLoadingEshop] = useState(false);
  const [isQuickEdit, setIsQuickEdit] = useState(false);
  const [quickForms, setQuickForms] = useState<Record<string, { cost_price: string; eshop_price: string; price: string }>>({});

  const selectedGame = useMemo(() => games.find(g => g.id === selectedId) ?? null, [games, selectedId]);

  useEffect(() => {
    if (isQuickEdit) {
      const initial: Record<string, { cost_price: string; eshop_price: string; price: string }> = {};
      games.forEach(g => {
        initial[g.id] = { 
          cost_price: g.cost_price ? String(g.cost_price) : "", 
          eshop_price: g.eshop_price ? String(g.eshop_price) : "", 
          price: String(g.price) 
        };
      });
      setQuickForms(initial);
    }
  }, [isQuickEdit, games]);

  const fetchQuickEshopPrice = async (gameId: string, title: string) => {
    try {
      const res = await fetch(`/api/eshop-price?q=${encodeURIComponent(title)}`);
      const data = await res.json();
      if (!res.ok) return;
      const priceUSD = data.priceUSD; 
      const priceCLP_approx = Math.round(priceUSD * 1000) + 10990;
      const priceCLP = data.priceCLP_exact > 0 ? data.priceCLP_exact : priceCLP_approx;
      
      setQuickForms(prev => {
        const current = prev[gameId];
        if (!current) return prev;
        const nextEshop = String(priceCLP);
        const nextPrice = calcSalePrice(nextEshop, current.cost_price) || current.price;
        return { ...prev, [gameId]: { ...current, eshop_price: nextEshop, price: nextPrice } };
      });
    } catch (err) {}
  };

  const autoFetchAllPrices = async () => {
    if (!confirm("Esto buscará en la eShop el precio de todos los juegos filtrados que NO tengan precio eShop actualmente. Tomará unos segundos por juego. ¿Continuar?")) return;
    
    const gamesToFetch = filtered.filter(g => {
      const current = quickForms[g.id];
      return !current?.eshop_price || toPrice(current.eshop_price) === 0;
    });
    
    const total = gamesToFetch.length;
    if (total === 0) {
      return showNotice("info", "Todos los juegos visibles ya tienen precio eShop.");
    }

    setLoading(true);
    let fetchCount = 0;
    for (const game of gamesToFetch) {
      fetchCount++;
      showNotice("info", `${game.title} # ${fetchCount} / ${total} ..... procesando`);
      await fetchQuickEshopPrice(game.id, game.title);
      showNotice("success", `${game.title} # ${fetchCount} / ${total} ..... completado`);
      await new Promise(r => setTimeout(r, 600)); // Evitar bloqueos
    }
    setLoading(false);
    showNotice("success", `Auto-completado finalizado. ${fetchCount} actualizados.`);
  };

  const saveQuickEdits = async () => {
    if (!supabase) return;
    setLoading(true);
    let errorCount = 0;
    let savedCount = 0;
    for (const game of filtered) {
      const qf = quickForms[game.id];
      if (!qf) continue;
      const cp = toPrice(qf.cost_price);
      const ep = toPrice(qf.eshop_price);
      const p = toPrice(qf.price);
      if (cp !== (game.cost_price || 0) || ep !== (game.eshop_price || 0) || p !== game.price) {
        const { error } = await supabase.from("games").update({
          cost_price: cp > 0 ? cp : null,
          eshop_price: ep > 0 ? ep : null,
          price: p
        }).eq("id", game.id);
        if (error) errorCount++;
        else savedCount++;
      }
    }
    setLoading(false);
    if (errorCount > 0) showNotice("error", `Hubo ${errorCount} errores al guardar`);
    else if (savedCount > 0) showNotice("success", `Se guardaron ${savedCount} juegos correctamente.`);
    else showNotice("info", "No había cambios que guardar.");
    onReload();
  };

  const counts = useMemo(() => ({
    all:      games.length,
    active:   games.filter(g => g.is_active).length,
    inactive: games.filter(g => !g.is_active).length,
    offer:    games.filter(g => g.is_offer).length,
  }), [games]);

  const filtered = useMemo(() => {
    let list = games;
    const t = query.trim().toLowerCase();
    if (t) list = list.filter(g => g.title.toLowerCase().includes(t));
    if (filter === "active")   list = list.filter(g => g.is_active);
    if (filter === "inactive") list = list.filter(g => !g.is_active);
    if (filter === "offer")    list = list.filter(g => g.is_offer);
    return list;
  }, [games, query, filter]);

  const select = (g: AdminGame) => { setSelectedId(g.id); setForm(toForm(g)); setModalOpen(true); };
  const newGame = () => { setSelectedId(null); setForm(emptyForm); setModalOpen(true); };
  const close = () => { setModalOpen(false); setSelectedId(null); };

  const fillImg = () => {
    const m = findImage(form.title);
    if (!m) { showNotice("error", "Sin imagen para ese nombre."); return; }
    setForm(f => ({ ...f, image_url: m.url }));
    showNotice("success", `Imagen: ${m.name}`);
  };

  const calcSalePrice = (eshopStr: string, costStr: string) => {
    const eshop = toPrice(eshopStr);
    const cost = toPrice(costStr);
    if (eshop <= 0) return "";
    
    let baseMarketing = Math.round((eshop * 0.47) / 1000) * 1000 - 10;
    let baseMargin = cost > 0 ? Math.round(((cost + 9000) / 0.965) / 1000) * 1000 - 10 : 0;
    
    let finalBase = Math.max(baseMarketing, baseMargin);
    if (finalBase < 990) finalBase = 990;
    return String(finalBase);
  };

  const fetchEshopPrice = async () => {
    if (!form.title.trim()) {
      showNotice("error", "Escribe un nombre de juego primero");
      return;
    }
    setLoadingEshop(true);
    showNotice("success", "Buscando en eShop...");
    try {
      const res = await fetch(`/api/eshop-price?q=${encodeURIComponent(form.title)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No encontrado");
      
      const priceUSD = data.priceUSD; 
      const priceCLP_approx = Math.round(priceUSD * 1000) + 10990;
      const priceCLP = data.priceCLP_exact > 0 ? data.priceCLP_exact : priceCLP_approx;
      
      setForm(f => {
        const nextEshop = String(priceCLP);
        const nextPrice = calcSalePrice(nextEshop, f.cost_price);
        return { ...f, eshop_price: nextEshop, price: nextPrice || f.price };
      });
      
      if (data.priceCLP_exact > 0) {
        showNotice("success", `¡Precio eShop Chile exacto! (${priceCLP} CLP)`);
      } else {
        showNotice("info", `No encontré el chileno. Dejamos el EEUU aprox: ${data.priceUSD} USD`);
      }
    } catch (err: any) {
      showNotice("error", err.message || "No se encontró el juego en eShop");
    } finally {
      setLoadingEshop(false);
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault(); if (!supabase) return;
    const payload = {
      title: form.title.trim(), 
      price: toPrice(form.price),
      cost_price: toPrice(form.cost_price),
      eshop_price: toPrice(form.eshop_price),
      image_url: form.image_url.trim() || null,
      storage_required: form.storage_required.trim() || null,
      console: form.console, 
      is_offer: form.is_offer,
      offer_price: form.is_offer ? toPrice(form.offer_price) : null,
      is_active: form.is_active,
    };
    if (!payload.title || payload.price <= 0) { showNotice("error", "Falta nombre o precio."); return; }
    setLoading(true);
    const req = selectedId
      ? supabase.from("games").update(payload).eq("id", selectedId)
      : supabase.from("games").insert(payload);
    const { error } = await req;
    setLoading(false);
    if (error) { showNotice("error", "No se pudo guardar."); return; }
    showNotice("success", selectedId ? "Juego actualizado." : "Juego agregado.");
    close(); await onReload();
  };

  const del = async () => {
    if (!supabase || !selectedId) return;
    if (!window.confirm(`¿Eliminar "${selectedGame?.title}"?`)) return;
    setLoading(true);
    const { error } = await supabase.from("games").delete().eq("id", selectedId);
    setLoading(false);
    if (error) { showNotice("error", "No se pudo eliminar."); return; }
    showNotice("success", "Juego eliminado."); close(); await onReload();
  };

  const previewOffer    = form.is_offer ? toPrice(form.offer_price) : 0;
  const previewFinal    = form.is_offer && previewOffer > 0 ? previewOffer : toPrice(form.price);
  const previewOriginal = form.is_offer && previewOffer > 0 ? toPrice(form.price) : null;

  return (
    <div className="flex h-full flex-col overflow-hidden pt-14 md:pt-0">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-4 border-b border-white/[0.06] px-6 py-4">
        <div className="flex-1">
          <h1 className="text-base font-black uppercase tracking-[0.15em] text-white">Juegos</h1>
          <p className="mt-0.5 text-[10px] text-gray-600">
            {games.length} en catálogo · {counts.active} activos
          </p>
        </div>
        <button onClick={() => setIsQuickEdit(!isQuickEdit)}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all duration-200 active:scale-95 ${
            isQuickEdit ? "bg-[#33FF00] text-black hover:bg-[#33FF00]/90" : "bg-white/10 text-white hover:bg-white/15"
          }`}>
          <Zap size={12} strokeWidth={3} className={isQuickEdit ? "fill-black" : "fill-white/30"} /> 
          {isQuickEdit ? "Salir Rápida" : "Edición Rápida"}
        </button>
        <button onClick={newGame}
          className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-black transition-all duration-200 hover:bg-white/90 active:scale-95">
          <Plus size={12} strokeWidth={3} /> Nuevo
        </button>
      </div>

      {/* ── List (always full width) ────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Search + filters */}
        <div className="shrink-0 border-b border-white/[0.05] px-4 py-3 space-y-2.5">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Buscar juego…"
              className="w-full rounded-xl border border-white/8 bg-white/4 py-2 pl-8 pr-3 text-sm text-white outline-none transition-all focus:border-white/16 focus:bg-white/6 placeholder:text-gray-700" />
          </div>
          <div className="flex gap-1">
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all duration-200 ${
                  filter === f.id ? "bg-white/12 text-white" : "text-gray-700 hover:text-gray-500"
                }`}>
                {f.label}
                <span className={`ml-1 transition-opacity duration-200 ${filter === f.id ? "opacity-60" : "opacity-40"}`}>
                  · {counts[f.id]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Grilla estilo tienda: mismas tarjetas del catálogo público; al
            hacer clic se abre el editor en vez del detalle de compra. */}
        <div className="flex-1 overflow-y-auto px-4 pb-32 pt-4 md:pb-6">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Search size={24} className="text-gray-800" />
              <p className="text-xs text-gray-700">Sin resultados</p>
            </div>
          ) : isQuickEdit ? (
            <div className="flex flex-col gap-2 pb-20">
              <div className="mb-2 flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                <p className="text-xs font-semibold text-white/70">Modo de Edición Rápida ({filtered.length} juegos visibles)</p>
                <div className="flex gap-2">
                  <button onClick={autoFetchAllPrices} className="flex items-center gap-1.5 rounded-lg bg-blue-500/20 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-blue-400 transition-all hover:bg-blue-500/30">
                    <Search size={12} strokeWidth={3} /> Auto eShop
                  </button>
                  <button onClick={saveQuickEdits} className="flex items-center gap-1.5 rounded-lg bg-[#33FF00]/20 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#33FF00] transition-all hover:bg-[#33FF00]/30">
                    <Save size={12} strokeWidth={3} /> Guardar Todos
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-[36px_1fr_100px_130px_70px_100px] gap-3 px-3 text-[9px] font-black uppercase tracking-widest text-gray-500">
                <div />
                <div>Juego</div>
                <div>Costo ($)</div>
                <div>eShop ($)</div>
                <div>Actual ($)</div>
                <div>Final ($)</div>
              </div>

              {filtered.map(game => {
                const qf = quickForms[game.id] || { cost_price: "", eshop_price: "", price: "" };
                return (
                  <div key={game.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-2 pr-4 transition-all hover:bg-white/10">
                    <img src={game.image_url || ""} alt="" className="aspect-square w-9 shrink-0 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1 truncate text-xs font-bold text-white">
                      {game.title}
                    </div>
                    <div className="w-[100px]">
                      <input value={qf.cost_price} onChange={e => {
                        const val = e.target.value;
                        setQuickForms(prev => ({
                          ...prev, [game.id]: { ...qf, cost_price: val, price: calcSalePrice(qf.eshop_price, val) || qf.price }
                        }));
                      }} placeholder="0" className="w-full rounded-lg bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none focus:bg-black/60" />
                    </div>
                    <div className="flex w-[130px] gap-1">
                      <input value={qf.eshop_price} onChange={e => {
                        const val = e.target.value;
                        setQuickForms(prev => ({
                          ...prev, [game.id]: { ...qf, eshop_price: val, price: calcSalePrice(val, qf.cost_price) || qf.price }
                        }));
                      }} placeholder="0" className="w-full min-w-0 flex-1 rounded-lg bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none focus:bg-black/60" />
                      <button onClick={() => fetchQuickEshopPrice(game.id, game.title)} className="shrink-0 rounded-lg bg-white/10 p-1.5 text-gray-400 hover:bg-white/20 hover:text-white">
                        <Search size={12} />
                      </button>
                    </div>
                    <div className="flex w-[70px] items-center">
                      <span className="text-xs text-gray-500 line-through decoration-white/20">{game.price}</span>
                    </div>
                    <div className="w-[100px]">
                      <input value={qf.price} onChange={e => {
                        setQuickForms(prev => ({ ...prev, [game.id]: { ...qf, price: e.target.value } }));
                      }} placeholder="0" className="w-full rounded-lg bg-[#33FF00]/10 px-2.5 py-1.5 text-xs font-bold text-[#33FF00] outline-none focus:bg-[#33FF00]/20" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {filtered.map((game, idx) => {
                const isOffer = game.is_offer && Boolean(game.offer_price);
                return (
                  <div
                    key={game.id}
                    className={`relative transition-opacity duration-200 ${game.is_active ? "" : "opacity-45"}`}
                  >
                    {!game.is_active && (
                      <span className="pointer-events-none absolute right-3 top-3 z-20 rounded-full bg-black/75 px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-white/80 backdrop-blur">
                        Oculto
                      </span>
                    )}
                    <GameStoreCard
                      titulo={game.title}
                      img={game.image_url}
                      consoleName={game.console}
                      precio={isOffer ? game.offer_price! : game.price}
                      precioOriginal={isOffer ? game.price : null}
                      ahorro={isOffer ? "OFERTA" : null}
                      onClick={() => select(game)}
                      ariaLabel={`Editar ${game.title}`}
                      priority={idx < 4}
                    />
                  </div>
                );
              })}
            </div>
          )}
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
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">
                    {selectedId ? "Editando juego" : "Nuevo juego"}
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
                        className={INPUT} placeholder="Nombre del juego" />
                    </label>
                    <label>
                      <span className={LABEL}>Precio eShop (oficial en CLP)</span>
                      <div className="flex gap-2">
                        <input value={form.eshop_price} onChange={e => {
                          const val = e.target.value;
                          setForm(f => {
                            const nextPrice = calcSalePrice(val, f.cost_price);
                            return { ...f, eshop_price: val, price: nextPrice || f.price };
                          });
                        }}
                          inputMode="numeric" className={`${INPUT} min-w-0 flex-1`} placeholder="0" />
                        <button type="button" onClick={fetchEshopPrice} disabled={!form.title.trim() || loadingEshop}
                          className="shrink-0 rounded-xl border border-white/8 bg-white/4 p-2.5 text-gray-500 transition-all hover:border-white/14 hover:bg-white/8 hover:text-white disabled:opacity-30 active:scale-95"
                          title="Obtener precio eShop">
                          {loadingEshop ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                        </button>
                      </div>
                    </label>
                    <label>
                      <span className={LABEL}>Precio venta CLP</span>
                      <input value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                        inputMode="numeric" className={INPUT} placeholder="0" />
                    </label>
                    <label>
                      <span className={LABEL}>Costo (lo que pagaste)</span>
                      <input value={form.cost_price} onChange={e => {
                          const val = e.target.value;
                          setForm(f => {
                            const nextPrice = calcSalePrice(f.eshop_price, val);
                            return { ...f, cost_price: val, price: nextPrice || f.price };
                          });
                        }}
                        inputMode="numeric" className={INPUT} placeholder="0" />
                      {form.price && form.cost_price && toPrice(form.price) > 0 && toPrice(form.cost_price) > 0 && (
                        <p className="mt-1 text-[10px] font-bold text-green-500">
                          Ganancia: ${(toPrice(form.price) - toPrice(form.cost_price)).toLocaleString("es-CL")}
                          {" "}({Math.round((1 - toPrice(form.cost_price) / toPrice(form.price)) * 100)}%)
                        </p>
                      )}
                    </label>
                    <label>
                      <span className={LABEL}>Espacio</span>
                      <input value={form.storage_required} onChange={e => setForm({ ...form, storage_required: e.target.value })}
                        className={INPUT} placeholder="Ej: 12.3 GB" />
                    </label>

                    {/* Console toggle */}
                    <div className="sm:col-span-2">
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
                          className="min-w-0 flex-1 rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-white/16 placeholder:text-gray-700"
                          placeholder="https://…" />
                        <button type="button" onClick={fillImg} disabled={!form.title.trim()}
                          className="shrink-0 rounded-xl border border-white/8 bg-white/4 p-2.5 text-gray-500 transition-all hover:border-white/14 hover:bg-white/8 hover:text-white disabled:opacity-30 active:scale-95">
                          <ImagePlus size={15} />
                        </button>
                      </div>
                    </label>
                  </div>

                  {/* Flags */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "is_active", label: "Activo", checked: form.is_active, onChange: (v: boolean) => setForm(f => ({ ...f, is_active: v })) },
                      { key: "is_offer",  label: "Oferta",  checked: form.is_offer,  onChange: (v: boolean) => setForm(f => ({ ...f, is_offer: v })) },
                    ].map(({ key, label, checked, onChange }) => (
                      <label key={key} className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/3 px-3 py-3 transition-all hover:bg-white/5">
                        <span className="text-[10px] font-bold text-gray-400">{label}</span>
                        <div className={`relative h-4 w-7 rounded-full transition-all duration-200 ${checked ? "bg-white" : "bg-white/10"}`}
                          onClick={() => onChange(!checked)}>
                          <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-black transition-transform duration-200 ${checked ? "translate-x-3.5" : "translate-x-0.5"}`} />
                        </div>
                        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only" />
                      </label>
                    ))}
                    <label>
                      <span className={LABEL}>Precio oferta</span>
                      <input value={form.offer_price} onChange={e => setForm({ ...form, offer_price: e.target.value })}
                        inputMode="numeric" disabled={!form.is_offer}
                        className="mt-1.5 w-full rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-orange-500/40 disabled:opacity-30 placeholder:text-gray-700"
                        placeholder="0" />
                    </label>
                  </div>

                  {!form.is_active && (
                    <p className="rounded-xl border border-yellow-500/15 bg-yellow-500/8 px-3 py-2.5 text-[11px] font-semibold text-yellow-400">
                      Inactivo · no aparece en la tienda pública
                    </p>
                  )}

                  <button disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-xs font-black uppercase tracking-widest text-black transition-all duration-200 hover:bg-white/90 disabled:opacity-50 active:scale-[0.98]">
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
                <Gamepad2 size={12} className="text-blue-400" />
                <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">Vista previa · Tienda</p>
              </div>

              {/* Preview body */}
              <div className="flex flex-1 flex-col overflow-y-auto">
                {/* Simulated store background */}
                <div className="relative flex flex-col items-center justify-center gap-5 px-6 py-10"
                  style={{ background: "linear-gradient(160deg, rgb(6,6,10) 0%, rgb(12,12,18) 100%)" }}>
                  {/* Subtle glow behind card */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-48 w-48 rounded-full blur-3xl"
                      style={{ background: "rgba(59,130,246,0.06)" }} />
                  </div>

                  <div className="relative z-10 w-full max-w-[240px]">
                    <GameCard
                      titulo={form.title || "Nombre del juego"}
                      precio={previewFinal}
                      precioOriginal={previewOriginal}
                      img={form.image_url || null}
                      ahorro={form.is_offer && previewOffer > 0 ? "OFERTA 🔥" : null}
                      esPack={false}
                      storageRequired={form.storage_required || null}
                      consoleName={form.console}
                      onAdd={() => {}}
                    />
                  </div>
                </div>

                {/* Metadata chips */}
                <div className="border-t border-white/[0.05] p-5 space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-700">Detalles en tienda</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                      <Gamepad2 size={11} className="mb-1.5 text-blue-400" />
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-700">Consola</p>
                      <p className="mt-0.5 text-[11px] font-bold text-white">{form.console === "switch2" ? "Solo Switch 2" : "Switch 1 y 2"}</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                      <HardDrive size={11} className="mb-1.5 text-green-400" />
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-700">Espacio</p>
                      <p className="mt-0.5 text-[11px] font-bold text-white">{form.storage_required || "—"}</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-700 mb-1">Precio</p>
                      <p className="text-[13px] font-black text-white">${fmt(previewFinal)}</p>
                      {previewOriginal && (
                        <p className="text-[10px] text-gray-600 line-through">${fmt(previewOriginal)}</p>
                      )}
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-700 mb-1.5">Estado</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${form.is_active ? "bg-green-500/12 text-green-400" : "bg-white/8 text-gray-500"}`}>
                        <span className={`h-1 w-1 rounded-full ${form.is_active ? "bg-green-400" : "bg-gray-600"}`} />
                        {form.is_active ? "Visible" : "Oculto"}
                      </span>
                    </div>
                  </div>

                  {form.is_offer && previewOffer > 0 && previewOriginal && (
                    <div className="rounded-xl border border-orange-500/15 bg-orange-500/6 p-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-orange-400 mb-1">Descuento activo</p>
                      <p className="text-sm font-black text-orange-300">
                        {Math.round((1 - previewOffer / previewOriginal) * 100)}% de descuento
                      </p>
                      <p className="text-[10px] text-orange-400/60 mt-0.5">
                        Ahorro de ${fmt(previewOriginal - previewOffer)}
                      </p>
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

"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Gamepad2, HardDrive, Loader2, LogOut, Plus, Save, ShieldCheck, Tag } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import GameCard from "@/components/GameCard";
import { DEFAULT_APP_SETTINGS, SETTING_KEYS } from "@/lib/settings";

type AdminGame = {
  id: string;
  title: string;
  price: number;
  image_url: string | null;
  storage_required: string | null;
  console: string | null;
  is_offer: boolean;
  offer_price: number | null;
  is_active: boolean;
};

type GameForm = {
  title: string;
  price: string;
  image_url: string;
  storage_required: string;
  console: "switch" | "switch2";
  is_offer: boolean;
  offer_price: string;
  is_active: boolean;
};

type SettingsForm = {
  nintendoOnlinePrice: string;
  packPriceIncrease: string;
};

const emptyForm: GameForm = {
  title: "",
  price: "",
  image_url: "",
  storage_required: "",
  console: "switch",
  is_offer: false,
  offer_price: "",
  is_active: true,
};

const defaultSettingsForm: SettingsForm = {
  nintendoOnlinePrice: String(DEFAULT_APP_SETTINGS.nintendoOnlinePrice),
  packPriceIncrease: String(DEFAULT_APP_SETTINGS.packPriceIncrease),
};

const toPrice = (value: string) => Number(value.replace(/[^0-9]/g, "")) || 0;

const toForm = (game: AdminGame): GameForm => ({
  title: game.title,
  price: String(game.price),
  image_url: game.image_url || "",
  storage_required: game.storage_required || "",
  console: game.console === "switch2" ? "switch2" : "switch",
  is_offer: game.is_offer,
  offer_price: game.offer_price ? String(game.offer_price) : "",
  is_active: game.is_active,
});

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionReady, setSessionReady] = useState(!isSupabaseConfigured);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [games, setGames] = useState<AdminGame[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<GameForm>(emptyForm);
  const [settingsForm, setSettingsForm] = useState<SettingsForm>(defaultSettingsForm);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selectedGame = useMemo(
    () => games.find((game) => game.id === selectedId) || null,
    [games, selectedId],
  );

  const filteredGames = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return games;
    return games.filter((game) => game.title.toLowerCase().includes(term));
  }, [games, query]);

  const previewPrice = toPrice(form.price);
  const previewOfferPrice = form.is_offer ? toPrice(form.offer_price) : 0;
  const previewFinalPrice = form.is_offer && previewOfferPrice > 0 ? previewOfferPrice : previewPrice;
  const previewOriginalPrice = form.is_offer && previewOfferPrice > 0 ? previewPrice : null;
  const previewConsoleLabel = form.console === "switch2" ? "Solo Switch 2" : "Switch 1 y 2";

  const showNotice = (type: "success" | "error", text: string) => {
    setNotice({ type, text });
    window.setTimeout(() => setNotice(null), 3600);
  };

  const loadGames = useCallback(async () => {
    if (!supabase) return;

    setLoading(true);
    let { data, error } = await supabase
      .from("games")
      .select("id,title,price,image_url,storage_required,console,is_offer,offer_price,is_active")
      .order("title", { ascending: true });

    if (error?.message?.toLowerCase().includes("console")) {
      const fallback = await supabase
        .from("games")
        .select("id,title,price,image_url,storage_required,is_offer,offer_price,is_active")
        .order("title", { ascending: true });

      data = fallback.data?.map((game) => ({ ...game, console: "switch" })) || null;
      error = fallback.error;
    }

    setLoading(false);

    if (error) {
      setMessage("No se pudo cargar el catalogo. Revisa permisos de admin en Supabase.");
      showNotice("error", "No se pudo cargar el catalogo.");
      return;
    }

    setGames((data || []) as AdminGame[]);
  }, []);

  const loadSettings = useCallback(async () => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("app_settings")
      .select("key,value")
      .in("key", Object.values(SETTING_KEYS));

    if (error) {
      setSettingsForm(defaultSettingsForm);
      return;
    }

    const rows = new Map((data || []).map((row) => [row.key, row.value]));
    setSettingsForm({
      nintendoOnlinePrice: String(rows.get(SETTING_KEYS.nintendoOnlinePrice) || DEFAULT_APP_SETTINGS.nintendoOnlinePrice),
      packPriceIncrease: String(rows.get(SETTING_KEYS.packPriceIncrease) || DEFAULT_APP_SETTINGS.packPriceIncrease),
    });
  }, []);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      const hasSession = Boolean(data.session);
      setIsLoggedIn(hasSession);
      setSessionReady(true);
      if (hasSession) {
        loadGames();
        loadSettings();
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const hasSession = Boolean(session);
      setIsLoggedIn(hasSession);
      if (hasSession) {
        loadGames();
        loadSettings();
      }
      if (!hasSession) setGames([]);
    });

    return () => listener.subscription.unsubscribe();
  }, [loadGames, loadSettings]);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;

    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setMessage("Login invalido o usuario sin acceso.");
      return;
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSelectedId(null);
    setForm(emptyForm);
  };

  const startNew = (clearMessage = true) => {
    setSelectedId(null);
    setForm(emptyForm);
    if (clearMessage) setMessage("");
  };

  const selectGame = (game: AdminGame) => {
    setSelectedId(game.id);
    setForm(toForm(game));
    setMessage("");
  };

  const saveGame = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;

    const payload = {
      title: form.title.trim(),
      price: toPrice(form.price),
      image_url: form.image_url.trim() || null,
      storage_required: form.storage_required.trim() || null,
      console: form.console,
      is_offer: form.is_offer,
      offer_price: form.is_offer ? toPrice(form.offer_price) : null,
      is_active: form.is_active,
    };

    if (!payload.title || payload.price <= 0) {
      setMessage("Falta nombre o precio.");
      showNotice("error", "Falta nombre o precio.");
      return;
    }

    setLoading(true);
    const request = selectedId
      ? supabase.from("games").update(payload).eq("id", selectedId)
      : supabase.from("games").insert(payload);
    const { error } = await request;
    setLoading(false);

    if (error) {
      const consoleHint = error.message?.includes("console") ? " Ejecuta primero el SQL para agregar la columna console." : "";
      setMessage(`No se pudo guardar. Revisa permisos o datos.${consoleHint}`);
      showNotice("error", "No se pudo guardar el juego.");
      return;
    }

    const successText = selectedId ? "Juego actualizado correctamente." : "Juego agregado correctamente.";
    setMessage(successText);
    showNotice("success", successText);
    startNew(false);
    await loadGames();
  };

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;

    const onlinePrice = toPrice(settingsForm.nintendoOnlinePrice);
    const packIncrease = toPrice(settingsForm.packPriceIncrease);

    if (onlinePrice <= 0 || packIncrease <= 0) {
      showNotice("error", "Revisa los precios de ajustes.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("app_settings").upsert([
      {
        key: SETTING_KEYS.nintendoOnlinePrice,
        value: onlinePrice,
        label: "Nintendo Switch Online + Expansion Pack 12 meses",
      },
      {
        key: SETTING_KEYS.packPriceIncrease,
        value: packIncrease,
        label: "Aumento automatico para packs del bot",
      },
    ]);
    setLoading(false);

    if (error) {
      showNotice("error", "No se pudieron guardar los ajustes. Ejecuta supabase/app-settings.sql.");
      return;
    }

    showNotice("success", "Ajustes guardados correctamente.");
    await loadSettings();
  };

  if (!isSupabaseConfigured) {
    return (
      <main className="alfeicon-theme theme-dark min-h-screen bg-black px-5 py-8 text-white">
        <div className="brand-shell mx-auto max-w-md rounded-[1.5rem] p-5">
          <h1 className="mb-2 text-xl font-black uppercase tracking-widest">Admin</h1>
          <p className="text-sm text-gray-400">Faltan las variables de Supabase en `.env.local`.</p>
        </div>
      </main>
    );
  }

  if (!sessionReady) {
    return (
      <main className="alfeicon-theme theme-dark flex min-h-screen items-center justify-center bg-black text-blue-400">
        <Loader2 className="animate-spin" />
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="alfeicon-theme theme-dark min-h-screen bg-black px-5 py-10 text-white">
        <form onSubmit={signIn} className="brand-shell mx-auto max-w-sm rounded-[1.7rem] p-5">
          <div className="mb-6 flex items-center gap-3">
            <ShieldCheck className="text-blue-400" size={24} />
            <h1 className="text-xl font-black uppercase tracking-widest">Admin</h1>
          </div>
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-gray-500">Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} className="premium-control w-full rounded-2xl px-3 py-3 text-white outline-none focus:border-blue-500" type="email" />
          </label>
          <label className="mb-5 block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-gray-500">Clave</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} className="premium-control w-full rounded-2xl px-3 py-3 text-white outline-none focus:border-blue-500" type="password" />
          </label>
          {message && <p className="mb-4 text-sm text-red-300">{message}</p>}
          <button disabled={loading} className="magnetic flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-black uppercase tracking-widest text-black disabled:opacity-60">
            {loading && <Loader2 size={16} className="animate-spin" />}
            Entrar
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="alfeicon-theme theme-dark min-h-screen bg-black px-4 py-5 text-white">
      {notice && (
        <div className={`fixed right-5 top-5 z-50 animate-soft-in rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-2xl ${
          notice.type === "success"
            ? "border-green-400/20 bg-green-500/15 text-green-100"
            : "border-red-400/20 bg-red-500/15 text-red-100"
        }`}>
          <div className="flex items-center gap-3">
            {notice.type === "success" ? <CheckCircle2 size={18} className="text-green-400" /> : <AlertCircle size={18} className="text-red-400" />}
            <p className="text-sm font-black">{notice.text}</p>
          </div>
        </div>
      )}
      <div className="mx-auto grid max-w-7xl gap-5 xl:grid-cols-[320px_minmax(0,1fr)_380px] lg:grid-cols-[300px_minmax(0,1fr)]">
        <section className="brand-shell animate-soft-in rounded-[1.8rem] p-4">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-lg font-black uppercase tracking-widest">Juegos</h1>
            <button onClick={signOut} className="magnetic rounded-xl border border-white/10 p-2 text-gray-400 hover:bg-white/5 hover:text-white" aria-label="Salir">
              <LogOut size={18} />
            </button>
          </div>
          <div className="mb-3 flex gap-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" className="premium-control min-w-0 flex-1 rounded-2xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
            <button onClick={() => startNew()} className="magnetic rounded-2xl bg-blue-600 p-2 text-white" aria-label="Nuevo juego">
              <Plus size={18} />
            </button>
          </div>
          <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
            {filteredGames.map((game) => (
              <button key={game.id} onClick={() => selectGame(game)} className={`magnetic group flex w-full items-center gap-3 rounded-2xl border p-2 text-left hover:-translate-y-0.5 ${selectedId === game.id ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-950/30" : "border-white/5 bg-black/30 hover:bg-white/5"}`}>
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-black">
                  {game.image_url ? <Image src={game.image_url} alt={game.title} fill className="object-cover" sizes="64px" /> : <Tag className="m-3 text-gray-600" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{game.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase text-gray-500">
                    <span>${game.price.toLocaleString("es-CL")} CLP</span>
                    {game.storage_required && <span>• {game.storage_required}</span>}
                    <span className={game.console === "switch2" ? "text-blue-400" : ""}>• {game.console === "switch2" ? "Solo Switch 2" : "Switch 1 y 2"}</span>
                  </div>
                </div>
                {game.is_active ? <Eye size={15} className="text-green-400" /> : <EyeOff size={15} className="text-gray-500" />}
              </button>
            ))}
          </div>
        </section>

        <form onSubmit={saveGame} className="brand-shell animate-soft-in rounded-[1.8rem] p-5" style={{ animationDelay: "70ms" }}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-black uppercase tracking-widest">{selectedGame ? "Editar" : "Nuevo"}</h2>
            <button disabled={loading} className="magnetic flex items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-black shadow-lg shadow-white/10 disabled:opacity-60">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {loading ? "Guardando" : "Guardar"}
            </button>
          </div>

          {message && <p className="mb-4 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-gray-300">{message}</p>}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-gray-500">Nombre</span>
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="premium-control w-full rounded-2xl px-3 py-3 outline-none focus:border-blue-500" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-gray-500">Precio</span>
              <input value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} inputMode="numeric" className="premium-control w-full rounded-2xl px-3 py-3 outline-none focus:border-blue-500" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-gray-500">Espacio</span>
              <input value={form.storage_required} onChange={(event) => setForm({ ...form, storage_required: event.target.value })} className="premium-control w-full rounded-2xl px-3 py-3 outline-none focus:border-blue-500" />
            </label>
            <div>
              <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-gray-500">Consola</span>
              <div className="premium-surface relative flex overflow-hidden rounded-full p-1">
                <span className={`absolute bottom-1 top-1 w-[calc(50%-0.25rem)] rounded-full bg-white transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${form.console === "switch2" ? "translate-x-[calc(100%+0.5rem)]" : "translate-x-0"}`} />
                <button type="button" onClick={() => setForm({ ...form, console: "switch" })} className={`relative z-10 flex-1 rounded-full py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${form.console === "switch" ? "text-black" : "text-gray-500 hover:text-white"}`}>
                  Switch 1 y 2
                </button>
                <button type="button" onClick={() => setForm({ ...form, console: "switch2" })} className={`relative z-10 flex-1 rounded-full py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${form.console === "switch2" ? "text-black" : "text-gray-500 hover:text-white"}`}>
                  Switch 2
                </button>
              </div>
            </div>
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-gray-500">Imagen URL</span>
              <input value={form.image_url} onChange={(event) => setForm({ ...form, image_url: event.target.value })} className="premium-control w-full rounded-2xl px-3 py-3 outline-none focus:border-blue-500" />
            </label>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <label className="brand-glass flex items-center justify-between rounded-2xl p-3">
              <span className="text-sm font-bold">Activo</span>
              <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
            </label>
            <label className="brand-glass flex items-center justify-between rounded-2xl p-3">
              <span className="text-sm font-bold">Oferta</span>
              <input type="checkbox" checked={form.is_offer} onChange={(event) => setForm({ ...form, is_offer: event.target.checked })} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-gray-500">Precio Oferta</span>
              <input value={form.offer_price} onChange={(event) => setForm({ ...form, offer_price: event.target.value })} inputMode="numeric" disabled={!form.is_offer} className="premium-control w-full rounded-2xl px-3 py-3 outline-none focus:border-blue-500 disabled:opacity-40" />
            </label>
          </div>
        </form>

        <aside className="premium-surface animate-soft-in rounded-[1.8rem] p-4 xl:sticky xl:top-5 xl:h-fit lg:col-span-2 xl:col-span-1" style={{ animationDelay: "120ms" }}>
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400">Vista previa</p>
            <h2 className="text-lg font-black uppercase tracking-widest text-white">Tienda</h2>
          </div>

          <form onSubmit={saveSettings} className="mb-5 rounded-[1.35rem] border border-white/10 bg-black/28 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-400">Precios rápidos</p>
                <p className="mt-1 text-xs font-semibold text-gray-500">Online y aumento de packs del bot.</p>
              </div>
              <button disabled={loading} className="magnetic rounded-full bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-black disabled:opacity-50">
                Guardar
              </button>
            </div>
            <div className="grid gap-3">
              <label>
                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">Online 12 meses</span>
                <input
                  value={settingsForm.nintendoOnlinePrice}
                  onChange={(event) => setSettingsForm({ ...settingsForm, nintendoOnlinePrice: event.target.value })}
                  inputMode="numeric"
                  className="premium-control w-full rounded-2xl px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </label>
              <label>
                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">Aumento packs bot</span>
                <input
                  value={settingsForm.packPriceIncrease}
                  onChange={(event) => setSettingsForm({ ...settingsForm, packPriceIncrease: event.target.value })}
                  inputMode="numeric"
                  className="premium-control w-full rounded-2xl px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </label>
            </div>
          </form>

          <div className="mx-auto max-w-[350px]">
            <GameCard
              titulo={form.title.trim() || "Nombre del juego"}
              precio={previewFinalPrice}
              precioOriginal={previewOriginalPrice}
              img={form.image_url.trim() || null}
              ahorro={form.is_offer && previewOfferPrice > 0 ? "OFERTA 🔥" : null}
              esPack={false}
              storageRequired={form.storage_required.trim() || null}
              consoleName={form.console}
              onAdd={() => setMessage("Vista previa: el boton comprar se prueba en la tienda publica.")}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="brand-glass rounded-2xl p-3">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-blue-400"><Gamepad2 size={15} /></div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Consola</p>
              <p className="mt-1 text-sm font-black text-white">{previewConsoleLabel}</p>
            </div>
            <div className="brand-glass rounded-2xl p-3">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-green-400"><HardDrive size={15} /></div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Espacio</p>
              <p className="mt-1 text-sm font-black text-white">{form.storage_required.trim() || "Sin dato"}</p>
            </div>
          </div>

          {!form.is_active && (
            <p className="mt-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs font-bold text-yellow-200">
              Este juego esta inactivo, por eso no aparecera en la tienda publica.
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}

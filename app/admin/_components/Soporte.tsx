"use client";

// Consultas enviadas desde la sección Soporte de la tienda. No tienen orden
// detrás — es gente que todavía no compra — así que se responden por el
// contacto que dejaron y se marcan como atendidas.
import { useMemo, useState } from "react";
import { Check, Inbox, Loader2, Mail, MessageCircle, RefreshCw, Trash2, Undo2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { SupportRequest } from "../_types";
import { fmtDate, fmtTime } from "../_helpers";

type Props = {
  requests: SupportRequest[];
  loading: boolean;
  setLoading: (v: boolean) => void;
  showNotice: (type: "success" | "error" | "info", text: string, playSound?: boolean) => void;
  onReload: () => Promise<void>;
};

// El contacto es texto libre: puede ser un teléfono o un correo. Si tiene 8 o
// más dígitos lo tratamos como WhatsApp chileno; si trae @, como correo.
function contactLink(contact: string, name: string) {
  const digits = contact.replace(/\D/g, "");
  if (contact.includes("@")) {
    return {
      href: `mailto:${contact.trim()}?subject=${encodeURIComponent("Tu consulta en Alfeicon Games")}`,
      label: "Responder por correo",
      Icon: Mail,
    };
  }
  if (digits.length >= 8) {
    // Sin código de país se asume Chile (56), que es de dónde son los clientes.
    const phone = digits.length <= 9 ? `56${digits}` : digits;
    const saludo = `Hola ${name.split(" ")[0]}! Te escribo de Alfeicon Games por tu consulta.`;
    return {
      href: `https://wa.me/${phone}?text=${encodeURIComponent(saludo)}`,
      label: "Responder por WhatsApp",
      Icon: MessageCircle,
    };
  }
  return null;
}

export function Soporte({ requests, loading, setLoading, showNotice, onReload }: Props) {
  const [tab, setTab] = useState<"nuevas" | "atendidas">("nuevas");

  const nuevas = useMemo(() => requests.filter(r => r.status === "nueva"), [requests]);
  const atendidas = useMemo(() => requests.filter(r => r.status === "atendida"), [requests]);
  const visibles = tab === "nuevas" ? nuevas : atendidas;

  const setStatus = async (r: SupportRequest, status: SupportRequest["status"]) => {
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.from("support_requests").update({ status }).eq("id", r.id);
    setLoading(false);
    if (error) { showNotice("error", `No se pudo actualizar: ${error.message}`); return; }
    showNotice("success", status === "atendida" ? "Consulta marcada como atendida" : "Consulta reabierta");
    await onReload();
  };

  const eliminar = async (r: SupportRequest) => {
    if (!supabase) return;
    if (!confirm(`¿Eliminar la consulta de ${r.name}? No se puede deshacer.`)) return;
    setLoading(true);
    const { error } = await supabase.from("support_requests").delete().eq("id", r.id);
    setLoading(false);
    if (error) { showNotice("error", `No se pudo eliminar: ${error.message}`); return; }
    showNotice("success", "Consulta eliminada");
    await onReload();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden pt-14 md:pt-0">
      <div className="flex shrink-0 flex-col border-b border-white/[0.06]">
        <div className="flex items-center gap-4 px-6 py-4">
          <div className="flex-1">
            <h1 className="text-base font-black uppercase tracking-[0.15em] text-white">Soporte</h1>
            <p className="mt-0.5 text-[10px] text-gray-600">
              {requests.length} {requests.length === 1 ? "consulta" : "consultas"} desde la tienda
            </p>
          </div>
          <button onClick={onReload} disabled={loading}
            className="rounded-full bg-white/5 p-2 text-white hover:bg-white/10 active:scale-95 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="flex gap-1.5 px-4 pb-3">
          <button onClick={() => setTab("nuevas")}
            className={`flex-1 rounded-lg py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
              tab === "nuevas" ? "border border-yellow-500/20 bg-yellow-500/10 text-yellow-400" : "border border-transparent text-gray-500 hover:bg-white/5"
            }`}>
            <span className="flex items-center justify-center gap-1.5">
              Nuevas {nuevas.length > 0 && <span className="rounded-full bg-yellow-500 px-1.5 py-0.5 text-[8px] text-black">{nuevas.length}</span>}
            </span>
          </button>
          <button onClick={() => setTab("atendidas")}
            className={`flex-1 rounded-lg py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
              tab === "atendidas" ? "border border-slate-400/20 bg-slate-400/10 text-slate-300" : "border border-transparent text-gray-500 hover:bg-white/5"
            }`}>
            <span className="flex items-center justify-center gap-1.5">
              Atendidas {atendidas.length > 0 && <span className="rounded-full bg-slate-400 px-1.5 py-0.5 text-[8px] text-black">{atendidas.length}</span>}
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-32 md:pb-6">
        {visibles.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <Inbox size={24} className="text-gray-800" />
            <p className="text-xs text-gray-700">
              {tab === "nuevas" ? "Sin consultas pendientes" : "Todavía no hay consultas atendidas"}
            </p>
            <p className="max-w-[240px] text-[10px] text-gray-600">
              Aquí llegan los mensajes del formulario de la sección Soporte de la tienda.
            </p>
          </div>
        ) : (
          <div className="mx-auto grid max-w-[1200px] gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibles.map(r => {
              const link = contactLink(r.contact, r.name);
              return (
                <div key={r.id} className="flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <div className="mb-2 flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-black text-white">{r.name}</p>
                      <p className="truncate text-[11px] text-gray-500">{r.contact}</p>
                    </div>
                    <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-gray-700">
                      {fmtTime(r.created_at)} · {fmtDate(r.created_at)}
                    </span>
                  </div>

                  <p className="mb-3 flex-1 whitespace-pre-wrap break-words rounded-xl bg-black/30 p-3 text-[12.5px] leading-relaxed text-gray-300">
                    {r.message}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {link && (
                      <a href={link.href} target="_blank" rel="noreferrer"
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-green-500/15 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-green-400 hover:bg-green-500/25">
                        <link.Icon size={12} /> {link.label}
                      </a>
                    )}

                    {r.status === "nueva" ? (
                      <button type="button" onClick={() => setStatus(r, "atendida")} disabled={loading}
                        className="flex items-center justify-center gap-1.5 rounded-full border border-white/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-50">
                        {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={3} />} Atendida
                      </button>
                    ) : (
                      <button type="button" onClick={() => setStatus(r, "nueva")} disabled={loading}
                        className="flex items-center justify-center gap-1.5 rounded-full border border-white/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-50">
                        <Undo2 size={12} /> Reabrir
                      </button>
                    )}

                    <button type="button" onClick={() => eliminar(r)} disabled={loading}
                      className="flex items-center justify-center rounded-full border border-red-500/15 px-2.5 py-2 text-red-500/60 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

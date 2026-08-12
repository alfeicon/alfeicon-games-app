"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Clock3, History, Search } from "lucide-react";
import type { ActivityLog } from "../_types";
import { fmt, fmtTime } from "../_helpers";

type Props = {
  logs: ActivityLog[];
  tableExists: boolean | null;
  error: string | null;
};

const labelForTable = (table: string) => {
  if (table === "games") return "Juego";
  if (table === "packs") return "Pack";
  if (table === "orders") return "Orden";
  if (table === "order_items") return "Item orden";
  if (table === "app_settings") return "Ajuste";
  return table;
};

const labelForField = (field: string) => {
  const labels: Record<string, string> = {
    price: "Precio",
    offer_price: "Precio oferta",
    is_offer: "Oferta activa",
    is_active: "Visible",
    cost_price: "Costo",
    eshop_price: "eShop",
    title: "Titulo",
    value: "Valor",
    value_text: "Texto",
    sale_price: "Venta",
    payment_status: "Estado pago",
    payment_method: "Metodo",
    status: "Estado",
    short_code: "Codigo",
    game_name: "Compra",
    discount_code: "Descuento",
    discount_amount: "Monto desc.",
    image_url: "Imagen",
    console: "Consola",
  };
  return labels[field] ?? field;
};

const formatValue = (field: string, value: unknown) => {
  if (["account_password", "account_email", "console_code", "client_email", "client_name", "receipt_url", "mp_payment_id"].includes(field)) {
    return "oculto";
  }
  if (value == null || value === "") return "vacio";
  if (typeof value === "boolean") return value ? "Si" : "No";
  if (["price", "offer_price", "cost_price", "eshop_price", "value", "sale_price", "discount_amount"].includes(field) && typeof value === "number") {
    return `$${fmt(value)}`;
  }
  return String(value);
};

const importantFields = [
  "price", "offer_price", "is_offer", "is_active", "cost_price", "eshop_price",
  "sale_price", "payment_status", "payment_method", "status", "discount_code", "discount_amount",
  "value", "value_text",
];

export function Historial({ logs, tableExists, error }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "prices" | "offers" | "visibility" | "settings">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter(log => {
      if (filter === "prices" && !log.changed_fields.some(f => ["price", "offer_price", "cost_price", "eshop_price", "sale_price", "discount_amount"].includes(f))) return false;
      if (filter === "offers" && !log.changed_fields.some(f => ["is_offer", "offer_price"].includes(f))) return false;
      if (filter === "visibility" && !log.changed_fields.includes("is_active")) return false;
      if (filter === "settings" && log.entity_table !== "app_settings") return false;
      if (!q) return true;
      return [
        log.entity_title,
        log.reason,
        log.entity_table,
        log.changed_fields.join(" "),
      ].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [filter, logs, query]);

  if (tableExists === false) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertCircle size={28} className="text-yellow-400" />
        <div>
          <h1 className="text-sm font-black uppercase tracking-widest text-white">Falta activar el historial</h1>
          <p className="mt-2 max-w-md text-xs leading-relaxed text-gray-500">
            Ejecuta <span className="font-mono text-gray-300">supabase/activity-log.sql</span> en Supabase SQL Editor para registrar cambios de precios, ofertas, visibilidad y ajustes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden pt-4 md:pt-0">
      <div className="shrink-0 border-b border-white/5 px-6 py-4">
        <div className="flex items-center gap-3">
          <History size={18} className="text-cyan-400" />
          <div>
            <h1 className="text-lg font-black uppercase tracking-widest text-cyan-400">Historial</h1>
            <p className="mt-0.5 text-xs font-bold text-gray-500">{logs.length} cambios registrados</p>
          </div>
        </div>
        {error && (
          <p className="mt-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs font-bold text-yellow-200">
            {error}
          </p>
        )}
      </div>

      <div className="shrink-0 space-y-3 border-b border-white/[0.05] px-4 py-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar juego, pack o motivo..."
            className="w-full rounded-xl border border-white/8 bg-white/4 py-2 pl-8 pr-3 text-sm text-white outline-none transition-all focus:border-cyan-500/30 focus:bg-white/6 placeholder:text-gray-700" />
        </div>
        <div className="flex flex-wrap gap-1">
          {([
            ["all", "Todos"],
            ["prices", "Montos"],
            ["offers", "Ofertas"],
            ["visibility", "Visibilidad"],
            ["settings", "Ajustes"],
          ] as const).map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)}
              className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all ${
                filter === id ? "bg-cyan-400/15 text-cyan-200" : "text-gray-700 hover:text-gray-500"
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-28 pt-4">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-xs font-bold text-gray-600">Sin cambios para este filtro.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(log => {
              const fields = log.changed_fields.filter(f => importantFields.includes(f));
              const visibleFields = fields.length > 0 ? fields : log.changed_fields.slice(0, 4);
              return (
                <article key={log.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-cyan-200">
                          {labelForTable(log.entity_table)}
                        </span>
                        <span className="rounded-full bg-white/7 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-gray-400">
                          {log.action}
                        </span>
                      </div>
                      <h2 className="mt-2 truncate text-sm font-black text-white">{log.entity_title || "Sin nombre"}</h2>
                      <p className="mt-1 text-xs font-bold text-gray-500">{log.reason || "Cambio registrado"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-bold text-gray-600">
                      <Clock3 size={12} />
                      {fmtTime(log.created_at)}
                    </div>
                  </div>

                  {visibleFields.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {visibleFields.map(field => (
                        <div key={field} className="rounded-xl bg-black/25 px-3 py-2">
                          <p className="text-[8px] font-black uppercase tracking-widest text-gray-600">{labelForField(field)}</p>
                          <p className="mt-1 text-xs font-bold text-gray-300">
                            <span className="text-red-300/80">{formatValue(field, log.old_values?.[field])}</span>
                            <span className="px-1.5 text-gray-700">→</span>
                            <span className="text-green-300">{formatValue(field, log.new_values?.[field])}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

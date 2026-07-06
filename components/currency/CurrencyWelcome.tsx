"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CreditCard, X } from "lucide-react";
import { useCurrency } from "./CurrencyProvider";
import { useScrollLock } from "@/lib/useScrollLock";
import {
  hasSeenCurrencyPrompt,
  markCurrencyPromptSeen,
  type CurrencyCode,
} from "@/lib/currency";

/**
 * Prompt de bienvenida que se muestra UNA sola vez al visitante nuevo para que
 * elija su país/moneda. El pill de la barra superior sigue disponible siempre
 * para cambiarla después.
 */
export default function CurrencyWelcome() {
  const { currencies, feeUsd, setCurrency, code } = useCurrency();
  const [open, setOpen] = useState(false);

  useScrollLock(open);

  const dismiss = useCallback(() => {
    markCurrencyPromptSeen();
    setOpen(false);
  }, []);

  const choose = (code: CurrencyCode) => {
    setCurrency(code);
    dismiss();
  };

  // Solo en cliente y solo si nunca se ha mostrado. El setTimeout difiere el
  // setState fuera del cuerpo del efecto (evita el warning de cascading render).
  useEffect(() => {
    if (hasSeenCurrencyPrompt()) return;
    const t = window.setTimeout(() => setOpen(true), 650);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (typeof document === "undefined" || !open) return null;

  return createPortal(
    <div
      className="catalog-detail-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Elige tu país y moneda"
      onClick={dismiss}
    >
      <div className="catalog-detail-panel catalog-detail-panel--scroll" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">
              👋 Bienvenido
            </p>
            <h3 className="mt-1 text-[18px] font-black leading-tight tracking-[-0.02em] text-white">
              ¿Desde qué país compras?
            </h3>
            <p className="mt-1 text-[12px] font-semibold leading-snug text-gray-400">
              Elige tu moneda para ver los precios a tu medida.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Cerrar"
            className="motion-press ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {currencies.map((c) => {
            const suggested = c.code === code;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => choose(c.code)}
                className={`relative flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition ${
                  suggested
                    ? "border-[#25d366]/55 bg-[#25d366]/12"
                    : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
                }`}
              >
                {suggested && (
                  <span className="absolute right-2 top-2 rounded-full bg-[#25d366] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-[#06130a]">
                    Sugerido
                  </span>
                )}
                <span className="text-xl" aria-hidden>{c.flag}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-black text-white">{c.region}</span>
                  <span className="block truncate text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    {c.code}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <CreditCard size={15} className="mt-0.5 shrink-0 text-[#a9bac5]" />
          <p className="text-[11px] font-semibold leading-relaxed text-[#d5dde1]">
            Fuera de Chile sumamos <b>+US${feeUsd}</b> por costos de cambio y transferencia. Pagas por
            transferencia internacional o tarjeta de crédito.
          </p>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="motion-press mt-3 w-full rounded-full border border-white/10 bg-white/[0.06] py-2.5 text-[12px] font-black uppercase tracking-wide text-gray-300"
        >
          Ahora no
        </button>
      </div>
    </div>,
    document.body,
  );
}

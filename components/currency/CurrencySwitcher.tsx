"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, CreditCard, Globe, X } from "lucide-react";
import { useCurrency } from "./CurrencyProvider";
import { useScrollLock } from "@/lib/useScrollLock";
import type { CurrencyCode } from "@/lib/currency";

export default function CurrencySwitcher() {
  const { currency, code, currencies, isBase, feeUsd, setCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useScrollLock(open);

  // Portal solo tras montar en cliente para evitar mismatch de hidratación.
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const choose = (next: CurrencyCode) => {
    setCurrency(next);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cur-pill"
        aria-label={`Moneda: ${currency.label}. Cambiar`}
      >
        <span key={code} className="cur-pill__val">
          <span className="cur-pill__flag" aria-hidden>{currency.flag}</span>
          <span className="cur-pill__code">{code}</span>
        </span>
        <Globe size={12} strokeWidth={2} className="opacity-70" />
      </button>

      {mounted && open &&
        createPortal(
          <div
            className="catalog-detail-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Seleccionar moneda"
            onClick={() => setOpen(false)}
          >
            <div className="catalog-detail-panel catalog-detail-panel--scroll" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black">
                    <Globe size={15} />
                  </span>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">
                    Elige tu moneda
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="motion-press flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-1.5">
                {currencies.map((c) => {
                  const active = c.code === code;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => choose(c.code)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                        active
                          ? "border-[#25d366]/50 bg-[#25d366]/10"
                          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
                      }`}
                    >
                      <span className="text-xl" aria-hidden>{c.flag}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black text-white">{c.label}</span>
                        <span className="block truncate text-[11px] font-semibold text-gray-400">
                          {c.region} · {c.code}
                          {!c.isBase && ` · +US$${feeUsd}`}
                        </span>
                      </span>
                      {active && <Check size={17} strokeWidth={3} className="text-[#25d366]" />}
                    </button>
                  );
                })}
              </div>

              {!isBase && (
                <div className="mt-3 flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <CreditCard size={15} className="mt-0.5 shrink-0 text-[#a9bac5]" />
                  <p className="text-[11px] font-semibold leading-relaxed text-[#d5dde1]">
                    Los precios internacionales incluyen <b>+US${feeUsd}</b> por costos de cambio y
                    transferencia. Pagas por transferencia internacional o tarjeta de crédito.
                  </p>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

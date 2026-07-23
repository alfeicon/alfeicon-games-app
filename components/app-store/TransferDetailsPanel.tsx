"use client";

// Panel de datos de transferencia dentro del modal de pago. El cliente copia
// los datos (uno por uno o "copiar todo" para que el banco autocomplete al
// pegar) y coordina el resto por la página. Instagram queda solo para casos
// especiales / pagos del extranjero.
// NOTA: los datos de la cuenta viven aquí por ahora; se pueden mover a los
// ajustes del admin (app_settings) más adelante para editarlos sin tocar código.
import { useState, useEffect } from "react";
import { ArrowLeft, Copy, Check, Instagram, Landmark, ChevronDown, ChevronUp } from "lucide-react";

const CUENTA = {
  titular: "Alfeicon Games",
  rut: "21.286.678-4",
  banco: "Mercado Pago",
  tipo: "Cuenta Vista",
  numero: "1034527460",
  email: "alfeicon.games@gmail.com",
};

type Props = {
  code: string;
  totalLabel: string;
  onBack?: () => void;
  isCollapsed?: boolean;
};

export default function TransferDetailsPanel({ code, totalLabel, onBack, isCollapsed }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [localCollapsed, setLocalCollapsed] = useState<boolean | null>(null);

  useEffect(() => {
    setLocalCollapsed(null);
  }, [isCollapsed]);

  const actualCollapsed = localCollapsed !== null ? localCollapsed : !!isCollapsed;
  const toggleCollapse = () => setLocalCollapsed(!actualCollapsed);

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard bloqueado: no hacemos nada */
    }
  };

  const rows = [
    { key: "titular", label: "Nombre", value: CUENTA.titular },
    { key: "rut", label: "RUT", value: CUENTA.rut },
    { key: "banco", label: "Banco", value: CUENTA.banco },
    { key: "tipo", label: "Tipo de cuenta", value: CUENTA.tipo },
    { key: "numero", label: "N° de cuenta", value: CUENTA.numero },
    { key: "email", label: "Email", value: CUENTA.email },
  ];

  const bloque = rows.map((r) => `${r.label}: ${r.value}`).join("\n");

  const contactoUrl = "https://ig.me/m/alfeicon_games";

  return (
    <div>
      {onBack && (
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={onBack} className="motion-press flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-gray-400 active:text-white">
            <ArrowLeft size={14} /> Volver
          </button>
        </div>
      )}

      <div className="mb-2 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-black">
          <Landmark size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-gray-400 flex items-center gap-1.5">
            Datos Chilenos <span className="text-sm leading-none">🇨🇱</span>
          </p>
          <p className="text-lg font-black leading-tight text-white">{totalLabel}</p>
        </div>
        <button onClick={toggleCollapse} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-gray-400 transition-colors active:bg-white/10 active:text-white">
          {actualCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>

      {!actualCollapsed && (
        <>
          <button
            type="button"
            onClick={() => copy("all", bloque)}
            className="motion-press mb-2 flex w-full items-center justify-center gap-2 rounded-full bg-white py-2 text-xs font-black uppercase tracking-wide text-black"
          >
            {copied === "all" ? (
              <><Check size={15} strokeWidth={3} /> ¡Copiado!</>
            ) : (
              <><Copy size={15} strokeWidth={2.6} /> Copiar todos los datos</>
            )}
          </button>

          <div className="overflow-hidden rounded-2xl border border-white/10">
            {rows.map((r, i) => (
              <button
                key={r.key}
                type="button"
                onClick={() => copy(r.key, r.value)}
                aria-label={`Copiar ${r.label}`}
                className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left transition-colors active:bg-white/5 ${i > 0 ? "border-t border-white/10" : ""}`}
              >
                <span className="min-w-0">
                  <span className="block text-[8.5px] font-black uppercase tracking-widest text-gray-500">{r.label}</span>
                  <span className="block truncate text-[13px] font-bold text-white">{r.value}</span>
                </span>
                <span className="shrink-0">
                  {copied === r.key ? <Check size={15} strokeWidth={3} className="text-[#22c55e]" /> : <Copy size={15} className="text-gray-400" />}
                </span>
              </button>
            ))}
          </div>

          <a
            href={contactoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="motion-press mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-white/10 px-2 py-2 text-[10px] font-black uppercase tracking-wide text-gray-400 active:text-white"
          >
            <Instagram size={14} className="shrink-0" />
            <span className="truncate">¿Eres de otro país? Pago internacional</span>
          </a>
        </>
      )}
    </div>
  );
}

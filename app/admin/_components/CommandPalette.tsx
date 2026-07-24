"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";

export type Command = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  /** Clase de color de Tailwind para el icono (p. ej. "text-blue-400"). */
  accent?: string;
  Icon: React.ElementType;
  run: () => void;
};

type Props = {
  commands: Command[];
  onClose: () => void;
};

/**
 * Paleta de comandos del panel (⌘K / Ctrl+K, o "/" fuera de un input).
 * Filtra por etiqueta y por descripción, se maneja con flechas + Enter y
 * cierra sola al ejecutar. Es el atajo rápido para saltar entre secciones
 * sin depender del sidebar ni del menú de móvil.
 */
export function CommandPalette({ commands, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      (c.hint || "").toLowerCase().includes(q) ||
      c.group.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Mantiene visible la fila seleccionada al navegar con el teclado.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(c => (results.length ? (c + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(c => (results.length ? (c - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = results[cursor];
      if (cmd) { cmd.run(); onClose(); }
    }
  };

  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]">
      <div className="admin-backdrop absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <div className="admin-palette relative w-full max-w-lg overflow-hidden rounded-2xl" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
          <Search size={15} className="shrink-0 text-gray-500" />
          <input
            ref={inputRef}
            value={query}
            // El cursor vuelve al primer resultado con cada tecla; si no,
            // Enter podría disparar un comando que ya se filtró fuera.
            onChange={e => { setQuery(e.target.value); setCursor(0); }}
            placeholder="Buscar sección o acción…"
            className="w-full bg-transparent py-4 text-sm outline-none placeholder:text-gray-600"
          />
          <kbd className="hidden shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-black text-gray-500 sm:block">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs font-bold text-gray-600">Sin coincidencias.</p>
          ) : results.map((cmd, i) => {
            const showGroup = cmd.group !== lastGroup;
            lastGroup = cmd.group;
            const active = i === cursor;
            return (
              <div key={cmd.id}>
                {showGroup && (
                  <p className="px-3 pb-1 pt-3 text-[9px] font-black uppercase tracking-widest text-gray-600 first:pt-1">{cmd.group}</p>
                )}
                <button
                  data-active={active}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => { cmd.run(); onClose(); }}
                  className="admin-palette-row flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                >
                  <cmd.Icon size={15} className={`shrink-0 ${cmd.accent || "text-gray-400"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-white">{cmd.label}</span>
                    {cmd.hint && <span className="block truncate text-[10.5px] text-gray-500">{cmd.hint}</span>}
                  </span>
                  {active && <CornerDownLeft size={12} className="shrink-0 text-gray-500" />}
                </button>
              </div>
            );
          })}
        </div>

        <div className="hidden items-center gap-4 border-t border-white/[0.07] px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest text-gray-600 sm:flex">
          <span>↑↓ Navegar</span>
          <span>↵ Abrir</span>
          <span className="ml-auto">Alt + 1…9 Salto directo</span>
        </div>
      </div>
    </div>
  );
}

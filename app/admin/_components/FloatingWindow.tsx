"use client";

// Ventana flotante para el panel de una orden: se arrastra desde su barra de
// título, se redimensiona desde la esquina y se puede minimizar a la barra de
// abajo. Pensada para escritorio — así se puede tener el chat abierto al lado
// de los datos en vez de ir cambiando de pestaña.
import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Minus, Lock, Unlock, ChevronsUpDown } from "lucide-react";

export type WinId = "orden" | "pago" | "chat" | "finanzas" | "boleta";

export type WinState = {
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  minimized: boolean;
  locked: boolean;
  /** Qué sección se está mostrando en esta ventana (se puede intercambiar). */
  section: WinId;
};

type Props = {
  title: string;
  Icon: React.ElementType;
  state: WinState;
  onChange: (patch: Partial<WinState>) => void;
  onFocus: () => void;
  /** Secciones a las que se puede cambiar esta ventana. */
  options: { id: WinId; label: string }[];
  onSwap: (section: WinId) => void;
  /** El contenido ocupa toda la ventana sin padding ni scroll propio (chat). */
  fill?: boolean;
  /** Tamaño del área donde flotan las ventanas. */
  bounds: { w: number; h: number };
  /** Rectángulos de las demás ventanas visibles, para chocar con ellas. */
  others: Rect[];
  children: ReactNode;
};

export type Rect = { x: number; y: number; w: number; h: number };

const GAP = 6; // separación al quedar pegadas

// Empuja el rectángulo fuera de cada obstáculo por el lado de menor
// penetración: así una ventana "topa" con otra en vez de encimarse.
function resolveCollisions(r: Rect, others: Rect[], bounds: { w: number; h: number }): Rect {
  let { x, y } = r;
  for (const o of others) {
    const overlapX = Math.min(x + r.w, o.x + o.w) - Math.max(x, o.x);
    const overlapY = Math.min(y + r.h, o.y + o.h) - Math.max(y, o.y);
    if (overlapX <= 0 || overlapY <= 0) continue; // no se tocan

    if (overlapX < overlapY) {
      // Sale por el lado horizontal más cercano.
      x = x + r.w / 2 < o.x + o.w / 2 ? o.x - r.w - GAP : o.x + o.w + GAP;
    } else {
      y = y + r.h / 2 < o.y + o.h / 2 ? o.y - r.h - GAP : o.y + o.h + GAP;
    }
  }
  // El empujón no puede sacarla del área visible.
  return {
    ...r,
    x: Math.max(0, Math.min(x, bounds.w - r.w)),
    y: Math.max(0, Math.min(y, bounds.h - r.h)),
  };
}

export function FloatingWindow({ title, Icon, state, onChange, onFocus, options, onSwap, fill, bounds, others, children }: Props) {
  // El arrastre se lleva en un ref para no re-renderizar en cada pixel; el
  // estado solo se actualiza con la posición ya calculada.
  const drag = useRef<{ mode: "move" | "resize"; dx: number; dy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const start = (mode: "move" | "resize") => (e: ReactPointerEvent<HTMLElement>) => {
    // Bloqueada: se puede leer y usar, pero no mover ni redimensionar.
    if (state.locked) return;
    e.preventDefault();
    onFocus();
    drag.current = {
      mode,
      dx: mode === "move" ? e.clientX - state.x : e.clientX - state.w,
      dy: mode === "move" ? e.clientY - state.y : e.clientY - state.h,
    };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const move = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === "move") {
      // Se limita al área visible y luego se resuelve el choque con las demás.
      const raw = {
        x: Math.max(0, Math.min(e.clientX - d.dx, bounds.w - state.w)),
        y: Math.max(0, Math.min(e.clientY - d.dy, bounds.h - state.h)),
        w: state.w,
        h: state.h,
      };
      const solved = resolveCollisions(raw, others, bounds);
      onChange({ x: solved.x, y: solved.y });
    } else {
      // Al agrandar, tampoco se pasa por encima de la ventana de al lado.
      let w = Math.max(280, Math.min(e.clientX - d.dx, bounds.w - state.x));
      let h = Math.max(160, Math.min(e.clientY - d.dy, bounds.h - state.y));
      for (const o of others) {
        const hitsY = state.y < o.y + o.h && state.y + h > o.y;
        const hitsX = state.x < o.x + o.w && state.x + w > o.x;
        if (hitsY && hitsX) {
          if (state.x + state.w <= o.x + GAP) w = Math.min(w, o.x - state.x - GAP);
          else if (state.y + state.h <= o.y + GAP) h = Math.min(h, o.y - state.y - GAP);
        }
      }
      onChange({ w: Math.max(280, w), h: Math.max(160, h) });
    }
  };

  const end = (e: ReactPointerEvent<HTMLElement>) => {
    drag.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  if (state.minimized) return null;

  return (
    <div
      onPointerDown={onFocus}
      className="absolute flex flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/60"
      style={{
        left: state.x,
        top: state.y,
        width: state.w,
        height: state.h,
        zIndex: state.z,
        background: "rgb(12,12,14)",
      }}
    >
      <header
        onPointerDown={start("move")}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className={`flex shrink-0 items-center gap-2 border-b border-white/[0.07] bg-white/[0.03] px-3 py-2 ${
          state.locked ? "cursor-default" : dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <Icon size={12} className="shrink-0 text-yellow-500" />

        <p className="flex-1 truncate text-[10px] font-black uppercase tracking-widest text-gray-400">{title}</p>

        {/* Cambiar de sección: el <select> va invisible encima del icono, así
            ocupa solo 20px pero mantiene el desplegable nativo. */}
        <span className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-gray-600 hover:bg-white/10 hover:text-white">
          <ChevronsUpDown size={11} />
          <select
            value={state.section}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => onSwap(e.target.value as WinId)}
            title="Cambiar el contenido de esta ventana"
            aria-label="Cambiar el contenido de esta ventana"
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {options.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </span>

        <button
          type="button"
          title={state.locked ? "Desbloquear ventana" : "Bloquear ventana (fija su posición)"}
          aria-label={state.locked ? `Desbloquear ${title}` : `Bloquear ${title}`}
          aria-pressed={state.locked}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onChange({ locked: !state.locked })}
          className={`flex h-5 w-5 items-center justify-center rounded-md hover:bg-white/10 ${
            state.locked ? "text-yellow-500" : "text-gray-600 hover:text-white"
          }`}
        >
          {state.locked ? <Lock size={11} /> : <Unlock size={11} />}
        </button>

        <button
          type="button"
          title="Minimizar"
          aria-label={`Minimizar ${title}`}
          // onPointerDown se detiene para que minimizar no inicie un arrastre.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onChange({ minimized: true })}
          className="flex h-5 w-5 items-center justify-center rounded-md text-gray-600 hover:bg-white/10 hover:text-white"
        >
          <Minus size={12} />
        </button>
      </header>

      <div className={fill ? "flex min-h-0 flex-1 flex-col" : "flex-1 overflow-y-auto p-3"}>{children}</div>

      {/* Esquina para redimensionar (oculta si la ventana está bloqueada) */}
      {!state.locked && (
      <span
        onPointerDown={start("resize")}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
        style={{
          background:
            "linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.18) 100%)",
        }}
      />
      )}
    </div>
  );
}

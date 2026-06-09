"use client";

import Image from 'next/image';
import { useState, type MouseEvent } from 'react';
import { Tag, Gift, ChevronDown, ChevronUp, Zap, HardDrive, Gamepad2, Heart, ArrowUpRight } from 'lucide-react'; 

// 1. Definimos los tipos para que TypeScript no se queje en page.tsx
interface GameCardProps {
  titulo: string;
  precio: number;
  precioOriginal?: number | null;
  img: string | null;
  ahorro?: string | null;     // Aquí viene "OFERTA 🔥" o "¡NUEVO! 🚀"
  esPack?: boolean;
  storageRequired?: string | null;
  consoleName?: string | null;
  juegosIncluidos?: string[]; // Lista de juegos para el desplegable
  onAdd: (event: MouseEvent<HTMLButtonElement>) => void;
  onSave?: () => void;
  saved?: boolean;
}

export default function GameCard({ 
  titulo, 
  precio, 
  precioOriginal, 
  img, 
  ahorro, 
  esPack, 
  storageRequired,
  consoleName,
  juegosIncluidos, 
  onAdd,
  onSave,
  saved = false,
}: GameCardProps) {
  
  const [expandido, setExpandido] = useState(false);

  // Función para formatear precio CL (Puntos en vez de comas)
  const formatoCLP = (valor: number) => {
    return valor.toLocaleString('es-CL');
  };

  // Detectamos si es una etiqueta de novedad para cambiarle el color
  const esNuevo = ahorro && ahorro.includes('NUEVO');
  const cleanBadge = ahorro?.replace(/[🔥🚀]/g, '').replace(/[¡!]/g, '').trim();
  const isSwitch2Only = (consoleName || '').toLowerCase().replace(/\s+/g, '').includes('switch2');
  const consoleLabel = consoleName ? (isSwitch2Only ? 'Solo Switch 2' : 'Switch 1 y 2') : null;
  const hasMeta = Boolean(storageRequired) || Boolean(consoleLabel);

  return (
    <article className="animate-soft-in liquid-glass group relative mx-auto flex h-full w-full max-w-[350px] flex-col rounded-[1.55rem] p-1.5 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:shadow-[0_32px_78px_rgba(83,104,120,0.22)]">
      
      {/* 1. SECCIÓN DE IMAGEN */}
      <div className="relative h-[236px] w-full shrink-0 overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#101417]/80 shadow-inner shadow-white/5">
        {img ? (
          <>
            <Image
              src={img}
              alt=""
              fill
              aria-hidden="true"
              className="scale-110 object-cover opacity-[0.42] blur-xl"
              sizes="(max-width: 768px) 100vw, 350px"
            />
            <Image 
              src={img} 
              alt={titulo} 
              fill 
              className="object-contain transition duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.025] group-hover:brightness-110"
              sizes="(max-width: 768px) 100vw, 350px"
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-700 font-bold text-xs uppercase tracking-widest">
            Sin Imagen
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_45%,rgba(0,0,0,0.58)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/10 to-transparent" />

        {/* Badge Izquierdo (Tipo de Producto) */}
        <div className={`absolute left-3 top-3 flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide shadow-lg backdrop-blur-xl ${esPack ? 'border-[#536878]/45 bg-[#536878]/85 text-[#e5e4e2]' : 'border-white/10 bg-black/62 text-white'}`}>
            {esPack ? <Gift size={10} /> : <Tag size={10} className="text-gray-400" />}
            {esPack ? 'Pack' : 'Digital'}
        </div>

        {/* Badge Derecho (Ofertas / Nuevo) - MEJORADO */}
        {ahorro && (
            <div className={`absolute right-3 top-3 z-10 rounded-full border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide shadow-lg backdrop-blur-xl
                ${esNuevo 
                    ? 'border-[#e5e4e2]/40 bg-[#e5e4e2] text-[#0a0a0a] shadow-[#e5e4e2]/15'
                    : 'border-red-300/25 bg-red-500/90 text-white shadow-red-600/20'
                }`}>
                {cleanBadge}
            </div>
        )}

        {onSave && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSave();
            }}
            aria-label={saved ? "Favorito" : "Agregar a favoritos"}
            className={`magnetic absolute right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-xl ${
              ahorro ? "bottom-3" : "top-3"
            } ${
              saved
                ? "border-[#e5e4e2]/70 bg-[#e5e4e2] text-[#0a0a0a] shadow-lg shadow-[#e5e4e2]/10"
                : "border-white/10 bg-black/55 text-white hover:bg-white/15"
            }`}
          >
            <Heart size={18} fill={saved ? "currentColor" : "none"} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* 2. SECCIÓN DE INFORMACIÓN */}
      <div className="relative z-10 flex flex-1 flex-col px-3 pb-3 pt-4">
        
        <div className="mb-4">
            <h3 className="mb-2 min-h-[42px] text-[17px] font-black leading-tight tracking-[-0.01em] text-white line-clamp-2">
              {titulo}
            </h3>
            
            {/* LÓGICA DE LISTA EXPANDIBLE (Solo si es pack y tiene juegos) */}
            {esPack && juegosIncluidos && juegosIncluidos.length > 0 ? (
                <div className="pack-list-glass rounded-[1rem] p-3 transition-all duration-500">
                    <p className="mb-2 border-b border-white/10 pb-2 text-[10px] font-black uppercase tracking-wider text-[#d5dde1]">
                        Contiene {juegosIncluidos.length} Juegos:
                    </p>
                    <ul className="space-y-1.5 text-[12px] font-semibold leading-relaxed text-[#e5e4e2]">
                        {/* Muestra todos si está expandido, o solo los primeros 4 */}
                        {(expandido ? juegosIncluidos : juegosIncluidos.slice(0, 4)).map((juego: string, i: number) => (
                             <li key={i} className="flex items-start gap-1.5">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#9fb3c0]" /> 
                                <span className={`${expandido ? "" : "line-clamp-1"} break-words`}>{juego}</span>
                             </li>
                        ))}
                    </ul>
                    {/* Botón Ver más solo si hay más de 4 juegos */}
                    {juegosIncluidos.length > 4 && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation(); // Evita que se active el hover del padre
                                setExpandido(!expandido);
                            }}
                            className="magnetic mt-3 flex w-full items-center justify-center gap-1 border-t border-white/10 pt-2.5 text-[10px] font-black uppercase tracking-wide text-[#d5dde1] hover:text-white"
                        >
                            {expandido ? <>Ver menos <ChevronUp size={12} /></> : <>+ {juegosIncluidos.length - 4} juegos más <ChevronDown size={12} /></>}
                        </button>
                    )}
                </div>
            ) : (
                <div className="mt-2 space-y-3">
                    <p className="text-[11px] font-semibold text-gray-500">Licencia oficial Nintendo</p>

                    {hasMeta && (
                        <div className="flex flex-wrap gap-2">
                            {consoleLabel && (
                                <span className="brand-chip animate-soft-in px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#a9bac5]">
                                    <Gamepad2 size={12} /> {consoleLabel}
                                </span>
                            )}
                            {storageRequired && (
                                <span className="brand-chip animate-soft-in px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-gray-400">
                                    <HardDrive size={12} /> {storageRequired}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
        
        {/* PRECIO Y BOTÓN */}
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-white/5 pt-4">
            <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Precio</span>
                
                {/* LÓGICA DE PRECIO TACHADO */}
                <div className="flex flex-col">
                    {precioOriginal && precioOriginal > precio && (
                         <span className="text-[10px] text-gray-500 line-through decoration-red-500 decoration-2 font-medium">
                            ${formatoCLP(precioOriginal)}
                         </span>
                    )}
                    <div className="flex items-baseline gap-1">
                        <span className="text-[24px] font-black leading-none tracking-[-0.04em] text-white">
                            ${formatoCLP(precio)}
                        </span>
                        <span className="text-[10px] text-gray-400">CLP</span>
                    </div>
                </div>
            </div>

            {/* BOTÓN UNIFICADO */}
            <button 
                onClick={onAdd}
                className="magnetic group/cta flex h-11 items-center gap-2 rounded-full bg-[#25d366] pl-4 pr-1.5 text-xs font-black uppercase tracking-wide text-[#06130a] shadow-lg shadow-[#25d366]/20 hover:bg-[#36e477]"
            >
                {esPack ? <Gift size={15} strokeWidth={2.5} /> : <Zap size={15} strokeWidth={2.5} fill="currentColor" className="opacity-55" />}
                Comprar
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#06130a]/10 transition-transform duration-500 group-hover/cta:translate-x-0.5">
                  <ArrowUpRight size={14} strokeWidth={2.6} />
                </span>
            </button>
        </div>
      </div>
    </article>
  );
}

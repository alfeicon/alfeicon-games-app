"use client";

import Image from 'next/image';
import { useState } from 'react';
import { Tag, Gift, ChevronDown, ChevronUp, Zap, HardDrive, Gamepad2 } from 'lucide-react'; 

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
  onAdd: () => void;
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
  onAdd 
}: GameCardProps) {
  
  const [expandido, setExpandido] = useState(false);

  // Función para formatear precio CL (Puntos en vez de comas)
  const formatoCLP = (valor: number) => {
    return valor.toLocaleString('es-CL');
  };

  // Detectamos si es una etiqueta de novedad para cambiarle el color
  const esNuevo = ahorro && ahorro.includes('NUEVO');
  const isSwitch2Only = !esPack && (consoleName || '').toLowerCase().replace(/\s+/g, '').includes('switch2');
  const consoleLabel = !esPack && consoleName ? (isSwitch2Only ? 'Solo Switch 2' : 'Switch 1 y 2') : null;
  const hasMeta = Boolean(storageRequired) || Boolean(consoleLabel);

  return (
    <div className="animate-soft-in group relative mx-auto flex h-full w-full max-w-[350px] flex-col overflow-hidden rounded-lg border border-[#536878]/30 bg-[#0a0a0a] shadow-[0_18px_42px_rgba(0,0,0,0.34)] transition-all duration-500 ease-out hover:-translate-y-1 hover:border-[#536878]/55 hover:bg-[#11181c] hover:shadow-[0_24px_56px_rgba(0,0,0,0.46)]">
      
      {/* 1. SECCIÓN DE IMAGEN */}
      <div className="relative h-[244px] w-full shrink-0 overflow-hidden border-b border-[#536878]/25 bg-[#101417]">
        {img ? (
          <Image 
            src={img} 
            alt={titulo} 
            fill 
            className="object-cover transition duration-700 ease-out group-hover:scale-[1.035] group-hover:brightness-110"
            sizes="(max-width: 768px) 100vw, 350px"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-700 font-bold text-xs uppercase tracking-widest">
            Sin Imagen
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_52%,rgba(0,0,0,0.42)_100%)]" />

        {/* Badge Izquierdo (Tipo de Producto) */}
        <div className={`absolute top-3 left-3 flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[10px] font-bold uppercase text-white shadow-lg backdrop-blur-xl ${esPack ? 'border-[#536878]/40 bg-[#536878]/85' : 'border-white/10 bg-black/65'}`}>
            {esPack ? <Gift size={10} /> : <Tag size={10} className="text-gray-400" />}
            {esPack ? 'Pack' : 'Digital'}
        </div>

        {/* Badge Derecho (Ofertas / Nuevo) - MEJORADO */}
        {ahorro && (
            <div className={`absolute right-3 top-3 z-10 rounded-md px-2.5 py-1.5 text-[10px] font-black uppercase shadow-lg
                ${esNuevo 
                    ? 'bg-yellow-300 text-black shadow-yellow-500/20' // Estilo para NUEVO
                    : 'bg-red-500 text-white shadow-red-600/20' // Estilo para OFERTA
                }`}>
                {ahorro}
            </div>
        )}
      </div>

      {/* 2. SECCIÓN DE INFORMACIÓN */}
      <div className="flex flex-1 flex-col p-4">
        
        <div className="mb-4">
            <h3 className="mb-2 min-h-[40px] text-[16px] font-black leading-snug text-white line-clamp-2">
              {titulo}
            </h3>
            
            {/* LÓGICA DE LISTA EXPANDIBLE (Solo si es pack y tiene juegos) */}
            {esPack && juegosIncluidos && juegosIncluidos.length > 0 ? (
                <div className="rounded-lg border border-[#536878]/30 bg-[#536878]/12 p-3 shadow-inner transition-all duration-300">
                    <p className="mb-2 border-b border-white/5 pb-1 text-[10px] font-bold uppercase text-gray-400">
                        Contiene {juegosIncluidos.length} Juegos:
                    </p>
                    <ul className="text-gray-300 text-[11px] leading-relaxed space-y-1">
                        {/* Muestra todos si está expandido, o solo los primeros 4 */}
                        {(expandido ? juegosIncluidos : juegosIncluidos.slice(0, 4)).map((juego: string, i: number) => (
                             <li key={i} className="flex items-start gap-1.5">
                                <span className="mt-0.5 shrink-0 text-[8px] text-[#8fa7b8]">●</span> 
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
                            className="mt-2 flex w-full items-center justify-center gap-1 border-t border-white/5 pt-2 text-[10px] font-bold uppercase text-[#a9bac5] transition-colors hover:text-white"
                        >
                            {expandido ? <>Ver menos <ChevronUp size={12} /></> : <>+ {juegosIncluidos.length - 4} juegos más <ChevronDown size={12} /></>}
                        </button>
                    )}
                </div>
            ) : (
                <div className="mt-2 space-y-3">
                    <p className="text-[11px] font-medium text-gray-500">Licencia Oficial Nintendo</p>

                    {hasMeta && (
                        <div className="flex flex-wrap gap-2">
                            {consoleLabel && (
                                <span className="animate-soft-in inline-flex items-center gap-1.5 rounded-full border border-[#536878]/35 bg-[#536878]/18 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#a9bac5]">
                                    <Gamepad2 size={12} /> {consoleLabel}
                                </span>
                            )}
                            {storageRequired && (
                                <span className="animate-soft-in inline-flex items-center gap-1.5 rounded-full border border-[#536878]/30 bg-[#536878]/12 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-gray-400">
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
                <span className="text-[10px] font-black uppercase text-gray-500">Precio</span>
                
                {/* LÓGICA DE PRECIO TACHADO */}
                <div className="flex flex-col">
                    {precioOriginal && precioOriginal > precio && (
                         <span className="text-[10px] text-gray-500 line-through decoration-red-500 decoration-2 font-medium">
                            ${formatoCLP(precioOriginal)}
                         </span>
                    )}
                    <div className="flex items-baseline gap-1">
                        <span className="text-[22px] font-black leading-none text-white">
                            ${formatoCLP(precio)}
                        </span>
                        <span className="text-[10px] text-gray-400">CLP</span>
                    </div>
                </div>
            </div>

            {/* BOTÓN UNIFICADO */}
            <button 
                onClick={onAdd}
                className={`flex h-11 items-center gap-2 rounded-full px-5 text-xs font-black uppercase shadow-lg transition duration-300 active:scale-95 ${
                  esPack 
                    ? "bg-[#536878] text-[#e5e4e2] shadow-[#536878]/20 hover:bg-[#627988]" 
                    : "bg-[#e5e4e2] text-[#0a0a0a] shadow-[#e5e4e2]/10 hover:bg-[#f0f0ee]"     
                }`}
            >
                {esPack ? <Gift size={16} strokeWidth={2.5} /> : <Zap size={16} strokeWidth={2.5} fill="currentColor" className="opacity-50" />}
                COMPRAR
            </button>
        </div>
      </div>
    </div>
  );
}

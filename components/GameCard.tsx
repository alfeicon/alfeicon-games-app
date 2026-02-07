"use client";

import Image from 'next/image';
import { useState } from 'react';
import { Tag, Gift, ChevronDown, ChevronUp, Zap } from 'lucide-react'; 

// 1. Definimos los tipos para que TypeScript no se queje en page.tsx
interface GameCardProps {
  titulo: string;
  precio: number;
  precioOriginal?: number | null;
  img: string | null;
  ahorro?: string | null;     // Aquí viene "OFERTA 🔥" o "¡NUEVO! 🚀"
  esPack?: boolean;
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

  return (
    <div className="group relative w-full max-w-[350px] mx-auto bg-[#111] border border-white/10 rounded-xl overflow-hidden hover:border-white/30 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] flex flex-col h-full">
      
      {/* 1. SECCIÓN DE IMAGEN */}
      <div className="relative h-[250px] w-full bg-gray-900 overflow-hidden border-b border-white/5 shrink-0">
        {img ? (
          <Image 
            src={img} 
            alt={titulo} 
            fill 
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 350px"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-700 font-bold text-xs uppercase tracking-widest">
            Sin Imagen
          </div>
        )}

        {/* Badge Izquierdo (Tipo de Producto) */}
        <div className={`absolute top-3 left-3 backdrop-blur-md border px-2 py-1 rounded text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1 ${esPack ? 'bg-blue-600/90 border-blue-400/30' : 'bg-black/80 border-white/10'}`}>
            {esPack ? <Gift size={10} /> : <Tag size={10} className="text-gray-400" />}
            {esPack ? 'Pack' : 'Digital'}
        </div>

        {/* Badge Derecho (Ofertas / Nuevo) - MEJORADO */}
        {ahorro && (
            <div className={`absolute top-3 right-3 text-[10px] font-black px-2 py-1 rounded shadow-lg tracking-wider uppercase z-10
                ${esNuevo 
                    ? 'bg-yellow-400 text-black animate-pulse shadow-yellow-500/20' // Estilo para NUEVO
                    : 'bg-red-600 text-white shadow-red-600/20' // Estilo para OFERTA
                }`}>
                {ahorro}
            </div>
        )}
      </div>

      {/* 2. SECCIÓN DE INFORMACIÓN */}
      <div className="p-4 flex flex-col flex-1">
        
        <div className="mb-4">
            <h3 className="text-white font-bold text-[15px] leading-snug mb-2 line-clamp-2 min-h-[40px]">
              {titulo}
            </h3>
            
            {/* LÓGICA DE LISTA EXPANDIBLE (Solo si es pack y tiene juegos) */}
            {esPack && juegosIncluidos && juegosIncluidos.length > 0 ? (
                <div className="bg-white/5 rounded-lg p-3 border border-white/5 transition-all duration-300">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 border-b border-white/5 pb-1">
                        Contiene {juegosIncluidos.length} Juegos:
                    </p>
                    <ul className="text-gray-300 text-[11px] leading-relaxed space-y-1">
                        {/* Muestra todos si está expandido, o solo los primeros 4 */}
                        {(expandido ? juegosIncluidos : juegosIncluidos.slice(0, 4)).map((juego: string, i: number) => (
                             <li key={i} className="flex items-start gap-1.5">
                                <span className="text-blue-500 mt-0.5 text-[8px] shrink-0">●</span> 
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
                            className="w-full mt-2 pt-2 border-t border-white/5 flex items-center justify-center gap-1 text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider"
                        >
                            {expandido ? <>Ver menos <ChevronUp size={12} /></> : <>+ {juegosIncluidos.length - 4} juegos más <ChevronDown size={12} /></>}
                        </button>
                    )}
                </div>
            ) : (
                <p className="text-gray-500 text-[11px] mt-2">Licencia Oficial Nintendo</p>
            )}
        </div>
        
        {/* PRECIO Y BOTÓN */}
        <div className="mt-auto flex items-center justify-between gap-3 pt-4 border-t border-white/5">
            <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 font-bold uppercase">Precio</span>
                
                {/* LÓGICA DE PRECIO TACHADO */}
                <div className="flex flex-col">
                    {precioOriginal && precioOriginal > precio && (
                         <span className="text-[10px] text-gray-500 line-through decoration-red-500 decoration-2 font-medium">
                            ${formatoCLP(precioOriginal)}
                         </span>
                    )}
                    <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black text-white tracking-tight">
                            ${formatoCLP(precio)}
                        </span>
                        <span className="text-[10px] text-gray-400">CLP</span>
                    </div>
                </div>
            </div>

            {/* BOTÓN UNIFICADO */}
            <button 
                onClick={onAdd}
                className={`h-10 px-5 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 transition active:scale-95 shadow-[0_0_10px_rgba(255,255,255,0.1)] ${
                  esPack 
                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20" 
                    : "bg-white hover:bg-gray-200 text-black"     
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
"use client"; // Importante para que funcione el click de "Ver más"

import Image from 'next/image';
import { useState } from 'react'; // Importamos useState para la memoria del click
import { ShoppingCart, Tag, Gift, ChevronDown, ChevronUp } from 'lucide-react';

export default function GameCard({ titulo, precio, img, ahorro, esPack, juegosIncluidos, onAdd }: any) {
  // Estado para saber si la lista está expandida o no
  const [expandido, setExpandido] = useState(false);

  return (
    <div className="group relative w-full max-w-[350px] mx-auto bg-[#111] border border-white/10 rounded-xl overflow-hidden hover:border-white/30 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] flex flex-col">
      
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

        {/* Badge Izquierdo */}
        <div className={`absolute top-3 left-3 backdrop-blur-md border px-2 py-1 rounded text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1 ${esPack ? 'bg-blue-600/90 border-blue-400/30' : 'bg-black/80 border-white/10'}`}>
            {esPack ? <Gift size={10} /> : <Tag size={10} className="text-gray-400" />}
            {esPack ? 'Pack' : 'Digital'}
        </div>

        {/* Badge Derecho (Solo Ofertas) */}
        {ahorro && !esPack && (
            <div className="absolute top-3 right-3 bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded shadow-lg tracking-wider uppercase">
                {ahorro}
            </div>
        )}
      </div>

      {/* 2. SECCIÓN DE INFORMACIÓN */}
      <div className="p-4 flex flex-col flex-1">
        
        <div className="mb-4">
            <h3 className="text-white font-bold text-[15px] leading-snug mb-2 line-clamp-2">
              {titulo}
            </h3>
            
            {/* LÓGICA DE LISTA EXPANDIBLE */}
            {esPack && juegosIncluidos ? (
                <div className="bg-white/5 rounded-lg p-3 border border-white/5 transition-all duration-300">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 border-b border-white/5 pb-1">
                        Contiene {juegosIncluidos.length} Juegos:
                    </p>
                    
                    <ul className="text-gray-300 text-[11px] leading-relaxed space-y-1">
                        {/* Si está expandido: Muestra TODOS los juegos
                           Si NO está expandido: Muestra solo los primeros 4 
                        */}
                        {(expandido ? juegosIncluidos : juegosIncluidos.slice(0, 4)).map((juego: string, i: number) => (
                             <li key={i} className="flex items-start gap-1.5">
                                <span className="text-blue-500 mt-0.5 text-[8px]">●</span> 
                                <span className={expandido ? "" : "line-clamp-1"}>{juego}</span>
                             </li>
                        ))}
                    </ul>

                    {/* Botón para Ver Más / Ver Menos */}
                    {juegosIncluidos.length > 4 && (
                        <button 
                            onClick={() => setExpandido(!expandido)}
                            className="w-full mt-2 pt-2 border-t border-white/5 flex items-center justify-center gap-1 text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider"
                        >
                            {expandido ? (
                                <>Ver menos <ChevronUp size={12} /></>
                            ) : (
                                <>+ {juegosIncluidos.length - 4} juegos más <ChevronDown size={12} /></>
                            )}
                        </button>
                    )}
                </div>
            ) : (
                <p className="text-gray-500 text-[11px]">Licencia Oficial Nintendo</p>
            )}
        </div>
        
        {/* Precio y Botón */}
        <div className="mt-auto flex items-center justify-between gap-3 pt-2 border-t border-white/5">
            <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 font-bold uppercase">Precio</span>
                <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-white tracking-tight">
                        ${precio.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-gray-400">CLP</span>
                </div>
            </div>

            <button 
                onClick={onAdd}
                className="bg-white text-black h-10 px-5 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 hover:bg-gray-200 transition active:scale-95 shadow-[0_0_10px_rgba(255,255,255,0.1)]"
            >
                <ShoppingCart size={14} strokeWidth={3} />
                AGREGAR
            </button>
        </div>
      </div>
    </div>
  );
}
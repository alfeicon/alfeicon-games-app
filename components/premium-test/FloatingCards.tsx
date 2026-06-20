"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { BarChart3, Boxes, Sparkles } from "lucide-react";

const cards = [
  { title: "Ventas de hoy", value: "$1.284.000", meta: "+18% vs ayer", icon: BarChart3, className: "left-6 top-[42%] hidden xl:block" },
  { title: "Stock actualizado", value: "98.7%", meta: "Sincronizado", icon: Boxes, className: "right-8 top-[42%] hidden lg:block" },
  { title: "Reportes inteligentes", value: "24 insights", meta: "Listos para revisar", icon: Sparkles, className: "bottom-[12%] left-1/2 -translate-x-1/2 md:left-auto md:right-[22%] md:translate-x-0" },
];

export function FloatingCards() {
  const cardRefs = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    cardRefs.current.forEach((card, index) => {
      gsap.to(card, {
        y: -10,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: index * 0.45,
      });
    });
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {cards.map(({ title, value, meta, icon: Icon, className }, index) => (
        <div
          key={title}
          ref={(node) => {
            if (node) cardRefs.current[index] = node;
          }}
          className={`absolute w-[min(280px,calc(100%-2rem))] rounded-[1.6rem] border border-white/20 bg-white/[0.07] p-4 text-white shadow-2xl shadow-black/20 backdrop-blur-2xl ${className}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-white/60">{title}</p>
              <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
              <p className="mt-1 text-xs font-semibold text-cyan-100/76">{meta}</p>
            </div>
            <span className="grid size-11 place-items-center rounded-2xl bg-white/12 text-cyan-100">
              <Icon size={20} />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

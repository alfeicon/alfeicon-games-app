import type { Metadata } from "next";
import { CircleAlert, Clock3 } from "lucide-react";

export const metadata: Metadata = {
  title: "Servicio temporalmente no disponible",
  description: "Alfeicon Games se encuentra temporalmente fuera de servicio.",
  robots: { index: false, follow: false },
};

export default function FueraDeServicioPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] px-5 py-8 text-white sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl flex-col justify-center">
        <div className="border-y border-white/10 py-8 sm:py-10">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Alfeicon Games" className="h-11 w-11 rounded-lg object-contain" />
            <p className="text-sm font-bold tracking-[0.16em] text-slate-300">ALFEICON GAMES</p>
          </div>

          <div className="mt-12 flex h-11 w-11 items-center justify-center rounded-lg border border-amber-300/25 bg-amber-400/10 text-amber-200">
            <CircleAlert size={22} aria-hidden />
          </div>
          <h1 className="mt-5 max-w-xl text-3xl font-bold leading-tight text-white sm:text-4xl">
            Estamos temporalmente fuera de servicio.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
            En este momento no estamos recibiendo compras. Estamos trabajando para volver lo antes posible.
          </p>

          <div className="mt-8 flex items-center gap-3 text-sm text-slate-300">
            <Clock3 size={18} className="shrink-0 text-amber-200" aria-hidden />
            <span>Gracias por tu paciencia. Informaremos cuando la tienda esté disponible nuevamente.</span>
          </div>
        </div>

        <p className="mt-5 text-xs text-slate-500">Alfeicon Games</p>
      </div>
    </main>
  );
}

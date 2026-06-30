"use client";

import { ShieldCheck, X } from 'lucide-react';

type TermsModalProps = {
  onClose: () => void;
};

export default function TermsModal({ onClose }: TermsModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/88 p-4 backdrop-blur-2xl animate-fade-in">
      <div className="brand-shell flex max-h-[90vh] w-full max-w-md flex-col rounded-[2rem]">

        {/* Header del Modal */}
        <div className="flex items-center justify-between border-b border-white/5 p-5">
          <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck size={18} className="text-blue-500" /> Términos y Condiciones
          </h3>
          <button onClick={onClose} className="magnetic rounded-full bg-white/5 p-2 text-white hover:bg-white/20">
            <X size={20} />
          </button>
        </div>

        {/* Contenido con Scroll */}
        <div className="space-y-8 overflow-y-auto p-6 text-left text-[13px] leading-relaxed text-gray-300 scrollbar-hide">

          {/* 1. Instalación */}
          <section className="space-y-3">
            <h4 className="text-white text-sm font-black uppercase tracking-wide border-b border-white/5 pb-1">1. Proceso de Instalación</h4>
            <p>• Entrega estimada: <span className="text-white font-bold">10 a 120 min</span> (según distribuidor).</p>
            <p>• <span className="text-blue-400 font-bold">Descarga inmediata:</span> Es obligatorio iniciar las descargas apenas recibas los datos. Si compras varios juegos, aplica la misma regla.</p>
            <p className="bg-white/5 p-4 rounded-xl border-l-4 border-yellow-500 italic text-gray-200">
              &ldquo;Recuerda contar con tiempo para la instalación. Si no estás seguro, es mejor esperar. Evitemos errores por apuro.&rdquo;
            </p>
          </section>

          {/* 2. Cuentas y Juegos */}
          <section className="space-y-3">
            <h4 className="text-white text-sm font-black uppercase tracking-wide border-b border-white/5 pb-1">2. Cuentas y Juegos</h4>
            <p>• Cuentas tipo <span className="text-white font-bold">PRINCIPAL</span>: Juegas con tu usuario personal.</p>
            <p>• <span className="text-red-400 font-bold uppercase">Prohibido:</span> No juegues con la cuenta entregada ni modifiques su información. Es solo para descargar. Mantén la cuenta en la consola sin tocarla.</p>
            <p>• Cambiar datos de la cuenta <span className="text-white font-bold text-red-500">anula la garantía</span> de inmediato.</p>
          </section>

          {/* 3. Riesgo de Baneo */}
          <section className="space-y-3 bg-red-900/10 p-5 rounded-2xl border border-red-500/20">
            <h4 className="text-red-400 text-sm font-black uppercase tracking-wide">3. Riesgo de Baneo</h4>
            <p>Existe una posibilidad de restricciones online del <span className="text-white font-bold">0,6%</span> (99,3% de éxito). De ocurrir un baneo, <span className="text-white font-bold underline">Alfeicon Games no asume responsabilidad</span>, ya que depende de normas externas de Nintendo.</p>
          </section>

          {/* 4. Sospechas y Pruebas */}
          <section className="space-y-3">
            <h4 className="text-white text-sm font-black uppercase tracking-wide border-b border-white/5 pb-1">4. Sospechas y Pruebas</h4>
            <p>Tenemos registro de acciones en la cuenta. Para evaluar reposición o garantía, se requieren pruebas claras de que el fallo no fue causado por el usuario.</p>
            <p>Si las evidencias son insuficientes, se podrá negar la reposición o devolución.</p>
          </section>

          {/* 5. Garantía Técnica */}
          <section className="space-y-4">
            <h4 className="text-white text-sm font-black uppercase tracking-wide border-b border-white/5 pb-1">5. Garantía Técnica</h4>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-white/5 p-3 rounded-xl">
                <p className="text-gray-400 text-[10px] uppercase font-bold">Compradores Nuevos</p>
                <p className="text-lg text-blue-400 font-black">1 Mes</p>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-blue-500/30">
                <p className="text-gray-400 text-[10px] uppercase font-bold">Compradores Antiguos</p>
                <p className="text-lg text-green-400 font-black">3 Meses</p>
              </div>
            </div>
            <p>• Cubre fallos del juego no causados por el usuario. Incluye reposición (1 vez) o devolución del 50%.</p>
            <p className="text-xs text-red-500 font-bold bg-red-500/5 p-3 rounded-lg border border-red-500/20">
              No aplica si eliminas el juego/cuenta, juegas con el perfil entregado, se trata de un pack o hay interrupciones por corte de luz/apagado.
            </p>
          </section>

          {/* 6. Devoluciones y Pagos */}
          <section className="space-y-3">
            <h4 className="text-white text-sm font-black uppercase tracking-wide border-b border-white/5 pb-1">6. Devoluciones y Pagos</h4>
            <p>• Si no hay stock tras tu pago o la entrega supera el tiempo razonable, puedes pedir reembolso total.</p>
            <p>• El pago debe ir a la cuenta oficial proporcionada; de lo contrario, no asumimos responsabilidad.</p>
          </section>

          {/* Cierre */}
          <p className="text-center font-bold text-white text-[10px] uppercase pt-6 border-t border-white/5 tracking-widest">
            Al comprar aceptas estos términos y las instrucciones del vendedor.
          </p>
        </div>

        {/* Botón de Cierre */}
        <div className="border-t border-white/5 p-4">
          <button onClick={onClose} className="magnetic w-full rounded-full bg-[#e5e4e2] py-4 text-xs font-black uppercase tracking-[0.2em] text-[#0a0a0a] shadow-lg shadow-white/10 hover:bg-white">
            Entendido y Acepto
          </button>
        </div>
      </div>
    </div>
  );
}

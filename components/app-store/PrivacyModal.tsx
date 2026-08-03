"use client";

import { ShieldAlert, X } from 'lucide-react';
import { useScrollLock } from '@/lib/useScrollLock';

type PrivacyModalProps = {
  onClose: () => void;
};

export default function PrivacyModal({ onClose }: PrivacyModalProps) {
  useScrollLock(true);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/88 p-4 backdrop-blur-2xl animate-fade-in">
      <div className="brand-shell flex max-h-[90vh] w-full max-w-md flex-col rounded-[2rem]">
        
        {/* Header del Modal */}
        <div className="flex items-center justify-between border-b border-white/5 p-5">
          <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
            <ShieldAlert size={18} className="text-purple-500" /> Política de Privacidad
          </h3>
          <button onClick={onClose} className="magnetic rounded-full bg-white/5 p-2 text-white active:bg-white/20">
            <X size={20} />
          </button>
        </div>

        {/* Contenido con Scroll */}
        <div className="space-y-8 overflow-y-auto p-6 text-left text-[13px] leading-relaxed text-gray-300 scrollbar-hide">
          
          <p className="text-sm">
            En <strong>Alfeicon Games</strong>, nos tomamos muy en serio la privacidad y seguridad de los datos de nuestros clientes.
          </p>

          <section className="space-y-3">
            <h4 className="text-white text-sm font-black uppercase tracking-wide border-b border-white/5 pb-1">1. Recopilación de Datos</h4>
            <p>
              Recopilamos únicamente la información necesaria para procesar tus pedidos y brindarte soporte técnico. Esto incluye tu correo electrónico (utilizado para el registro e inicio de sesión seguro) y los datos básicos de tu cuenta proporcionados a través de Google o tu proveedor de autenticación.
            </p>
          </section>

          <section className="space-y-3">
            <h4 className="text-white text-sm font-black uppercase tracking-wide border-b border-white/5 pb-1">2. Uso de la Información</h4>
            <p>
              Tu información es utilizada exclusivamente para:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Enviarte los datos de acceso a los juegos adquiridos.</li>
              <li>Validar tu identidad y proteger tus compras en tu "Biblioteca".</li>
              <li>Notificarte sobre actualizaciones importantes o promociones de la tienda (puedes darte de baja en cualquier momento).</li>
            </ul>
          </section>

          <section className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/10">
            <h4 className="text-white text-sm font-black uppercase tracking-wide">3. Compartición con Terceros</h4>
            <p>
              <strong>Bajo ninguna circunstancia vendemos, alquilamos ni comercializamos tus datos personales a terceros.</strong> Solo compartimos datos de forma cifrada con nuestras pasarelas de pago (Mercado Pago, Global66) estrictamente para procesar las transacciones financieras.
            </p>
          </section>

          <section className="space-y-3">
            <h4 className="text-white text-sm font-black uppercase tracking-wide border-b border-white/5 pb-1">4. Seguridad y Protección</h4>
            <p>
              Nuestra base de datos (alojada en Supabase) cuenta con cifrado de nivel empresarial y políticas de seguridad estrictas (RLS) que garantizan que nadie más pueda ver tus datos ni tu historial de compras.
            </p>
          </section>
          
          <section className="space-y-3">
            <h4 className="text-white text-sm font-black uppercase tracking-wide border-b border-white/5 pb-1">5. Derechos del Usuario</h4>
            <p>
              Tienes el derecho de solicitar la eliminación completa de tu cuenta y todos tus datos asociados en cualquier momento contactando a nuestro soporte a través de tu perfil.
            </p>
          </section>

        </div>

        {/* Botón de Cierre */}
        <div className="border-t border-white/5 p-4">
          <button onClick={onClose} className="magnetic w-full rounded-full bg-[#e5e4e2] py-4 text-xs font-black uppercase tracking-[0.2em] text-[#0a0a0a] shadow-lg shadow-white/10 active:bg-white">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

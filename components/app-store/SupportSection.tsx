"use client";

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Check, ChevronRight, Facebook, Instagram, LifeBuoy, ShieldCheck, ShieldAlert, Youtube, Mail } from 'lucide-react';
import SupportTicketModal from './SupportTicketModal';

// Toques sobre el logo necesarios para abrir el modo admin (atajo oculto).
const ADMIN_TAPS = 5;
const ADMIN_TAP_WINDOW_MS = 1200;

type SupportSectionProps = {
  sectionMotion: string;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
};

const STATS = [
  { value: '+1000', label: 'Clientes felices' },
  { value: '99.3%', label: 'Compras sin problemas' },
  { value: '7 días', label: 'Garantía incluida' },
];

const INSTAGRAM_URL = 'https://instagram.com/alfeicon_games';

const CHANNELS = [
  { href: INSTAGRAM_URL, label: 'Instagram', meta: '+2.800 seguidores', icon: <Instagram size={18} />, cls: 'support-channel--ig' },
  { href: 'https://web.facebook.com/alfeicon.games', label: 'Facebook', meta: 'Página oficial', icon: <Facebook size={18} />, cls: 'support-channel--fb' },
  { href: 'https://www.youtube.com/@alfeicon_games', label: 'YouTube', meta: 'Tutoriales en video', icon: <Youtube size={18} />, cls: 'support-channel--yt' },
];

const FAQ = [
  { q: '¿Cómo funciona?', a: 'Te entregamos las credenciales del juego 🎮 a través de una cuenta que vinculamos a tu consola. Luego, podrás descargar el juego y disfrutarlo desde tu usuario personal 🕹️, con o sin conexión a Internet 🌐✨' },
  { q: '¿Qué tipo son estas cuentas?', a: 'Trabajamos principalmente con cuentas primarias / principales. En caso de comprar un juego siempre será una cuenta primaria (puedes jugar directamente con tu usuario personal).' },
  { q: '¿Venden cuentas secundarias?', a: 'Sí vendemos a pedido, tienen un menor valor. (Usas el usuario entregado para jugar y debes jugar en modo avión).' },
  { q: '¿Necesito mi consola desbloqueada?', a: 'No. Los juegos son digitales y se descargan desde la eShop oficial de Nintendo.' },
  { q: '¿Existe riesgo de baneo?', a: 'Existe un riesgo mínimo del 0.7%. El cliente acepta este punto al comprar.' },
  { q: '¿Cuánto dura la garantía?', a: '7 días desde la entrega en juegos unitarios y 3 días en packs. Tu boleta queda disponible ese mismo plazo.' },
  { q: '¿Cuánto tiempo durará el juego?', a: 'Indefinido si sigues las instrucciones: no borres el juego ni la cuenta, ni modifiques datos.' },
];

export default function SupportSection({ sectionMotion, onOpenTerms, onOpenPrivacy }: SupportSectionProps) {
  const router = useRouter();
  const tapCount = useRef(0);
  const tapTimer = useRef<number | null>(null);

  // Formulario de consulta: queda guardado para revisarlo desde el admin, a
  // diferencia de un mensaje suelto en redes, que se pierde si no lo ves.
  const [showForm, setShowForm] = useState(false);

  // Atajo oculto: ADMIN_TAPS toques seguidos sobre el logo abren /admin.
  const handleLogoTap = () => {
    if (tapTimer.current) window.clearTimeout(tapTimer.current);
    tapCount.current += 1;
    if (tapCount.current >= ADMIN_TAPS) {
      tapCount.current = 0;
      router.push('/admin');
      return;
    }
    tapTimer.current = window.setTimeout(() => { tapCount.current = 0; }, ADMIN_TAP_WINDOW_MS);
  };

  return (
    <div className={`section-motion ${sectionMotion} pb-28 pt-0`}>

      {/* ── HERO ── */}
      <div className="support-hero">
        <div className="support-hero__bg" />
        <div className="support-hero__content">
          <div className="support-hero__badge">
            <span className="support-hero__dot" />
            <span>Respondemos en minutos</span>
          </div>
          <h1 className="support-hero__title">¿En qué te<br/>ayudamos?</h1>
          <p className="support-hero__sub">
            Abre un ticket aquí abajo y te respondemos, o escríbenos por Instagram si te acomoda más.
          </p>
          <div className="flex flex-col gap-3 mt-4 w-full">
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="support-ig-btn" aria-label="Escribirnos por Instagram">
              <Instagram size={20} />
              <span>Escríbenos por Instagram</span>
            </a>
            <a href="mailto:alfeicon.games@gmail.com" className="support-email-btn" aria-label="Escribirnos por Correo">
              <Mail size={20} />
              <span>Escríbenos por Correo</span>
            </a>
          </div>
        </div>
      </div>

      <div className="support-body">



        {/* ── TRUST CHECKLIST ── */}
        <div className="support-checks">
          {STATS.map(s => (
            <div key={s.label} className="support-check">
              <span className="support-check__tick">
                <Check size={16} strokeWidth={3.2} />
              </span>
              <span className="support-check__value">{s.value}</span>
              <span className="support-check__label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* ── REDES SOCIALES ── */}
        <div className="support-section-label">Síguenos</div>
        <div className="support-channels">
          {CHANNELS.map(ch => (
            <a key={ch.label} href={ch.href} target="_blank" className={`support-channel ${ch.cls}`}>
              <span className="support-channel__icon">{ch.icon}</span>
              <span className="support-channel__label">{ch.label}</span>
              <span className="support-channel__meta">{ch.meta}</span>
              <ChevronRight size={14} className="support-channel__arrow" />
            </a>
          ))}
        </div>

        {/* ── FAQ ── */}
        <div id="faq" className="support-section-label" style={{ scrollMarginTop: '1rem' }}>Preguntas frecuentes</div>
        <div className="support-faq">
          {FAQ.map(({ q, a }, i) => (
            <div key={i} className="support-faq__item">
              <p className="support-faq__q">{q}</p>
              <p className="support-faq__a">{a}</p>
            </div>
          ))}
        </div>

        {/* ── LEGALES (TÉRMINOS Y PRIVACIDAD) ── */}
        <div className="flex flex-col gap-3">
          <button onClick={onOpenTerms} className="support-terms-btn">
            <ShieldCheck size={16} />
            <span>Términos y condiciones</span>
            <ChevronRight size={15} className="ml-auto" />
          </button>
          
          <button onClick={onOpenPrivacy} className="support-terms-btn" style={{ borderColor: 'rgba(168, 85, 247, 0.2)', backgroundColor: 'rgba(168, 85, 247, 0.05)' }}>
            <ShieldAlert size={16} className="text-purple-400" />
            <span className="text-purple-100">Política de Privacidad</span>
            <ChevronRight size={15} className="ml-auto text-purple-400" />
          </button>
        </div>
        
        {/* ── FOOTER / BRANDING ── */}
        <div className="mt-16 flex flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-500 to-purple-500 p-[2px] shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)]">
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#0f1217]">
              <Image src="/logo.png" alt="Alfeicon" width={24} height={24} className="opacity-80" />
            </div>
          </div>
          
          <h4 className="mb-1 text-sm font-black uppercase tracking-[0.2em] text-white">
            Alfeicon Games
          </h4>
          <p className="mb-6 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Propiedad de Alfeicon Group Spa
          </p>
          
          <div className="h-[1px] w-12 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          
          <p className="mt-6 text-[9px] font-bold uppercase tracking-[0.3em] text-gray-600">
            Diseñado y Creado con ❤️
          </p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-gray-700">
            © {new Date().getFullYear()} Todos los derechos reservados
          </p>
          
          {/* Indicador visual de final de página */}
          <div className="mt-10 h-1 w-32 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-amber-500 opacity-80 shadow-[0_0_20px_rgba(168,85,247,0.6)]" />
        </div>

      </div>
    </div>
  );
}

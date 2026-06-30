"use client";

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ChevronRight, Facebook, Instagram, MessageCircle, ShieldCheck, Youtube } from 'lucide-react';

// Toques sobre el logo necesarios para abrir el modo admin (atajo oculto).
const ADMIN_TAPS = 5;
const ADMIN_TAP_WINDOW_MS = 1200;

type SupportSectionProps = {
  sectionMotion: string;
  whatsappNumber: string;
  onOpenTerms: () => void;
};

const STATS = [
  { value: '+500', label: 'Clientes' },
  { value: '99.3%', label: 'Sin problemas' },
  { value: '1-3 meses', label: 'Garantía' },
];

const CHANNELS = [
  { href: 'https://instagram.com/alfeicon_games', label: 'Instagram', meta: '+2.800 seguidores', icon: <Instagram size={18} />, cls: 'support-channel--ig' },
  { href: 'https://web.facebook.com/alfeicon.games', label: 'Facebook', meta: 'Página oficial', icon: <Facebook size={18} />, cls: 'support-channel--fb' },
  { href: 'https://www.youtube.com/@alfeicon_games', label: 'YouTube', meta: 'Tutoriales en video', icon: <Youtube size={18} />, cls: 'support-channel--yt' },
];

const FAQ = [
  { q: '¿Necesito mi consola desbloqueada?', a: 'No. Los juegos son digitales y se descargan desde la eShop oficial de Nintendo.' },
  { q: '¿Existe riesgo de baneo?', a: 'Existe un riesgo mínimo del 0.7%. El cliente acepta este punto al comprar.' },
  { q: '¿Cuánto dura la garantía?', a: 'Compradores nuevos: 1 mes. Compradores antiguos: 3 meses.' },
  { q: '¿Cuánto tiempo durará el juego?', a: 'Indefinido si sigues las instrucciones: no borres el juego ni la cuenta, ni modifiques datos.' },
];

export default function SupportSection({ sectionMotion, whatsappNumber, onOpenTerms }: SupportSectionProps) {
  const router = useRouter();
  const tapCount = useRef(0);
  const tapTimer = useRef<number | null>(null);

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
          <button
            type="button"
            onClick={handleLogoTap}
            className="support-hero__logo-wrap"
            aria-label="Alfeicon Games"
          >
            <Image src="/logo.png" alt="Alfeicon Games" width={52} height={52} className="support-hero__logo" />
          </button>
          <div className="support-hero__badge">
            <span className="support-hero__dot" />
            <span>Respondemos en minutos</span>
          </div>
          <h1 className="support-hero__title">¿En qué te<br/>ayudamos?</h1>
          <p className="support-hero__sub">Escríbenos por WhatsApp o revisa las dudas frecuentes abajo.</p>
          <a href={`https://wa.me/${whatsappNumber}`} target="_blank" className="support-wa-btn" aria-label="Abrir WhatsApp">
            <MessageCircle size={20} />
            <span>Chatear por WhatsApp</span>
          </a>
        </div>
      </div>

      <div className="support-body">

        {/* ── TRUST STATS ── */}
        <div className="support-stats">
          {STATS.map(s => (
            <div key={s.label} className="support-stat">
              <span className="support-stat__value">{s.value}</span>
              <span className="support-stat__label">{s.label}</span>
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
        <div className="support-section-label">Preguntas frecuentes</div>
        <div className="support-faq">
          {FAQ.map(({ q, a }, i) => (
            <div key={i} className="support-faq__item">
              <p className="support-faq__q">{q}</p>
              <p className="support-faq__a">{a}</p>
            </div>
          ))}
        </div>

        {/* ── TÉRMINOS ── */}
        <button onClick={onOpenTerms} className="support-terms-btn">
          <ShieldCheck size={16} />
          <span>Términos y condiciones</span>
          <ChevronRight size={15} className="ml-auto" />
        </button>

      </div>
    </div>
  );
}

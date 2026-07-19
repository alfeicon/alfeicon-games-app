"use client";

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Check, ChevronRight, Facebook, Instagram, Loader2, MessageCircle, Send, ShieldCheck, Youtube } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

// Toques sobre el logo necesarios para abrir el modo admin (atajo oculto).
const ADMIN_TAPS = 5;
const ADMIN_TAP_WINDOW_MS = 1200;

type SupportSectionProps = {
  sectionMotion: string;
  whatsappNumber: string;
  onOpenTerms: () => void;
};

const STATS = [
  { value: '+1000', label: 'Clientes felices' },
  { value: '99.3%', label: 'Compras sin problemas' },
  { value: '7 días', label: 'Garantía incluida' },
];

const CHANNELS = [
  { href: 'https://instagram.com/alfeicon_games', label: 'Instagram', meta: '+2.800 seguidores', icon: <Instagram size={18} />, cls: 'support-channel--ig' },
  { href: 'https://web.facebook.com/alfeicon.games', label: 'Facebook', meta: 'Página oficial', icon: <Facebook size={18} />, cls: 'support-channel--fb' },
  { href: 'https://www.youtube.com/@alfeicon_games', label: 'YouTube', meta: 'Tutoriales en video', icon: <Youtube size={18} />, cls: 'support-channel--yt' },
];

const FAQ = [
  { q: '¿Necesito mi consola desbloqueada?', a: 'No. Los juegos son digitales y se descargan desde la eShop oficial de Nintendo.' },
  { q: '¿Existe riesgo de baneo?', a: 'Existe un riesgo mínimo del 0.7%. El cliente acepta este punto al comprar.' },
  { q: '¿Cuánto dura la garantía?', a: 'La garantía es de 7 días desde la entrega de tu cuenta.' },
  { q: '¿Cuánto tiempo durará el juego?', a: 'Indefinido si sigues las instrucciones: no borres el juego ni la cuenta, ni modifiques datos.' },
];

export default function SupportSection({ sectionMotion, whatsappNumber, onOpenTerms }: SupportSectionProps) {
  const router = useRouter();
  const tapCount = useRef(0);
  const tapTimer = useRef<number | null>(null);

  // Formulario de consulta: queda guardado para revisarlo desde el admin, a
  // diferencia del botón de WhatsApp donde la consulta se pierde si no la ves.
  const [form, setForm] = useState({ name: '', contact: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviarConsulta = async () => {
    const name = form.name.trim();
    const contact = form.contact.trim();
    const message = form.message.trim();
    if (!name || !contact || !message || sending) return;

    setSending(true);
    const { error: err } = await (supabase?.from('support_requests').insert({ name, contact, message })
      ?? Promise.resolve({ error: new Error('sin conexión') as any }));
    setSending(false);

    if (err) {
      console.error('[soporte] no se pudo enviar', err);
      setError('No pudimos enviar tu consulta. Escríbenos por WhatsApp y te respondemos igual.');
      return;
    }

    setError(null);
    setSent(true);
    setForm({ name: '', contact: '', message: '' });

    fetch('/api/notify-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'SUPPORT_REQUEST', order: { game_name: name, short_code: contact }, message }),
    }).catch(err2 => console.error('[soporte] error notificando', err2));
  };

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
          <p className="support-hero__sub">Escríbenos por WhatsApp o revisa las dudas frecuentes abajo.</p>
          <a href={`https://wa.me/${whatsappNumber}`} target="_blank" className="support-wa-btn" aria-label="Abrir WhatsApp">
            <MessageCircle size={20} />
            <span>Chatear por WhatsApp</span>
          </a>
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

        {/* ── FORMULARIO DE CONSULTA ── */}
        <div className="support-section-label">Déjanos tu consulta</div>
        <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
          {sent ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-green-500/15 text-green-400">
                <Check size={22} strokeWidth={3} />
              </span>
              <p className="text-sm font-black text-white">¡Consulta enviada!</p>
              <p className="max-w-[260px] text-xs leading-relaxed text-gray-400">
                Te responderemos al contacto que dejaste. Si es urgente, escríbenos por WhatsApp.
              </p>
              <button type="button" onClick={() => setSent(false)}
                className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-500 underline">
                Enviar otra
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Tu nombre"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-gray-600 focus:border-white/25"
              />
              <input
                value={form.contact}
                onChange={e => setForm({ ...form, contact: e.target.value })}
                placeholder="Tu WhatsApp o correo"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-gray-600 focus:border-white/25"
              />
              <textarea
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                rows={3}
                placeholder="¿En qué te ayudamos?"
                className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-gray-600 focus:border-white/25"
              />

              {error && <p className="text-[11px] font-semibold text-red-400">{error}</p>}

              <button
                type="button"
                onClick={enviarConsulta}
                disabled={sending || !form.name.trim() || !form.contact.trim() || !form.message.trim()}
                className="motion-press flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-xs font-black uppercase tracking-widest text-black disabled:opacity-40"
              >
                {sending ? <><Loader2 size={14} className="animate-spin" /> Enviando…</> : <><Send size={14} /> Enviar consulta</>}
              </button>
            </div>
          )}
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

        {/* ── LOGO (marca + acceso admin oculto: 5 toques) ── */}
        <button
          type="button"
          onClick={handleLogoTap}
          className="support-footer-logo"
          aria-label="Alfeicon Games"
        >
          <Image src="/logo.png" alt="Alfeicon Games" width={44} height={44} />
        </button>

      </div>
    </div>
  );
}

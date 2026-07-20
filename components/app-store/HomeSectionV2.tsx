"use client";

import Image from 'next/image';
import { type MouseEvent, useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronRight, Gamepad2, Package2, Route, Star, Heart, Newspaper, BookOpen, ShieldCheck, LifeBuoy, Plus
} from 'lucide-react';
import type { CatalogGame, CatalogPack } from '@/lib/catalog';
import { getNintendoThumb } from '@/lib/catalog';
import type { NewsItem } from '@/lib/news';
import type { SectionId } from './AppDock';
import { useCurrency } from '@/components/currency/CurrencyProvider';
import CurrencySwitcher from '@/components/currency/CurrencySwitcher';
import SupportTicketModal from './SupportTicketModal';
import './HomeSectionV2.css';

type Props = {
  sectionMotion: string;
  productos: CatalogGame[];
  packs: CatalogPack[];
  news: NewsItem[];
  ofertasFlash: CatalogGame[];
  cargando: boolean;
  nintendoOnlinePrice: number;
  navigateToSection: (s: SectionId) => void;
  setStoreTab: (tab: 'individual' | 'packs') => void;
  comprarDirecto: (item: CatalogGame | CatalogPack, event?: MouseEvent<HTMLElement>) => void;
  addToCart: (item: CatalogGame | CatalogPack, event?: MouseEvent<HTMLElement>) => void;
  comprarNintendoOnline: (event?: MouseEvent<HTMLElement>) => void;
  onOpenTerms: () => void;
  whatsappNumber: string;
};

/* ── Counts up from 0 when element enters the viewport ── */
function CountUp({ value, loading }: { value: number; loading: boolean }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (loading || started.current || !ref.current || !value) return;
    const el = ref.current;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started.current) return;
      started.current = true;
      obs.disconnect();
      const start = performance.now();
      const duration = 750;
      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setCount(Math.round(value * eased));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [value, loading]);

  return <span ref={ref}>{loading ? '—' : count}</span>;
}

/* ── Triggers CSS class on .hs2-reveal elements as they scroll in ── */
function useScrollReveal(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const els = document.querySelectorAll<HTMLElement>('.hs2-reveal:not(.hs2-visible)');
    if (!els.length) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        const delay = parseInt(el.dataset.delay ?? '0', 10);
        setTimeout(() => el.classList.add('hs2-visible'), delay);
        obs.unobserve(el);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -28px 0px' });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [ready]);
}

export default function HomeSectionV2({
  sectionMotion,
  productos,
  packs,
  news,
  ofertasFlash,
  cargando,
  nintendoOnlinePrice,
  navigateToSection,
  setStoreTab,
  comprarDirecto,
  addToCart,
  comprarNintendoOnline,
  onOpenTerms,
  whatsappNumber,
}: Props) {
  useScrollReveal(!cargando);
  const { format, code } = useCurrency();
  const [activeStep, setActiveStep] = useState(0);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const stepsRef = useRef<HTMLDivElement>(null);

  const ofertas = useMemo(() => {
    if (ofertasFlash.length > 0) return ofertasFlash;
    return productos.filter((p) => p.precioOriginal !== null && p.precioOriginal > p.precio);
  }, [ofertasFlash, productos]);

  // Animate the steps
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep(prev => (prev + 1) % 4);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`section-motion ${sectionMotion} hs2-root`}>

      {/* ── TOP BAR ── */}
      <div className="hs2-topbar">
        <div className="hs2-logo-pill">
          <span className="hs2-logo-mark">
            <Image src="/logo.png" alt="Alfeicon" fill className="object-contain p-1.5" sizes="28px" priority />
          </span>
          <span>Alfeicon Games</span>
        </div>
        <CurrencySwitcher />
      </div>

      {/* ── ACCESOS DIRECTOS ──
          La guía y el soporte viven al final de la página y casi nadie baja
          hasta allá. Estos atajos los anuncian arriba: los dos primeros
          llevan a su sección y el de ayuda abre el ticket al tiro. */}
      <div className="hs2-shortcuts">
        <button type="button" onClick={() => stepsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="hs2-shortcut">
          <Route size={15} strokeWidth={2} />
          <span>Cómo comprar</span>
        </button>
        <button type="button" onClick={() => navigateToSection('instrucciones')} className="hs2-shortcut">
          <BookOpen size={15} strokeWidth={2} />
          <span>Instrucciones</span>
        </button>
        <button type="button" onClick={() => setShowTicketForm(true)} className="hs2-shortcut hs2-shortcut--help">
          <LifeBuoy size={15} strokeWidth={2} />
          <span>Ayuda</span>
        </button>
      </div>

      {/* 1. COMPRA GUIADA */}
      <div className="hs2-reveal mt-2" data-delay="0" ref={stepsRef}>
        <div className="hs2-steps-card mb-4">
          <div className="hs2-steps-head">
            <span className="hs2-steps-ico"><Route size={19} strokeWidth={1.7} /></span>
            <div className="min-w-0 flex-1">
              <p className="hs2-steps-title">Compra guiada en 4 pasos</p>
              <p className="hs2-steps-sub">Rápido, seguro y con acompañamiento.</p>
            </div>
            <ChevronRight size={15} className="hs2-stat-arrow flex-shrink-0" />
          </div>
          <div className="hs2-steps-track">
            {(['Elige', 'Confirma', 'Paga', 'Recibe y juega'] as const).map((lbl, i) => (
              <div key={lbl} className="hs2-step" style={{ transition: 'all 0.3s ease' }}>
                <span className={`hs2-step-num ${activeStep === i ? 'hs2-step-active' : ''}`} style={{ transition: 'all 0.3s ease', transform: activeStep === i ? 'scale(1.1)' : 'scale(1)' }}>{i + 1}</span>
                <span className="hs2-step-lbl" style={{ opacity: activeStep === i ? 1 : 0.6, fontWeight: activeStep === i ? 800 : 600 }}>{lbl}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. JUEGOS Y PACKS STATS */}
      <div className="hs2-info-grid mb-4">
        <div className="hs2-stat-col" style={{ width: '100%', flexDirection: 'row' }}>
          <button type="button" onClick={() => navigateToSection('catalogo')} className="hs2-stat-card" style={{ flex: 1 }}>
            <span className="hs2-stat-ico-box">
              <Gamepad2 size={18} className="hs2-stat-ico" strokeWidth={1.6} />
            </span>
            <div className="hs2-stat-text">
              <strong className="hs2-stat-num">
                <CountUp value={productos.length} loading={cargando} />
              </strong>
              <span className="hs2-stat-lbl">juegos</span>
            </div>
            <ChevronRight size={15} className="hs2-stat-arrow" />
          </button>
          <button
            type="button"
            onClick={() => { setStoreTab('packs'); navigateToSection('catalogo'); }}
            className="hs2-stat-card" style={{ flex: 1 }}
          >
            <span className="hs2-stat-ico-box">
              <Package2 size={18} className="hs2-stat-ico" strokeWidth={1.6} />
            </span>
            <div className="hs2-stat-text">
              <strong className="hs2-stat-num">
                <CountUp value={packs.length} loading={cargando} />
              </strong>
              <span className="hs2-stat-lbl">packs</span>
            </div>
            <ChevronRight size={15} className="hs2-stat-arrow" />
          </button>
        </div>
      </div>

      {/* 3. OFERTAS */}
      <section className="hs2-reveal mb-5" data-delay="30">
        <div className="hs2-sec-head mb-3">
          <h2 className="hs2-sec-title">Ofertas Especiales</h2>
          <button type="button" onClick={() => navigateToSection('catalogo')} className="hs2-see-all">
            Ver todas <ChevronRight size={12} />
          </button>
        </div>
        <div className="hs2-game-rail scrollbar-hide">
          {cargando
            ? [1, 2, 3, 4].map(i => <div key={i} className="hs2-game-skeleton" />)
            : ofertas.slice(0, 6).map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={e => comprarDirecto(item, e)}
                className="hs2-game-card"
                aria-label={`Comprar ${item.titulo}`}
              >
                <span className="hs2-game-img">
                  {item.img
                    ? <Image src={getNintendoThumb(item.img, 432, 516) ?? item.img} alt={item.titulo} fill className="object-cover" sizes="144px" priority={idx === 0} />
                    : <Gamepad2 size={28} className="text-gray-600" />
                  }
                  <span className="hs2-heart-btn" aria-hidden>
                    <Heart size={13} />
                  </span>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      addToCart(item, e as any);
                    }}
                    className="absolute top-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/20 active:bg-white/40 transition-colors text-white z-10"
                    aria-label="Añadir al carrito"
                  >
                    <Plus size={12} strokeWidth={2.5} />
                  </div>
                </span>
                <span className="hs2-game-info">
                  <span className="hs2-game-name">{item.titulo}</span>
                  <span className="flex items-center gap-1.5 mt-0.5">
                    <span className="hs2-game-price text-[#4ade80]">{format(item.precio)}</span>
                    {item.precioOriginal && (
                      <span className="text-[10px] text-gray-500 line-through">{format(item.precioOriginal)}</span>
                    )}
                  </span>
                </span>
              </button>
            ))
          }
        </div>
      </section>

      {/* 4. PACKS DESTACADOS (CARRUSEL) */}
      <section className="hs2-reveal mb-5" data-delay="60">
        <div className="hs2-sec-head mb-3">
          <h2 className="hs2-sec-title flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
            Packs de Juegos
          </h2>
          <button
            type="button"
            onClick={() => { setStoreTab('packs'); navigateToSection('catalogo'); }}
            className="hs2-see-all"
          >
            Ver todos <ChevronRight size={12} />
          </button>
        </div>
        
        {cargando ? (
          <div className="hs2-news__empty animate-pulse">Cargando packs...</div>
        ) : packs.length === 0 ? (
          <div className="hs2-news__empty">No hay packs disponibles</div>
        ) : (
          <div className="hs2-packs-carousel scrollbar-hide">
            {packs.slice(0, 5).map((pack) => {
              const shown = pack.juegosIncluidos.slice(0, 3);
              const extra = pack.juegosIncluidos.length - shown.length;
              return (
                <div
                  key={pack.id}
                  onClick={(e) => comprarDirecto(pack, e)}
                  className="hs2-pack-card"
                >
                  <div className="hs2-pack-img-wrapper">
                    {pack.img ? (
                      <Image
                        src={getNintendoThumb(pack.img, 560, 300) ?? pack.img}
                        alt={pack.titulo}
                        fill
                        className="object-cover"
                        sizes="280px"
                      />
                    ) : (
                      <div className="hs2-pack-placeholder">
                        <Package2 size={36} />
                      </div>
                    )}
                    <span className="hs2-pack-badge-count">
                      {pack.juegosIncluidos.length} Juegos
                    </span>
                    {pack.esNuevo && (
                      <span className="hs2-pack-badge-new">
                        Nuevo
                      </span>
                    )}
                  </div>
                  <div className="hs2-pack-content">
                    <div>
                      <h3 className="hs2-pack-title">{pack.titulo}</h3>
                      <p className="hs2-pack-desc">
                        {shown.join(' · ')}{extra > 0 ? ` +${extra} más` : ''}
                      </p>
                    </div>
                    <div className="hs2-pack-footer">
                      <span className="hs2-pack-price">
                        {format(pack.precio)} <span className="hs2-pack-currency">{code}</span>
                      </span>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(pack, e as any);
                        }}
                        className="cat2-add-btn"
                        style={{ width: '28px', height: '28px' }}
                      >
                        <Plus size={14} strokeWidth={2.5} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. ONLINE + EXPANSION */}
      <div className="hs2-info-grid mb-4">
        <button type="button" onClick={comprarNintendoOnline} className="hs2-online-card" style={{ width: '100%' }}>
          <span className="hs2-online-watermark" aria-hidden>🎁</span>
          <div className="hs2-online-top">
            <div className="hs2-online-info">
              <span className="hs2-online-badge">DESTACADO</span>
              <h2 className="hs2-online-title">Online + expansión</h2>
              <p className="hs2-online-dur">12 meses</p>
            </div>
            <p className="hs2-online-price">
              {format(nintendoOnlinePrice)}&nbsp;<sup>{code}</sup>
            </p>
          </div>
          <span className="hs2-online-cta">
            Comprar ahora <ChevronRight size={13} strokeWidth={2.5} />
          </span>
        </button>
      </div>

      {/* 6. NOTICIAS */}
      <section className="hs2-news mb-4" aria-label="Noticias">
        <div className="hs2-news__head">
          <h2 className="hs2-news__title">Noticias</h2>
        </div>
        {news.length === 0 ? (
          <div className="hs2-news__empty">
            <Newspaper size={22} strokeWidth={1.6} />
            <p>Próximamente noticias</p>
          </div>
        ) : (
          <div className="hs2-news__rail">
            {news.map((item) => (
              <div key={item.id} className="hs2-news__card">
                <span className="hs2-news__card-img">
                  {item.image_url ? (
                    <Image src={item.image_url} alt={item.title} fill className="object-cover" sizes="240px" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center">
                      <Newspaper size={20} strokeWidth={1.6} className="text-white/25" />
                    </span>
                  )}
                </span>
                <span className="hs2-news__card-body">
                  <span className="hs2-news__card-title">{item.title}</span>
                  {item.description && (
                    <span className="hs2-news__card-desc">{item.description}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 7. CLIENTES FELICES */}
      <section className="hs2-reveal mb-6" data-delay="120">
        <div className="hs2-sec-head mb-3">
          <h2 className="hs2-sec-title">Clientes felices</h2>
        </div>
        <div className="hs2-reviews-rail scrollbar-hide">
          {[
            { n: 1, text: 'Rápida entrega y excelente atención.', handle: '@marco.switch' },
            { n: 2, text: 'Todo perfecto, 100% recomendados.', handle: '@juega.conmigo' },
            { n: 3, text: 'Muy buena experiencia. Volvería a comprar.', handle: '@nintendero.cl' },
          ].map(r => (
            <div key={r.handle} className="hs2-review-card">
              <div className="hs2-review-img">
                <Image src={`/clientes/${r.n}.jpg`} alt="" fill className="object-cover" sizes="52px" />
              </div>
              <div className="hs2-review-body">
                <div className="hs2-stars">
                  {[1, 2, 3, 4, 5].map(s => <Star key={s} size={9} className="fill-yellow-400 text-yellow-400" />)}
                </div>
                <p className="hs2-review-text">{r.text}</p>
                <span className="hs2-review-handle">{r.handle}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 8. INSTRUCCIONES Y SOPORTE */}
      <div className="hs2-reveal mb-6" data-delay="150">
        <button
          type="button"
          onClick={() => navigateToSection('instrucciones')}
          className="hs2-guide-card mb-2"
          aria-label="Ver instrucciones de instalación"
        >
          <span className="hs2-guide-ico"><BookOpen size={20} strokeWidth={1.8} /></span>
          <span className="hs2-guide-text">
            <span className="hs2-guide-title">¿No sabes cómo instalar tu juego?</span>
            <span className="hs2-guide-sub">Te enseñamos paso a paso — elige tu consola.</span>
          </span>
          <span className="hs2-guide-cta">
            Ver instrucciones <ChevronRight size={13} strokeWidth={2.5} />
          </span>
        </button>

        {/* Abre el formulario de consulta acá mismo: deja un ticket guardado
            que podemos revisar, en vez de una conversación de WhatsApp que se
            pierde si no la vemos a tiempo. */}
        <button
          type="button"
          onClick={() => setShowTicketForm(true)}
          className="support-ticket-banner"
          aria-label="Abrir un ticket de soporte"
        >
          <span className="support-ticket-banner__ico">
            <LifeBuoy size={22} strokeWidth={1.9} />
          </span>
          <span className="support-ticket-banner__text">
            <span className="support-ticket-banner__title">¿Tienes problemas o dudas?</span>
            <span className="support-ticket-banner__sub">Cuéntanos y te generamos un ticket. Te respondemos a tu WhatsApp o correo.</span>
          </span>
          <span className="support-ticket-banner__cta">
            Abrir ticket <ChevronRight size={14} strokeWidth={2.6} />
          </span>
        </button>
      </div>

      {/* 9. TÉRMINOS Y CONDICIONES (footer inicio) */}
      <div className="hs2-reveal mb-6" data-delay="180">
        <button type="button" onClick={onOpenTerms} className="support-terms-btn">
          <ShieldCheck size={16} />
          <span>Términos y condiciones</span>
          <ChevronRight size={15} className="ml-auto" />
        </button>
      </div>

      <SupportTicketModal open={showTicketForm} onClose={() => setShowTicketForm(false)} />
    </div>
  );
}

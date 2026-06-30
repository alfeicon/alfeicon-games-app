"use client";

import Image from 'next/image';
import { type MouseEvent, useState, useEffect, useRef } from 'react';
import {
  ChevronRight, Gamepad2, MessageCircle, Package2, Route, Star, Heart, Newspaper, BookOpen,
} from 'lucide-react';
import type { CatalogGame, CatalogPack } from '@/lib/catalog';
import { getNintendoThumb } from '@/lib/catalog';
import type { SectionId } from './AppDock';
import './HomeSectionV2.css';

type Props = {
  sectionMotion: string;
  productos: CatalogGame[];
  packs: CatalogPack[];
  ofertasFlash: CatalogGame[];
  cargando: boolean;
  nintendoOnlinePrice: number;
  canalWhatsapp: string;
  navigateToSection: (s: SectionId) => void;
  setStoreTab: (t: 'individual' | 'packs') => void;
  comprarDirecto: (item: CatalogGame | CatalogPack, event?: MouseEvent<HTMLElement>) => void;
  comprarNintendoOnline: (event?: MouseEvent<HTMLElement>) => void;
};

function fmt(n: number) { return n.toLocaleString('es-CL'); }

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
  ofertasFlash,
  cargando,
  nintendoOnlinePrice,
  canalWhatsapp,
  navigateToSection,
  setStoreTab,
  comprarDirecto,
  comprarNintendoOnline,
}: Props) {
  useScrollReveal(!cargando);

  const recomendados = ofertasFlash.length > 0 ? ofertasFlash : productos;

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
        <a href={canalWhatsapp} target="_blank" rel="noopener" aria-label="Soporte en vivo" className="hs2-support-pill">
          <span className="hs2-live-dot" />
          <span>Soporte en vivo</span>
          <MessageCircle size={13} strokeWidth={1.6} />
        </a>
      </div>

      {/* ── ACCESO RÁPIDO: INSTRUCCIONES ── */}
      <button
        type="button"
        onClick={() => navigateToSection('instrucciones')}
        className="hs2-guide-card"
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

      {/* ── NOTICIAS ── */}
      <section className="hs2-news" aria-label="Noticias">
        <div className="hs2-news__head">
          <h2 className="hs2-news__title">Noticias</h2>
        </div>
        {/* Estado vacío — aquí irán las imágenes de noticias */}
        <div className="hs2-news__empty">
          <Newspaper size={22} strokeWidth={1.6} />
          <p>Próximamente noticias</p>
        </div>
      </section>

      {/* ── INFO GRID: Online + Stats ── */}
      <div className="hs2-info-grid mt-3 mb-3">
        <button type="button" onClick={comprarNintendoOnline} className="hs2-online-card">
          <span className="hs2-online-watermark" aria-hidden>🎁</span>
          <div className="hs2-online-top">
            <div className="hs2-online-info">
              <span className="hs2-online-badge">DESTACADO</span>
              <h2 className="hs2-online-title">Online + expansión</h2>
              <p className="hs2-online-dur">12 meses</p>
            </div>
            <p className="hs2-online-price">
              ${fmt(nintendoOnlinePrice)}&nbsp;<sup>CLP</sup>
            </p>
          </div>
          <span className="hs2-online-cta">
            Comprar ahora <ChevronRight size={13} strokeWidth={2.5} />
          </span>
        </button>

        <div className="hs2-stat-col">
          <button type="button" onClick={() => navigateToSection('catalogo')} className="hs2-stat-card">
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
            className="hs2-stat-card"
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

      {/* ── STEPS CARD ── */}
      <div className="hs2-reveal" data-delay="0">
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
              <div key={lbl} className="hs2-step">
                <span className={`hs2-step-num${i === 0 ? ' hs2-step-active' : ''}`}>{i + 1}</span>
                <span className="hs2-step-lbl">{lbl}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RECOMENDADOS ── */}
      <section className="hs2-reveal mb-5" data-delay="60">
        <div className="hs2-sec-head mb-3">
          <h2 className="hs2-sec-title">Recomendados</h2>
          <button type="button" onClick={() => navigateToSection('catalogo')} className="hs2-see-all">
            Ver todos <ChevronRight size={12} />
          </button>
        </div>
        <div className="hs2-game-rail scrollbar-hide">
          {cargando
            ? [1, 2, 3, 4].map(i => <div key={i} className="hs2-game-skeleton" />)
            : recomendados.slice(0, 6).map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={e => comprarDirecto(item, e)}
                className="hs2-game-card"
                aria-label={`Comprar ${item.titulo}`}
              >
                <span className="hs2-game-img">
                  {item.img
                    ? <Image src={getNintendoThumb(item.img, 288, 288) ?? item.img} alt={item.titulo} fill className="object-cover" sizes="144px" priority={idx === 0} />
                    : <Gamepad2 size={28} className="text-gray-600" />
                  }
                  <span className="hs2-heart-btn" aria-hidden><Heart size={13} /></span>
                </span>
                <span className="hs2-game-info">
                  <span className="hs2-game-name">{item.titulo}</span>
                  <span className="hs2-game-price">${fmt(item.precio)}</span>
                </span>
              </button>
            ))
          }
        </div>
      </section>

      {/* ── CLIENTES FELICES ── */}
      <section className="hs2-reveal mb-6" data-delay="120">
        <div className="hs2-sec-head mb-3">
          <h2 className="hs2-sec-title">Clientes felices</h2>
          <button type="button" onClick={() => navigateToSection('perfil')} className="hs2-see-all">
            Ver más <ChevronRight size={12} />
          </button>
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

    </div>
  );
}

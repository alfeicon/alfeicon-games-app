"use client";

import Image from 'next/image';
import { AlertTriangle, ChevronRight, FileText, Instagram, Youtube, Zap } from 'lucide-react';

// Contacto de la tienda: Instagram (ig.me/m abre el chat directo).
const INSTAGRAM_DM = 'https://ig.me/m/alfeicon_games';

export type GuideConsole = 'switch2' | 'switch1';

type GuideSectionProps = {
  sectionMotion: string;
  helpSelected: GuideConsole | null;
  setHelpSelected: (value: GuideConsole | null) => void;
  pickerExiting: boolean;
  setPickerExiting: (value: boolean) => void;
};

const CHECKLIST_SWITCH2: ReadonlyArray<readonly [string, string]> = [
  ['Espacio libre', 'Revisa que tengas memoria disponible antes de descargar.'],
  ['Cuenta principal', 'Instala estrictamente siguiendo el método indicado.'],
  ['Descarga inmediata', 'Si compraste varios juegos, descárgalos todos apenas los recibas.'],
  ['No archivar', 'Archivar la cuenta equivale a eliminar el juego y anula la garantía.'],
];

const CHECKLIST_SWITCH1: ReadonlyArray<readonly [string, string]> = [
  ['Espacio libre', 'Revisa que tengas memoria/SD disponible antes de descargar.'],
  ['Cuenta principal', 'Instala estrictamente siguiendo el método indicado.'],
  ['Descarga inmediata', 'Si compraste varios juegos, descárgalos todos apenas los recibas.'],
  ['No archivar', 'Archivar la cuenta equivale a eliminar el juego y anula la garantía.'],
];

function Checklist({ items }: { items: ReadonlyArray<readonly [string, string]> }) {
  return (
    <div className="guide-checklist">
      {items.map(([t, d], i) => (
        <div key={t} className="guide-checklist-item">
          <span className="guide-checklist-num">{i + 1}</span>
          <div>
            <p className="guide-checklist-title">{t}</p>
            <p className="guide-checklist-desc">{d}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function InstagramBar() {
  return (
    <div className="guide-help-bar">
      <div>
        <p className="guide-help-bar__label">¿Aún tienes dudas?</p>
        <p className="guide-help-bar__title">Te ayudamos por Instagram</p>
      </div>
      <a href={INSTAGRAM_DM} target="_blank" rel="noopener noreferrer" className="guide-help-btn" aria-label="Escribirnos por Instagram">
        <Instagram size={20} />
      </a>
    </div>
  );
}

export default function GuideSection({
  sectionMotion,
  helpSelected,
  setHelpSelected,
  pickerExiting,
  setPickerExiting,
}: GuideSectionProps) {
  const selectConsole = (target: GuideConsole) => {
    setPickerExiting(true);
    setTimeout(() => setHelpSelected(target), 320);
  };
  const goBack = () => {
    setHelpSelected(null);
    setPickerExiting(false);
  };

  return (
    <div className={`section-motion ${sectionMotion}`}>

      {/* ── PANTALLA: SELECTOR ── */}
      {helpSelected === null && (
        <div className={`guide-picker-screen${pickerExiting ? ' guide-picker-screen--exit' : ''}`}>
          {/* Hero top */}
          <div className="guide-picker-hero">
            <div className="guide-picker-hero-bg" />
            <p className="guide-picker-eyebrow">Centro de instalación</p>
            <h1 className="guide-picker-title">¿Qué consola<br/>tienes?</h1>
            <p className="guide-picker-sub">Selecciona la opción que corresponde a tu consola</p>
          </div>

          {/* Cards */}
          <div className="guide-picker-cards">
            {/* Switch 2 */}
            <button onClick={() => selectConsole('switch2')} className="guide-console-card guide-console-card--s2">
              <div className="guide-console-card__bg" />
              <div className="guide-console-card__logo-zone">
                <Image src="/nintendo-switch2-logo.png" alt="Nintendo Switch 2" width={110} height={110} className="guide-console-card__logo-img" />
              </div>
              <div className="guide-console-card__info-zone">
                <div className="guide-console-card__shimmer" />
                <p className="guide-console-card__name">Nintendo<br/>Switch 2</p>
                <p className="guide-console-card__hint">Instrucciones específicas + video tutorial obligatorio</p>
                <span className="guide-console-card__cta">Ver guía <ChevronRight size={11} className="inline" /></span>
              </div>
            </button>

            {/* Separador entre opciones */}
            <div className="guide-picker-divider" aria-hidden="true">
              <span className="guide-picker-divider__node" />
            </div>

            {/* Switch 1 / OLED / Lite */}
            <button onClick={() => selectConsole('switch1')} className="guide-console-card guide-console-card--s1">
              <div className="guide-console-card__bg" />
              <div className="guide-console-card__logo-zone">
                <Image src="/nintendo-switch1-logo.png" alt="Nintendo Switch" width={110} height={110} className="guide-console-card__logo-img" />
              </div>
              <div className="guide-console-card__info-zone">
                <div className="guide-console-card__shimmer" />
                <p className="guide-console-card__name">Switch 1<br/>OLED · Lite · V1 · V2</p>
                <p className="guide-console-card__hint">Guía PDF paso a paso para todos los modelos</p>
                <span className="guide-console-card__cta">Ver guía <ChevronRight size={11} className="inline" /></span>
              </div>
            </button>
          </div>

          {/* Warning strip */}
          <div className="guide-picker-warning">
            <AlertTriangle size={14} className="shrink-0 text-yellow-500" />
            <p>Usar la guía incorrecta puede generar errores. Si tienes dudas escríbenos por Instagram.</p>
          </div>
        </div>
      )}

      {/* ── PANTALLA: GUÍA SWITCH 2 ── */}
      {helpSelected === 'switch2' && (
        <div className="guide-detail-screen">
          {/* Hero con logo */}
          <div className="guide-detail-hero guide-detail-hero--s2">
            <div className="guide-detail-hero__bg" />
            <button onClick={goBack} className="guide-back-btn">
              <ChevronRight size={14} className="rotate-180" /> Cambiar consola
            </button>
            <div className="guide-detail-hero__logo">
              <Image src="/nintendo-switch2-logo.png" alt="Nintendo Switch 2" fill className="object-contain drop-shadow-2xl" sizes="180px" />
            </div>
            <p className="guide-detail-hero__label">Guía de instalación</p>
          </div>

          {/* Checklist antes de empezar */}
          <div className="guide-detail-body">
            <p className="guide-section-label"><AlertTriangle size={13} /> Antes de empezar</p>
            <Checklist items={CHECKLIST_SWITCH2} />
            <div className="guide-tip">
              <Zap size={13} className="shrink-0 text-white" />
              <p>Jugar sin conexión a internet reduce riesgos y evita errores durante el uso.</p>
            </div>

            {/* Video */}
            <p className="guide-section-label mt-2"><Youtube size={13} /> Tutorial en video</p>
            <div className="guide-video-wrap">
              <iframe src="https://www.youtube.com/embed/Tl5A7OeRbh0" title="Tutorial Switch 2" className="absolute inset-0 h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
            <div className="guide-video-note">
              <div className="guide-video-note__dot" />
              <p>Mira el tutorial completo <strong>antes de empezar</strong>. Switch 2 requiere pasos específicos que conviene seguir en orden.</p>
            </div>

            <InstagramBar />
          </div>
        </div>
      )}

      {/* ── PANTALLA: GUÍA SWITCH 1 / OLED / LITE ── */}
      {helpSelected === 'switch1' && (
        <div className="guide-detail-screen">
          {/* Hero con logo */}
          <div className="guide-detail-hero guide-detail-hero--s1">
            <div className="guide-detail-hero__bg" />
            <button onClick={goBack} className="guide-back-btn">
              <ChevronRight size={14} className="rotate-180" /> Cambiar consola
            </button>
            <div className="guide-detail-hero__logo">
              <Image src="/nintendo-switch1-logo.png" alt="Nintendo Switch" fill className="object-contain drop-shadow-2xl" sizes="180px" />
            </div>
            <p className="guide-detail-hero__label">Guía de instalación</p>
          </div>

          {/* Checklist antes de empezar */}
          <div className="guide-detail-body">
            <p className="guide-section-label"><AlertTriangle size={13} /> Antes de empezar</p>
            <Checklist items={CHECKLIST_SWITCH1} />
            <div className="guide-tip">
              <Zap size={13} className="shrink-0 text-white" />
              <p>Jugar sin conexión a internet reduce riesgos y evita errores durante el uso.</p>
            </div>

            {/* PDF */}
            <p className="guide-section-label mt-2"><FileText size={13} /> Manual de instalación</p>
            <a href="/guia.pdf" target="_blank" className="guide-pdf-preview">
              <div className="guide-pdf-preview__thumb">
                <Image src="/guide-hero.png" alt="Vista previa guía" width={493} height={269} className="guide-pdf-preview__img" />
                <div className="guide-pdf-preview__thumb-overlay">
                  <div className="guide-pdf-preview__badge">
                    <FileText size={14} />
                    <span>PDF</span>
                  </div>
                </div>
              </div>
              <div className="guide-pdf-preview__footer">
                <div className="guide-pdf-preview__info">
                  <p className="guide-pdf-preview__title">Instrucciones para instalar los juegos</p>
                  <p className="guide-pdf-preview__meta">Switch 1 · OLED · Lite · 2.5 MB</p>
                </div>
                <div className="guide-pdf-preview__dl">
                  <FileText size={15} />
                  <span>Descargar</span>
                </div>
              </div>
            </a>

            <InstagramBar />
          </div>
        </div>
      )}

    </div>
  );
}

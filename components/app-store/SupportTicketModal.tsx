"use client";

// Formulario de consulta de soporte. Vive aparte porque se abre desde dos
// lugares: el banner del inicio y el de la sección Soporte. A diferencia del
// enlace a redes, esto queda guardado en `support_requests` y se puede
// revisar después desde el admin.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, LifeBuoy, Loader2, Send, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Se antepone al mensaje para que en el admin se sepa de qué orden habla. */
  referencia?: string;
  /**
   * Cuando la compra trae varias cuentas, el cliente elige cuál le falló. Sin
   * esto tendríamos que adivinar de qué juego habla.
   */
  opciones?: string[];
};

export default function SupportTicketModal({ open, onClose, referencia, opciones }: Props) {
  const [form, setForm] = useState({ name: '', contact: '', message: '' });
  const [afectado, setAfectado] = useState('');
  const [sending, setSending] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enviarConsulta = async () => {
    const name = form.name.trim();
    const contact = form.contact.trim();
    const escrito = form.message.trim();
    if (!name || !contact || !escrito || sending) return;
    // El admin necesita saber de qué orden y de qué juego se habla antes de
    // leer el mensaje: por eso van al principio y no en un campo aparte.
    const etiquetas = [referencia, afectado].filter(Boolean).join(' · ');
    const message = etiquetas ? `[${etiquetas}] ${escrito}` : escrito;

    setSending(true);
    // Se pide el id de vuelta para armar el número de ticket que ve el cliente.
    const { data, error: err } = await (supabase
      ?.from('support_requests')
      .insert({ name, contact, message })
      .select('id')
      .single()
      ?? Promise.resolve({ data: null, error: new Error('sin conexión') as any }));
    setSending(false);

    if (err || !data) {
      console.error('[soporte] no se pudo enviar', err);
      setError('No pudimos enviar tu consulta. Escríbenos por Instagram y te respondemos igual.');
      return;
    }

    // El ticket es un trozo del id: corto de leer y suficiente para que el
    // cliente y nosotros hablemos de la misma consulta. Evita una columna
    // correlativa y el riesgo de repetidos si dos envían a la vez.
    const code = `TCK-${String(data.id).replace(/-/g, '').slice(0, 6).toUpperCase()}`;

    setError(null);
    setTicket(code);
    setForm({ name: '', contact: '', message: '' });

    fetch('/api/notify-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SUPPORT_REQUEST',
        order: { game_name: `${name} · ${code}`, short_code: contact },
        message,
      }),
    }).catch(err2 => console.error('[soporte] error notificando', err2));
  };

  // Con el modal abierto se bloquea el scroll del fondo y Escape cierra,
  // igual que la ficha del catálogo. Se guarda el overflow previo en vez de
  // asumir "auto": si otro modal ya lo había bloqueado, al cerrar este no
  // debe desbloquearlo por su cuenta.
  useEffect(() => {
    if (!open) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const cerrar = () => {
    onClose();
    setTicket(null);
    setError(null);
  };

  if (!open) return null;

  // Se porta a #store-content: dentro de la sección, el modal queda atrapado
  // en su contexto de apilamiento y el dock (z-index 50) se dibuja encima por
  // mucho z-index que le pongamos. Portado, lo tapa como corresponde.
  // Fuera de la tienda (ej. la boleta de /entrega) ese nodo no existe y el
  // body sirve igual: ahí no hay dock que tapar.
  if (typeof document === 'undefined') return null;
  const contenedor = document.getElementById('store-content') || document.body;

  return createPortal(
    // Mismas clases que la ficha del catálogo y el modal de pago: ya resuelven
    // el vidrio y el desenfoque en este árbol.
    <div
      className="catalog-detail-backdrop"
      style={{ zIndex: 120 }}
      role="dialog"
      aria-modal="true"
      aria-label="Dejar una consulta"
      onClick={cerrar}
    >
      {/* --scroll: el panel base no trae padding (espera hijos con regiones
          propias). Sin esto el contenido se pega a los bordes. */}
      <div className="catalog-detail-panel catalog-detail-panel--scroll" onClick={e => e.stopPropagation()}>
        {ticket ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 text-green-400">
              <Check size={28} strokeWidth={3} />
            </span>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Tu ticket</p>
            <p className="text-2xl font-black tracking-widest text-white">{ticket}</p>
            <p className="max-w-[280px] text-xs leading-relaxed text-gray-400">
              Guarda este número. Te respondemos al contacto que dejaste; si es urgente, escríbenos por Instagram.
            </p>
            <button type="button" onClick={cerrar}
              className="motion-press mt-2 w-full rounded-full bg-white py-3 text-xs font-black uppercase tracking-widest text-black">
              Listo
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
                <LifeBuoy size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Soporte</p>
                <h3 className="text-base font-black leading-tight text-white">¿En qué te ayudamos?</h3>
              </div>
              <button type="button" onClick={cerrar} aria-label="Cerrar"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 active:bg-white/10">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Tu nombre"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-white/25"
              />
              <input
                value={form.contact}
                onChange={e => setForm({ ...form, contact: e.target.value })}
                placeholder="Tu Instagram, WhatsApp o correo"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-white/25"
              />
              {opciones && opciones.length > 1 && (
                <select
                  value={afectado}
                  onChange={e => setAfectado(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-3 text-sm text-white outline-none focus:border-white/25"
                >
                  <option value="">¿Con cuál tuviste el problema?</option>
                  {opciones.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
              <textarea
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                rows={4}
                placeholder="Cuéntanos qué pasó"
                className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3.5 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-white/25"
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
          </>
        )}
      </div>
    </div>,
    contenedor,
  );
}

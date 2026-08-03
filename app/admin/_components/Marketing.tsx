"use client";

import { useState, useEffect } from "react";
import { Mail, Loader2, Users } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Props = {
  loading: boolean;
  setLoading: (v: boolean) => void;
  showNotice: (type: "success" | "error" | "info", text: string, playSound?: boolean) => void;
};

export function Marketing({ loading, setLoading, showNotice }: Props) {
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [target, setTarget] = useState<"all" | "test" | "selected">("test");
  const [uniqueEmails, setUniqueEmails] = useState<string[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    async function fetchUsers() {
      if (!supabase) return;
      const { data, error } = await supabase.rpc('get_admin_user_emails');
      if (error) {
        showNotice("error", "Error cargando correos: " + (error.message || JSON.stringify(error)));
      }
      if (data) {
        const seen = new Set<string>();
        const emails: string[] = [];
        for (const u of data) {
          const emailClean = (u.email || "").trim().toLowerCase();
          if (!seen.has(emailClean)) {
            seen.add(emailClean);
            emails.push(emailClean);
          }
        }
        setUniqueEmails(emails);
      }
    }
    fetchUsers();
  }, []);

  const handleSend = async () => {
    if (!subject || !html) {
      showNotice("error", "Falta asunto o mensaje");
      return;
    }

    let to: string[] = [];
    if (target === "test") to = ["alfeicon.games@gmail.com"];
    else if (target === "all") to = uniqueEmails;
    else if (target === "selected") {
      to = Array.from(selectedEmails);
      if (to.length === 0) {
        showNotice("error", "No has seleccionado destinatarios");
        return;
      }
    }

    if (!confirm(`¿Seguro que quieres enviar este correo a ${to.length} cliente${to.length === 1 ? '' : 's'}?`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, html }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");

      showNotice("success", "Correo enviado con éxito");
      setSubject("");
      setHtml("");
    } catch (error: any) {
      showNotice("error", "Error al enviar: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden pt-14 md:pt-0">
      <div className="flex shrink-0 flex-col border-b border-white/[0.06] px-6 py-4">
        <h1 className="text-base font-black uppercase tracking-[0.15em] text-white">Marketing y Avisos</h1>
        <p className="mt-0.5 text-[10px] text-gray-600">Envía correos a {uniqueEmails.length} clientes registrados</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
        <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500">Destinatarios</label>
            <div className="flex gap-2">
              <button onClick={() => setTarget("test")} className={`flex-1 rounded-xl border py-2 text-[10px] font-bold uppercase tracking-widest transition-colors sm:text-xs ${target === "test" ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400" : "border-white/10 text-gray-500 hover:bg-white/5"}`}>
                De Prueba
              </button>
              <button onClick={() => setTarget("selected")} className={`flex-1 rounded-xl border py-2 text-[10px] font-bold uppercase tracking-widest transition-colors sm:text-xs ${target === "selected" ? "border-blue-500/30 bg-blue-500/10 text-blue-400" : "border-white/10 text-gray-500 hover:bg-white/5"}`}>
                Selección
              </button>
              <button onClick={() => setTarget("all")} className={`flex-1 rounded-xl border py-2 text-[10px] font-bold uppercase tracking-widest transition-colors sm:text-xs ${target === "all" ? "border-purple-500/30 bg-purple-500/10 text-purple-400" : "border-white/10 text-gray-500 hover:bg-white/5"}`}>
                <Users size={14} className="inline mr-1" /> Todos ({uniqueEmails.length})
              </button>
            </div>
            
            {target === "selected" && (
              <div className="mt-3 flex max-h-48 flex-col gap-1 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-2">
                <div className="mb-1 flex items-center justify-between px-2 py-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    {selectedEmails.size} seleccionados
                  </span>
                  <button 
                    onClick={() => setSelectedEmails(selectedEmails.size === uniqueEmails.length ? new Set() : new Set(uniqueEmails))}
                    className="text-[10px] font-bold uppercase tracking-widest text-blue-400 hover:text-blue-300"
                  >
                    {selectedEmails.size === uniqueEmails.length ? 'Desmarcar todo' : 'Marcar todo'}
                  </button>
                </div>
                {uniqueEmails.map(email => (
                  <label key={email} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={selectedEmails.has(email)}
                      onChange={(e) => {
                        const next = new Set(selectedEmails);
                        if (e.target.checked) next.add(email);
                        else next.delete(email);
                        setSelectedEmails(next);
                      }}
                      className="h-4 w-4 rounded border-white/20 bg-black/50 text-blue-500 focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="text-xs text-white/80">{email}</span>
                  </label>
                ))}
                {uniqueEmails.length === 0 && (
                  <p className="p-2 text-center text-xs text-gray-500">No hay correos disponibles</p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500">Asunto del Correo</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Ej: ¡Actualizamos el Pack de Mario!"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/50" />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500">Mensaje (HTML permitido)</label>
            <textarea value={html} onChange={e => setHtml(e.target.value)} placeholder="<h1>Hola!</h1><p>Tenemos novedades...</p>" rows={10}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-mono text-white placeholder:text-white/20 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/50" />
          </div>

          <button onClick={handleSend} disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-purple-500 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-purple-500/20 transition-transform active:scale-95 disabled:opacity-50">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
            Enviar Correo
          </button>
        </div>
      </div>
    </div>
  );
}

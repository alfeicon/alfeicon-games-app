import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { UserProfile } from "./EmbeddedLibrary";
import { Loader2 } from "lucide-react";

interface OnboardingFormProps {
  user: any;
  onComplete: (profile: UserProfile) => void;
}

export default function OnboardingForm({ user, onComplete }: OnboardingFormProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [alias, setAlias] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !alias || !birthDate) {
      setError("Por favor completa todos los campos.");
      return;
    }

    setLoading(true);
    setError(null);

    if (!supabase) {
      setError("Error de configuración de base de datos.");
      setLoading(false);
      return;
    }

    // Ensure profile exists or update it
    const { data, error: upsertError } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        first_name: firstName,
        last_name: lastName,
        alias,
        birth_date: birthDate,
      })
      .select()
      .single();

    if (upsertError) {
      console.error(upsertError);
      setError("Hubo un error al guardar tu perfil.");
      setLoading(false);
    } else {
      onComplete(data as UserProfile);
    }
  };

  return (
    <div className="w-full text-left">
      <div className="mb-8 text-center">
        <h2 className="text-xl font-black uppercase tracking-widest text-white">Completa tu perfil</h2>
        <p className="mt-2 text-xs text-gray-400">Antes de continuar, necesitamos algunos datos.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-xs text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">Nombre</label>
          <input
            type="text"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder-gray-500 focus:border-blue-500/50 focus:outline-none"
            placeholder="Ej. Juan"
          />
        </div>
        
        <div>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">Apellido</label>
          <input
            type="text"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder-gray-500 focus:border-blue-500/50 focus:outline-none"
            placeholder="Ej. Pérez"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">Alias (Nombre de usuario)</label>
          <input
            type="text"
            value={alias}
            onChange={e => setAlias(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder-gray-500 focus:border-blue-500/50 focus:outline-none"
            placeholder="Ej. JuanitoGamer"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">Fecha de Nacimiento</label>
          <input
            type="date"
            value={birthDate}
            onChange={e => setBirthDate(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder-gray-500 focus:border-blue-500/50 focus:outline-none"
            style={{ colorScheme: "dark" }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-4 flex w-full items-center justify-center rounded-xl bg-blue-600 py-4 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : "Guardar y Continuar"}
        </button>
      </form>
    </div>
  );
}

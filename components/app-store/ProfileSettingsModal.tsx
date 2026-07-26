import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile } from "./EmbeddedLibrary";
import { Loader2, X, AlertTriangle, Settings } from "lucide-react";

interface ProfileSettingsModalProps {
  user: any;
  profile: UserProfile;
  onClose: () => void;
  onUpdate: (updatedProfile: UserProfile) => void;
  onLogout: () => void;
}

export default function ProfileSettingsModal({ user, profile, onClose, onUpdate, onLogout }: ProfileSettingsModalProps) {
  const [firstName, setFirstName] = useState(profile.first_name || "");
  const [lastName, setLastName] = useState(profile.last_name || "");
  const [alias, setAlias] = useState(profile.alias || "");
  const [birthDate, setBirthDate] = useState(profile.birth_date || "");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);
  const [passMessage, setPassMessage] = useState<{ type: "success" | "error", text: string } | null>(null);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // Update Profile Data
    const { data, error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        alias,
        birth_date: birthDate,
      })
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      setMessage({ type: "error", text: "Error al actualizar perfil." });
      setLoading(false);
      return;
    }

    setMessage({ type: "success", text: "Perfil actualizado correctamente." });
    onUpdate(data as UserProfile);
    setLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) {
      setPassMessage({ type: "error", text: "Debes ingresar ambas contraseñas." });
      return;
    }
    
    setPassLoading(true);
    setPassMessage(null);

    // Verificar la contraseña actual haciendo login de nuevo
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: oldPassword,
    });

    if (signInError) {
      setPassMessage({ type: "error", text: "La contraseña actual es incorrecta." });
      setPassLoading(false);
      return;
    }

    // Actualizar a la nueva
    const { error: passError } = await supabase.auth.updateUser({ password: newPassword });
    
    if (passError) {
      setPassMessage({ type: "error", text: "Error al actualizar contraseña: " + passError.message });
    } else {
      setPassMessage({ type: "success", text: "¡Contraseña actualizada exitosamente!" });
      setOldPassword("");
      setNewPassword("");
    }
    setPassLoading(false);
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    // Para eliminar la cuenta desde el cliente sin función RPC, es complicado.
    // Lo mejor es llamar a un endpoint, o desvincular al usuario.
    // Por ahora, simularemos la eliminación y cerraremos sesión.
    await supabase.from("profiles").delete().eq("id", user.id);
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: -20 }} 
      className="w-full flex flex-col text-left"
    >
      <div className="mb-6 flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">
            <Settings size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Ajustes</p>
            <h2 className="text-xl font-black uppercase tracking-widest text-white leading-none">Mi Cuenta</h2>
          </div>
        </div>
        <button onClick={onClose} className="rounded-full bg-white/5 p-3 text-gray-400 transition-colors hover:bg-white/10 hover:text-white">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 pb-10 px-2">
          <form onSubmit={handleUpdateProfile} className="w-full mx-auto flex max-w-md flex-col gap-5">
            {message && (
              <div className={`rounded-xl border p-3 text-center text-xs ${message.type === 'success' ? 'border-green-500/20 bg-green-500/10 text-green-400' : 'border-red-500/20 bg-red-500/10 text-red-400'}`}>
                {message.text}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[9px] font-black uppercase tracking-widest text-gray-500">Nombre</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white focus:border-blue-500/50 outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-[9px] font-black uppercase tracking-widest text-gray-500">Apellido</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white focus:border-blue-500/50 outline-none" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[9px] font-black uppercase tracking-widest text-gray-500">Alias</label>
              <input type="text" value={alias} onChange={e => setAlias(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white focus:border-blue-500/50 outline-none" />
            </div>

            <div>
              <label className="mb-1 block text-[9px] font-black uppercase tracking-widest text-gray-500">Fecha de Nacimiento</label>
              <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white focus:border-blue-500/50 outline-none" style={{ colorScheme: "dark" }} />
            </div>

            <button type="submit" disabled={loading} className="mt-2 flex w-full items-center justify-center rounded-xl bg-blue-600 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-blue-500 disabled:opacity-50">
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Guardar Datos"}
            </button>
          </form>

          <form onSubmit={handleUpdatePassword} className="w-full mx-auto max-w-md mt-10 border-t border-white/5 pt-8 flex flex-col gap-5">
            <h3 className="mb-2 text-[10px] font-black uppercase tracking-widest text-blue-400">Seguridad</h3>
            
            {passMessage && (
              <div className={`rounded-xl border p-3 text-center text-xs ${passMessage.type === 'success' ? 'border-green-500/20 bg-green-500/10 text-green-400' : 'border-red-500/20 bg-red-500/10 text-red-400'}`}>
                {passMessage.text}
              </div>
            )}

            <div>
              <label className="mb-1 block text-[9px] font-black uppercase tracking-widest text-gray-500">Contraseña Actual</label>
              <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder-gray-600 focus:border-blue-500/50 outline-none" required />
            </div>

            <div>
              <label className="mb-1 block text-[9px] font-black uppercase tracking-widest text-gray-500">Nueva Contraseña</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder-gray-600 focus:border-blue-500/50 outline-none" required />
            </div>

            <button type="submit" disabled={passLoading} className="mt-2 flex w-full items-center justify-center rounded-xl bg-white/10 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-white/20 disabled:opacity-50">
              {passLoading ? <Loader2 size={16} className="animate-spin" /> : "Actualizar Contraseña"}
            </button>
          </form>

          <div className="mx-auto max-w-md mt-10 border-t border-white/5 pt-8">
            <h3 className="mb-4 text-[10px] font-black uppercase tracking-widest text-red-500">Danger Zone</h3>
            
            {!showDeleteConfirm ? (
              <button type="button" onClick={() => setShowDeleteConfirm(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 py-4 text-xs font-bold uppercase tracking-widest text-red-400 hover:bg-red-500/10 transition-colors">
                <AlertTriangle size={16} /> Eliminar Cuenta
              </button>
            ) : (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-center shadow-lg">
                <p className="mb-5 text-xs font-bold text-red-200">¿Estás completamente seguro? Esta acción no se puede deshacer y perderás todos tus juegos.</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 rounded-xl bg-white/10 py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-white/20 transition-colors">Cancelar</button>
                  <button onClick={handleDeleteAccount} className="flex-1 rounded-xl bg-red-600 py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-red-500 transition-colors shadow-[0_0_20px_rgba(220,38,38,0.3)]">Sí, Eliminar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
  );
}

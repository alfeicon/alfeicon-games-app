"use client";

import { useState, useEffect } from "react";
import { Cookie, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Verificar si el usuario ya aceptó las cookies
    const cookieConsent = localStorage.getItem("alfeicon_cookie_consent");
    if (!cookieConsent) {
      // Pequeño retraso para que no aparezca de golpe al cargar la página
      const timer = setTimeout(() => setShowBanner(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("alfeicon_cookie_consent", "accepted");
    setShowBanner(false);
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed top-4 right-4 z-50 w-[calc(100vw-2rem)] md:w-[400px]"
        >
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0f1217]/95 p-5 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                  <Cookie size={16} />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Uso de Cookies</h3>
              </div>
              <button onClick={() => setShowBanner(false)} className="text-gray-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <p className="text-xs text-gray-400 leading-relaxed">
              Utilizamos cookies para mejorar tu experiencia en nuestra tienda, analizar nuestro tráfico y personalizar el contenido. 
              Al continuar navegando, aceptas nuestra política de cookies y privacidad.
            </p>
            
            <div className="mt-2 flex gap-2">
              <button 
                onClick={handleAccept}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-[11px] font-black uppercase tracking-widest text-white transition-colors hover:bg-blue-500 shadow-lg shadow-blue-500/20"
              >
                Entendido
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

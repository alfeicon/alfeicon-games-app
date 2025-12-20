// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// 1. IMPORTACIONES DE HERRAMIENTAS
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Pixels from "@/components/Pixels";

const inter = Inter({ subsets: ["latin"] });

// 2. AQUÍ ESTÁ LO NUEVO: CONFIGURACIÓN DE LA TARJETA (BANNER)
export const metadata: Metadata = {
  metadataBase: new URL('https://alfeicon-games.vercel.app'), // Esto permite que Vercel encuentre la imagen
  title: {
    default: "Alfeicon Games | Juegos Digitales",
    template: "%s | Alfeicon Games"
  },
  description: "Compra tus juegos favoritos de Nintendo Switch a precios increíbles. Entrega inmediata y seguridad garantizada.",
  
  // Configuración para WhatsApp, Facebook, Instagram (Open Graph)
  openGraph: {
    title: "Alfeicon Games 🎮 | Ofertas Nintendo Switch",
    description: "🔥 Packs y Juegos a precios bajos. ¡Entra y revisa nuestro catálogo con entrega inmediata!",
    url: 'https://alfeicon-games.vercel.app',
    siteName: 'Alfeicon Games',
    images: [
      {
        url: '/banner.png', // <--- BUSCARÁ ESTA FOTO EN TU CARPETA PUBLIC
        width: 1200,
        height: 630,
        alt: 'Portada Alfeicon Games',
      },
    ],
    locale: 'es_CL',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body 
        className={`${inter.className} bg-black text-white overscroll-none`}
        suppressHydrationWarning={true} 
      >
        {/* 3. LOS PIXELES VAN PRIMERO PARA RASTREAR DESDE EL INICIO */}
        <Pixels />

        {children}
        
        {/* 4. HERRAMIENTAS DE MONITOREO AL FINAL */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
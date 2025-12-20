import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// 1. IMPORTAMOS EL COMPONENTE DE VERCEL
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next"; // <--- NUEVO
import Pixels from "@/components/Pixels";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Alfeicon Games",
  description: "Tu tienda de juegos digitales",
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
        {children}
        
        {/* 2. AGREGAMOS EL COMPONENTE AQUÍ (INVISIBLE) */}
        <Pixels />  {/* <-- ESTO ES LO IMPORTANTE */}
        <Analytics />
        <SpeedInsights /> {/* <--- NUEVO AQUÍ */}
      </body>
    </html>
  );
}
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.3.5"],
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // <--- ESTO ES EL COMODÍN. Autoriza cualquier sitio web.
      },
    ],
  },
};

export default nextConfig;

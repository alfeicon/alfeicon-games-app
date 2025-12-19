import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Orígenes del dev server desde tu celular en la red. Los comodines cubren
  // subredes típicas de WiFi/hotspot, así no hay que editar la IP cada vez.
  // (Se mantienen algunas IPs exactas como respaldo.)
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.*.*",
    "172.20.10.*",
    "10.*.*.*",
    "192.168.1.86",
  ],
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;

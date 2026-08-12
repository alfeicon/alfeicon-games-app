"use client";

import dynamic from "next/dynamic";
import type { StoreInitialData } from "./StoreApp";

const MobileAppStore = dynamic(() => import("./StoreApp"), {
  ssr: false,
  loading: () => <main className="min-h-screen bg-[#080b0f]" aria-busy="true" />,
});

export default function StoreAppClient({ initial }: { initial: StoreInitialData }) {
  return <MobileAppStore initial={initial} />;
}

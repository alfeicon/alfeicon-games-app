import { EntregaWizard } from "./EntregaWizard";

export default function EntregaPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#090b0d] text-white selection:bg-yellow-500/30">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-500/[0.04] blur-3xl" />
      <EntregaWizard />
    </div>
  );
}

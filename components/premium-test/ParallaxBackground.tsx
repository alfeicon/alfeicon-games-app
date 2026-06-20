"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

export function ParallaxBackground() {
  const backRef = useRef<HTMLDivElement | null>(null);
  const midRef = useRef<HTMLDivElement | null>(null);
  const frontRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const x = event.clientX / window.innerWidth - 0.5;
      const y = event.clientY / window.innerHeight - 0.5;

      gsap.to(backRef.current, { x: x * 18, y: y * 12, duration: 0.9, ease: "power3.out" });
      gsap.to(midRef.current, { x: x * -34, y: y * -22, duration: 0.75, ease: "power3.out" });
      gsap.to(frontRef.current, { x: x * 56, y: y * 36, duration: 0.62, ease: "power3.out" });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden bg-[#06182f]">
      <div ref={backRef} className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#0b6acb_0%,#0c4f8d_35%,#163350_68%,#08111f_100%)]" />
        <div className="absolute left-[-14%] top-[-20%] size-[42rem] rounded-full bg-sky-300/18 blur-3xl" />
        <div className="absolute bottom-[-22%] right-[-10%] size-[44rem] rounded-full bg-blue-950/45 blur-3xl" />
      </div>

      <div ref={midRef} className="absolute inset-0">
        <div className="absolute left-[19%] top-[4.5rem] h-56 w-40 rotate-[-10deg] rounded-[2.4rem] bg-white/32 blur-[2px]" />
        <div className="absolute left-[35%] top-[8.5rem] h-32 w-52 rotate-[7deg] rounded-[2rem] bg-slate-950/45 blur-[2px]" />
        <div className="absolute right-[26%] top-[8rem] h-36 w-36 rounded-full bg-amber-300/75 blur-[3px]" />
        <div className="absolute right-[15%] top-[12rem] h-40 w-10 rounded-full bg-yellow-200/80 blur-[2px]" />
        <div className="absolute bottom-[9%] left-[8%] h-[26rem] w-[18rem] rounded-[10rem_10rem_2rem_2rem] border border-white/12 bg-white/[0.035] backdrop-blur-sm" />
        <div className="absolute bottom-[13%] left-[22%] h-56 w-72 rotate-[-5deg] rounded-[2rem] bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.34)_0_9px,rgba(8,22,42,0.34)_9px_18px)] opacity-80 blur-[0.3px]" />
        <div className="absolute bottom-[10%] right-[15%] h-44 w-10 rounded-full bg-amber-300/70 blur-[1px]" />
        <div className="absolute bottom-[14%] right-[10%] h-24 w-20 rounded-full bg-yellow-300/70 blur-sm" />
      </div>

      <div ref={frontRef} className="absolute inset-0">
        <div className="absolute left-[47%] top-[9rem] h-28 w-12 rotate-12 rounded-full bg-orange-400/85 blur-[2px]" />
        <div className="absolute left-[57%] top-[10rem] h-36 w-8 rounded-full bg-yellow-200/75 blur-[1.5px]" />
        <div className="absolute bottom-[8%] right-[8%] h-56 w-24 rounded-[2rem] border border-white/14 bg-white/[0.045] backdrop-blur-sm" />
        <div className="absolute left-[4%] top-[22%] h-64 w-64 rounded-[3rem] border border-white/10 bg-white/[0.025]" />
        <div className="absolute bottom-[16%] right-[6%] size-7 rounded-full bg-yellow-200/80 blur-[1px]" />
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,transparent,rgba(2,6,23,0.42))]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),rgba(2,6,23,0.38))]" />
    </div>
  );
}

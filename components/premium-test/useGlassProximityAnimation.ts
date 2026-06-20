"use client";

import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";

type GlassProximityAnimationOptions = {
  panelRef: RefObject<HTMLElement | null>;
  lowerContentRef: RefObject<HTMLElement | null>;
  dividerRef: RefObject<HTMLElement | null>;
  linksRef: RefObject<HTMLElement[]>;
};

const distanceFromRect = (x: number, y: number, rect: DOMRect) => {
  const dx = Math.max(rect.left - x, 0, x - rect.right);
  const dy = Math.max(rect.top - y, 0, y - rect.bottom);
  return Math.hypot(dx, dy);
};

export function useGlassProximityAnimation({
  panelRef,
  lowerContentRef,
  dividerRef,
  linksRef,
}: GlassProximityAnimationOptions) {
  useEffect(() => {
    const panel = panelRef.current;
    const lowerContent = lowerContentRef.current;
    const divider = dividerRef.current;

    if (!panel || !lowerContent || !divider) return;

    const closedHeight = 76;
    const getOpenHeight = () => (window.matchMedia("(min-width: 640px)").matches ? 286 : 238);
    let isOpen = false;

    gsap.set(panel, {
      height: closedHeight,
      transformOrigin: "50% 0%",
      y: 0,
      scaleX: 1,
      scaleY: 1,
    });
    gsap.set([lowerContent, divider], { autoAlpha: 0, y: -10 });

    gsap.fromTo(
      panel,
      { opacity: 0, y: -34, scale: 0.985 },
      { opacity: 1, y: 0, scale: 1, duration: 0.72, ease: "power3.out" },
    );

    const openPanel = () => {
      if (isOpen) return;
      isOpen = true;

      const openHeight = getOpenHeight();
      gsap.killTweensOf([panel, lowerContent, divider, linksRef.current]);

      // Stronger glass bounce: expands past the target, compresses, then settles.
      gsap
        .timeline()
        .to(panel, {
          height: openHeight + 46,
          y: -8,
          scaleX: 1.018,
          scaleY: 1.035,
          duration: 0.28,
          ease: "power2.out",
        })
        .to(panel, {
          height: openHeight - 10,
          y: 3,
          scaleX: 0.996,
          scaleY: 0.985,
          duration: 0.16,
          ease: "power1.inOut",
        })
        .to(panel, {
          height: openHeight,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          duration: 0.62,
          ease: "elastic.out(1, 0.45)",
        });

      gsap.to([lowerContent, divider], {
        autoAlpha: 1,
        y: 0,
        duration: 0.34,
        ease: "power2.out",
        delay: 0.18,
      });
      gsap.fromTo(
        linksRef.current,
        { opacity: 0, x: -20, scale: 0.94 },
        { opacity: 1, x: 0, scale: 1, duration: 0.5, ease: "back.out(2.2)", stagger: 0.075, delay: 0.22 },
      );
    };

    const closePanel = () => {
      if (!isOpen) return;
      isOpen = false;

      gsap.killTweensOf([panel, lowerContent, divider, linksRef.current]);
      gsap.to([lowerContent, divider], { autoAlpha: 0, y: -10, duration: 0.18, ease: "power2.out" });
      gsap
        .timeline()
        .to(panel, { height: closedHeight - 6, scaleY: 0.96, duration: 0.16, ease: "power2.in" }, 0.04)
        .to(panel, { height: closedHeight, scaleY: 1, y: 0, duration: 0.32, ease: "power3.out" });
    };

    const handleMouseMove = (event: MouseEvent) => {
      const distance = distanceFromRect(event.clientX, event.clientY, panel.getBoundingClientRect());

      if (distance < 150) {
        openPanel();
      } else if (distance > 285) {
        closePanel();
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [dividerRef, linksRef, lowerContentRef, panelRef]);
}

"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type ShaderAnimationProps = {
  className?: string;
};

export function ShaderAnimation({ className = "" }: ShaderAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    animationId: number;
    isVisible: boolean;
    isInViewport: boolean;
    isRunning: boolean;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const camera = new THREE.Camera();
    camera.position.z = 1;

    const scene = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(2, 2);

    const uniforms = {
      time: { value: 1.0 },
      resolution: { value: new THREE.Vector2() },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        void main() {
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform vec2 resolution;
        uniform float time;

        void main(void) {
          vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
          float t = time * 0.05;
          float lineWidth = 0.002;
          vec3 color = vec3(0.0);

          for (int j = 0; j < 3; j++) {
            for (int i = 0; i < 5; i++) {
              color[j] += lineWidth * float(i * i) / abs(fract(t - 0.01 * float(j) + float(i) * 0.01) * 5.0 - length(uv) + mod(uv.x + uv.y, 0.2));
            }
          }

          vec3 warmTint = vec3(color.r * 0.9, color.g * 0.55, color.b * 0.28);
          gl_FragColor = vec4(warmTint, 1.0);
        }
      `,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.pointerEvents = "none";

    container.appendChild(renderer.domElement);

    const onResize = () => {
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      renderer.setSize(width, height, false);
      uniforms.resolution.value.set(renderer.domElement.width, renderer.domElement.height);
    };

    onResize();
    window.addEventListener("resize", onResize);

    const animate = () => {
      if (!sceneRef.current?.isVisible) {
        if (sceneRef.current) sceneRef.current.isRunning = false;
        return;
      }

      uniforms.time.value += 0.05;
      renderer.render(scene, camera);
      const animationId = requestAnimationFrame(animate);

      if (sceneRef.current) {
        sceneRef.current.animationId = animationId;
      }
    };

    sceneRef.current = { renderer, animationId: 0, isVisible: true, isInViewport: true, isRunning: true };
    animate();

    const startAnimation = () => {
      if (!sceneRef.current || sceneRef.current.isRunning || !sceneRef.current.isVisible) return;
      sceneRef.current.isRunning = true;
      animate();
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (!sceneRef.current) return;
      sceneRef.current.isInViewport = Boolean(entry?.isIntersecting);
      sceneRef.current.isVisible = sceneRef.current.isInViewport && !document.hidden;

      if (sceneRef.current.isVisible) {
        startAnimation();
      } else {
        sceneRef.current.isRunning = false;
        cancelAnimationFrame(sceneRef.current.animationId);
      }
    });

    observer.observe(container);

    const handleVisibilityChange = () => {
      if (!sceneRef.current) return;
      sceneRef.current.isVisible = sceneRef.current.isInViewport && !document.hidden;

      if (sceneRef.current.isVisible) {
        startAnimation();
      } else {
        sceneRef.current.isRunning = false;
        cancelAnimationFrame(sceneRef.current.animationId);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      observer.disconnect();

      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);
      }

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, []);

  return <div ref={containerRef} className={`pointer-events-none h-full w-full overflow-hidden ${className}`} />;
}

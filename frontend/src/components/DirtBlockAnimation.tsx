import React, { useEffect, useRef } from "react";
import { cn } from "../lib/cn";

type CubeProps = {
  size?: number;
  className?: string;
};

export function DirtBlockAnimation({ size = 16, className }: CubeProps) {
  const cubeRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const cube = cubeRef.current;
    if (!cube) return;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const t = (timestamp - startTimeRef.current) / 1000;

      const rotateY = t * 45;
      const rotateX = -20 + Math.sin(t * 0.8) * 10;

      cube.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const half = size / 2;

  const faceStyle = (transform: string): React.CSSProperties => ({
    position: "absolute",
    width: size,
    height: size,
    transform,
    borderWidth: 1,
    boxSizing: "border-box",
  });

  return (
    <div
      style={{
        width: size,
        height: size,
        perspective: size * 4,
      }}
    >
      <div
        ref={cubeRef}
        className={cn("border-current", className)}
        style={{
          width: size,
          height: size,
          position: "relative",
          transformStyle: "preserve-3d",
        }}
      >
        <div
          className={cn("border border-current", className)}
          style={faceStyle(`translateZ(${half}px)`)}
        />
        <div
          className={cn("border border-current", className)}
          style={faceStyle(`rotateY(180deg) translateZ(${half}px)`)}
        />
        <div
          className={cn("border border-current", className)}
          style={faceStyle(`rotateY(-90deg) translateZ(${half}px)`)}
        />
        <div
          className={cn("border border-current", className)}
          style={faceStyle(`rotateY(90deg) translateZ(${half}px)`)}
        />
        <div
          className={cn("border border-current", className)}
          style={faceStyle(`rotateX(90deg) translateZ(${half}px)`)}
        />
        <div
          className={cn("border border-current", className)}
          style={faceStyle(`rotateX(-90deg) translateZ(${half}px)`)}
        />
      </div>
    </div>
  );
}

export default DirtBlockAnimation;

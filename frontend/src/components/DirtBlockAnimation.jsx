import { useEffect, useRef } from "react";

// Texture is a cube net: 4 columns x 3 rows
// Layout: [empty, front, empty, empty]
//         [left,  top,   right, back]
//         [empty, bottom, empty, empty]
const FACE_UV = {
  front:  { x: 1, y: 0 },
  left:   { x: 0, y: 1 },
  top:    { x: 1, y: 1 },
  right:  { x: 2, y: 1 },
  back:   { x: 3, y: 1 },
  bottom: { x: 1, y: 2 },
};

function Face({ face, size, half, textureUrl }) {
  const uv = FACE_UV[face];
  
  const transforms = {
    front:  `translateZ(${half}px)`,
    back:   `rotateY(180deg) translateZ(${half}px)`,
    left:   `rotateY(-90deg) translateZ(${half}px)`,
    right:  `rotateY(90deg) translateZ(${half}px)`,
    top:    `rotateX(90deg) translateZ(${half}px)`,
    bottom: `rotateX(-90deg) translateZ(${half}px)`,
  };

  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        transform: transforms[face],
        backgroundImage: `url(${textureUrl})`,
        backgroundSize: `${size * 4}px ${size * 3}px`,
        backgroundPosition: `-${uv.x * size}px -${uv.y * size}px`,
        imageRendering: "pixelated",
      }}
    />
  );
}

export function DirtBlockAnimation({ size = 16 }) {
  const cubeRef = useRef(null);
  const animationRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    const cube = cubeRef.current;
    if (!cube) return;

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const t = (timestamp - startTimeRef.current) / 1000;

      // Multi-axis rotation with varying speeds using sine waves
      const rotateY = t * 40; // Base Y rotation ~40°/sec
      const rotateX = -25 + Math.sin(t * 0.7) * 10; // Wobble X between -35 and -15
      const rotateZ = Math.sin(t * 0.5) * 5; // Subtle Z wobble ±5°

      cube.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`;

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
  const textureUrl = "/assets/dirt-block-tex.png";

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
        style={{
          width: size,
          height: size,
          position: "relative",
          transformStyle: "preserve-3d",
        }}
      >
        <Face face="front" size={size} half={half} textureUrl={textureUrl} />
        <Face face="back" size={size} half={half} textureUrl={textureUrl} />
        <Face face="left" size={size} half={half} textureUrl={textureUrl} />
        <Face face="right" size={size} half={half} textureUrl={textureUrl} />
        <Face face="top" size={size} half={half} textureUrl={textureUrl} />
        <Face face="bottom" size={size} half={half} textureUrl={textureUrl} />
      </div>
    </div>
  );
}

export default DirtBlockAnimation;

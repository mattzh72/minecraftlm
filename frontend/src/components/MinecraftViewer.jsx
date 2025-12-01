import { useEffect, useRef } from 'react';
import {
  loadDeepslateResources,
  getDeepslateResources,
  structureFromJsonData,
  mat4,
  vec3
} from '../utils/deepslate';

export default function MinecraftViewer({ structureData }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    // Load resources once on mount
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = "/assets/atlas.png";

    image.onload = () => {
      // Load assets
      fetch('/assets/assets.js')
        .then(res => res.text())
        .then(code => {
          // Execute assets.js to define window.assets
          eval(code);
          loadDeepslateResources(image, window.assets);
        });
    };

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!structureData || !canvasRef.current) return;

    const resources = getDeepslateResources();
    if (!resources) return;

    const canvas = canvasRef.current;
    const gl = canvas.getContext("webgl");

    // Create structure from JSON data
    const structure = structureFromJsonData(structureData);

    // Clean up old renderer
    if (rendererRef.current) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    // Create new renderer
    const renderer = new window.deepslate.StructureRenderer(
      gl,
      structure,
      resources,
      { chunkSize: 8 }
    );
    rendererRef.current = renderer;

    // Camera setup
    let viewDist = 4;
    let xRotation = 0.8;
    let yRotation = 0.5;
    const size = structure.getSize();
    let cameraPos = vec3.create();
    vec3.set(cameraPos, -size[0] / 2, -size[1] / 2, -size[2] / 2);

    // Render function
    function render() {
      yRotation = yRotation % (Math.PI * 2);
      xRotation = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, xRotation));
      viewDist = Math.max(1, Math.min(20, viewDist));

      const view = mat4.create();
      mat4.rotateX(view, view, xRotation);
      mat4.rotateY(view, view, yRotation);
      mat4.translate(view, view, cameraPos);

      renderer.drawStructure(view);
      renderer.drawGrid(view);
    }

    // Initial render
    animationFrameRef.current = requestAnimationFrame(render);

    // Movement functions
    function move3d(direction, relativeVertical = true, sensitivity = 1) {
      let offset = vec3.create();
      vec3.set(
        offset,
        direction[0] * sensitivity,
        direction[1] * sensitivity,
        direction[2] * sensitivity
      );
      if (relativeVertical) {
        vec3.rotateX(offset, offset, [0, 0, 0], -xRotation * sensitivity);
      }
      vec3.rotateY(offset, offset, [0, 0, 0], -yRotation * sensitivity);
      vec3.add(cameraPos, cameraPos, offset);
    }

    function pan(direction, sensitivity = 1) {
      yRotation += (direction[0] / 200) * sensitivity;
      xRotation += (direction[1] / 200) * sensitivity;
    }

    // Mouse controls
    let clickPos = null;
    const handleMouseDown = (evt) => {
      evt.preventDefault();
      clickPos = [evt.clientX, evt.clientY];
    };

    const handleMouseMove = (evt) => {
      if (clickPos) {
        const args = [evt.clientX - clickPos[0], evt.clientY - clickPos[1]];
        pan(args);
        clickPos = [evt.clientX, evt.clientY];
        animationFrameRef.current = requestAnimationFrame(render);
      }
    };

    const handleMouseUp = () => {
      clickPos = null;
    };

    const handleWheel = (evt) => {
      evt.preventDefault();
      move3d([0, 0, -evt.deltaY / 200]);
      animationFrameRef.current = requestAnimationFrame(render);
    };

    // Keyboard controls
    const moveDist = 0.2;
    const keyMoves = {
      w: [0, 0, moveDist],
      s: [0, 0, -moveDist],
      a: [moveDist, 0, 0],
      d: [-moveDist, 0, 0],
      arrowup: [0, 0, moveDist],
      arrowdown: [0, 0, -moveDist],
      arrowleft: [moveDist, 0, 0],
      arrowright: [-moveDist, 0, 0],
      shift: [0, moveDist, 0],
      " ": [0, -moveDist, 0],
    };
    let pressedKeys = new Set();

    function updatePosition() {
      if (pressedKeys.size === 0) {
        return;
      }

      let direction = vec3.create();
      for (const key of pressedKeys) {
        if (keyMoves[key]) {
          vec3.add(direction, direction, keyMoves[key]);
        }
      }

      move3d(direction, false);
      render();
      animationFrameRef.current = requestAnimationFrame(updatePosition);
    }

    const handleKeyDown = (evt) => {
      const key = evt.key.toLowerCase();
      if (keyMoves[key] || evt.key === "Shift") {
        evt.preventDefault();
        pressedKeys.add(key);
        if (!animationFrameRef.current) {
          animationFrameRef.current = requestAnimationFrame(updatePosition);
        }
      }
    };

    const handleKeyUp = (evt) => {
      const key = evt.key.toLowerCase();
      if (keyMoves[key] || evt.key === "Shift") {
        evt.preventDefault();
        pressedKeys.delete(key);
      }
    };

    // Add event listeners
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseout", handleMouseUp);
    canvas.addEventListener("wheel", handleWheel);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    // Cleanup
    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseout", handleMouseUp);
      canvas.removeEventListener("wheel", handleWheel);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [structureData]);

  return (
    <canvas
      ref={canvasRef}
      width={window.innerWidth * 0.7}
      height={window.innerHeight}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { useTheme } from "../context/useTheme";

function AboutToothVisual() {
  const canvasRef = useRef(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const lightMode = theme === "light";
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, .1, 50);
    camera.position.set(0, .15, 6.4);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = lightMode ? .96 : 1;

    const tooth = new THREE.Group();
    scene.add(tooth);
    const enamel = new THREE.MeshPhysicalMaterial({ color: 0xf7f5ef, roughness: .28, metalness: 0, clearcoat: .62, clearcoatRoughness: .22 });
    let active = true;
    let loadedModel = null;
    new GLTFLoader().load("/models/tooth.glb", ({ scene: model }) => {
      if (!active) return;
      loadedModel = model;
      const actualTooth = model.getObjectByName("Sphere");
      if (!actualTooth?.isMesh) return;
      model.traverse((item) => { if (item.isMesh && item !== actualTooth) item.visible = false; });
      let bounds = new THREE.Box3().setFromObject(actualTooth);
      let size = bounds.getSize(new THREE.Vector3());
      if (size.x > size.y && size.x > size.z) actualTooth.rotation.z += Math.PI / 2;
      else if (size.z > size.y && size.z > size.x) actualTooth.rotation.x += Math.PI / 2;
      bounds = new THREE.Box3().setFromObject(actualTooth);
      size = bounds.getSize(new THREE.Vector3());
      model.position.sub(bounds.getCenter(new THREE.Vector3()));
      model.scale.setScalar(2.8 / Math.max(size.x, size.y, size.z));
      actualTooth.material = enamel;
      tooth.add(model);
    });

    scene.add(new THREE.HemisphereLight(0xffffff, lightMode ? 0x73949c : 0x0b2934, lightMode ? 2.1 : 1.8));
    const key = new THREE.DirectionalLight(0xffffff, 3.1); key.position.set(-3, 4, 4); scene.add(key);
    const rim = new THREE.PointLight(0x2ec4c7, lightMode ? 8 : 11, 10); rim.position.set(3, 0, 3); scene.add(rim);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const clock = new THREE.Clock();
    let frame = 0;
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
    const render = () => {
      frame = requestAnimationFrame(render);
      const elapsed = clock.getElapsedTime();
      const motion = reducedMotion.matches ? 0 : 1;
      tooth.rotation.y = elapsed * .16 * motion;
      tooth.rotation.x = -.07 + Math.sin(elapsed * .55) * .025 * motion;
      tooth.position.y = Math.sin(elapsed * .8) * .08 * motion;
      renderer.render(scene, camera);
    };
    render();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      if (loadedModel) loadedModel.traverse((item) => item.geometry?.dispose());
      enamel.dispose();
      renderer.dispose();
    };
  }, [theme]);

  return <canvas ref={canvasRef} className="about-tooth-canvas" aria-label="Animated three-dimensional dental tooth" />;
}

export default AboutToothVisual;

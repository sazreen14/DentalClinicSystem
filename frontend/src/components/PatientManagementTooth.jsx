import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { useTheme } from "../context/useTheme";

function PatientManagementTooth() {
  const canvasRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const lightMode = theme === "light";
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, .1, 50);
    camera.position.set(0, .15, 6.8);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = lightMode ? .94 : 1;

    const tooth = new THREE.Group();
    scene.add(tooth);
    const enamel = new THREE.MeshPhysicalMaterial({ color: 0xf7f5ef, roughness: .29, metalness: 0, clearcoat: .6, clearcoatRoughness: .22 });
    const orbitGroup = new THREE.Group();
    const orbitDefinitions = [{ y: .65, rx: 2, rz: .52, tilt: .1, speed: .08 },{ y: -.45, rx: 2.35, rz: .62, tilt: -.12, speed: -.065 },{ y: -1.42, rx: 1.72, rz: .42, tilt: .08, speed: .1 }];
    const orbits = orbitDefinitions.map((definition, index) => {
      const points = Array.from({ length: 128 }, (_, pointIndex) => {
        const angle = pointIndex / 128 * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle) * definition.rx, 0, Math.sin(angle) * definition.rz);
      });
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: lightMode ? 0x168f92 : 0x52d5d7, transparent: true, opacity: lightMode ? .34 : .54, depthTest: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const ring = new THREE.LineLoop(geometry, material);
      ring.position.y = definition.y;
      ring.rotation.set(definition.tilt, index * .42, definition.tilt * .7);
      ring.userData = { baseY: ring.rotation.y, speed: definition.speed };
      orbitGroup.add(ring);
      return ring;
    });
    scene.add(orbitGroup);

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
      model.scale.setScalar(3.25 / Math.max(size.x, size.y, size.z));
      actualTooth.material = enamel;
      tooth.add(model);
    });

    scene.add(new THREE.HemisphereLight(0xffffff, lightMode ? 0x79969e : 0x092934, lightMode ? 2.05 : 1.85));
    const key = new THREE.DirectionalLight(0xffffff, 3.2); key.position.set(-3, 4, 4); scene.add(key);
    const rim = new THREE.PointLight(0x2ec4c7, lightMode ? 8 : 11, 11); rim.position.set(3, .2, 3); scene.add(rim);
    const fill = new THREE.PointLight(0x75aee8, lightMode ? 4 : 5, 9); fill.position.set(-3, -1, 2); scene.add(fill);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const clock = new THREE.Clock();
    let frame = 0;
    const resize = () => { const { width, height } = canvas.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
    const render = () => {
      frame = requestAnimationFrame(render);
      const elapsed = clock.getElapsedTime();
      const motion = reducedMotion.matches ? 0 : 1;
      const targetY = elapsed * .13 * motion + pointerRef.current.x * .13 * motion;
      tooth.rotation.y += (targetY - tooth.rotation.y) * .035;
      tooth.rotation.x += ((-.06 + pointerRef.current.y * .08 * motion) - tooth.rotation.x) * .04;
      tooth.position.y = Math.sin(elapsed * .78) * .09 * motion;
      orbits.forEach((ring) => { ring.rotation.y = ring.userData.baseY + elapsed * ring.userData.speed * motion; });
      renderer.render(scene, camera);
    };
    render();
    return () => { active = false; cancelAnimationFrame(frame); observer.disconnect(); if (loadedModel) loadedModel.traverse((item) => item.geometry?.dispose()); orbits.forEach((ring) => { ring.geometry.dispose(); ring.material.dispose(); }); enamel.dispose(); renderer.dispose(); };
  }, [theme]);

  return <canvas ref={canvasRef} className="patient-management-tooth-canvas" aria-label="Animated three-dimensional dental tooth" onPointerMove={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); pointerRef.current = { x: (event.clientX - bounds.left) / bounds.width * 2 - 1, y: (event.clientY - bounds.top) / bounds.height * 2 - 1 }; }} onPointerLeave={() => { pointerRef.current = { x: 0, y: 0 }; }} />;
}

export default PatientManagementTooth;

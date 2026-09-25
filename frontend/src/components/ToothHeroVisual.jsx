import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FaBell, FaCheckCircle, FaShieldAlt, FaTooth } from "react-icons/fa";
import { useTheme } from "../context/useTheme";

const callouts = [
  [FaShieldAlt, "Secure", "Protected information"],
  [FaBell, "Reminder", "Never miss your appointment"],
  [FaCheckCircle, "Easy", "Online booking"],
  [FaTooth, "Trusted", "Patient-centred dental care"],
];

function ToothHeroVisual() {
  const canvasRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const [modelState, setModelState] = useState("loading");
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.35, 8.2);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const lightMode = theme === "light";
    renderer.toneMappingExposure = lightMode ? .94 : .98;

    const tooth = new THREE.Group();
    scene.add(tooth);
    const enamel = new THREE.MeshPhysicalMaterial({ color: 0xf4f1e9, roughness: 0.3, metalness: 0, clearcoat: 0.58, clearcoatRoughness: 0.24 });
    tooth.rotation.x = -.08;

    const orbitSystem = new THREE.Group();
    const orbitColor = lightMode ? 0x168f92 : 0x52d5d7;
    const orbitDefinitions = [
      { y: 1.35, rx: 2.25, rz: .58, x: .08, z: -.12, opacity: .38, speed: .055 },
      { y: .72, rx: 2.65, rz: .72, x: -.1, z: .09, opacity: .55, speed: -.045 },
      { y: .12, rx: 2.85, rz: .82, x: .12, z: -.07, opacity: .62, speed: .065 },
      { y: -.5, rx: 2.45, rz: .7, x: -.08, z: .13, opacity: .5, speed: -.06 },
      { y: -1.16, rx: 2.05, rz: .58, x: .1, z: -.1, opacity: .62, speed: .08 },
      { y: -1.62, rx: 1.75, rz: .46, x: -.06, z: .08, opacity: .58, speed: -.085 },
      { y: -1.94, rx: 2.15, rz: .48, x: .08, z: -.05, opacity: .46, speed: .052 },
      { y: -2.18, rx: 2.55, rz: .52, x: -.04, z: .04, opacity: .3, speed: -.04 },
    ];
    const orbits = orbitDefinitions.map((definition, index) => {
      const points = Array.from({ length: 160 }, (_, pointIndex) => {
        const angle = pointIndex / 160 * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle) * definition.rx, 0, Math.sin(angle) * definition.rz);
      });
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const materialOptions = {
        color: orbitColor,
        transparent: true,
        opacity: definition.opacity * (lightMode ? .76 : 1),
        depthTest: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      };
      const material = index % 3 === 1
        ? new THREE.LineDashedMaterial({ ...materialOptions, dashSize: .11, gapSize: .075 })
        : new THREE.LineBasicMaterial(materialOptions);
      const ring = new THREE.LineLoop(geometry, material);
      if (ring.computeLineDistances) ring.computeLineDistances();
      ring.position.y = definition.y;
      ring.rotation.set(definition.x, index * .34, definition.z);
      ring.userData = { baseRotationY: ring.rotation.y, speed: definition.speed, responsiveIndex: index };
      orbitSystem.add(ring);
      return ring;
    });
    scene.add(orbitSystem);

    let active = true;
    let loadedModel = null;
    const disposeMaterial = (material) => {
      if (!material) return;
      Object.values(material).forEach((value) => { if (value?.isTexture) value.dispose(); });
      material.dispose();
    };
    new GLTFLoader().load("/models/tooth.glb", ({ scene: model }) => {
      if (!active) {
        model.traverse((item) => { if (item.geometry) item.geometry.dispose(); if (Array.isArray(item.material)) item.material.forEach(disposeMaterial); else disposeMaterial(item.material); });
        return;
      }
      loadedModel = model;
      const actualTooth = model.getObjectByName("Sphere");
      if (!actualTooth?.isMesh) {
        const error = new Error('Expected tooth mesh "Sphere" was not found in /models/tooth.glb');
        if (import.meta.env.DEV) console.error(error.message);
        setModelState("error");
        return;
      }
      const ignoredMeshes = [];
      model.traverse((item) => { if (item.isMesh && item !== actualTooth) ignoredMeshes.push(item); });
      ignoredMeshes.forEach((item) => {
        item.removeFromParent();
        item.geometry?.dispose();
        if (Array.isArray(item.material)) item.material.forEach(disposeMaterial); else disposeMaterial(item.material);
      });
      let bounds = new THREE.Box3().setFromObject(actualTooth);
      let size = bounds.getSize(new THREE.Vector3());
      if (size.x > size.y && size.x > size.z) actualTooth.rotation.z += Math.PI / 2;
      else if (size.z > size.y && size.z > size.x) actualTooth.rotation.x += Math.PI / 2;
      bounds = new THREE.Box3().setFromObject(actualTooth);
      size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      model.position.sub(center);
      const scale = 3.85 / Math.max(size.x, size.y, size.z);
      model.scale.setScalar(scale);
      model.traverse((item) => {
        if (!item.isMesh || item !== actualTooth) return;
        if (Array.isArray(item.material)) item.material.forEach(disposeMaterial); else disposeMaterial(item.material);
        if (!item.geometry.attributes.normal) item.geometry.computeVertexNormals();
        item.material = enamel;
        item.castShadow = false;
        item.receiveShadow = false;
      });
      tooth.add(model);
      setModelState("ready");
    }, undefined, (error) => {
      if (!active) return;
      if (import.meta.env.DEV) console.error("Unable to load the homepage tooth model from /models/tooth.glb", error);
      setModelState("error");
    });

    scene.add(new THREE.HemisphereLight(0xf4fbff, lightMode ? 0x78909c : 0x12343b, lightMode ? 2.15 : 1.9));
    const key = new THREE.DirectionalLight(0xfffdf7, lightMode ? 3.55 : 3.2); key.position.set(-3,4,5); scene.add(key);
    const rim = new THREE.PointLight(lightMode ? 0x159c9f : 0x42e5e7, lightMode ? 9 : 12, 12); rim.position.set(3,0.5,3); scene.add(rim);
    const fill = new THREE.PointLight(lightMode ? 0x6f91b5 : 0x9dbfff, lightMode ? 6 : 5, 10); fill.position.set(-3,-1,2); scene.add(fill);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = !document.hidden;
    let frame = 0;
    const clock = new THREE.Clock();
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      const visibleRingCount = width < 480 ? 4 : width < 700 ? 6 : 8;
      orbits.forEach((ring) => { ring.visible = ring.userData.responsiveIndex < visibleRingCount; });
      renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
    const onVisibility = () => { visible = !document.hidden; if (visible) clock.getDelta(); };
    document.addEventListener("visibilitychange", onVisibility);

    const render = () => {
      frame = requestAnimationFrame(render);
      if (!visible) return;
      const elapsed = clock.getElapsedTime();
      const motion = reducedMotion.matches ? 0 : 1;
      const targetY = pointerRef.current.x * .18 * motion;
      const targetX = (-.08 + pointerRef.current.y * .12) * motion;
      tooth.rotation.y += ((elapsed * .12 * motion + targetY) - tooth.rotation.y) * .025;
      tooth.rotation.x += (targetX - tooth.rotation.x) * .04;
      tooth.position.y = motion ? Math.sin(elapsed * .8) * .12 : 0;
      orbits.forEach((ring) => {
        ring.rotation.y = ring.userData.baseRotationY + elapsed * ring.userData.speed * motion;
      });
      renderer.render(scene, camera);
    };
    render();

    return () => {
      active = false;
      cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener("visibilitychange", onVisibility);
      if (loadedModel) loadedModel.traverse((item) => { if (item.geometry) item.geometry.dispose(); });
      orbits.forEach((ring) => { ring.geometry.dispose(); ring.material.dispose(); });
      enamel.dispose(); renderer.dispose();
    };
  }, [theme]);

  return <div className="tooth-hero-visual" onPointerMove={(event) => { const bounds=event.currentTarget.getBoundingClientRect(); pointerRef.current={x:(event.clientX-bounds.left)/bounds.width*2-1,y:(event.clientY-bounds.top)/bounds.height*2-1}; }} onPointerLeave={() => { pointerRef.current={x:0,y:0}; }}>
    <div className="tooth-glow" aria-hidden="true" />
    <canvas ref={canvasRef} className="tooth-canvas" aria-label="Animated three-dimensional dental tooth model" />
    {modelState === "loading" && <div className="tooth-model-status" role="status">Loading dental model…</div>}
    {modelState === "error" && <div className="tooth-model-fallback" role="img" aria-label="Dental tooth model unavailable"><span>🦷</span><small>Dental model unavailable</small></div>}
    <div className="tooth-base-glow" aria-hidden="true"><i /></div>
    <div className="tooth-particles" aria-hidden="true">{Array.from({length:10},(_,index)=><i key={index}/>)}</div>
    <div className="tooth-callouts" aria-hidden="true">{callouts.map(([Icon,title,text],index)=><div className={`tooth-callout tooth-callout-${index+1}`} key={title}><Icon/><div><span>{title}</span><strong>{text}</strong></div></div>)}</div>
  </div>;
}

export default ToothHeroVisual;

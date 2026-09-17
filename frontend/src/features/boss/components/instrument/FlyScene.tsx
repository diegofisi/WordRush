import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface FlySceneProps {
  /** Firing rate of the motor population, in Hz. It sets how fast she types. */
  motorHz: number;
  /** The word she is typing this turn. Empty when she is not typing. */
  typing: string;
  /** Called as each letter goes down, so the caller can show progress. */
  onKey?: (index: number) => void;
}

const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM'];

function letterTexture(character: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#2c343d';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#8b97a4';
    ctx.font = 'bold 34px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(character, 32, 36);
  }
  return new THREE.CanvasTexture(canvas);
}

/**
 * The mesh ships as a stylised blue fly with a single red eye; the animal whose
 * connectome plays this game is *Drosophila melanogaster*, which is amber with
 * a banded abdomen, dark legs and two big red eyes.
 *
 * Everything here is done by material name, so the geometry stays the artist's:
 *
 * 1. **The second eye.** The mesh only paints one of the two eye bulges red; the
 *    other is part of the body, and tinting the body amber turned it into a
 *    yellow snout — a "proboscis" that is not one. The red eye is copied across
 *    the midline to cover it.
 * 2. **The banding.** The body carries no UVs, so the gradient from pale thorax
 *    to dark banded abdomen is written as vertex colours along the body axis.
 * 3. **Contrast.** Legs and bristles stay dark and the wings go to clear grey.
 *    Tinting every part the same amber is what made her read as a plastic toy.
 */
function dressAsDrosophila(model: THREE.Object3D): void {
  const eyes: THREE.Mesh[] = [];

  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      switch (material.name) {
        case 'red-eye':
          material.color.setHex(0xc4161c);
          material.roughness = 0.32;
          eyes.push(child);
          break;
        case 'flywings-dark':
          // A translucent wing casting a solid shadow looks like a paper cut-out.
          child.castShadow = false;
          material.color.setHex(0xd7dee6);
          material.opacity = 0.26;
          material.roughness = 0.2;
          break;
        case 'black':
        case 'brown':
          // Legs and bristles: darker than the body, as they are on the animal.
          material.color.setHex(0x4a2f16);
          material.roughness = 0.72;
          break;
        case 'glass':
          break;
        default:
          bandBody(child, material);
          break;
      }
    }
  });

  for (const eye of eyes) {
    eye.geometry.computeBoundingBox();
    const box = eye.geometry.boundingBox;
    if (!box) continue;
    // Moved across the midline rather than mirrored by a negative scale: an eye
    // is near enough a sphere, and a negative scale inverts the winding.
    const centre = box.getCenter(new THREE.Vector3()).applyMatrix4(eye.matrix);
    const other = eye.clone();
    other.position.x -= 2 * centre.x;
    eye.parent?.add(other);
  }
}

/** Pale at the thorax, dark and striped down the abdomen. */
function bandBody(mesh: THREE.Mesh, material: THREE.MeshStandardMaterial): void {
  const position = mesh.geometry.getAttribute('position');
  if (!position) return;
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox;
  if (!box) return;

  // Whichever way the mesh was authored, the body runs along its longest axis.
  const size = box.getSize(new THREE.Vector3());
  const axis = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
  const low = box.min[axis];
  const span = Math.max(0.0001, size[axis]);

  const pale = new THREE.Color(0xd6a054);
  const dark = new THREE.Color(0x5d3210);
  const colours = new Float32Array(position.count * 3);
  const colour = new THREE.Color();
  const read = axis === 'x' ? position.getX : axis === 'y' ? position.getY : position.getZ;

  for (let i = 0; i < position.count; i += 1) {
    // 0 at the head, 1 at the tip of the abdomen.
    const along = (read.call(position, i) - low) / span;
    const head = along < 0.28;
    const abdomen = Math.max(0, (along - 0.45) / 0.55);
    const stripe = abdomen > 0 ? (Math.sin(abdomen * Math.PI * 5) + 1) / 2 : 0;
    // The head is a shade darker than the thorax, as it is on the animal.
    const mix = head ? 0.3 : Math.min(1, abdomen * 0.5 + stripe * abdomen * 0.65);
    colour.copy(pale).lerp(dark, mix);
    colours[i * 3] = colour.r;
    colours[i * 3 + 1] = colour.g;
    colours[i * 3 + 2] = colour.b;
  }

  mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  material.vertexColors = true;
  material.color.setHex(0xffffff);
  material.roughness = 0.62;
}

/**
 * The fly at her keyboard.
 *
 * The body is the real "Shy fly" mesh (Maf'j Alvarez, CC-BY 3.0, see
 * `public/models/fly/ATTRIBUTION.md`), shipped unmodified and rigged here.
 * Two things about the animation are not decoration: she presses the keys of
 * the word she is actually sending, and she presses them at the pace of the
 * motor population of the simulation (docs/context/08-boss-mode.md).
 */
export const FlyScene = ({ motorHz, typing, onKey }: FlySceneProps) => {
  const holder = useRef<HTMLDivElement>(null);
  const rate = useRef(motorHz);
  const word = useRef(typing);
  const cursor = useRef(0);
  const notify = useRef(onKey);
  rate.current = motorHz;
  notify.current = onKey;

  // A new word restarts her from the first letter.
  useEffect(() => {
    if (word.current !== typing) {
      word.current = typing;
      cursor.current = 0;
    }
  }, [typing]);

  useEffect(() => {
    const mount = holder.current;
    if (!mount) return;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0d1116, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.cursor = 'grab';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 2, 0.1, 100);
    let azimuth = 0.5;
    let elevation = 0.55;
    let distance = 7;
    const place = () => {
      camera.position.set(
        distance * Math.cos(elevation) * Math.sin(azimuth),
        distance * Math.sin(elevation),
        distance * Math.cos(elevation) * Math.cos(azimuth),
      );
      camera.lookAt(0, 0.3, 0);
    };
    place();

    // Dim on purpose: this sits next to a measuring screen, and a brightly lit
    // desk toy pulled the eye away from the panels that carry the numbers.
    scene.add(new THREE.HemisphereLight(0x9fb6c8, 0x0a0d10, 0.34));
    const key = new THREE.DirectionalLight(0xffeccf, 0.62);
    key.position.set(3.2, 6, 3.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x6fd7ff, 0.22);
    rim.position.set(-4, 2, -3);
    scene.add(rim);
    const warm = new THREE.PointLight(0xffb545, 0, 3.4, 2);
    scene.add(warm);

    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(6.6, 0.26, 2.85),
      new THREE.MeshStandardMaterial({ color: 0x141a20, roughness: 0.92 }),
    );
    plate.position.y = -0.14;
    plate.receiveShadow = true;
    scene.add(plate);

    const keyGeometry = new THREE.BoxGeometry(0.46, 0.17, 0.46);
    const sideMaterial = new THREE.MeshStandardMaterial({ color: 0x222931, roughness: 0.88 });
    const keys: THREE.Mesh[] = [];
    const byLetter = new Map<string, THREE.Mesh>();
    const textures: THREE.CanvasTexture[] = [];

    KEY_ROWS.forEach((row, r) => {
      [...row].forEach((character, c) => {
        const texture = letterTexture(character);
        textures.push(texture);
        const top = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.75 });
        const mesh = new THREE.Mesh(keyGeometry, [
          sideMaterial,
          sideMaterial,
          top,
          sideMaterial,
          sideMaterial,
          sideMaterial,
        ]);
        mesh.position.set((c - (row.length - 1) / 2) * 0.545 + r * 0.16, 0.085, (r - 1) * 0.63);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        keys.push(mesh);
        byLetter.set(character, mesh);
      });
    });

    const fly = new THREE.Group();
    // Measured against this mesh: its bounding box includes the wings, which
    // stand well above the body, so seating her by the box would float her over
    // the keys. This is where her legs meet them.
    const restY = 0.46;
    fly.position.set(0.1, restY, 0.1);
    scene.add(fly);

    // The mesh arrives asynchronously; the scene runs with or without it.
    new GLTFLoader().load(
      `${import.meta.env.BASE_URL}models/fly/shy-fly.glb`,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const scale = 2.15 / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(scale);
        const centre = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
        model.position.sub(centre);
        model.rotation.y = -Math.PI / 2;
        dressAsDrosophila(model);
        fly.add(model);
      },
      undefined,
      () => {
        // No model, no scene furniture: the keyboard still shows the keystrokes.
      },
    );

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const down = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const move = (event: PointerEvent) => {
      if (!dragging) return;
      azimuth -= (event.clientX - lastX) * 0.006;
      elevation = Math.max(0.12, Math.min(1.35, elevation + (event.clientY - lastY) * 0.005));
      lastX = event.clientX;
      lastY = event.clientY;
      place();
    };
    const up = () => {
      dragging = false;
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      distance = Math.max(3.5, Math.min(12, distance + event.deltaY * 0.004));
      place();
    };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      if (!clientWidth || !clientHeight) return;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    let pressed: THREE.Mesh | null = null;
    let pressPhase = 1;
    let nextKeyAt = 0;
    let frame = 0;
    let previous = performance.now();

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;

      // One keystroke per motor burst. A quiet motor population means no typing.
      const perSecond = Math.max(0, rate.current) / 26;
      const letters = word.current;
      if (letters.length > 0 && perSecond > 0.15 && now >= nextKeyAt) {
        nextKeyAt = now + 1000 / perSecond;
        const index = cursor.current % letters.length;
        const character = letters[index]?.toUpperCase() ?? '';
        pressed = byLetter.get(character) ?? null;
        pressPhase = 0;
        notify.current?.(index);
        cursor.current += 1;
      }

      fly.position.y = restY + Math.sin((now / 1000) * 2.2) * 0.025;
      if (pressed) {
        // She leans over the key she is about to press.
        const goal = new THREE.Vector3(
          pressed.position.x * 0.5,
          fly.position.y,
          pressed.position.z * 0.5,
        );
        fly.position.x += (goal.x - fly.position.x) * 0.06;
        fly.position.z += (goal.z - fly.position.z) * 0.06;
      }

      if (pressPhase < 1) pressPhase = Math.min(1, pressPhase + dt * 5.4);
      const dip = Math.sin(pressPhase * Math.PI);
      for (const mesh of keys) {
        const target = mesh === pressed ? 0.085 - 0.055 * dip : 0.085;
        mesh.position.y += (target - mesh.position.y) * 0.4;
      }
      if (pressed) {
        warm.position.set(pressed.position.x, 0.42, pressed.position.z);
        warm.intensity = 3.2 * dip;
      } else {
        warm.intensity = 0;
      }

      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('wheel', wheel);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      for (const texture of textures) texture.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={holder} className="h-full w-full" />;
};

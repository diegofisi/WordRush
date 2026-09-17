import { useEffect, useRef } from 'react';
import * as THREE from 'three';

import type { BossTelemetry } from '@/shared/contract';

import cloud from '../../data/cloud.json';
import circuit from '../../data/readout-circuit.json';
import { CLOUD_MODES, type CloudMode } from './cloud-modes';

export interface CloudState {
  /** Mean activity over the 8,000 sampled cells, 0..1. */
  mean: number;
  /** How many of them are lit right now. */
  firing: number;
}

interface NeuronCloud3DProps {
  telemetry: BossTelemetry;
  /** The live slice's spike counts, two bits per neuron, base64. */
  bits: string | null;
  mode: CloudMode;
  /** Slow rotation on or off; dragging always works. */
  orbit: boolean;
  /** Called a few times a second with what the buffer actually holds. */
  onState?: (state: CloudState) => void;
}

/**
 * The brain as a point cloud, drawn the way the published connectome viewers
 * draw it: additive blending so density reads as anatomy, point size falling
 * off with perspective, and every firing cell burning brighter.
 *
 * Technique follows fly-brain-bench's WebGL2 renderer (MIT); the positions and
 * transmitter calls are FlyWire 783 (CC-BY 4.0).
 */

/** One colour per transmitter, in the order `cloud.nts` lists them. */
const NT_COLOURS: Record<string, [number, number, number]> = {
  acetylcholine: [0.36, 0.82, 0.98],
  dopamine: [0.98, 0.72, 0.35],
  gaba: [0.96, 0.45, 0.42],
  glutamate: [0.55, 0.95, 0.72],
  octopamine: [0.92, 0.6, 0.95],
  serotonin: [1.0, 0.85, 0.5],
  unknown: [0.55, 0.62, 0.72],
};

/**
 * In the fly, GABA and glutamate are the inhibitory transmitters and
 * acetylcholine is the excitatory one — the same assignment the simulation
 * upstream uses to sign its synapses. Atlas mode colours by that, so the two
 * views answer different questions: what a cell *is*, and what it is *doing*.
 */
const INHIBITORY = new Set(['gaba', 'glutamate']);
const EXCITES: [number, number, number] = [0.42, 0.92, 0.64];
const INHIBITS: [number, number, number] = [0.98, 0.62, 0.36];

/**
 * The gains here are lower than the reference renderer's on purpose. It draws a
 * 60 fps stream where a fraction of a percent of the cells spike per frame; this
 * panel gets one 20 ms slice every 160 ms, and in 20 ms of biology about one
 * cell in six fires. At their gain, 1,300 cells lighting at once, 34 px wide,
 * summed additively to flat white and the anatomy disappeared.
 */
const VERTEX = `
  attribute float aActivity;
  attribute vec3 aColour;
  attribute vec3 aSignColour;
  uniform float uPointScale;
  uniform float uBaseAlpha;
  uniform float uMode;
  varying vec3 vColour;
  varying float vActivity;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
    float size = uPointScale / max(-view.z, 0.001);

    if (uMode < 0.5) {
      // Transmitter: every cell in its own colour, firing ones warmed.
      gl_PointSize = clamp(size * (1.0 + aActivity * 2.1), 1.0, 19.0);
      vec3 own = mix(aColour, vec3(1.0, 0.96, 0.86), min(aActivity * 0.7, 0.62));
      vColour = own * (uBaseAlpha + aActivity * 0.85);
      vActivity = aActivity;
    } else if (uMode < 1.5) {
      // Atlas: a faint grey shell, and the firing cells carry all the colour.
      gl_PointSize = clamp(size * (1.0 + aActivity * 3.7), 1.0, 19.0);
      vec3 atlas = mix(vec3(0.52, 0.57, 0.63), aSignColour, min(1.0, aActivity * 2.2));
      vColour = atlas * (uBaseAlpha * 0.42 + aActivity * 1.35);
      vActivity = aActivity;
    } else {
      // Circuit: the whole brain drops to an unlit shell so the 64 cells drawn
      // on top of it are the only thing with any life in them.
      gl_PointSize = clamp(size, 1.0, 6.0);
      vColour = vec3(0.5, 0.55, 0.62) * (uBaseAlpha * 0.3);
      vActivity = 0.0;
    }
  }
`;

/** The 64 readout cells: bigger, coloured by sign, brightness is their rate. */
const NODE_VERTEX = `
  attribute float aLevel;
  attribute vec3 aSignColour;
  uniform float uPointScale;
  varying vec3 vColour;
  varying float vActivity;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
    float size = uPointScale / max(-view.z, 0.001);
    gl_PointSize = clamp(size * (2.2 + aLevel * 3.4), 3.0, 30.0);
    vColour = aSignColour * (0.28 + aLevel * 1.5);
    vActivity = aLevel;
  }
`;

const FRAGMENT = `
  precision highp float;
  varying vec3 vColour;
  varying float vActivity;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    float r2 = dot(d, d);
    if (r2 > 0.25) discard;
    float core = exp(-r2 * 8.0);
    float halo = exp(-r2 * 2.4) * vActivity * 0.4;
    gl_FragColor = vec4(vColour * (core + halo), 1.0);
  }
`;

function decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/** How bright one, two and three-or-more spikes in a live slice look. */
const STEP = [0, 0.42, 0.72, 1];

/**
 * The per-turn snapshot only says "fired at least once in 150 ms", which is
 * true of a quarter of the sample. Lighting all of those at full is what turned
 * the panel white: a decision window is weaker evidence than a 20 ms slice, and
 * is drawn as such.
 */
const SNAPSHOT_LEVEL = 0.5;

export const NeuronCloud3D = ({ telemetry, bits, mode, orbit, onState }: NeuronCloud3DProps) => {
  const holder = useRef<HTMLDivElement>(null);
  const activityRef = useRef<Float32Array | null>(null);
  const attributeRef = useRef<THREE.BufferAttribute | null>(null);
  const modeRef = useRef<{ value: number } | null>(null);
  const showCircuit = useRef<(on: boolean) => void>(() => {});
  /** Where each readout cell's brightness is heading, 0..1. */
  const targets = useRef(new Float32Array(circuit.count));
  const orbitRef = useRef(orbit);
  const report = useRef(onState);
  orbitRef.current = orbit;
  report.current = onState;

  useEffect(() => {
    const index = CLOUD_MODES.indexOf(mode);
    if (modeRef.current) modeRef.current.value = index < 0 ? 0 : index;
    showCircuit.current(mode === 'circuit');
  }, [mode]);

  // The readout cells' own firing rates, the same numbers the decision network
  // draws in its input column.
  useEffect(() => {
    const rates = telemetry.descending;
    for (let i = 0; i < targets.current.length; i += 1) {
      targets.current[i] = Math.min(1, (rates[i] ?? 0) / 160);
    }
  }, [telemetry]);

  /**
   * Every slice tops cells up to what they just did, never down: a cell that
   * fired hard flashes and then fades on its own, and one that keeps firing
   * stays lit. Topping up instead of overwriting is what makes the difference
   * between a steady cell and a bursting one visible.
   */
  useEffect(() => {
    const activity = activityRef.current;
    if (!activity || !bits) return;
    const bytes = decode(bits);
    for (let k = 0; k < activity.length; k += 1) {
      const byte = bytes[k >> 2];
      if (byte === undefined) continue;
      const level = STEP[(byte >> (6 - (k & 3) * 2)) & 3] ?? 0;
      if (level > activity[k]!) activity[k] = level;
    }
    if (attributeRef.current) attributeRef.current.needsUpdate = true;
  }, [bits]);

  // The per-turn snapshot is the fallback until the first live slice arrives.
  useEffect(() => {
    const activity = activityRef.current;
    if (!activity || bits) return;
    activity.fill(0);
    for (const index of telemetry.cloud) {
      if (index < activity.length) activity[index] = SNAPSHOT_LEVEL;
    }
    if (attributeRef.current) attributeRef.current.needsUpdate = true;
    // Only when there is no live stream to prefer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telemetry]);

  useEffect(() => {
    const mount = holder.current;
    if (!mount) return;

    const count = cloud.count;
    const raw = decode(cloud.pos);
    const transmitters = decode(cloud.nt);
    const names = cloud.nts as string[];

    const positions = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    const signColours = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      // Stored centred in -127..127; the brain stands up along y.
      positions[i * 3] = ((raw[i * 3] ?? 128) - 128) / 127;
      positions[i * 3 + 1] = -((raw[i * 3 + 2] ?? 128) - 128) / 127;
      positions[i * 3 + 2] = ((raw[i * 3 + 1] ?? 128) - 128) / 127;
      const nt = names[transmitters[i] ?? 6] ?? 'unknown';
      const rgb = NT_COLOURS[nt] ?? NT_COLOURS.unknown!;
      colours[i * 3] = rgb[0];
      colours[i * 3 + 1] = rgb[1];
      colours[i * 3 + 2] = rgb[2];
      const sign = INHIBITORY.has(nt) ? INHIBITS : EXCITES;
      signColours[i * 3] = sign[0];
      signColours[i * 3 + 1] = sign[1];
      signColours[i * 3 + 2] = sign[2];
    }
    const activity = new Float32Array(count);
    activityRef.current = activity;
    for (const index of telemetry.cloud) if (index < count) activity[index] = SNAPSHOT_LEVEL;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColour', new THREE.BufferAttribute(colours, 3));
    geometry.setAttribute('aSignColour', new THREE.BufferAttribute(signColours, 3));
    const activityAttribute = new THREE.BufferAttribute(activity, 1);
    activityAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aActivity', activityAttribute);
    attributeRef.current = activityAttribute;

    const uMode = { value: Math.max(0, CLOUD_MODES.indexOf(mode)) };
    const uPointScale = { value: 60 };
    modeRef.current = uMode;

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uPointScale, uBaseAlpha: { value: 0.14 }, uMode },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    const scene = new THREE.Scene();
    scene.add(points);

    // ---- the decision network's own cells, drawn over the shell ------------

    const nodeCount = circuit.count;
    const nodeRaw = decode(circuit.pos);
    const nodeSigns = decode(circuit.excitatory);
    const nodePositions = new Float32Array(nodeCount * 3);
    const nodeColours = new Float32Array(nodeCount * 3);
    for (let i = 0; i < nodeCount; i += 1) {
      // Same packing and the same transform as the cloud: one script writes both.
      nodePositions[i * 3] = ((nodeRaw[i * 3] ?? 128) - 128) / 127;
      nodePositions[i * 3 + 1] = -((nodeRaw[i * 3 + 2] ?? 128) - 128) / 127;
      nodePositions[i * 3 + 2] = ((nodeRaw[i * 3 + 1] ?? 128) - 128) / 127;
      const excites = (((nodeSigns[i >> 3] ?? 0) >> (7 - (i & 7))) & 1) === 1;
      const rgb = excites ? EXCITES : INHIBITS;
      nodeColours[i * 3] = rgb[0];
      nodeColours[i * 3 + 1] = rgb[1];
      nodeColours[i * 3 + 2] = rgb[2];
    }
    const levels = new Float32Array(nodeCount);

    const nodeGeometry = new THREE.BufferGeometry();
    nodeGeometry.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));
    nodeGeometry.setAttribute('aSignColour', new THREE.BufferAttribute(nodeColours, 3));
    const levelAttribute = new THREE.BufferAttribute(levels, 1);
    levelAttribute.setUsage(THREE.DynamicDrawUsage);
    nodeGeometry.setAttribute('aLevel', levelAttribute);

    const nodes = new THREE.Points(
      nodeGeometry,
      new THREE.ShaderMaterial({
        vertexShader: NODE_VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: { uPointScale },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    nodes.visible = mode === 'circuit';
    scene.add(nodes);

    // Every line is a real synapse between two of the 64 (`readout-circuit.json`,
    // written straight out of the connectome). None of them is drawn for effect.
    const { from, to } = circuit.edges;
    const edgePositions = new Float32Array(from.length * 6);
    const edgeColours = new Float32Array(from.length * 6);
    for (let e = 0; e < from.length; e += 1) {
      for (let axis = 0; axis < 3; axis += 1) {
        edgePositions[e * 6 + axis] = nodePositions[(from[e] ?? 0) * 3 + axis]!;
        edgePositions[e * 6 + 3 + axis] = nodePositions[(to[e] ?? 0) * 3 + axis]!;
      }
    }
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
    const edgeColourAttribute = new THREE.BufferAttribute(edgeColours, 3);
    edgeColourAttribute.setUsage(THREE.DynamicDrawUsage);
    edgeGeometry.setAttribute('color', edgeColourAttribute);
    const edges = new THREE.LineSegments(
      edgeGeometry,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    edges.visible = mode === 'circuit';
    scene.add(edges);

    showCircuit.current = (on: boolean) => {
      nodes.visible = on;
      edges.visible = on;
    };

    const camera = new THREE.PerspectiveCamera(38, 2, 0.01, 100);
    camera.position.set(0, 0, 3.1);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0d1116, 1);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.cursor = 'grab';

    let azimuth = 0;
    let elevation = 0;
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
      azimuth += (event.clientX - lastX) * 0.006;
      elevation = Math.max(-1.1, Math.min(1.1, elevation + (event.clientY - lastY) * 0.005));
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const up = () => {
      dragging = false;
    };
    renderer.domElement.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      if (!clientWidth || !clientHeight) return;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      uPointScale.value = clientHeight * 0.062;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    let frame = 0;
    let previous = performance.now();
    let reportedAt = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      if (!dragging && orbitRef.current) azimuth += dt * 0.12;
      for (const object of [points, nodes, edges]) {
        object.rotation.y = azimuth;
        object.rotation.x = elevation;
      }

      // The nodes ease toward their measured rate instead of snapping: the
      // rates arrive a few times a second, and a step function reads as a
      // glitch where a rise reads as a cell coming on.
      if (nodes.visible) {
        const ease = Math.min(1, dt * 7);
        for (let i = 0; i < levels.length; i += 1) {
          levels[i]! += ((targets.current[i] ?? 0) - levels[i]!) * ease;
        }
        levelAttribute.needsUpdate = true;
        for (let e = 0; e < from.length; e += 1) {
          // A synapse is only worth seeing when its source is firing.
          const level = levels[from[e] ?? 0]! * 0.5;
          for (let end = 0; end < 2; end += 1) {
            edgeColours[e * 6 + end * 3] = 0.32 * level;
            edgeColours[e * 6 + end * 3 + 1] = 0.85 * level;
            edgeColours[e * 6 + end * 3 + 2] = 0.62 * level;
          }
        }
        edgeColourAttribute.needsUpdate = true;
      }

      // A spike is a flash, not a light switch. The decay has to outrun the
      // slice rate or every cell ends up lit at once: this loses 98 % of the
      // brightness per second, so a cell is down to a third by the time the
      // next slice lands 160 ms later.
      const decay = Math.pow(0.02, dt);
      let changed = false;
      let total = 0;
      let firing = 0;
      for (let i = 0; i < activity.length; i += 1) {
        const value = activity[i]!;
        if (value > 0.002) {
          activity[i] = value * decay;
          changed = true;
          total += value;
          firing += 1;
        } else if (value !== 0) {
          activity[i] = 0;
          changed = true;
        }
      }
      if (changed) activityAttribute.needsUpdate = true;
      renderer.render(scene, camera);

      if (now - reportedAt > 180) {
        reportedAt = now;
        report.current?.({ mean: total / activity.length, firing });
      }
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      geometry.dispose();
      material.dispose();
      nodeGeometry.dispose();
      (nodes.material as THREE.Material).dispose();
      edgeGeometry.dispose();
      (edges.material as THREE.Material).dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      activityRef.current = null;
      attributeRef.current = null;
      modeRef.current = null;
      showCircuit.current = () => {};
    };
    // Built once; new turns arrive through the activity buffer above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={holder} className="h-full w-full" />;
};

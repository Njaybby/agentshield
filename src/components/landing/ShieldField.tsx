"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type Ratios = { allow: number; block: number; quarantine: number };

const N = 900;
const WALL_X = 0.55;
const SPAWN_X = -5.5;
const EXIT_X = 4.2;
const MAX_IMPACTS = 16;

const NEUTRAL = new THREE.Color("#6f6f78");
const FATE_COLORS = [new THREE.Color("#3ecf8e"), new THREE.Color("#f0565c"), new THREE.Color("#f2b441")];

// fate: 0 allow, 1 block, 2 quarantine. phase: 0 incoming, 1 decided.
type Sim = {
  pos: Float32Array;
  col: Float32Array;
  alpha: Float32Array;
  size: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  fate: Uint8Array;
  phase: Uint8Array;
  timer: Float32Array;
};

function pickFate(r: Ratios) {
  const x = Math.random();
  if (x < r.block) return 1;
  if (x < r.block + r.quarantine) return 2;
  return 0;
}

function spawn(s: Sim, i: number, r: Ratios, scatter: boolean) {
  const i3 = i * 3;
  s.pos[i3] = scatter ? SPAWN_X + Math.random() * (WALL_X - SPAWN_X - 0.2) : SPAWN_X - Math.random() * 2;
  s.pos[i3 + 1] = (Math.random() - 0.5) * 3.4;
  s.pos[i3 + 2] = (Math.random() - 0.5) * 2.2;
  s.vx[i] = 0.55 + Math.random() * 0.75;
  s.vy[i] = 0;
  s.fate[i] = pickFate(r);
  s.phase[i] = 0;
  s.timer[i] = 0;
  s.size[i] = 0.6 + Math.random() * 0.9;
  s.alpha[i] = scatter ? 0.8 : 0;
  s.col[i3] = NEUTRAL.r;
  s.col[i3 + 1] = NEUTRAL.g;
  s.col[i3 + 2] = NEUTRAL.b;
}

const pointsVert = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  uniform float uDpr;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uDpr * (22.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
    vAlpha = aAlpha;
    vColor = aColor;
  }
`;

const pointsFrag = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.15, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

const wallVert = /* glsl */ `
  varying vec2 vLocal;
  void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Hairline grid on the membrane plus expanding rings where proposals hit it.
const wallFrag = /* glsl */ `
  #define MAX_IMPACTS ${MAX_IMPACTS}
  varying vec2 vLocal;
  uniform float uTime;
  uniform vec4 uImpacts[MAX_IMPACTS];
  uniform vec3 uColors[3];
  void main() {
    vec2 g = abs(fract(vLocal * 3.2) - 0.5);
    float line = 1.0 - smoothstep(0.0, 0.035, min(g.x, g.y));
    float edge = smoothstep(1.7, 1.1, abs(vLocal.y)) * smoothstep(1.35, 0.8, abs(vLocal.x));
    vec3 col = vec3(0.93) * line * 0.07 * edge;
    float alpha = line * 0.07 * edge + 0.015 * edge;
    for (int i = 0; i < MAX_IMPACTS; i++) {
      vec4 imp = uImpacts[i];
      float age = uTime - imp.z;
      if (imp.z <= 0.0 || age < 0.0 || age > 1.6) continue;
      float d = distance(vLocal, imp.xy);
      float ring = exp(-pow((d - age * 0.55) * 26.0, 2.0)) * (1.0 - age / 1.6);
      float strength = imp.w == 1.0 ? 0.55 : (imp.w == 2.0 ? 0.4 : 0.18);
      col += uColors[int(imp.w)] * ring * strength * edge;
      alpha += ring * strength * edge;
    }
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.85));
  }
`;

function Scene({ ratios, animate }: { ratios: Ratios; animate: boolean }) {
  const points = useRef<THREE.Points>(null);
  const wallMat = useRef<THREE.ShaderMaterial>(null);
  const impactIdx = useRef(0);
  const ratiosRef = useRef(ratios);
  ratiosRef.current = ratios;

  const sim = useMemo<Sim>(() => {
    const s: Sim = {
      pos: new Float32Array(N * 3),
      col: new Float32Array(N * 3),
      alpha: new Float32Array(N),
      size: new Float32Array(N),
      vx: new Float32Array(N),
      vy: new Float32Array(N),
      fate: new Uint8Array(N),
      phase: new Uint8Array(N),
      timer: new Float32Array(N),
    };
    for (let i = 0; i < N; i++) spawn(s, i, ratios, true);
    return s;
    // initial distribution only; live ratios flow through ratiosRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(sim.pos, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(sim.col, 3));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(sim.alpha, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(sim.size, 1));
    return g;
  }, [sim]);

  const pointsUniforms = useMemo(() => ({ uDpr: { value: 1 } }), []);
  const wallUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uImpacts: { value: Array.from({ length: MAX_IMPACTS }, () => new THREE.Vector4(0, 0, -10, 0)) },
      uColors: { value: FATE_COLORS },
    }),
    [],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const t = state.clock.elapsedTime;
    pointsUniforms.uDpr.value = state.gl.getPixelRatio();
    wallUniforms.uTime.value = t;
    if (!animate) return;
    const s = sim;
    const r = ratiosRef.current;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      const fate = s.fate[i];
      if (s.phase[i] === 0) {
        s.pos[i3] += s.vx[i] * dt;
        s.alpha[i] = Math.min(0.85, s.alpha[i] + dt * 0.8);
        if (s.pos[i3] >= WALL_X) {
          s.phase[i] = 1;
          s.timer[i] = 0;
          if (Math.random() < 0.08) {
            const slot = impactIdx.current++ % MAX_IMPACTS;
            // plane is rotated a quarter turn, so world z maps to local -x
            wallUniforms.uImpacts.value[slot].set(-s.pos[i3 + 2], s.pos[i3 + 1], t, fate);
          }
          if (fate === 1) {
            s.vx[i] = -(0.35 + Math.random() * 0.6);
            s.vy[i] = (Math.random() - 0.5) * 1.1;
          } else if (fate === 2) {
            s.vx[i] = 0;
            s.vy[i] = (Math.random() - 0.5) * 0.08;
            s.pos[i3] = WALL_X - 0.04;
          }
        }
      } else {
        s.timer[i] += dt;
        const c = FATE_COLORS[fate];
        const k = Math.min(1, s.timer[i] * 6);
        s.col[i3] = NEUTRAL.r + (c.r - NEUTRAL.r) * k;
        s.col[i3 + 1] = NEUTRAL.g + (c.g - NEUTRAL.g) * k;
        s.col[i3 + 2] = NEUTRAL.b + (c.b - NEUTRAL.b) * k;
        s.pos[i3] += s.vx[i] * dt;
        s.pos[i3 + 1] += s.vy[i] * dt;
        if (fate === 0) {
          s.alpha[i] = 0.85 * Math.max(0, 1 - (s.pos[i3] - WALL_X) / (EXIT_X - WALL_X));
          if (s.pos[i3] > EXIT_X) spawn(s, i, r, false);
        } else if (fate === 1) {
          s.vy[i] *= 0.985;
          s.alpha[i] = 0.9 * Math.max(0, 1 - s.timer[i] / 1.4);
          if (s.timer[i] > 1.4) spawn(s, i, r, false);
        } else {
          s.alpha[i] = s.timer[i] < 2 ? 0.9 : 0.9 * Math.max(0, 1 - (s.timer[i] - 2) / 1.2);
          if (s.timer[i] > 3.2) spawn(s, i, r, false);
        }
      }
    }
    const g = points.current?.geometry;
    if (g) {
      g.attributes.position.needsUpdate = true;
      g.attributes.aColor.needsUpdate = true;
      g.attributes.aAlpha.needsUpdate = true;
      g.attributes.aSize.needsUpdate = true;
    }
  });

  return (
    <>
      <points ref={points} geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          vertexShader={pointsVert}
          fragmentShader={pointsFrag}
          uniforms={pointsUniforms}
          transparent
          depthWrite={false}
        />
      </points>
      <mesh position={[WALL_X, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[2.8, 3.6, 1, 1]} />
        <shaderMaterial
          ref={wallMat}
          vertexShader={wallVert}
          fragmentShader={wallFrag}
          uniforms={wallUniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}

export default function ShieldField({ ratios, animate }: { ratios: Ratios; animate: boolean }) {
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={animate ? "always" : "demand"}
      camera={{ position: [-2.6, 0.9, 6.4], fov: 38 }}
      onCreated={({ camera }) => camera.lookAt(0.4, 0, 0)}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <Scene ratios={ratios} animate={animate} />
    </Canvas>
  );
}

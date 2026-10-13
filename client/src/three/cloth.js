import { collide, gapTo } from './body.js';

// Position-based cloth: Verlet integration under gravity, then repeated
// passes that pull every constraint back toward its rest length, sew
// stitched seams closed and push the cloth out of the body.

const GRAVITY = 386; // in/s²
const SUBSTEPS = 2;
const ITERATIONS = 10;
const DAMPING = 0.985;
const THICKNESS = 0.15; // inches off the body surface
const STATIC_FRICTION = 1.0;
const KINETIC_FRICTION = 0.6;
const SLEEP_MOVE = 0.004; // in per substep
const SLEEP_FRAMES = 30;
const MAX_AWAKE_FRAMES = 480;

// Stiffness per constraint kind: [across, along, shear, bend,
// skip-one across] (see garmentMesh.js). Stretch fabric gives a lot
// across the body (where knits stretch) and some along; woven barely
// gives at all.
// Strain limits: past this much stretch a constraint stops giving at all.
// Knits stretch easily up to a point, then stiffen; wovens barely stretch.
const STRETCH_LIMIT = { woven: 0.04, stretch: 0.25 };

const STIFFNESS = {
  woven: [1, 1, 0.5, 0.12, 1],
  stretch: [0.3, 0.75, 0.3, 0.08, 0.6],
};

export class ClothSim {
  constructor(mesh, body, fabric, { stiffBending = false, iterations = ITERATIONS, sewFrames = 0 } = {}) {
    this.iterations = iterations;
    // Frames at the start with gravity off, so seams close before the
    // pieces can fall (pattern pieces start apart, unsewn).
    this.sewFrames = sewFrames;
    const n = mesh.pos.length;
    this.count = n;
    this.tags = mesh.tags;
    this.faces = Uint32Array.from(mesh.faces);
    this.pos = new Float32Array(n * 3);
    mesh.pos.forEach((p, i) => this.pos.set(p, i * 3));

    this.a = Int32Array.from(mesh.pairs.map((p) => p[0]));
    this.b = Int32Array.from(mesh.pairs.map((p) => p[1]));
    this.kind = Uint8Array.from(mesh.pairs.map((p) => p[2]));
    this.rest = new Float32Array(mesh.pairs.length);
    // Stitches: [vertex, b0, b1, w] sews the vertex to the point w of the
    // way from b0 to b1 (a point along the other edge); [a, b] sews two
    // vertices together.
    const stitches = mesh.stitches.map((st) => (st.length === 2 ? [st[0], st[1], st[1], 0] : st));
    this.stitchV = Int32Array.from(stitches.map((st) => st[0]));
    this.stitchB0 = Int32Array.from(stitches.map((st) => st[1]));
    this.stitchB1 = Int32Array.from(stitches.map((st) => st[2]));
    this.stitchW = Float32Array.from(stitches.map((st) => st[3]));
    this.pinY = new Float32Array(n).fill(NaN);
    this.stiffBending = stiffBending;

    this.body = body;
    this.setFabric(fabric);
    this.updateRest(mesh);

    // Start outside the body: anything inside it (a garment smaller than
    // the body) gets pushed out and simply starts stretched.
    const p = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      p[0] = this.pos[i * 3];
      p[1] = this.pos[i * 3 + 1];
      p[2] = this.pos[i * 3 + 2];
      collide(body, p, THICKNESS);
      this.pos.set(p, i * 3);
    }
    this.prev = Float32Array.from(this.pos);
    this.wake();
  }

  // New measurements, same topology: only rest lengths and pins change,
  // and the cloth adjusts from wherever it is now.
  // Rest lengths come from mesh.restPos when given (the flat pattern
  // pieces), otherwise from the starting 3D shape.
  updateRest(mesh) {
    const restPos = mesh.restPos ?? mesh.pos;
    for (let c = 0; c < this.rest.length; c++) {
      const pa = restPos[this.a[c]];
      const pb = restPos[this.b[c]];
      this.rest[c] = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
    }
    this.pinY.fill(NaN);
    for (const i of mesh.pinY) this.pinY[i] = mesh.pos[i][1];
    this.wake();
  }

  setBody(body) {
    this.body = body;
    this.wake();
  }

  setFabric(fabric) {
    this.stiffness = [...STIFFNESS[fabric]];
    if (this.stiffBending) this.stiffness[3] = 0.35;
    this.stretchy = fabric === 'stretch';
    this.limit = STRETCH_LIMIT[fabric];
    this.wake();
  }

  wake() {
    this.awake = true;
    this.calmFrames = 0;
    this.awakeFrames = 0;
  }

  // Advances one animation frame. Returns false once the cloth has settled.
  get sewing() {
    return this.sewFrames > 0;
  }

  frame() {
    if (!this.awake) return false;
    let maxMove = 0;
    const gravity = this.sewing ? 0 : 1;
    for (let s = 0; s < SUBSTEPS; s++) maxMove = Math.max(maxMove, this.substep(1 / 60 / SUBSTEPS, gravity));
    if (this.sewing) {
      this.sewFrames--;
      return true;
    }
    this.awakeFrames++;
    this.calmFrames = maxMove < SLEEP_MOVE ? this.calmFrames + 1 : 0;
    if (this.calmFrames > SLEEP_FRAMES || this.awakeFrames > MAX_AWAKE_FRAMES) this.awake = false;
    return true;
  }

  substep(h, gravityScale = 1) {
    const { pos, prev, count } = this;
    const g = GRAVITY * h * h * gravityScale;
    for (let i = 0; i < count * 3; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v = (pos[i + k] - prev[i + k]) * DAMPING;
        prev[i + k] = pos[i + k];
        pos[i + k] += v;
      }
      pos[i + 1] -= g;
    }

    const n = this.iterations;
    for (let it = 0; it < n; it++) {
      this.solveConstraints();
      this.solveStitches();
      this.applyPins();
      if (it === Math.floor(n / 2) - 1 || it === n - 1) this.collideAll();
    }

    let maxMove = 0;
    for (let i = 0; i < count * 3; i += 3) {
      const m = Math.hypot(pos[i] - prev[i], pos[i + 1] - prev[i + 1], pos[i + 2] - prev[i + 2]);
      if (m > maxMove) maxMove = m;
    }
    return maxMove;
  }

  solveConstraints() {
    const { pos, a, b, rest, kind, stiffness } = this;
    for (let c = 0; c < rest.length; c++) {
      const i = a[c] * 3;
      const j = b[c] * 3;
      const dx = pos[j] - pos[i];
      const dy = pos[j + 1] - pos[i + 1];
      const dz = pos[j + 2] - pos[i + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      const k = kind[c];
      const max = rest[c] * (1 + this.limit);
      // Within the limit: soft, per the fabric's stiffness. Beyond it
      // (structural constraints only): pulled straight back to the limit.
      const f =
        d > max && (k === 0 || k === 1 || k === 4)
          ? (0.5 * (d - max)) / d
          : (0.5 * stiffness[k] * (d - rest[c])) / d;
      pos[i] += dx * f;
      pos[i + 1] += dy * f;
      pos[i + 2] += dz * f;
      pos[j] -= dx * f;
      pos[j + 1] -= dy * f;
      pos[j + 2] -= dz * f;
    }
  }

  // Seams have zero rest length: each pass pulls both sides most of the
  // way together. The far side may be a point along an edge (between b0
  // and b1); its pull is shared between those two vertices.
  solveStitches() {
    const { pos, stitchV, stitchB0, stitchB1, stitchW } = this;
    for (let c = 0; c < stitchV.length; c++) {
      const v = stitchV[c] * 3;
      const b0 = stitchB0[c] * 3;
      const b1 = stitchB1[c] * 3;
      const w = stitchW[c];
      for (let k = 0; k < 3; k++) {
        const target = pos[b0 + k] * (1 - w) + pos[b1 + k] * w;
        const diff = (target - pos[v + k]) * 0.45;
        pos[v + k] += diff;
        pos[b0 + k] -= diff * (1 - w);
        pos[b1 + k] -= diff * w;
      }
    }
  }

  applyPins() {
    const { pos, pinY, count } = this;
    for (let i = 0; i < count; i++) if (!Number.isNaN(pinY[i])) pos[i * 3 + 1] = pinY[i];
  }

  // Collision with friction (position-based, after Müller et al.): where
  // the body pushes a particle out, its movement along the surface since
  // the start of the step is cancelled (static friction) or reduced
  // (kinetic). Without friction cloth slowly slides off any slope, so
  // nothing could hang from the shoulders.
  collideAll() {
    const { pos, prev, count, body } = this;
    const p = [0, 0, 0];
    for (let i = 0; i < count; i++) {
      const x = i * 3;
      p[0] = pos[x];
      p[1] = pos[x + 1];
      p[2] = pos[x + 2];
      if (!collide(body, p, THICKNESS)) continue;
      const push = [p[0] - pos[x], p[1] - pos[x + 1], p[2] - pos[x + 2]];
      const depth = Math.hypot(...push);
      if (depth > 1e-9) {
        const n = push.map((v) => v / depth);
        const move = [p[0] - prev[x], p[1] - prev[x + 1], p[2] - prev[x + 2]];
        const along = move[0] * n[0] + move[1] * n[1] + move[2] * n[2];
        const tangent = move.map((v, k) => v - n[k] * along);
        const slide = Math.hypot(...tangent);
        const keep = slide < STATIC_FRICTION * depth ? 0 : 1 - Math.min(1, (KINETIC_FRICTION * depth) / slide);
        for (let k = 0; k < 3; k++) p[k] -= tangent[k] * (1 - keep);
      }
      pos[x] = p[0];
      pos[x + 1] = p[1];
      pos[x + 2] = p[2];
    }
  }

  // Per-vertex fit data for the fit map: how stretched the cloth is
  // around the body (from the across constraints) and how far it hangs
  // off the body.
  fitData() {
    const { pos, a, b, rest, kind, count } = this;
    const strainSum = new Float32Array(count);
    const strainN = new Uint8Array(count);
    for (let c = 0; c < rest.length; c++) {
      if (kind[c] !== 0) continue;
      const i = a[c] * 3;
      const j = b[c] * 3;
      const d = Math.hypot(pos[j] - pos[i], pos[j + 1] - pos[i + 1], pos[j + 2] - pos[i + 2]);
      const strain = d / rest[c] - 1;
      strainSum[a[c]] += strain;
      strainSum[b[c]] += strain;
      strainN[a[c]]++;
      strainN[b[c]]++;
    }
    let strain = new Float32Array(count);
    for (let i = 0; i < count; i++) strain[i] = strainN[i] ? strainSum[i] / strainN[i] : 0;
    // Average over neighbors a few times: seams and the floor create
    // single-vertex spikes that aren't the garment being tight.
    for (let pass = 0; pass < 3; pass++) strain = this.smooth(strain);

    const gap = new Float32Array(count);
    const p = [0, 0, 0];
    for (let i = 0; i < count; i++) {
      p[0] = pos[i * 3];
      p[1] = pos[i * 3 + 1];
      p[2] = pos[i * 3 + 2];
      gap[i] = gapTo(this.body, p);
    }
    return { strain, gap };
  }

  smooth(values) {
    if (!this.neighbors) {
      this.neighbors = Array.from({ length: this.count }, () => []);
      for (let c = 0; c < this.rest.length; c++) {
        if (this.kind[c] > 1) continue;
        this.neighbors[this.a[c]].push(this.b[c]);
        this.neighbors[this.b[c]].push(this.a[c]);
      }
    }
    const out = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      let sum = values[i];
      for (const n of this.neighbors[i]) sum += values[n];
      out[i] = sum / (this.neighbors[i].length + 1);
    }
    return out;
  }
}

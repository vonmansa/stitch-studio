// Parametric mannequin built from body measurements, in inches (y up,
// +z = front). The same limb sections are used both to render the body
// and as the collision surface the cloth simulation drapes against.

export const ARM_ANGLE = (40 * Math.PI) / 180; // A-pose, from vertical

// Ellipse semi-axes [a, a·k] whose perimeter is C (Ramanujan's approximation).
export function ellipseFromCirc(C, k) {
  const a = C / (Math.PI * (3 * (1 + k) - Math.sqrt((3 + k) * (1 + 3 * k))));
  return [a, a * k];
}

const sec = (p, [rx, rz]) => ({ p, rx, rz });

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const norm = (a) => scale(a, 1 / (Math.hypot(...a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Precomputes each segment's axis and cross-section frame. The frame's x
// follows world x and z follows world z as closely as the axis allows, so
// rx is always "width" and rz "depth", for vertical legs and angled arms alike.
function limb(sections) {
  const segments = [];
  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[i];
    const b = sections[i + 1];
    const axis = sub(b.p, a.p);
    const len = Math.hypot(...axis);
    const d = scale(axis, 1 / len);
    const ex = norm(sub([1, 0, 0], scale(d, d[0])));
    const c = cross(ex, d);
    const ez = norm(c[2] < 0 ? scale(c, -1) : c);
    segments.push({ a, b, d, len, ex, ez });
  }
  return { sections, segments };
}

export function buildBody(b) {
  const crotchY = b.inseam + 0.5;
  const kneeY = crotchY * 0.6;
  const hipY = crotchY + 3.5;
  const waistY = crotchY + 9;
  const chestY = waistY + 8.5;
  const shoulderY = chestY + 5;
  const neckBaseY = shoulderY + 1.5;

  const [hipRx, hipRz] = ellipseFromCirc(b.hip, 0.78);
  const [, chestRz] = ellipseFromCirc(b.chest, 0.72);
  const [neckRx, neckRz] = ellipseFromCirc(b.neck, 0.9);
  const shoulderHalf = b.shoulder / 2;

  const torso = limb([
    sec([0, crotchY - 0.5, 0], ellipseFromCirc(b.hip * 0.82, 0.8)),
    sec([0, hipY, 0], [hipRx, hipRz]),
    sec([0, waistY, 0], ellipseFromCirc(b.waist, 0.74)),
    sec([0, chestY, 0], ellipseFromCirc(b.chest, 0.72)),
    sec([0, shoulderY - 1.5, 0], [shoulderHalf * 0.86, chestRz * 0.82]),
    sec([0, shoulderY, 0], [shoulderHalf * 0.72, chestRz * 0.6]),
    sec([0, neckBaseY, 0], [neckRx * 1.12, neckRz * 1.1]),
    sec([0, neckBaseY + 3.5, 0], [neckRx, neckRz]),
  ]);

  const legX = hipRx * 0.48;
  const legs = [-1, 1].map((s) =>
    limb([
      sec([s * legX, crotchY + 3, 0], ellipseFromCirc(b.thigh * 1.05, 0.9)),
      sec([s * legX, crotchY - 1, 0], ellipseFromCirc(b.thigh, 0.9)),
      sec([s * legX * 1.02, crotchY - 7, 0], ellipseFromCirc(b.thigh * 0.85, 0.9)),
      sec([s * legX * 1.05, kneeY, 0.3], ellipseFromCirc(b.knee, 0.95)),
      sec([s * legX * 1.05, kneeY - 4, -0.3], ellipseFromCirc(b.knee * 1.02, 0.95)),
      sec([s * legX * 1.08, 3.5, 0], ellipseFromCirc(9, 0.9)),
      sec([s * legX * 1.08, 0.3, 0.8], ellipseFromCirc(9.5, 0.7)),
    ])
  );

  const armLen = b.armLength;
  const arms = [-1, 1].map((s) => {
    const root = [s * (shoulderHalf - 1), shoulderY - 1.6, 0];
    const dir = [s * Math.sin(ARM_ANGLE), -Math.cos(ARM_ANGLE), 0];
    const at = (t) => [root[0] + dir[0] * t, root[1] + dir[1] * t, root[2]];
    return {
      root,
      dir,
      ...limb([
        sec(at(-0.5), ellipseFromCirc(b.bicep * 1.3, 0.85)),
        sec(at(3), ellipseFromCirc(b.bicep, 0.9)),
        sec(at(armLen * 0.45), ellipseFromCirc(b.bicep * 0.8, 0.85)),
        sec(at(armLen * 0.75), ellipseFromCirc(b.bicep * 0.82, 0.8)),
        sec(at(armLen), ellipseFromCirc(6.8, 0.7)),
        sec(at(armLen + 6.5), ellipseFromCirc(7.5, 0.4)),
      ]),
    };
  });

  const head = { center: [0, neckBaseY + 3.5 + 4.3, 0.4], radius: 4.3 };

  return {
    levels: { crotchY, kneeY, hipY, waistY, chestY, shoulderY, neckBaseY },
    legX,
    torso,
    legs,
    arms,
    head,
    limbs: [torso, ...legs, ...arms],
  };
}

// Where p sits relative to a limb: the deepest segment it's inside, as
// normalized radius r (< 1 means inside the body surface).
function locate(limbData, p) {
  let best = null;
  for (const s of limbData.segments) {
    const v = sub(p, s.a.p);
    const t = dot(v, s.d) / s.len;
    if (t < 0 || t > 1) continue;
    const c = [s.a.p[0] + s.d[0] * t * s.len, s.a.p[1] + s.d[1] * t * s.len, s.a.p[2] + s.d[2] * t * s.len];
    const local = sub(p, c);
    const lx = dot(local, s.ex);
    const lz = dot(local, s.ez);
    const rx = s.a.rx + (s.b.rx - s.a.rx) * t;
    const rz = s.a.rz + (s.b.rz - s.a.rz) * t;
    const r = Math.hypot(lx / rx, lz / rz);
    if (!best || r < best.r) best = { r, c, lx, lz, rx, rz, s };
  }
  return best;
}

// Pushes point (an [x, y, z] array, modified in place) out of the body
// to `margin` inches off the surface. Returns true if it moved.
export function collide(body, p, margin) {
  let moved = false;
  for (const l of body.limbs) {
    const hit = locate(l, p);
    if (!hit) continue;
    const avg = (hit.rx + hit.rz) / 2;
    const target = 1 + margin / avg;
    if (hit.r >= target) continue;
    const { s } = hit;
    let { lx, lz } = hit;
    if (hit.r < 1e-6) {
      lz = hit.rz;
      lx = 0;
    }
    const k = target / Math.hypot(lx / hit.rx, lz / hit.rz);
    // Push along the surface normal, not straight out from the axis: where
    // the body tapers (neck into shoulders, hips into waist) the normal
    // tilts along the axis, which is what lets a sloped shoulder hold a
    // garment up against gravity.
    const radial = [0, 1, 2].map((i) => s.ex[i] * lx * (k - 1) + s.ez[i] * lz * (k - 1));
    const depth = Math.hypot(...radial) || 1e-9;
    const slope = ((s.b.rx - s.a.rx + s.b.rz - s.a.rz) / 2) / s.len;
    const f = 1 / (1 + slope * slope);
    for (let i = 0; i < 3; i++) p[i] += (radial[i] - slope * s.d[i] * depth) * f;
    moved = true;
  }
  if (p[1] < margin) {
    p[1] = margin;
    moved = true;
  }
  return moved;
}

// Approximate gap between a point and the nearest body surface, in
// inches (0 if touching or inside).
export function gapTo(body, p) {
  let gap = Infinity;
  for (const l of body.limbs) {
    const hit = locate(l, p);
    if (!hit) continue;
    gap = Math.min(gap, Math.max(0, (hit.r - 1) * ((hit.rx + hit.rz) / 2)));
  }
  return gap;
}

// Torso cross-section radii [rx, rz] at height y.
export function torsoRadiiAt(body, y) {
  const secs = body.torso.sections;
  if (y <= secs[0].p[1]) return [secs[0].rx, secs[0].rz];
  for (let i = 0; i < secs.length - 1; i++) {
    const a = secs[i];
    const b = secs[i + 1];
    if (y <= b.p[1]) {
      const t = (y - a.p[1]) / (b.p[1] - a.p[1]);
      return [a.rx + (b.rx - a.rx) * t, a.rz + (b.rz - a.rz) * t];
    }
  }
  const last = secs[secs.length - 1];
  return [last.rx, last.rz];
}

// Center and radii [x, z, rx, rz] of a vertical limb (torso or leg) at
// height y, interpolated between its sections.
export function limbAtY(limb, y) {
  const secs = limb.sections;
  const top = secs.reduce((a, b) => (b.p[1] > a.p[1] ? b : a));
  const bottom = secs.reduce((a, b) => (b.p[1] < a.p[1] ? b : a));
  if (y >= top.p[1]) return [top.p[0], top.p[2], top.rx, top.rz];
  if (y <= bottom.p[1]) return [bottom.p[0], bottom.p[2], bottom.rx, bottom.rz];
  for (let i = 0; i < secs.length - 1; i++) {
    const a = secs[i];
    const b = secs[i + 1];
    const lo = Math.min(a.p[1], b.p[1]);
    const hi = Math.max(a.p[1], b.p[1]);
    if (y >= lo && y <= hi) {
      const t = (y - a.p[1]) / (b.p[1] - a.p[1] || 1);
      return [a.p[0] + (b.p[0] - a.p[0]) * t, a.p[2] + (b.p[2] - a.p[2]) * t, a.rx + (b.rx - a.rx) * t, a.rz + (b.rz - a.rz) * t];
    }
  }
  return [bottom.p[0], bottom.p[2], bottom.rx, bottom.rz];
}

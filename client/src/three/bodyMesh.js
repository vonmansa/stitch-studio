import * as THREE from 'three';

const AROUND = 24;
const STEPS = 4; // rings per limb segment

// Renders the mannequin from the same limb sections used for collision,
// drawn slightly inside them so the cloth never looks like it clips.
export function buildBodyObject(body) {
  const group = new THREE.Group();
  // Double-sided: limbs run both up (torso) and down (legs, arms), so ring
  // winding — and therefore face orientation — differs between them.
  const material = new THREE.MeshStandardMaterial({ color: 0xcfc6bf, roughness: 0.85, side: THREE.DoubleSide });

  for (const limb of body.limbs) {
    const positions = [];
    const index = [];
    let rings = 0;
    limb.segments.forEach((s, si) => {
      for (let k = si === 0 ? 0 : 1; k <= STEPS; k++) {
        const t = k / STEPS;
        const c = [0, 1, 2].map((i) => s.a.p[i] + s.d[i] * s.len * t);
        const rx = (s.a.rx + (s.b.rx - s.a.rx) * t) * 0.97;
        const rz = (s.a.rz + (s.b.rz - s.a.rz) * t) * 0.97;
        for (let j = 0; j < AROUND; j++) {
          const th = (2 * Math.PI * j) / AROUND;
          positions.push(...[0, 1, 2].map((i) => c[i] + s.ex[i] * rx * Math.cos(th) + s.ez[i] * rz * Math.sin(th)));
        }
        rings++;
      }
    });
    for (let r = 0; r < rings - 1; r++) {
      for (let j = 0; j < AROUND; j++) {
        const a = r * AROUND + j;
        const b = r * AROUND + ((j + 1) % AROUND);
        index.push(a, b, a + AROUND, b, b + AROUND, a + AROUND);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    group.add(new THREE.Mesh(geometry, material));
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(body.head.radius, 32, 24), material);
  head.position.set(...body.head.center);
  head.scale.set(0.85, 1.08, 0.95);
  group.add(head);
  return group;
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildBody } from './body.js';
import { buildGarmentMesh, REGION_DRAG } from './garmentMesh.js';
import { buildPanelGarment } from './panels.js';
import { ClothSim } from './cloth.js';
import { buildBodyObject } from './bodyMesh.js';
import { VERDICTS } from '../fit/fitCheck.js';
import { specFor, clampFor } from '../fit/garments.js';
import { toCm } from '../fit/pantsModel.js';

const FABRIC_COLORS = { pants: '#4a6489', tshirt: '#e9e3da', shirt: '#dbe6f1', jacket: '#6b5a50' };
// Stretch past which cloth counts as pulling tight against the body.
// Above typical "resting on the body" tension, below what an undersized
// garment produces.
const TIGHT_STRAIN = { woven: 0.08, stretch: 0.1 };
// The neck, shoulders and the sleeve's sewn-in top edge are where the
// single-mesh garment is only approximate (CLO sews separate panels
// there), so their color comes from the measurement check instead of the
// simulation.
const MEASURED_REGIONS = { neck: 'neck', shoulder: 'shoulder', cap: 'bicep', armhole: 'chest' };
const SNAP = (v) => Math.round(v * 4) / 4;

const color = (hex) => new THREE.Color(hex);
const C = {
  tight: color(VERDICTS.tight.color),
  fitted: color(VERDICTS.fitted.color),
  relaxed: color(VERDICTS.relaxed.color),
  loose: color(VERDICTS.loose.color),
};

function fitColor(strain, gap, fabric, out) {
  const tight = TIGHT_STRAIN[fabric];
  if (strain > tight * 0.6) {
    return out.copy(C.fitted).lerp(C.tight, Math.min(1, (strain - tight * 0.6) / (tight * 0.4)));
  }
  if (gap < 1) return out.copy(C.fitted);
  if (gap < 3) return out.copy(C.fitted).lerp(C.relaxed, Math.min(1, gap - 1));
  return out.copy(C.relaxed).lerp(C.loose, Math.min(1, (gap - 3) / 3));
}

export default function Viewer3D({ model, garment, body, fabric, mode, simMode, areaVerdicts, selected, onSelect, onAdjust }) {
  const hostRef = useRef(null);
  const world = useRef(null);
  const [status, setStatus] = useState('Sewing pattern…');
  // Latest props for the imperative event handlers and render loop.
  // Updated in a layout effect, before any other effect reads it.
  const latest = useRef({});
  useLayoutEffect(() => {
    latest.current = { model, garment, fabric, mode, areaVerdicts, selected, onSelect, onAdjust };
  });

  // ---- Scene setup (once) ----
  useEffect(() => {
    const host = hostRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f3efeb');
    const camera = new THREE.PerspectiveCamera(32, 1, 1, 1000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.minDistance = 40;
    controls.maxDistance = 260;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8d7f76, 1.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(40, 90, 70);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-60, 40, -50);
    scene.add(fill);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshStandardMaterial({ color: 0xe4ddd6 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const w = { renderer, scene, camera, controls, needsRender: true, frame: 0 };
    world.current = w;

    const resetView = () => {
      camera.position.set(0, 42, 150);
      controls.target.set(0, 36, 0);
      controls.update();
      w.needsRender = true;
    };
    w.resetView = resetView;
    resetView();

    const resize = () => {
      const { clientWidth: width, clientHeight: height } = host;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      w.needsRender = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    controls.addEventListener('change', () => (w.needsRender = true));

    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const { sim, cloth } = w;
      if (sim && sim.frame()) {
        cloth.geometry.attributes.position.needsUpdate = true;
        cloth.geometry.computeVertexNormals();
        if (w.frame++ % 8 === 0) recolor(w, latest.current);
        w.needsRender = true;
        const next = sim.sewing ? 'Sewing pattern…' : sim.awake ? 'Draping…' : 'Settled';
        if (next !== w.status) {
          w.status = next;
          if (next === 'Settled') recolor(w, latest.current);
          setStatus(next);
        }
      }
      if (w.needsRender) {
        renderer.render(scene, camera);
        w.needsRender = false;
      }
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);

  // ---- Body: rebuilt when body measurements change ----
  useEffect(() => {
    const w = world.current;
    const bodyModel = buildBody(body);
    w.body = bodyModel;
    if (w.bodyObject) w.scene.remove(w.bodyObject);
    w.bodyObject = buildBodyObject(bodyModel);
    w.scene.add(w.bodyObject);
    if (w.sim) w.sim.setBody(bodyModel);
    w.needsRender = true;
  }, [body]);

  // ---- Garment ----
  // Quick mode: one cloth per garment type, tweaks update its rest lengths
  // in place (live while dragging). Sewn mode: the drafted pattern pieces
  // are re-triangulated and re-sewn, so edits rebuild the garment — after
  // a short pause, like re-simulating after a pattern edit in CLO.
  useEffect(() => {
    const w = world.current;
    const key = `${model.type}:${simMode}`;
    const build = () => {
      const sewn = simMode === 'sewn';
      const mesh = sewn ? buildPanelGarment(model.type, garment, w.body) : buildGarmentMesh(model.type, garment, w.body);
      if (!sewn && w.clothKey === key && w.sim) {
        w.sim.updateRest(mesh);
      } else {
        replaceCloth(w, mesh, {
          fabric: latest.current.fabric,
          stiffBending: model.type === 'jacket',
          iterations: model.type === 'pants' ? 10 : 16,
          sewFrames: sewn ? 90 : 0,
        });
        w.clothKey = key;
        recolor(w, latest.current);
      }
      w.status = null;
      w.needsRender = true;
    };
    if (simMode === 'sewn' && w.clothKey === key && w.sim) {
      const timer = setTimeout(build, 350);
      return () => clearTimeout(timer);
    }
    build();
    return undefined;
    // fabric is applied by its own effect; including it here would rebuild the cloth
  }, [model.type, garment, body, simMode]);

  useEffect(() => {
    const w = world.current;
    if (!w.sim) return;
    w.sim.setFabric(fabric);
    w.status = null;
  }, [fabric]);

  useEffect(() => {
    const w = world.current;
    recolor(w, latest.current);
    w.needsRender = true;
  }, [mode, selected, areaVerdicts]);

  // ---- Picking and dragging on the cloth ----
  useEffect(() => {
    const w = world.current;
    const canvas = w.renderer.domElement;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let drag = null;

    const pick = (e) => {
      const rect = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, w.camera);
      return w.cloth ? raycaster.intersectObject(w.cloth)[0] : null;
    };

    const onDown = (e) => {
      const hit = pick(e);
      if (!hit) return;
      const tag = w.sim.tags[hit.face.a];
      const region = REGION_DRAG[tag];
      const { garment: g, onSelect: select } = latest.current;
      select(MEASURED_REGIONS[tag] ?? region.h ?? region.v);
      w.controls.enabled = false;
      canvas.setPointerCapture(e.pointerId);
      // Inches of movement per screen pixel at the depth of the click.
      const dist = w.camera.position.distanceTo(hit.point);
      const perPx = (2 * dist * Math.tan(THREE.MathUtils.degToRad(w.camera.fov / 2))) / canvas.clientHeight;
      drag = {
        x: e.clientX,
        y: e.clientY,
        axis: null,
        region,
        perPx,
        outward: Math.sign(hit.point.x) || 1,
        start: { h: g[region.h], v: g[region.v] },
      };
    };

    const onMove = (e) => {
      if (!drag) {
        canvas.style.cursor = pick(e) ? 'pointer' : 'grab';
        return;
      }
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.axis && Math.hypot(dx, dy) > 6) {
        drag.axis = Math.abs(dx) >= Math.abs(dy) || !drag.region.v ? 'h' : 'v';
        if (drag.axis === 'v' && !drag.region.v) drag.axis = 'h';
      }
      if (!drag.axis) return;
      const { model: m, onAdjust: adjust, onSelect: select } = latest.current;
      const key = drag.region[drag.axis];
      if (!key) return;
      select(key);
      // Sideways: dragging the edge outward widens the circumference by
      // the distance moved. Up/down: dragging down lengthens.
      const delta = drag.axis === 'h' ? dx * drag.outward * drag.perPx : dy * drag.perPx;
      adjust(key, clampFor(m, key, SNAP(drag.start[drag.axis] + delta)));
    };

    const onUp = () => {
      drag = null;
      w.controls.enabled = true;
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const spec = specFor(model, selected);
  const value = garment[selected];
  const dragHint = Object.entries(REGION_DRAG).find(([, r]) => r.h === selected || r.v === selected)?.[1];

  return (
    <div className="viewer3d">
      <div ref={hostRef} className="viewer3d-canvas" />
      <div className="viewer3d-hud">
        {spec && (
          <div className="viewer3d-selected">
            <strong>{spec.label}</strong> {Number(value.toFixed(2))} in · {toCm(value).toFixed(1)} cm
            <span className="muted">
              {dragHint?.v === selected ? 'Drag up/down on the garment to change' : 'Drag sideways on the garment to change'}
            </span>
          </div>
        )}
        <span className="viewer3d-status">{status}</span>
      </div>
      <div className="viewer3d-footer">
        <button type="button" className="button button-secondary" onClick={() => world.current.resetView()}>
          Reset view
        </button>
        {mode === 'fit' && (
          <div
            className="tryon-legend"
            title="Colors come from the cloth simulation (how stretched the fabric is and how far it hangs off the body), except the neck, shoulders and sleeve seams, which use the measurement check."
          >
            {Object.values(VERDICTS).map((v) => (
              <span key={v.label}>
                <i style={{ background: v.color }} />
                {v.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function replaceCloth(w, mesh, { fabric, ...options }) {
  if (w.cloth) {
    w.scene.remove(w.cloth);
    w.cloth.geometry.dispose();
  }
  const sim = new ClothSim(mesh, w.body, fabric, options);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(sim.pos, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(sim.count * 3), 3));
  geometry.setIndex(new THREE.BufferAttribute(sim.faces, 1));
  geometry.computeVertexNormals();
  const cloth = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })
  );
  w.scene.add(cloth);
  w.sim = sim;
  w.cloth = cloth;
}

function recolor(w, { mode, fabric, model, areaVerdicts, selected }) {
  const { sim, cloth } = w;
  if (!sim || !cloth) return;
  const colors = cloth.geometry.attributes.color;
  const out = new THREE.Color();
  const base = new THREE.Color(FABRIC_COLORS[model.type]);
  const accent = new THREE.Color('#a85c4d');
  const white = new THREE.Color('#ffffff');
  const fit = mode === 'fit' ? sim.fitData() : null;

  for (let i = 0; i < sim.count; i++) {
    const tag = sim.tags[i];
    const region = REGION_DRAG[tag];
    if (fit) {
      const measuredArea = MEASURED_REGIONS[tag];
      const verdict = measuredArea && areaVerdicts[measuredArea];
      if (verdict) out.set(VERDICTS[verdict].color);
      // No measurement rule here (e.g. a T-shirt's neckline): show only
      // how far it sits off the body, not the approximate seam stretch.
      else if (measuredArea) fitColor(0, fit.gap[i], fabric, out);
      else fitColor(fit.strain[i], fit.gap[i], fabric, out);
    } else {
      out.copy(base);
    }
    const isSelected = region.h === selected || region.v === selected;
    if (isSelected) out.lerp(fit ? white : accent, 0.2);
    colors.setXYZ(i, out.r, out.g, out.b);
  }
  colors.needsUpdate = true;
  w.needsRender = true;
}

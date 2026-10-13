// Garment-agnostic handle dragging. A handle's position is a function of
// one measurement; dragging inverts that function for the pointer.

const snapQuarter = (inches) => Math.round(inches * 4) / 4;

// The direction a handle moves as its measurement goes from min to max.
// Works for straight horizontal/vertical handles and for diagonal ones
// like a sleeve's length, which moves along the sleeve.
export function handleDirection(getHandle, spec, m) {
  const a = getHandle(spec.key, { ...m, [spec.key]: spec.min });
  const b = getHandle(spec.key, { ...m, [spec.key]: spec.max });
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

// Projects the pointer onto the handle's direction of travel and binary
// searches for the value that puts the handle there. Every handle moves
// monotonically along its direction, so the search always converges.
export function valueForPointer(getHandle, spec, m, pointer) {
  const dir = handleDirection(getHandle, spec, m);
  const project = ([x, y]) => x * dir[0] + y * dir[1];
  const target = project(pointer);
  let lo = spec.min;
  let hi = spec.max;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (project(getHandle(spec.key, { ...m, [spec.key]: mid })) < target) lo = mid;
    else hi = mid;
  }
  return Math.min(spec.max, Math.max(spec.min, snapQuarter((lo + hi) / 2)));
}

// Resize cursor matching the handle's direction (SVG y points down).
export function cursorFor([dx, dy]) {
  const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 180) % 180;
  if (angle < 22.5 || angle >= 157.5) return 'ew-resize';
  if (angle < 67.5) return 'nwse-resize';
  if (angle < 112.5) return 'ns-resize';
  return 'nesw-resize';
}

// Arrow key that should increase the value: the one pointing the same
// way the handle moves as the value grows.
export function increaseKeys([dx, dy]) {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { up: 'ArrowRight', down: 'ArrowLeft' } : { up: 'ArrowLeft', down: 'ArrowRight' };
  }
  return dy >= 0 ? { up: 'ArrowDown', down: 'ArrowUp' } : { up: 'ArrowUp', down: 'ArrowDown' };
}

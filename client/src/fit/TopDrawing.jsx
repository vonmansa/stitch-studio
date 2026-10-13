import { getTopOutlinePath } from './topModel.js';

const pts = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const shift = ([x, y], [dx, dy], k) => [x + dx * k, y + dy * k];

export default function TopDrawing({ geometry: g, onBodyPointerDown, className = '', showPockets = true }) {
  const S = g.scale;
  const inches = (px) => (px - g.topY) / S;
  const sides = [
    [g.right, 1],
    [g.left, -1],
  ];

  return (
    <g className={className}>
      <path d={getTopOutlinePath(g)} className="pants-body" onPointerDown={onBodyPointerDown} />
      {g.type === 'tshirt' && <TshirtDetails g={g} sides={sides} />}
      {g.type === 'shirt' && <ShirtDetails g={g} sides={sides} inches={inches} showPockets={showPockets} />}
      {g.type === 'jacket' && <JacketDetails g={g} sides={sides} inches={inches} showPockets={showPockets} />}
    </g>
  );
}

// A line across the sleeve, `k` inches in from the sleeve hem.
function SleeveLine({ side, g, k, className = 'pants-detail' }) {
  const back = [-g.u[0] * (side === g.right ? 1 : -1), -g.u[1]];
  return (
    <line
      x1={shift(side.sleeveTop, back, k * g.scale)[0]}
      y1={shift(side.sleeveTop, back, k * g.scale)[1]}
      x2={shift(side.sleeveBottom, back, k * g.scale)[0]}
      y2={shift(side.sleeveBottom, back, k * g.scale)[1]}
      className={className}
    />
  );
}

function TshirtDetails({ g, sides }) {
  const nh = g.neckHalf;
  const d = g.neckDepth;
  const band = 0.7;
  return (
    <g pointerEvents="none">
      <path
        d={`M ${g.px([-nh + 0.35, 0.55]).join(' ')} Q ${g.px([0, 2 * (d + band) - 0.55]).join(' ')} ${g.px([nh - 0.35, 0.55]).join(' ')}`}
        className="pants-detail"
      />
      <line x1={g.left.hem[0] + 2} y1={g.hemY - 5} x2={g.right.hem[0] - 2} y2={g.hemY - 5} className="pants-detail pants-stitch" />
      {sides.map(([side], i) => (
        <SleeveLine key={i} side={side} g={g} k={0.8} className="pants-detail pants-stitch" />
      ))}
    </g>
  );
}

function ShirtDetails({ g, sides, inches, showPockets }) {
  const nh = g.neckHalf;
  const length = inches(g.hemY);
  const buttons = [];
  for (let y = 3; y < length - 1.5; y += 3.5) buttons.push(y);
  const armpit = inches(g.armpitY);
  return (
    <g pointerEvents="none">
      <polygon
        points={pts([g.px([-nh, 0]), g.px([nh, 0]), g.px([nh - 0.25, -0.9]), g.px([-nh + 0.25, -0.9])])}
        className="pants-body pants-detail garment-shade"
      />
      {sides.map(([, s]) => (
        <polygon
          key={s}
          points={pts([g.px([nh, 0], s), g.px([nh + 0.55, 3.0], s), g.px([0.2, 1.25], s)])}
          className="pants-body pants-detail garment-shade"
        />
      ))}
      {[-0.6, 0.6].map((x) => (
        <line key={x} x1={g.px([x, 1.3])[0]} y1={g.px([x, 1.3])[1]} x2={g.px([x, length])[0]} y2={g.hemY} className="pants-detail" />
      ))}
      {buttons.map((y) => (
        <circle key={y} cx={g.cx} cy={g.px([0, y])[1]} r={0.22 * g.scale} className="garment-button" />
      ))}
      {sides.map(([side], i) => (
        <SleeveLine key={i} side={side} g={g} k={2.5} />
      ))}
      {showPockets && (
        <polygon
          points={pts([
            g.px([1.75, armpit - 0.5]),
            g.px([6, armpit - 0.5]),
            g.px([6, armpit + 4.5]),
            g.px([3.875, armpit + 5.25]),
            g.px([1.75, armpit + 4.5]),
          ])}
          className="pants-detail pants-stitch"
        />
      )}
    </g>
  );
}

function JacketDetails({ g, sides, inches, showPockets }) {
  const nh = g.neckHalf;
  const breakIn = inches(g.breakY);
  const length = inches(g.hemY);
  const pocketY = inches(g.waistY) + (length - inches(g.waistY)) * 0.4;
  return (
    <g pointerEvents="none">
      {sides.map(([, s]) => (
        <polygon
          key={s}
          points={pts([
            g.px([nh, 0], s),
            g.px([nh + 0.9, 3.2], s),
            g.px([nh + 0.45, 3.9], s),
            g.px([nh + 2.6, 4.4], s),
            g.px([0, breakIn], s),
          ])}
          className="pants-body pants-detail garment-shade"
        />
      ))}
      <line x1={g.cx} y1={g.breakY} x2={g.cx} y2={g.hemY} className="pants-detail" />
      {[1.5, 5.5].map((dy) => (
        <circle key={dy} cx={g.cx} cy={g.px([0, breakIn + dy])[1]} r={0.32 * g.scale} className="garment-button" />
      ))}
      {showPockets &&
        sides.map(([, s]) => (
          <rect
            key={s}
            x={Math.min(g.px([1.8, 0], s)[0], g.px([7.8, 0], s)[0])}
            y={g.px([0, pocketY])[1]}
            width={6 * g.scale}
            height={2.2 * g.scale}
            rx={0.3 * g.scale}
            className="pants-detail"
          />
        ))}
      {sides.map(([side], i) => (
        <SleeveLine key={i} side={side} g={g} k={1.5} className="pants-detail pants-stitch" />
      ))}
    </g>
  );
}

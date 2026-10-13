import { CM_PER_INCH } from './pantsModel.js';
import { SEAM_ALLOWANCES } from './MeasurementsContext.jsx';
import { draftPiece, piecePath, pieceBounds, sideSeamPointAt } from './patternDraft.js';
import { draftDetailPieces, POCKET_OPENING } from './detailPieces.js';

// Everything on the sheet is in inches (1 SVG unit = 1 inch), so the same
// content renders on screen, as a true-scale SVG download, and as printed
// tiles just by changing the viewBox.

const INK = '#2b2320';
const SEAM = '#a85c4d';
const MARGIN = 1;
const TOP = 2.8; // room for the title and test square
const GAP = 2;

const fmt = (v) => `${Number(v.toFixed(2))}`;

export function buildSheet(garment, { seamAllowance: sa, includeDetails, includePockets }) {
  const pad = sa + 0.6;
  const front = draftPiece(garment, 'front');
  const back = draftPiece(garment, 'back');
  const fb = pieceBounds(front);
  const bb = pieceBounds(back);

  // Front is mirrored so the two pieces sit side seam to side seam, the
  // way they're laid out for cutting.
  const frontOx = MARGIN + pad + fb.maxX;
  const frontWidth = fb.maxX - fb.minX;
  const backOx = MARGIN + pad + frontWidth + pad + GAP + pad - bb.minX;
  const oy = TOP + pad - Math.min(fb.minY, bb.minY);

  const main = [
    { piece: front, label: 'FRONT', map: (p) => [frontOx - p.x, oy + p.y], dir: -1 },
    { piece: back, label: 'BACK', map: (p) => [backOx + p.x, oy + p.y], dir: 1 },
  ];

  const mainWidth = backOx + bb.maxX + pad + MARGIN;
  const mainBottom = oy + Math.max(fb.maxY, bb.maxY) + pad;

  // Small pieces are packed left to right in rows under the main pieces.
  const detailPieces = draftDetailPieces(garment, { includeDetails, includePockets });
  const width = Math.max(mainWidth, ...detailPieces.map((p) => p.width + 2 * pad + 2 * MARGIN));
  const details = [];
  let x = MARGIN;
  let y = mainBottom + GAP;
  let rowHeight = 0;
  for (const piece of detailPieces) {
    const w = piece.width + 2 * pad;
    if (x + w > width - MARGIN && x > MARGIN) {
      x = MARGIN;
      y += rowHeight + GAP;
      rowHeight = 0;
    }
    details.push({ piece, ox: x + pad, oy: y + pad });
    x += w + GAP;
    rowHeight = Math.max(rowHeight, piece.height + 2 * pad);
  }

  const height = (details.length ? y + rowHeight : mainBottom) + MARGIN;

  // Areas with printed content (pieces plus their allowance, and the
  // title/test square), used to skip blank pages when tiling.
  const mainBox = ({ piece, map }) => {
    const b = pieceBounds(piece);
    const xs = [map({ x: b.minX, y: 0 })[0], map({ x: b.maxX, y: 0 })[0]];
    const ys = [map({ x: 0, y: b.minY })[1], map({ x: 0, y: b.maxY })[1]];
    return { x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, y0: ys[0] - pad, y1: ys[1] + pad };
  };
  const contentBoxes = [
    { x0: 0, y0: 0, x1: Math.min(width, 14), y1: TOP - 0.8 },
    ...main.map(mainBox),
    ...details.map(({ piece, ox, oy }) => ({
      x0: ox - pad,
      y0: oy - pad,
      x1: ox + piece.width + pad,
      y1: oy + piece.height + pad,
    })),
  ];

  return { width, height, sa, main, details, garment, pockets: includePockets, contentBoxes };
}

export function PatternSheet({ sheet, gridUnit, svgRef }) {
  return (
    <svg
      ref={svgRef}
      className="pattern-sheet"
      viewBox={`0 0 ${sheet.width.toFixed(3)} ${sheet.height.toFixed(3)}`}
      fontFamily="system-ui, -apple-system, sans-serif"
      role="img"
      aria-label="Drafted pant pattern pieces"
    >
      <SheetContent sheet={sheet} gridUnit={gridUnit} />
    </svg>
  );
}

export function SheetContent({ sheet, gridUnit }) {
  const { width, height, sa, garment } = sheet;
  const step = gridUnit === 'in' ? 1 : 1 / CM_PER_INCH;
  const gridLines = [];
  for (let i = 0, x = 0; x <= width; i++, x = i * step) {
    gridLines.push(<GridLine key={`v${i}`} x1={x} y1={0} x2={x} y2={height} major={i % 5 === 0} />);
  }
  for (let i = 0, y = 0; y <= height; i++, y = i * step) {
    gridLines.push(<GridLine key={`h${i}`} x1={0} y1={y} x2={width} y2={y} major={i % 5 === 0} />);
  }

  const testSize = gridUnit === 'in' ? 2 : 5 / CM_PER_INCH;
  const testLabel = gridUnit === 'in' ? '2 in' : '5 cm';
  const saLabel = SEAM_ALLOWANCES.find((s) => s.value === sa)?.label ?? `${sa} in`;

  return (
    <g fontFamily="system-ui, -apple-system, sans-serif">
      <rect width={width} height={height} fill="#ffffff" />
      {gridLines}

      <rect x={MARGIN} y={0.5} width={testSize} height={testSize} fill="none" stroke={INK} strokeWidth={0.03} />
      <text x={MARGIN + testSize + 0.3} y={0.95} fontSize={0.38} fill={INK} fontWeight="600">
        Test square: {testLabel}
      </text>
      <text x={MARGIN + testSize + 0.3} y={1.5} fontSize={0.3} fill={INK}>
        Pants · waist {fmt(garment.waist)} in · hip {fmt(garment.hip)} in · inseam {fmt(garment.inseam)} in ·
        seam allowance {saLabel}
      </text>

      {sheet.main.map(({ piece, label, map, dir }) => (
        <MainPiece key={label} piece={piece} label={label} map={map} dir={dir} sa={sa} pockets={sheet.pockets} />
      ))}
      {sheet.details.map(({ piece, ox, oy }) => (
        <DetailPiece key={piece.key} piece={piece} ox={ox} oy={oy} sa={sa} />
      ))}
    </g>
  );
}

function GridLine({ major, ...coords }) {
  return <line {...coords} stroke={major ? '#d9cbc1' : '#efe7e1'} strokeWidth={major ? 0.025 : 0.012} />;
}

// Stroking the seam line at 2× the allowance and covering the inner half
// with the piece fill leaves an exact offset band outside the seam — the
// seam allowance — with a hairline at its outer edge as the cut line.
function SeamAllowance({ d, sa }) {
  const band = { d, fill: 'none', strokeLinejoin: 'miter', strokeMiterlimit: 4 };
  return (
    <>
      <path {...band} stroke={INK} strokeWidth={2 * sa + 0.05} />
      <path {...band} stroke="#f6e9e3" strokeWidth={2 * sa - 0.05} />
      <path d={d} fill="#fffdfb" />
      <path d={d} fill="none" stroke={SEAM} strokeWidth={0.035} strokeDasharray="0.18 0.1" />
    </>
  );
}

// A notch is a short tick from the seam line out into the allowance.
// Back pieces get double notches, the standard way to tell front from back.
function Notch({ x, y, dx, dy, sa, double }) {
  const len = sa * 0.7;
  const offsets = double ? [-0.12, 0.12] : [0];
  return offsets.map((o) => (
    <line
      key={o}
      x1={x + o * dy}
      y1={y + o * dx}
      x2={x + o * dy + dx * len}
      y2={y + o * dx + dy * len}
      stroke={INK}
      strokeWidth={0.04}
    />
  ));
}

function Grainline({ x1, y1, x2, y2 }) {
  const horizontal = y1 === y2;
  const head = (x, y, sign) =>
    horizontal
      ? `${x + sign * 0.5},${y - 0.25} ${x},${y} ${x + sign * 0.5},${y + 0.25}`
      : `${x - 0.25},${y + sign * 0.5} ${x},${y} ${x + 0.25},${y + sign * 0.5}`;
  return (
    <g stroke={INK} strokeWidth={0.04} fill="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <polyline points={head(x1, y1, 1)} />
      <polyline points={head(x2, y2, -1)} />
    </g>
  );
}

function MainPiece({ piece, label, map, dir, sa, pockets }) {
  const p = piece.points;
  const { hipY, hemY, kneeY } = piece.levels;
  const isBack = piece.side === 'back';

  const [creaseX] = map({ x: piece.crease, y: 0 });
  const grainTop = map({ x: piece.crease, y: hipY + 1.5 })[1];
  const grainBottom = map({ x: piece.crease, y: hemY - 2 })[1];
  const labelY = map({ x: 0, y: kneeY - 5 })[1];

  // `outward` is +1 for the side seam, −1 for the inseam, in draft
  // coordinates; `dir` flips it for the mirrored front piece.
  const notchAt = (pt, outward, key) => {
    const [x, y] = map(pt);
    return <Notch key={key} x={x} y={y} dx={dir * outward} dy={0} sa={sa} double={isBack} />;
  };
  const pocketNotches = pockets
    ? [POCKET_OPENING.top, POCKET_OPENING.bottom].map((y) => notchAt(sideSeamPointAt(piece, y), 1, `pocket${y}`))
    : null;

  return (
    <g>
      <SeamAllowance d={piecePath(piece, map)} sa={sa} />
      {notchAt(p.kneeOuter, 1, 'kneeOuter')}
      {notchAt(p.kneeInner, -1, 'kneeInner')}
      {pocketNotches}
      <Grainline x1={creaseX} y1={grainTop} x2={creaseX} y2={grainBottom} />
      <g fill={INK} textAnchor="middle">
        <text
          x={creaseX - 0.35}
          y={labelY}
          fontSize={0.6}
          fontWeight="700"
          transform={`rotate(-90 ${creaseX - 0.35} ${labelY})`}
        >
          {label}
        </text>
        <text x={creaseX + 0.55} y={labelY} fontSize={0.4} transform={`rotate(-90 ${creaseX + 0.55} ${labelY})`}>
          Cut 2 · grainline{pockets ? ' · pocket between side notches' : ''}
        </text>
      </g>
    </g>
  );
}

function DetailPiece({ piece, ox, oy, sa }) {
  const { width: w, height: h } = piece;
  // Tall, narrow pieces get their label turned to read along the length.
  const rotated = h > w;
  const cx = w / 2;
  const cy = rotated ? h / 2 : Math.min(h / 2, 0.95);
  const grain =
    piece.grain === 'horizontal'
      ? { x1: Math.min(2, w * 0.2), y1: h * 0.78, x2: w - Math.min(2, w * 0.2), y2: h * 0.78 }
      : { x1: w * 0.8, y1: h * 0.15, x2: w * 0.8, y2: h * 0.85 };

  return (
    <g transform={`translate(${ox} ${oy})`}>
      <SeamAllowance d={piece.path} sa={sa} />
      {piece.folds.map(([[x1, y1], [x2, y2]], i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={INK}
          strokeWidth={0.03}
          strokeDasharray="0.4 0.12 0.06 0.12"
        />
      ))}
      {piece.notches.map((n, i) => (
        <Notch key={i} x={n.x} y={n.y} dx={n.dir[0]} dy={n.dir[1]} sa={sa} />
      ))}
      <Grainline {...grain} />
      <g fill={INK} textAnchor="middle" transform={rotated ? `rotate(-90 ${cx} ${cy})` : undefined}>
        {rotated || h >= 4 ? (
          <>
            <text x={cx} y={cy - 0.1} fontSize={0.45} fontWeight="700">
              {piece.name}
            </text>
            <text x={cx} y={cy + 0.4} fontSize={0.32}>
              {piece.cut}
            </text>
          </>
        ) : (
          <text x={cx} y={cy} fontSize={0.42}>
            <tspan fontWeight="700">{piece.name}</tspan> · {piece.cut}
          </text>
        )}
      </g>
      {piece.note && (
        <text x={0} y={h + sa + 0.4} fontSize={0.26} fill={INK} fontStyle="italic">
          {piece.note}
        </text>
      )}
    </g>
  );
}

import { useId } from 'react';
import { CM_PER_INCH } from './pantsModel.js';
import { SEAM_ALLOWANCES } from './MeasurementsContext.jsx';
import { draftPiece, piecePath, pieceBounds, sideSeamPointAt } from './patternDraft.js';
import { draftDetailPieces, POCKET_OPENING } from './detailPieces.js';
import { draftTop } from './topDraft.js';

// Everything on the sheet is in inches (1 SVG unit = 1 inch), so the same
// content renders on screen, as a true-scale SVG download, and as printed
// tiles just by changing the viewBox.

const INK = '#2b2320';
const SEAM = '#a85c4d';
const MARGIN = 1;
const TOP = 2.8; // room for the title and test square
const GAP = 2;

const fmt = (v) => `${Number(v.toFixed(2))}`;

// Packs pieces left to right in rows starting at `y`, wrapping at `width`.
function packRows(pieces, y, width, pad) {
  const placed = [];
  let x = MARGIN;
  let rowHeight = 0;
  for (const piece of pieces) {
    const w = piece.width + 2 * pad;
    if (x + w > width - MARGIN && x > MARGIN) {
      x = MARGIN;
      y += rowHeight + GAP;
      rowHeight = 0;
    }
    placed.push({ piece, ox: x + pad, oy: y + pad });
    x += w + GAP;
    rowHeight = Math.max(rowHeight, piece.height + 2 * pad);
  }
  return { placed, bottom: y + rowHeight };
}

const boxOf = ({ piece, ox, oy }, pad) => ({
  x0: ox - pad,
  y0: oy - pad,
  x1: ox + piece.width + pad,
  y1: oy + piece.height + pad,
});

export function buildSheet(type, garment, options) {
  return type === 'pants' ? buildPantsSheet(garment, options) : buildTopSheet(type, garment, options);
}

function buildTopSheet(type, garment, options) {
  const sa = options.seamAllowance;
  const pad = sa + 0.6;
  const { pieces, checks, title } = draftTop(type, garment, options);
  // Front, back and sleeve side by side on the first row, the rest below.
  const firstRow = pieces.slice(0, 3).reduce((sum, p) => sum + p.width + 2 * pad, 0) + 2 * GAP;
  const width = Math.max(firstRow, ...pieces.map((p) => p.width + 2 * pad)) + 2 * MARGIN;
  const { placed, bottom } = packRows(pieces, TOP, width, pad);
  return {
    width,
    height: bottom + MARGIN,
    sa,
    title,
    checks,
    main: [],
    details: placed,
    contentBoxes: [TITLE_BOX(width), ...placed.map((p) => boxOf(p, pad))],
  };
}

const TITLE_BOX = (width) => ({ x0: 0, y0: 0, x1: Math.min(width, 14), y1: TOP - 0.8 });

function buildPantsSheet(garment, { seamAllowance: sa, includeDetails, includePockets }) {
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

  // Small pieces are packed in rows under the main pieces.
  const detailPieces = draftDetailPieces(garment, { includeDetails, includePockets });
  const width = Math.max(mainWidth, ...detailPieces.map((p) => p.width + 2 * pad + 2 * MARGIN));
  const { placed: details, bottom } = packRows(detailPieces, mainBottom + GAP, width, pad);
  const height = (details.length ? bottom : mainBottom) + MARGIN;

  // Areas with printed content, used to skip blank pages when tiling.
  const mainBox = ({ piece, map }) => {
    const b = pieceBounds(piece);
    const xs = [map({ x: b.minX, y: 0 })[0], map({ x: b.maxX, y: 0 })[0]];
    const ys = [map({ x: 0, y: b.minY })[1], map({ x: 0, y: b.maxY })[1]];
    return { x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, y0: ys[0] - pad, y1: ys[1] + pad };
  };

  // Waist/hip go around the whole body (2 fronts + 2 backs); leg
  // measurements go around one leg (1 front + 1 back).
  const w = (key) => front.widths[key] + back.widths[key];
  const checks = [
    { label: 'Waist', target: garment.waist, total: 2 * w('waist') },
    { label: 'Hip', target: garment.hip, total: 2 * w('hip') },
    { label: 'Thigh', target: garment.thigh, total: w('thigh') },
    { label: 'Knee', target: garment.knee, total: w('knee') },
    { label: 'Leg opening', target: garment.hem, total: w('hem') },
  ];

  return {
    width,
    height,
    sa,
    title: `Pants · waist ${fmt(garment.waist)} in · hip ${fmt(garment.hip)} in · inseam ${fmt(garment.inseam)} in`,
    checks,
    main,
    details,
    pockets: includePockets,
    contentBoxes: [TITLE_BOX(width), ...main.map(mainBox), ...details.map((p) => boxOf(p, pad))],
  };
}

export function PatternSheet({ sheet, gridUnit, svgRef }) {
  return (
    <svg
      ref={svgRef}
      className="pattern-sheet"
      viewBox={`0 0 ${sheet.width.toFixed(3)} ${sheet.height.toFixed(3)}`}
      fontFamily="system-ui, -apple-system, sans-serif"
      role="img"
      aria-label="Drafted pattern pieces"
    >
      <SheetContent sheet={sheet} gridUnit={gridUnit} />
    </svg>
  );
}

export function SheetContent({ sheet, gridUnit }) {
  const { width, height, sa } = sheet;
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
        {sheet.title} · seam allowance {saLabel}
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
function SeamAllowance({ d, sa, clipPath }) {
  const band = { d, fill: 'none', strokeLinejoin: 'miter', strokeMiterlimit: 4, clipPath };
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
  // Offsets run perpendicular to the notch, so double notches stay side
  // by side on curved seams too.
  return offsets.map((o) => (
    <line
      key={o}
      x1={x - o * dy}
      y1={y + o * dx}
      x2={x - o * dy + dx * len}
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
  const clipId = useId();
  const { width: w, height: h } = piece;
  // Tall, narrow pieces get their label turned to read along the length.
  const rotated = piece.rotated ?? h > w;
  const cx = piece.labelAt?.x ?? w / 2;
  const cy = piece.labelAt?.y ?? (rotated ? h / 2 : Math.min(h / 2, 0.95));
  const grain =
    piece.grainLine ??
    (piece.grain === 'horizontal'
      ? { x1: Math.min(2, w * 0.2), y1: h * 0.78, x2: w - Math.min(2, w * 0.2), y2: h * 0.78 }
      : { x1: w * 0.8, y1: h * 0.15, x2: w * 0.8, y2: h * 0.85 });
  const fold = piece.onFold;

  return (
    <g transform={`translate(${ox} ${oy})`}>
      {fold && (
        // No seam allowance past a fold edge: clip the allowance band to
        // the piece's side of the fold.
        <clipPath id={clipId}>
          <rect x={fold.x1} y={-sa - 1} width={w + sa + 1} height={h + 2 * sa + 2} />
        </clipPath>
      )}
      <SeamAllowance d={piece.path} sa={sa} clipPath={fold ? `url(#${clipId})` : undefined} />
      {fold && <FoldEdge fold={fold} />}
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
        <Notch key={i} x={n.x} y={n.y} dx={n.dir[0]} dy={n.dir[1]} sa={sa} double={n.double} />
      ))}
      {(piece.marks ?? []).map((m, i) => (
        <circle key={i} cx={m.x} cy={m.y} r={0.25} fill="none" stroke={INK} strokeWidth={0.04} />
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

// A vertical edge that's cut on the fabric fold: solid fold line plus the
// standard bracket with arrows pointing at it.
function FoldEdge({ fold }) {
  const { x1, y1, y2 } = fold;
  const inset = 0.7;
  const top = y1 + Math.min(2, (y2 - y1) * 0.2);
  const bottom = y2 - Math.min(2, (y2 - y1) * 0.2);
  const arrow = (y) => `${x1 + 0.3},${y - 0.15} ${x1 + 0.08},${y} ${x1 + 0.3},${y + 0.15}`;
  const mid = (top + bottom) / 2;
  return (
    <g stroke={INK} strokeWidth={0.04} fill="none">
      <line x1={x1} y1={y1} x2={x1} y2={y2} strokeWidth={0.05} />
      <polyline points={`${x1 + 0.08},${top} ${x1 + inset},${top} ${x1 + inset},${bottom} ${x1 + 0.08},${bottom}`} />
      <polyline points={arrow(top)} />
      <polyline points={arrow(bottom)} />
      <text
        x={x1 + inset + 0.35}
        y={mid}
        fontSize={0.32}
        fontWeight="700"
        fill={INK}
        stroke="none"
        textAnchor="middle"
        transform={`rotate(-90 ${x1 + inset + 0.35} ${mid})`}
      >
        PLACE ON FOLD
      </text>
    </g>
  );
}

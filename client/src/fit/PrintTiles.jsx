import { createPortal } from 'react-dom';
import { SheetContent } from './PatternSheet.jsx';

export const PAPERS = {
  letter: { label: 'US Letter', cssSize: 'letter', width: 8.5, height: 11 },
  a4: { label: 'A4', cssSize: 'A4', width: 8.27, height: 11.69 },
};

// Most home printers can't print to the paper edge; 0.4″ clears the
// unprintable margin on all common models.
const PRINT_MARGIN = 0.4;

const rowLetter = (r) => String.fromCharCode(65 + r);

export function tileLayout(sheet, paperKey) {
  const paper = PAPERS[paperKey];
  const tileW = paper.width - 2 * PRINT_MARGIN;
  const tileH = paper.height - 2 * PRINT_MARGIN;
  const cols = Math.ceil(sheet.width / tileW);
  const rows = Math.ceil(sheet.height / tileH);

  // Pages that would print only grid are left out; the remaining pages
  // keep their row/column names so they still line up when assembled.
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = c * tileW;
      const y0 = r * tileH;
      const hasContent = sheet.contentBoxes.some(
        (b) => b.x0 < x0 + tileW && b.x1 > x0 && b.y0 < y0 + tileH && b.y1 > y0
      );
      if (hasContent) tiles.push({ r, c, x: x0, y: y0, id: `${rowLetter(r)}${c + 1}` });
    }
  }
  return { paper, tileW, tileH, cols, rows, tiles, count: tiles.length, skipped: cols * rows - tiles.length };
}

// Rendered into <body> (outside the app root) so print CSS can hide the
// whole app and show only these pages.
export default function PrintTiles({ sheet, gridUnit, paperKey }) {
  const { paper, tileW, tileH, cols, rows, tiles, count } = tileLayout(sheet, paperKey);
  const pages = tiles.map(({ r, c, x, y, id }, index) => {
    return (
      <div className="print-tile" key={id}>
        <svg
          width={`${tileW}in`}
          height={`${tileH}in`}
          viewBox={`${x} ${y} ${tileW} ${tileH}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <SheetContent sheet={sheet} gridUnit={gridUnit} />
          <rect
            x={x + 0.01}
            y={y + 0.01}
            width={tileW - 0.02}
            height={tileH - 0.02}
            fill="none"
            stroke="#2b2320"
            strokeWidth={0.015}
            strokeDasharray="0.2 0.1"
          />
          {/* White halo keeps labels legible where they land on piece lines. */}
          <g
            fontFamily="system-ui, -apple-system, sans-serif"
            fill="#2b2320"
            stroke="#ffffff"
            strokeWidth={0.06}
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            <text x={x + 0.15} y={y + tileH - 0.15} fontSize={0.22} fontWeight="700">
              {id}
              <tspan fontWeight="400">
                {' '}
                · page {index + 1} of {count}
              </tspan>
            </text>
            {/* Match labels at the middle of each shared edge, e.g. A1 and A2 both say "A1|A2". */}
            {c < cols - 1 && (
              <EdgeLabel x={x + tileW - 0.15} y={y + tileH / 2} anchor="end" text={`${id} | ${rowLetter(r)}${c + 2}`} />
            )}
            {c > 0 && <EdgeLabel x={x + 0.15} y={y + tileH / 2} anchor="start" text={`${rowLetter(r)}${c} | ${id}`} />}
            {r < rows - 1 && (
              <EdgeLabel x={x + tileW - 0.15} y={y + tileH - 0.15} anchor="end" text={`${id} / ${rowLetter(r + 1)}${c + 1}`} />
            )}
            {r > 0 && <EdgeLabel x={x + tileW / 2} y={y + 0.3} anchor="middle" text={`${rowLetter(r - 1)}${c + 1} / ${id}`} />}
          </g>
        </svg>
      </div>
    );
  });

  return createPortal(
    <div className="print-tiles">
      <style>{`@page { size: ${paper.cssSize} portrait; margin: ${PRINT_MARGIN}in; }`}</style>
      {pages}
    </div>,
    document.body
  );
}

function EdgeLabel({ x, y, anchor, text }) {
  return (
    <text x={x} y={y} fontSize={0.2} textAnchor={anchor} fontWeight="600">
      {text}
    </text>
  );
}

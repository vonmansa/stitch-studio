import { snapQuarter } from './pantsModel.js';

// The side-seam pocket opening, measured down from the side waist. The
// same numbers place the notches on the front/back side seams and on the
// pocket bag, so the pieces line up when sewn.
export const POCKET_OPENING = { top: 2, bottom: 8.5 };

const WAISTBAND_FINISHED = 1.5;
const BUTTON_OVERLAP = 1.5;

const fmt = (v) => `${Number(v.toFixed(2))}`;

const rectPath = (w, h) => `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;

// Each piece is drawn in its own coordinates (inches, origin top-left).
// `notches` point outward from the seam line: dir is the outward unit
// vector. `folds` are fold lines drawn across the piece.
export function draftDetailPieces(m, { includeDetails, includePockets }) {
  const pieces = [];
  const flyLength = Math.max(5, snapQuarter(m.rise - 3.5));

  if (includeDetails) {
    const length = m.waist + BUTTON_OVERLAP;
    const height = WAISTBAND_FINISHED * 2;
    pieces.push({
      key: 'waistband',
      name: 'WAISTBAND',
      cut: 'Cut 1 · interface',
      note: `Folds to ${fmt(WAISTBAND_FINISHED)} in wide · includes ${fmt(BUTTON_OVERLAP)} in button overlap`,
      width: length,
      height,
      path: rectPath(length, height),
      grain: 'horizontal',
      folds: [[[0, height / 2], [length, height / 2]]],
      // Runs CF → side → CB → side → CF after the overlap. Side seams sit
      // at the front piece's waist width (¼ waist − ½″) from each CF,
      // matching the front/back split in patternDraft.js.
      notches: [
        0,
        m.waist / 4 - 0.5,
        m.waist / 2,
        (3 * m.waist) / 4 + 0.5,
      ].map((x) => ({ x: x + BUTTON_OVERLAP, y: height, dir: [0, 1] })),
    });

    const facingW = 2;
    pieces.push({
      key: 'fly-facing',
      name: 'FLY FACING',
      cut: 'Cut 1',
      width: facingW,
      height: flyLength,
      path: `M 0 0 L ${facingW} 0 L ${facingW} ${flyLength} L 1 ${flyLength} Q 0 ${flyLength} 0 ${flyLength - 1.25} Z`,
      grain: 'vertical',
      folds: [],
      notches: [],
    });

    const shieldW = 3;
    pieces.push({
      key: 'fly-shield',
      name: 'FLY SHIELD',
      cut: 'Cut 1 · fold lengthwise',
      width: shieldW,
      height: flyLength + 0.75,
      path: rectPath(shieldW, flyLength + 0.75),
      grain: 'vertical',
      folds: [[[shieldW / 2, 0], [shieldW / 2, flyLength + 0.75]]],
      notches: [],
    });
  }

  if (includePockets) {
    const bagW = 6.5;
    const bagH = 12;
    pieces.push({
      key: 'pocket-bag',
      name: 'POCKET BAG',
      cut: 'Cut 4 · lining',
      note: 'Straight edge sews to the side seam',
      width: bagW,
      height: bagH,
      path: `M 0 0 L ${bagW} 0 L ${bagW} ${bagH - 3} Q ${bagW} ${bagH} ${bagW - 3} ${bagH} L 2 ${bagH} Q 0 ${bagH} 0 ${bagH - 2} Z`,
      grain: 'vertical',
      folds: [],
      notches: [POCKET_OPENING.top, POCKET_OPENING.bottom].map((y) => ({ x: 0, y, dir: [-1, 0] })),
    });

    // Scaled to the seat so it doesn't look tiny on a large size or
    // swamp a small one.
    const patchW = Math.min(7.5, Math.max(5, snapQuarter(m.hip / 7)));
    const patchH = patchW + 0.75;
    pieces.push({
      key: 'patch-pocket',
      name: 'BACK POCKET',
      cut: 'Cut 2',
      note: 'Fold top edge to the inside on the fold line',
      width: patchW,
      height: patchH,
      path: `M 0 0 L ${patchW} 0 L ${patchW} ${patchH - 0.75} L ${patchW / 2} ${patchH} L 0 ${patchH - 0.75} Z`,
      grain: 'vertical',
      folds: [[[0, 1], [patchW, 1]]],
      notches: [],
    });
  }

  return pieces;
}

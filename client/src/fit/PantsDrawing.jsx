import { SCALE, getOutlinePath } from './pantsModel.js';

export default function PantsDrawing({ geometry: g, onBodyPointerDown, className = '' }) {
  const waistbandY = g.waistY + 1.5 * SCALE;
  const flyBottom = g.crotchY - 1.5 * SCALE;
  return (
    <g className={className}>
      <path d={getOutlinePath(g)} className="pants-body" onPointerDown={onBodyPointerDown} />
      <line
        x1={g.left.waist[0]}
        y1={waistbandY}
        x2={g.right.waist[0]}
        y2={waistbandY}
        className="pants-detail"
      />
      <path
        d={`M ${g.cx} ${waistbandY} L ${g.cx} ${flyBottom} Q ${g.cx} ${flyBottom + 8} ${g.cx - 10} ${flyBottom + 4}`}
        className="pants-detail pants-stitch"
      />
      {[g.left, g.right].map((side, i) => (
        <line
          key={i}
          x1={side.legCenterCrotch[0]}
          y1={side.legCenterCrotch[1] + 10}
          x2={side.legCenterHem[0]}
          y2={side.legCenterHem[1] - 4}
          className="pants-crease"
        />
      ))}
    </g>
  );
}

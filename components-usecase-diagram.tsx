import type { UCModel } from "@/lib/usecase";

const ROW = 90;
const TOP = 50;
const ACTOR_X = 90;
const CASE_X = 400;
const RX = 110;
const RY = 28;

export default function UseCaseDiagram({ model }: { model: UCModel }) {
  const actors = model.nodes.filter((n) => n.kind === "actor");
  const cases = model.nodes.filter((n) => n.kind === "usecase");
  const rows = Math.max(actors.length, cases.length, 1);
  const height = TOP + rows * ROW;

  const pos = new Map<string, { x: number; y: number; kind: UCKind }>();
  actors.forEach((a, i) => pos.set(a.id, { x: ACTOR_X, y: TOP + i * ROW, kind: "actor" }));
  cases.forEach((c, i) => pos.set(c.id, { x: CASE_X, y: TOP + i * ROW, kind: "usecase" }));

  return (
    <svg
      viewBox={`0 0 620 ${height}`}
      className="h-auto w-full rounded bg-white"
      role="img"
      aria-label="Use case diagram"
    >
      <defs>
        <marker id="uc-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
          <path d="M0,0 L9,3 L0,6" fill="none" stroke="#555" />
        </marker>
      </defs>

      {/* Garis relasi dulu, supaya node menutupi ujungnya */}
      {model.edges.map((e, i) => {
        const a = pos.get(e.from);
        const b = pos.get(e.to);
        if (!a || !b) return null;

        const dashed = e.kind !== "assoc";
        let x1: number, y1: number, x2: number, y2: number;

        if (a.kind === "usecase" && b.kind === "usecase") {
          const down = b.y > a.y;
          x1 = a.x;
          y1 = a.y + (down ? RY : -RY);
          x2 = b.x;
          y2 = b.y + (down ? -RY : RY);
        } else {
          x1 = a.kind === "actor" ? a.x + 20 : a.x - RX;
          y1 = a.y;
          x2 = b.kind === "actor" ? b.x + 20 : b.x - RX;
          y2 = b.y;
        }

        return (
          <g key={`edge-${i}`}>
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#555"
              strokeDasharray={dashed ? "6 4" : undefined}
              markerEnd={dashed ? "url(#uc-arrow)" : undefined}
            />
            {dashed && (
              <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize="11" fill="#555">
                «{e.kind}»
              </text>
            )}
          </g>
        );
      })}

      {actors.map((a) => {
        const { x, y } = pos.get(a.id)!;
        return (
          <g key={`actor-${a.id}`} stroke="#333" strokeWidth={1.5} fill="none">
            <circle cx={x} cy={y - 22} r={7} />
            <line x1={x} y1={y - 15} x2={x} y2={y + 5} />
            <line x1={x - 10} y1={y - 6} x2={x + 10} y2={y - 6} />
            <line x1={x} y1={y + 5} x2={x - 9} y2={y + 18} />
            <line x1={x} y1={y + 5} x2={x + 9} y2={y + 18} />
            <text x={x} y={y + 34} textAnchor="middle" fontSize="12" fill="#333" stroke="none">
              {a.id}
            </text>
          </g>
        );
      })}

      {cases.map((c) => {
        const { x, y } = pos.get(c.id)!;
        return (
          <g key={`case-${c.id}`}>
            <ellipse cx={x} cy={y} rx={RX} ry={RY} fill="#fff" stroke="#333" strokeWidth={1.5} />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="13" fill="#333">
              {c.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

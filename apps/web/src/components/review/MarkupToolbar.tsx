import { useEffect, useState } from "react";
import {
  Circle,
  Hand,
  Highlighter,
  LucideIcon,
  MapPin,
  MoveUpRight,
  Pencil,
  Square,
  Trash2,
  Undo2,
} from "lucide-react";
import { PALETTE, SIZES, SizeKey, ToolId } from "../../lib/annotations";
import { useMediaQuery } from "../../lib/hooks";
import { Popover } from "../Popover";

export const TOOLS: Array<{ id: ToolId; label: string; key: string; Icon: LucideIcon }> = [
  { id: "hand", label: "Move", key: "V", Icon: Hand },
  { id: "pin", label: "Pin a comment", key: "C", Icon: MapPin },
  { id: "pen", label: "Draw", key: "D", Icon: Pencil },
  { id: "highlight", label: "Highlight", key: "H", Icon: Highlighter },
  { id: "rect", label: "Box", key: "R", Icon: Square },
  { id: "ellipse", label: "Circle", key: "E", Icon: Circle },
  { id: "arrow", label: "Arrow", key: "A", Icon: MoveUpRight },
];

type Props = {
  tool: ToolId;
  onTool: (tool: ToolId) => void;
  color: string;
  onColor: (color: string) => void;
  size: SizeKey;
  onSize: (size: SizeKey) => void;
  canUndo: boolean;
  onUndo: () => void;
  onClear: () => void;
  /** What the hand tool is called for this media ("Move" for images, "Play" for video). */
  handLabel?: string;
  /** Sits on a light surface (the side panel) instead of the dark stage. */
  light?: boolean;
};

/** Ink options only make sense for the drawing tools. */
const hasInk = (tool: ToolId) => tool !== "hand";
const hasSize = (tool: ToolId) => tool !== "hand" && tool !== "pin";

const SHAPE_IDS: ToolId[] = ["rect", "ellipse", "arrow"];

export function MarkupToolbar({ tool, onTool, color, onColor, size, onSize, canUndo, onUndo, onClear, handLabel = "Move", light: onLight = false }: Props) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const light = color.toLowerCase() === "#ffffff";

  // On phones the three shape tools share one button so every target stays >= 40px.
  const compact = useMediaQuery("(max-width: 520px), (orientation: landscape) and (max-height: 520px)");
  const [shapeAnchor, setShapeAnchor] = useState<HTMLButtonElement | null>(null);
  const [shapesOpen, setShapesOpen] = useState(false);
  const [lastShape, setLastShape] = useState<ToolId>("rect");
  useEffect(() => {
    if (SHAPE_IDS.includes(tool)) setLastShape(tool);
  }, [tool]);
  const shown = compact ? TOOLS.filter((t) => !SHAPE_IDS.includes(t.id)) : TOOLS;
  const ShapeIcon = TOOLS.find((t) => t.id === lastShape)!.Icon;

  return (
    <div className={`toolbar${onLight ? " is-light" : ""}`} role="toolbar" aria-label="Markup tools">
      <div className="tool-group">
        {shown.map(({ id, label, key, Icon }) => {
          const name = id === "hand" ? handLabel : label;
          return (
            <button
              key={id}
              type="button"
              className="tool"
              aria-pressed={tool === id}
              aria-label={`${name} (${key})`}
              data-tip={`${name} · ${key}`}
              onClick={() => onTool(id)}
            >
              <Icon size={18} />
            </button>
          );
        })}
        {compact && (
          <button
            ref={setShapeAnchor}
            type="button"
            className="tool"
            aria-pressed={SHAPE_IDS.includes(tool)}
            aria-label="Shapes: box, circle, arrow"
            aria-expanded={shapesOpen}
            onClick={() => {
              onTool(lastShape);
              setShapesOpen((v) => !v);
            }}
          >
            <ShapeIcon size={18} />
            <i className="tool-caret" aria-hidden />
          </button>
        )}
      </div>

      {/* Colour and undo only appear once they can do something, so a plain "play" state stays uncluttered. */}
      {(hasInk(tool) || canUndo) && (
        <>
          <span className="tool-sep" aria-hidden />
          <div className="tool-group">
            {hasInk(tool) && (
              <button
                ref={setAnchor}
                type="button"
                className="tool tool-ink"
                aria-label="Colour and thickness"
                aria-expanded={open}
                data-tip="Colour & thickness"
                onClick={() => setOpen((v) => !v)}
              >
                <span className={`ink-dot${light ? " is-light" : ""}`} style={{ background: color }} />
              </button>
            )}
            <button type="button" className="tool" aria-label="Undo last mark (⌘Z)" data-tip="Undo · ⌘Z" disabled={!canUndo} onClick={onUndo}>
              <Undo2 size={18} />
            </button>
          </div>
        </>
      )}

      <Popover anchor={shapeAnchor} open={shapesOpen} onClose={() => setShapesOpen(false)} align="start" className="shape-pop" label="Shapes">
        {TOOLS.filter((t) => SHAPE_IDS.includes(t.id)).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className="shape-opt"
            aria-pressed={tool === id}
            onClick={() => {
              onTool(id);
              setShapesOpen(false);
            }}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </Popover>

      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} align="start" className="ink-pop" label="Colour and thickness">
        <p className="pop-label">Colour</p>
        <div className="swatches" role="radiogroup" aria-label="Colour">
          {PALETTE.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={color.toLowerCase() === c.value.toLowerCase()}
              aria-label={c.name}
              className="swatch"
              style={{ background: c.value }}
              onClick={() => onColor(c.value)}
            />
          ))}
        </div>
        {hasSize(tool) && (
          <>
            <p className="pop-label">Thickness</p>
            <div className="sizes" role="radiogroup" aria-label="Thickness">
              {(Object.keys(SIZES) as SizeKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={size === key}
                  aria-label={{ S: "Thin", M: "Medium", L: "Thick" }[key]}
                  className="size-opt"
                  onClick={() => onSize(key)}
                >
                  <span style={{ height: SIZES[key] * 0.9 + 1, background: color }} />
                </button>
              ))}
            </div>
          </>
        )}
        <button
          type="button"
          className="menu-item danger"
          disabled={!canUndo}
          onClick={() => {
            onClear();
            setOpen(false);
          }}
        >
          <Trash2 size={15} /> Clear my markup
        </button>
      </Popover>
    </div>
  );
}

import type { ReactNode } from 'react';
import {
  ArrowRight,
  ChevronDown,
  Circle,
  Diamond,
  Download,
  Eraser,
  Grid3x3,
  Hand,
  Highlighter,
  Image as ImageIcon,
  Keyboard,
  Maximize,
  Minus,
  MoreHorizontal,
  MousePointer2,
  PenLine,
  Redo2,
  Shapes,
  Spline,
  Square,
  Star,
  StickyNote,
  Trash2,
  Triangle,
  Type,
  Undo2,
  Wallpaper,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { FONT_HANDWRITTEN, FONT_SANS, PALETTE, STICKY_COLORS, STROKE_WIDTH_MAX, STROKE_WIDTH_MIN, type ShapeKind } from '@canvas/shared';
import { useAppDispatch, useAppSelector, useAppStore } from '@/app/hooks';
import { Popover } from '@/components/ui/Popover';
import { Menu, MenuCheckbox, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/Menu';
import { cn } from '@/lib/cn';
import { toastShown } from '@/features/ui/uiSlice';
import { boardCleared, elementsUpdated, redo, undo, type ElementPatch } from '../../slices/documentSlice';
import { shapeKindSelected, toolOptionsChanged, toolSelected, type Tool } from '../../slices/toolsSlice';
import { backgroundPanelToggled, editorDialogOpened } from '../../slices/viewSlice';
import { pickAndInsertImage, zoomBy, zoomToFit } from '../../actions';
import { exportBoard, type ExportFormat } from '../../canvas/export';

const mod = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl+';

const SHAPES: Array<{ kind: ShapeKind; label: string; icon: ReactNode }> = [
  { kind: 'rectangle', label: 'Rectangle', icon: <Square size={18} /> },
  { kind: 'ellipse', label: 'Ellipse', icon: <Circle size={18} /> },
  { kind: 'triangle', label: 'Triangle', icon: <Triangle size={18} /> },
  { kind: 'diamond', label: 'Diamond', icon: <Diamond size={18} /> },
  { kind: 'star', label: 'Star', icon: <Star size={18} /> },
  { kind: 'line', label: 'Line', icon: <Minus size={18} className="-rotate-45" /> },
  { kind: 'arrow', label: 'Arrow', icon: <ArrowRight size={18} className="-rotate-45" /> },
];

function ToolTile({
  label,
  shortcut,
  active,
  onClick,
  children,
  hasMenu,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  onClick?(): void;
  children: ReactNode;
  hasMenu?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={cn(
        'relative flex h-[56px] w-[54px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors',
        active ? 'bg-primary text-primary-fg shadow-sm' : 'text-fg hover:bg-surface-2',
      )}
    >
      {children}
      <span className="leading-none">{label}</span>
      {hasMenu && <ChevronDown size={10} className="absolute right-1 top-1 opacity-60" />}
    </button>
  );
}

const Divider = () => <div className="mx-1.5 h-10 w-px shrink-0 bg-line" aria-hidden />;

/** Applies a style change to the current selection (when any) as a single undo step. */
function useApplyToSelection() {
  const store = useAppStore();
  const dispatch = useAppDispatch();
  return (fn: (type: string) => ElementPatch['style'] | null) => {
    const s = store.getState();
    const ids = new Set(s.editor.view.selectedIds);
    const patches = s.editor.document.elements
      .filter((e) => ids.has(e.id) && !e.locked)
      .flatMap((e) => {
        const style = fn(e.type);
        return style ? [{ id: e.id, style }] : [];
      });
    if (patches.length) dispatch(elementsUpdated(patches));
  };
}

function ColorPopover() {
  const dispatch = useAppDispatch();
  const tools = useAppSelector((s) => s.editor.tools);
  const apply = useApplyToSelection();

  const setColor = (color: string) => {
    dispatch(toolOptionsChanged({ color }));
    apply((type) => (type === 'image' || type === 'sticky' ? null : { stroke: color }));
  };
  const setFill = (fill: string) => {
    dispatch(toolOptionsChanged({ fill }));
    apply((type) => (type === 'shape' ? { fill } : null));
  };
  const setSticky = (stickyColor: string) => {
    dispatch(toolOptionsChanged({ stickyColor }));
    apply((type) => (type === 'sticky' ? { fill: stickyColor } : null));
  };

  const swatch = (c: string, selected: boolean, onClick: () => void, label: string) => (
    <button
      key={c}
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn('h-7 w-7 rounded-full border border-black/10 transition-transform hover:scale-110', selected && 'ring-2 ring-primary ring-offset-2 ring-offset-surface')}
      style={{ background: c === 'transparent' ? 'repeating-conic-gradient(#e5e7eb 0 25%, #fff 0 50%) 50% / 10px 10px' : c }}
    />
  );

  return (
    <Popover
      align="start"
      className="w-[260px] space-y-4"
      trigger={
        <button type="button" aria-label="Color" title="Color" className="flex h-[56px] shrink-0 items-center gap-1.5 rounded-lg px-2 hover:bg-surface-2">
          <span className="h-9 w-9 rounded-full border-2 border-white shadow ring-1 ring-line" style={{ background: tools.color }} />
          <ChevronDown size={14} className="text-muted" />
        </button>
      }
    >
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Stroke & text</p>
        <div className="grid grid-cols-6 gap-2">{PALETTE.map((c) => swatch(c, tools.color === c, () => setColor(c), `Color ${c}`))}</div>
        <label className="mt-3 flex items-center gap-2 text-sm text-muted">
          Custom
          <input type="color" value={tools.color} onChange={(e) => setColor(e.target.value.toUpperCase())} className="h-7 w-10 cursor-pointer rounded border border-line bg-transparent" />
        </label>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Shape fill</p>
        <div className="grid grid-cols-6 gap-2">
          {['transparent', '#DBEAFE', '#DCFCE7', '#FEF9C3', '#FCE7F3', '#EDE9FE', '#FFEDD5', '#E5E7EB', '#C7D2FE', '#FDE68A', '#111827', '#FFFFFF'].map((c) =>
            swatch(c, tools.fill === c, () => setFill(c), c === 'transparent' ? 'No fill' : `Fill ${c}`),
          )}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Sticky note</p>
        <div className="flex gap-2">{STICKY_COLORS.map((c) => swatch(c, tools.stickyColor === c, () => setSticky(c), `Sticky ${c}`))}</div>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Text font</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            [FONT_HANDWRITTEN, 'Handwritten'],
            [FONT_SANS, 'Sans'],
          ].map(([f, label]) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                dispatch(toolOptionsChanged({ fontFamily: f }));
                apply((type) => (type === 'text' || type === 'sticky' ? { fontFamily: f } : null));
              }}
              className={cn('rounded-lg border px-2 py-1.5 text-sm', tools.fontFamily === f ? 'border-primary bg-primary-soft text-primary' : 'border-line')}
              style={{ fontFamily: f, fontSize: f === FONT_HANDWRITTEN ? 20 : 14 }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </Popover>
  );
}

function ShapesTile({ active }: { active: boolean }) {
  const dispatch = useAppDispatch();
  const { shapeKind, handDrawn } = useAppSelector((s) => s.editor.tools);
  const current = SHAPES.find((s) => s.kind === shapeKind)!;
  return (
    <Popover
      align="start"
      className="w-[236px]"
      trigger={
        <div>
          <ToolTile label="Shapes" shortcut="S" active={active} hasMenu>
            {active ? current.icon : <Shapes size={20} />}
          </ToolTile>
        </div>
      }
    >
      <div className="grid grid-cols-4 gap-1">
        {SHAPES.map((s) => (
          <button
            key={s.kind}
            type="button"
            title={s.label}
            aria-label={s.label}
            onClick={() => dispatch(shapeKindSelected(s.kind))}
            className={cn('flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px]', active && shapeKind === s.kind ? 'bg-primary text-primary-fg' : 'hover:bg-surface-2')}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>
      <label className="mt-3 flex cursor-pointer items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
        Hand-drawn style
        <input type="checkbox" className="h-4 w-4 accent-primary" checked={handDrawn} onChange={(e) => dispatch(toolOptionsChanged({ handDrawn: e.target.checked }))} />
      </label>
    </Popover>
  );
}

export function Toolbar({ boardTitle }: { boardTitle: string }) {
  const dispatch = useAppDispatch();
  const tool = useAppSelector((s) => s.editor.tools.tool);
  const strokeWidth = useAppSelector((s) => s.editor.tools.strokeWidth);
  const snapToGrid = useAppSelector((s) => s.editor.tools.snapToGrid);
  const canUndo = useAppSelector((s) => s.editor.document.past.length > 0);
  const canRedo = useAppSelector((s) => s.editor.document.future.length > 0);
  const panelOpen = useAppSelector((s) => s.editor.view.backgroundPanelOpen);
  const apply = useApplyToSelection();

  const pick = (t: Tool) => () => dispatch(toolSelected(t));
  const setWidth = (w: number) => {
    const v = Math.min(STROKE_WIDTH_MAX, Math.max(STROKE_WIDTH_MIN, Math.round(w) || STROKE_WIDTH_MIN));
    dispatch(toolOptionsChanged({ strokeWidth: v }));
    apply((type) => (type === 'stroke' || type === 'shape' || type === 'connector' ? { strokeWidth: v } : null));
  };
  const doExport = (f: ExportFormat) => exportBoard(f, boardTitle).catch((e) => dispatch(toastShown((e as Error).message, 'error')));

  return (
    <div
      className="no-scrollbar flex h-[72px] items-center overflow-x-auto rounded-xl border border-line bg-surface px-2 shadow-card max-md:fixed max-md:inset-x-2 max-md:bottom-2 max-md:z-30"
      role="toolbar"
      aria-label="Drawing tools"
    >
      <ToolTile label="Select" shortcut="V" active={tool === 'select'} onClick={pick('select')}>
        <MousePointer2 size={20} />
      </ToolTile>
      <ToolTile label="Hand" shortcut="H / Space" active={tool === 'hand'} onClick={pick('hand')}>
        <Hand size={20} />
      </ToolTile>
      <ToolTile label="Pen" shortcut="P" active={tool === 'pen'} onClick={pick('pen')}>
        <PenLine size={20} />
      </ToolTile>
      <ToolTile label="Marker" shortcut="M" active={tool === 'highlighter'} onClick={pick('highlighter')}>
        <Highlighter size={20} />
      </ToolTile>
      <ToolTile label="Eraser" shortcut="E" active={tool === 'eraser'} onClick={pick('eraser')}>
        <Eraser size={20} />
      </ToolTile>
      <ShapesTile active={tool === 'shape'} />
      <ToolTile label="Text" shortcut="T" active={tool === 'text'} onClick={pick('text')}>
        <Type size={20} />
      </ToolTile>
      <ToolTile label="Image" shortcut="I" active={tool === 'image'} onClick={() => dispatch(pickAndInsertImage())}>
        <ImageIcon size={20} />
      </ToolTile>
      <ToolTile label="Sticky" shortcut="N" active={tool === 'sticky'} onClick={pick('sticky')}>
        <StickyNote size={20} />
      </ToolTile>
      <ToolTile label="Connect" shortcut="C" active={tool === 'connector'} onClick={pick('connector')}>
        <Spline size={20} />
      </ToolTile>

      <Divider />
      <ColorPopover />
      <div className="flex shrink-0 items-center gap-2 px-2">
        <input
          type="range"
          aria-label="Stroke width"
          className="range w-24 lg:w-28"
          min={STROKE_WIDTH_MIN}
          max={STROKE_WIDTH_MAX}
          value={strokeWidth}
          onChange={(e) => setWidth(Number(e.target.value))}
        />
        <input
          type="number"
          aria-label="Stroke width value"
          min={STROKE_WIDTH_MIN}
          max={STROKE_WIDTH_MAX}
          value={strokeWidth}
          onChange={(e) => setWidth(Number(e.target.value))}
          className="h-9 w-12 rounded-lg border border-line bg-surface text-center text-sm text-fg outline-none focus:border-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      <Divider />
      <ToolTile label="Undo" shortcut={`${mod}Z`} onClick={() => dispatch(undo())}>
        <Undo2 size={20} className={cn(!canUndo && 'opacity-40')} />
      </ToolTile>
      <ToolTile label="Redo" shortcut={`${mod}⇧Z`} onClick={() => dispatch(redo())}>
        <Redo2 size={20} className={cn(!canRedo && 'opacity-40')} />
      </ToolTile>

      <div className="min-w-2 flex-1" />

      <Menu>
        <MenuTrigger asChild>
          <button type="button" className="flex h-[56px] w-[88px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium hover:bg-surface-2" aria-label="More options">
            <MoreHorizontal size={20} />
            More Options
          </button>
        </MenuTrigger>
        <MenuContent className="w-60">
          <MenuItem icon={<Maximize />} shortcut="⇧1" onSelect={() => dispatch(zoomToFit())}>
            Zoom to fit
          </MenuItem>
          <MenuItem icon={<ZoomIn />} shortcut="+" onSelect={() => dispatch(zoomBy(1.2))}>
            Zoom in
          </MenuItem>
          <MenuItem icon={<ZoomOut />} shortcut="−" onSelect={() => dispatch(zoomBy(1 / 1.2))}>
            Zoom out
          </MenuItem>
          <MenuSeparator />
          <MenuCheckbox checked={snapToGrid} onCheckedChange={(v) => dispatch(toolOptionsChanged({ snapToGrid: v }))}>
            <span className="flex items-center gap-2">
              <Grid3x3 size={15} className="text-muted" /> Snap to grid
            </span>
          </MenuCheckbox>
          <MenuSeparator />
          <MenuLabel>Export</MenuLabel>
          <MenuItem icon={<Download />} onSelect={() => doExport('png')}>
            Export as PNG
          </MenuItem>
          <MenuItem icon={<Download />} onSelect={() => doExport('svg')}>
            Export as SVG
          </MenuItem>
          <MenuItem icon={<Download />} onSelect={() => doExport('pdf')}>
            Export as PDF
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<Keyboard />} shortcut="?" onSelect={() => dispatch(editorDialogOpened('shortcuts'))}>
            Keyboard shortcuts
          </MenuItem>
          <MenuItem
            icon={<Trash2 />}
            danger
            onSelect={() => {
              if (confirm('Clear everything on this board? You can undo this.')) dispatch(boardCleared());
            }}
          >
            Clear board
          </MenuItem>
        </MenuContent>
      </Menu>
      <button
        type="button"
        onClick={() => dispatch(backgroundPanelToggled())}
        aria-pressed={panelOpen}
        className={cn('btn-primary ml-2 h-12 shrink-0 rounded-xl px-4', panelOpen && 'ring-2 ring-primary/30')}
      >
        <Wallpaper size={18} />
        Background
      </button>
    </div>
  );
}

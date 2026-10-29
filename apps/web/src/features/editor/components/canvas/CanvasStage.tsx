import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Layer, Rect, Shape, Stage, Transformer } from 'react-konva';
import type { CanvasElement } from '@canvas/shared';
import { useAppDispatch, useAppSelector, useAppStore } from '@/app/hooks';
import { elementsAdded, elementsRemoved, elementsUpdated, type ElementPatch } from '../../slices/documentSlice';
import { editingStarted, selectionChanged, viewportChanged } from '../../slices/viewSlice';
import { toolSelected } from '../../slices/toolsSlice';
import { insertImageFile, pickAndInsertImage, startTextAt, zoomToFit } from '../../actions';
import { drawBackground } from '../../canvas/background';
import { CULLING_THRESHOLD } from '../../canvas/constants';
import { createConnector, createShape, createSticky, createStroke } from '../../canvas/factory';
import {
  center,
  connectorEndpoints,
  elementBounds,
  normalizeRect,
  rectsIntersect,
  snapTo,
  visibleWorldRect,
  zoomAround,
} from '../../canvas/geometry';
import { useImage } from '../../canvas/imageCache';
import { paintOps, shapePaths } from '../../canvas/rough';
import { outlineToSvgPath, strokeOutline } from '../../canvas/stroke';
import { CONTENT_LAYER_NAME, stageRegistry } from '../../canvas/stageRegistry';
import { ElementNode, type NodeHandlers } from './ElementNode';
import { SelectionToolbar } from './SelectionToolbar';
import { TextEditor } from './TextEditor';
import { ZoomControls } from './ZoomControls';

type Gesture =
  | { kind: 'pan'; startX: number; startY: number; vx: number; vy: number }
  | { kind: 'draw'; points: number[][]; highlighter: boolean }
  | { kind: 'shape'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'marquee'; x1: number; y1: number; x2: number; y2: number; base: string[] }
  | { kind: 'erase'; ids: Set<string>; last: { x: number; y: number } }
  | { kind: 'connect'; from: string; x2: number; y2: number };

const PRIMARY = '#4F46E5';
const ERASER_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="8" fill="white" fill-opacity=".6" stroke="#111827" stroke-width="1.5"/></svg>',
)}") 10 10, crosshair`;

const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/** Element id for a Konva event target (or null for the empty canvas). */
function elementIdOf(node: Konva.Node | null | undefined): string | null {
  const el = node?.findAncestor('.element', true);
  return el ? el.id() : null;
}

/** Ids to select when clicking an element: its whole group if it belongs to one. */
function withGroup(el: CanvasElement, all: CanvasElement[]) {
  return el.groupId ? all.filter((e) => e.groupId === el.groupId).map((e) => e.id) : [el.id];
}

export function CanvasStage() {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const elements = useAppSelector((s) => s.editor.document.elements);
  const background = useAppSelector((s) => s.editor.view.backgroundDraft ?? s.editor.document.background);
  const boardId = useAppSelector((s) => s.editor.document.boardId);
  const viewport = useAppSelector((s) => s.editor.view.viewport);
  const selectedIds = useAppSelector((s) => s.editor.view.selectedIds);
  const editingId = useAppSelector((s) => s.editor.view.editingId);
  const tool = useAppSelector((s) => s.editor.tools.tool);
  const readOnly = useAppSelector((s) => s.editor.view.readOnly);
  const exporting = useAppSelector((s) => s.editor.view.exporting);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const draftRef = useRef<Konva.Shape>(null);
  const gesture = useRef<Gesture | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [spaceDown, setSpaceDown] = useState(false);
  const [gestureActive, setGestureActive] = useState(false);
  const spaceRef = useRef(false);

  // ----- Size / registry -----
  useEffect(() => {
    const el = containerRef.current!;
    const ro = new ResizeObserver(([entry]) => setSize({ width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    stageRegistry.stage = stageRef.current;
  });
  useEffect(() => () => void (stageRegistry.stage = null), []);

  const fittedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!boardId || !size.width || fittedFor.current === boardId) return;
    fittedFor.current = boardId;
    dispatch(zoomToFit());
  }, [boardId, size.width, dispatch]);

  // Redraw once web fonts arrive so Caveat text measures and renders correctly.
  useEffect(() => {
    document.fonts?.ready.then(() => stageRef.current?.batchDraw());
  }, []);

  // ----- Space-to-pan -----
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTypingTarget(e.target)) {
        e.preventDefault();
        if (!spaceRef.current) setSpaceDown((spaceRef.current = true));
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown((spaceRef.current = false));
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // ----- Wheel: pan, ctrl/⌘ + wheel or pinch to zoom -----
  useEffect(() => {
    const el = containerRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const vp = store.getState().editor.view.viewport;
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.01));
        dispatch(viewportChanged(zoomAround(vp, vp.scale * factor, { x: e.clientX - rect.left, y: e.clientY - rect.top })));
      } else {
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
        dispatch(viewportChanged({ ...vp, x: vp.x - dx, y: vp.y - dy }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [dispatch, store]);

  // ----- Derived render data -----
  const byId = useMemo(() => new Map(elements.map((e) => [e.id, e])), [elements]);
  const sorted = useMemo(() => [...elements].sort((a, b) => a.zIndex - b.zIndex), [elements]);
  const visible = useMemo(() => {
    if (exporting || sorted.length <= CULLING_THRESHOLD || !size.width) return sorted;
    const view = visibleWorldRect(viewport, size.width, size.height);
    const margin = 200 / viewport.scale;
    const area = { x: view.x - margin, y: view.y - margin, width: view.width + margin * 2, height: view.height + margin * 2 };
    const sel = new Set(selectedIds);
    return sorted.filter((e) => e.type === 'connector' || sel.has(e.id) || rectsIntersect(elementBounds(e), area));
  }, [sorted, viewport, size, exporting, selectedIds]);

  const bgImage = useImage(background.type === 'image' ? background.imageUrl : null).img;

  // ----- Coordinate helpers -----
  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current!.getBoundingClientRect();
      const vp = store.getState().editor.view.viewport;
      const sx = clientX - rect.left, sy = clientY - rect.top;
      return { x: (sx - vp.x) / vp.scale, y: (sy - vp.y) / vp.scale, sx, sy };
    },
    [store],
  );

  const redrawDraft = () => draftRef.current?.getLayer()?.batchDraw();

  const eraseAlong = (from: { x: number; y: number }, to: { x: number; y: number }, ids: Set<string>) => {
    const stage = stageRef.current!;
    const vp = store.getState().editor.view.viewport;
    const steps = Math.max(1, Math.ceil((Math.hypot(to.x - from.x, to.y - from.y) * vp.scale) / 4));
    for (let i = 0; i <= steps; i++) {
      const wx = from.x + ((to.x - from.x) * i) / steps, wy = from.y + ((to.y - from.y) * i) / steps;
      const hit = stage.getIntersection({ x: wx * vp.scale + vp.x, y: wy * vp.scale + vp.y });
      const node = hit?.findAncestor('.element', true);
      const id = node?.id();
      if (id && !ids.has(id) && !byIdRef.current.get(id)?.locked) {
        ids.add(id);
        node!.hide();
        node!.getLayer()?.batchDraw();
      }
    }
  };
  const byIdRef = useRef(byId);
  byIdRef.current = byId;

  // ----- Stage pointer handling -----
  const onPointerDown = (e: KonvaEventObject<PointerEvent>) => {
    const evt = e.evt;
    const state = store.getState();
    const t = state.editor.tools.tool;
    const p = toWorld(evt.clientX, evt.clientY);
    const vp = state.editor.view.viewport;
    const startGesture = (g: Gesture) => {
      gesture.current = g;
      setGestureActive(true);
      containerRef.current?.setPointerCapture?.(evt.pointerId);
    };

    if (evt.button === 1 || spaceRef.current || t === 'hand' || (readOnly && evt.button === 0)) {
      startGesture({ kind: 'pan', startX: p.sx, startY: p.sy, vx: vp.x, vy: vp.y });
      return;
    }
    if (evt.button !== 0) return;
    const targetId = elementIdOf(e.target);

    switch (t) {
      case 'select':
        if (!targetId) {
          if (!evt.shiftKey) dispatch(selectionChanged([]));
          startGesture({ kind: 'marquee', x1: p.x, y1: p.y, x2: p.x, y2: p.y, base: evt.shiftKey ? state.editor.view.selectedIds : [] });
        }
        break;
      case 'pen':
      case 'highlighter': {
        const pressure = evt.pointerType === 'pen' ? evt.pressure || 0.5 : 0.5;
        startGesture({ kind: 'draw', points: [[p.x, p.y, pressure]], highlighter: t === 'highlighter' });
        redrawDraft();
        break;
      }
      case 'eraser': {
        const g: Gesture = { kind: 'erase', ids: new Set(), last: p };
        startGesture(g);
        eraseAlong(p, p, g.ids);
        break;
      }
      case 'shape':
        startGesture({ kind: 'shape', x1: p.x, y1: p.y, x2: p.x, y2: p.y });
        break;
      case 'text': {
        const target = targetId ? byId.get(targetId) : undefined;
        if (target && (target.type === 'text' || target.type === 'sticky')) {
          dispatch(selectionChanged([target.id]));
          dispatch(editingStarted(target.id));
        } else {
          dispatch(startTextAt(p.x, p.y - state.editor.tools.fontSize * 0.6));
        }
        dispatch(toolSelected('select'));
        break;
      }
      case 'sticky': {
        const el = createSticky(p.x, p.y, state.editor.tools);
        dispatch(elementsAdded([el]));
        dispatch(selectionChanged([el.id]));
        dispatch(editingStarted(el.id));
        dispatch(toolSelected('select'));
        break;
      }
      case 'image':
        dispatch(pickAndInsertImage({ x: p.x, y: p.y }));
        break;
      case 'connector': {
        const target = targetId ? byId.get(targetId) : undefined;
        if (target && target.type !== 'connector') {
          const c = center(elementBounds(target));
          startGesture({ kind: 'connect', from: target.id, x2: c.x, y2: c.y });
        }
        break;
      }
    }
  };

  const onPointerMove = (evt: PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const p = toWorld(evt.clientX, evt.clientY);
    switch (g.kind) {
      case 'pan':
        dispatch(viewportChanged({ ...store.getState().editor.view.viewport, x: g.vx + (p.sx - g.startX), y: g.vy + (p.sy - g.startY) }));
        break;
      case 'draw': {
        const events = evt.getCoalescedEvents?.() ?? [evt];
        const minDist = 0.75 / store.getState().editor.view.viewport.scale;
        for (const ce of events.length ? events : [evt]) {
          const q = toWorld(ce.clientX, ce.clientY);
          const last = g.points[g.points.length - 1];
          if (Math.hypot(q.x - last[0], q.y - last[1]) < minDist) continue;
          g.points.push([q.x, q.y, ce.pointerType === 'pen' ? ce.pressure || 0.5 : 0.5]);
        }
        redrawDraft();
        break;
      }
      case 'shape': {
        const kind = store.getState().editor.tools.shapeKind;
        let { x, y } = p;
        if (evt.shiftKey) {
          const dx = x - g.x1, dy = y - g.y1;
          if (kind === 'line' || kind === 'arrow') {
            const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
            const len = Math.hypot(dx, dy);
            x = g.x1 + Math.cos(angle) * len;
            y = g.y1 + Math.sin(angle) * len;
          } else {
            const s = Math.max(Math.abs(dx), Math.abs(dy));
            x = g.x1 + Math.sign(dx || 1) * s;
            y = g.y1 + Math.sign(dy || 1) * s;
          }
        }
        g.x2 = x;
        g.y2 = y;
        redrawDraft();
        break;
      }
      case 'marquee':
        g.x2 = p.x;
        g.y2 = p.y;
        redrawDraft();
        break;
      case 'erase':
        eraseAlong(g.last, p, g.ids);
        g.last = p;
        break;
      case 'connect':
        g.x2 = p.x;
        g.y2 = p.y;
        redrawDraft();
        break;
    }
  };

  const finishGesture = (evt: PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    setGestureActive(false);
    const state = store.getState();
    const tools = state.editor.tools;

    switch (g.kind) {
      case 'draw': {
        const pts = g.points.length === 1 ? [...g.points, [g.points[0][0] + 0.5, g.points[0][1] + 0.5, g.points[0][2]]] : g.points;
        dispatch(elementsAdded([createStroke(pts, tools, g.highlighter)]));
        break;
      }
      case 'shape': {
        const isLine = tools.shapeKind === 'line' || tools.shapeKind === 'arrow';
        const tiny = Math.hypot(g.x2 - g.x1, g.y2 - g.y1) * state.editor.view.viewport.scale < 6;
        const [x2, y2] = tiny ? [g.x1 + 160, g.y1 + (isLine ? 0 : 110)] : [g.x2, g.y2];
        const el = createShape(tools.shapeKind, g.x1, g.y1, x2, y2, tools);
        dispatch(elementsAdded([el]));
        dispatch(selectionChanged([el.id]));
        dispatch(toolSelected('select'));
        break;
      }
      case 'marquee': {
        const r = normalizeRect(g.x1, g.y1, g.x2, g.y2);
        if (r.width * state.editor.view.viewport.scale > 3 || r.height * state.editor.view.viewport.scale > 3) {
          const all = state.editor.document.elements;
          const hit = new Set(g.base);
          for (const el of all) {
            if (el.type === 'connector' || !rectsIntersect(elementBounds(el), r)) continue;
            withGroup(el, all).forEach((id) => hit.add(id));
          }
          dispatch(selectionChanged([...hit]));
        }
        break;
      }
      case 'erase':
        if (g.ids.size) dispatch(elementsRemoved([...g.ids]));
        break;
      case 'connect': {
        const stage = stageRef.current!;
        const rect = containerRef.current!.getBoundingClientRect();
        const hit = stage.getIntersection({ x: evt.clientX - rect.left, y: evt.clientY - rect.top });
        const toId = elementIdOf(hit);
        const to = toId ? byIdRef.current.get(toId) : undefined;
        if (to && to.id !== g.from && to.type !== 'connector') dispatch(elementsAdded([createConnector(g.from, to.id, tools)]));
        break;
      }
    }
    redrawDraft();
  };

  useEffect(() => {
    const move = (e: PointerEvent) => onPointerMove(e);
    const up = (e: PointerEvent) => finishGesture(e);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  });

  const onStageDblClick = (e: KonvaEventObject<MouseEvent>) => {
    if (readOnly || store.getState().editor.tools.tool !== 'select' || elementIdOf(e.target)) return;
    const p = toWorld(e.evt.clientX, e.evt.clientY);
    dispatch(startTextAt(p.x, p.y - store.getState().editor.tools.fontSize * 0.6));
  };

  // ----- Element handlers (stable identity so memoised nodes don't re-render) -----
  const handlers = useMemo<NodeHandlers>(
    () => ({
      onPointerDown(e, el) {
        const s = store.getState();
        if (s.editor.tools.tool !== 'select' || s.editor.view.readOnly || spaceRef.current || e.evt.button !== 0) return;
        const ids = withGroup(el, s.editor.document.elements);
        const sel = s.editor.view.selectedIds;
        if (e.evt.shiftKey) {
          const allIn = ids.every((id) => sel.includes(id));
          dispatch(selectionChanged(allIn ? sel.filter((id) => !ids.includes(id)) : [...new Set([...sel, ...ids])]));
        } else if (!sel.includes(el.id)) {
          dispatch(selectionChanged(ids));
        }
      },
      onDblClick(el) {
        const s = store.getState();
        if (s.editor.view.readOnly || el.locked) return;
        if (el.type === 'text' || el.type === 'sticky') {
          dispatch(selectionChanged([el.id]));
          dispatch(editingStarted(el.id));
        }
      },
      onDragStart(_e, el) {
        const sel = store.getState().editor.view.selectedIds;
        if (!sel.includes(el.id)) dispatch(selectionChanged([el.id]));
      },
      onDragEnd(_e, el) {
        const s = store.getState();
        const stage = stageRef.current!;
        const ids = s.editor.view.selectedIds.includes(el.id) ? s.editor.view.selectedIds : [el.id];
        const step = s.editor.tools.snapToGrid ? s.editor.document.background.grid.spacing : 0;
        const patches: ElementPatch[] = [];
        for (const id of ids) {
          const node = stage.findOne(`#${id}`);
          const cur = byIdRef.current.get(id);
          if (!node || !cur || cur.type === 'connector') continue;
          let x = node.x(), y = node.y();
          if (step) {
            x = snapTo(x, step);
            y = snapTo(y, step);
            node.position({ x, y });
          }
          if (x !== cur.x || y !== cur.y) patches.push({ id, x, y });
        }
        if (patches.length) dispatch(elementsUpdated(patches));
      },
    }),
    [dispatch, store],
  );

  const onTransformEnd = () => {
    const tr = trRef.current!;
    const patches: ElementPatch[] = tr.nodes().flatMap((node) => {
      const el = byIdRef.current.get(node.id());
      if (!el) return [];
      const sx = node.scaleX(), sy = node.scaleY();
      node.scale({ x: 1, y: 1 });
      const p: ElementPatch = { id: el.id, x: node.x(), y: node.y(), rotation: +node.rotation().toFixed(2) };
      if (el.type === 'text') {
        p.style = { fontSize: Math.max(6, Math.min(400, Math.round((el.style.fontSize ?? 24) * sy))) };
        p.width = el.width * sy;
        p.height = el.height * sy;
      } else {
        p.width = Math.max(2, el.width * sx);
        p.height = Math.max(2, el.height * sy);
        if (el.data.points) p.data = { points: el.data.points.map(([x, y, pr]) => (pr === undefined ? [x * sx, y * sy] : [x * sx, y * sy, pr])) };
      }
      return [p];
    });
    dispatch(elementsUpdated(patches));
  };

  // ----- Transformer attachment -----
  const transformable = useMemo(
    () => selectedIds.map((id) => byId.get(id)).filter((e): e is CanvasElement => !!e && e.type !== 'connector' && !e.locked && e.id !== editingId),
    [selectedIds, byId, editingId],
  );
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const nodes = readOnly ? [] : transformable.map((e) => stage.findOne(`#${e.id}`)).filter((n): n is Konva.Node => !!n);
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [transformable, visible, readOnly]);

  const singleText = transformable.length === 1 && transformable[0].type === 'text';
  const keepRatio = transformable.length === 1 && (transformable[0].type === 'text' || transformable[0].type === 'image');

  // Outlines for selected items the transformer can't hold (connectors, locked).
  const outlines = useMemo(
    () =>
      selectedIds
        .map((id) => byId.get(id))
        .filter((e): e is CanvasElement => !!e && (e.type === 'connector' || e.locked))
        .map((e) => ({ id: e.id, locked: e.locked, ...elementBounds(e, byId) })),
    [selectedIds, byId],
  );

  // ----- Draft preview (drawn imperatively, no React re-render per pointer move) -----
  const drawDraft = (ctx: Konva.Context) => {
    const g = gesture.current;
    if (!g) return;
    const c = ctx._context;
    const s = store.getState();
    const tools = s.editor.tools;
    const scale = s.editor.view.viewport.scale;
    if (g.kind === 'draw') {
      const outline = strokeOutline(g.points, tools.strokeWidth, g.highlighter);
      c.globalAlpha = g.highlighter ? 0.35 : 1;
      c.fillStyle = tools.color;
      c.fill(new Path2D(outlineToSvgPath(outline)));
    } else if (g.kind === 'shape') {
      const el = createShape(tools.shapeKind, g.x1, g.y1, g.x2, g.y2, tools);
      el.id = 'draft-shape';
      el.style.seed = 7;
      c.translate(el.x, el.y);
      paintOps(c, shapePaths(el));
    } else if (g.kind === 'marquee') {
      const r = normalizeRect(g.x1, g.y1, g.x2, g.y2);
      c.fillStyle = 'rgba(79,70,229,0.08)';
      c.strokeStyle = PRIMARY;
      c.lineWidth = 1 / scale;
      c.fillRect(r.x, r.y, r.width, r.height);
      c.strokeRect(r.x, r.y, r.width, r.height);
    } else if (g.kind === 'connect') {
      const from = byIdRef.current.get(g.from);
      if (!from) return;
      const a = center(elementBounds(from));
      c.strokeStyle = PRIMARY;
      c.lineWidth = 2 / scale;
      c.setLineDash([6 / scale, 4 / scale]);
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(g.x2, g.y2);
      c.stroke();
    }
  };

  // ----- Drag & drop images -----
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (readOnly) return;
    const p = toWorld(e.clientX, e.clientY);
    Array.from(e.dataTransfer.files)
      .filter((f) => f.type.startsWith('image/'))
      .forEach((f, i) => dispatch(insertImageFile(f, { x: p.x + i * 32, y: p.y + i * 32 })));
  };

  const cursor = readOnly
    ? gestureActive ? 'grabbing' : 'grab'
    : spaceDown || tool === 'hand'
      ? gestureActive ? 'grabbing' : 'grab'
      : tool === 'eraser'
        ? ERASER_CURSOR
        : tool === 'text'
          ? 'text'
          : tool === 'select'
            ? 'default'
            : 'crosshair';

  const interactive = !readOnly && !spaceDown && (tool === 'select' || tool === 'eraser' || tool === 'connector' || tool === 'text');
  const draggable = !readOnly && !spaceDown && tool === 'select';
  const layerTransform = { x: viewport.x, y: viewport.y, scaleX: viewport.scale, scaleY: viewport.scale };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden select-none"
      style={{ cursor, touchAction: 'none' }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      // Keep focus where it is (e.g. a just-opened text editor) when pressing on the canvas itself.
      onMouseDown={(e) => e.target instanceof HTMLCanvasElement && e.preventDefault()}
      data-testid="canvas"
    >
      {size.width > 0 && (
        <Stage ref={stageRef} width={size.width} height={size.height} onPointerDown={onPointerDown} onDblClick={onStageDblClick} onDblTap={onStageDblClick as never}>
          <Layer listening={false}>
            <Shape
              sceneFunc={(ctx) => drawBackground(ctx._context, background, viewport, size.width, size.height, bgImage)}
              perfectDrawEnabled={false}
            />
          </Layer>
          <Layer name={CONTENT_LAYER_NAME} {...layerTransform}>
            {visible.map((el) => (
              <ElementNode
                key={el.id}
                el={el}
                ends={el.type === 'connector' ? connectorEndpoints(el, byId) : undefined}
                interactive={interactive}
                draggable={draggable && !el.locked}
                editing={editingId === el.id}
                handlers={handlers}
              />
            ))}
          </Layer>
          <Layer {...layerTransform}>
            <Shape ref={draftRef} sceneFunc={drawDraft} listening={false} />
            {outlines.map((o) => (
              <Rect
                key={o.id}
                x={o.x - 4}
                y={o.y - 4}
                width={o.width + 8}
                height={o.height + 8}
                stroke={o.locked ? '#9CA3AF' : PRIMARY}
                strokeWidth={1.5 / viewport.scale}
                dash={[6 / viewport.scale, 4 / viewport.scale]}
                listening={false}
              />
            ))}
            <Transformer
              ref={trRef}
              onTransformEnd={onTransformEnd}
              rotateEnabled
              flipEnabled={false}
              keepRatio={keepRatio}
              enabledAnchors={singleText ? ['top-left', 'top-right', 'bottom-left', 'bottom-right'] : undefined}
              anchorSize={9}
              anchorCornerRadius={3}
              anchorStroke={PRIMARY}
              anchorFill="#fff"
              borderStroke={PRIMARY}
              borderStrokeWidth={1.5}
              rotateAnchorOffset={26}
              padding={4}
              ignoreStroke
              boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 6 || Math.abs(newBox.height) < 6 ? oldBox : newBox)}
            />
          </Layer>
        </Stage>
      )}
      {!readOnly && !gestureActive && <SelectionToolbar width={size.width} />}
      {!readOnly && <TextEditor />}
      <ZoomControls />
    </div>
  );
}

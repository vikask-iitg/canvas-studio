import { memo } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Group, Image as KonvaImage, Rect, Shape, Text } from 'react-konva';
import type { CanvasElement } from '@canvas/shared';
import { paintOps, shapePaths, connectorPaths } from '../../canvas/rough';
import { strokeGeometry } from '../../canvas/stroke';
import { useImage } from '../../canvas/imageCache';
import { STICKY_PADDING, TEXT_LINE_HEIGHT } from '../../canvas/constants';

export interface NodeHandlers {
  onPointerDown(e: KonvaEventObject<PointerEvent>, el: CanvasElement): void;
  onDblClick(el: CanvasElement): void;
  onDragStart(e: KonvaEventObject<DragEvent>, el: CanvasElement): void;
  onDragEnd(e: KonvaEventObject<DragEvent>, el: CanvasElement): void;
}

interface Props {
  el: CanvasElement;
  /** Connector endpoints [x1, y1, x2, y2], computed by the parent from the attached elements. */
  ends?: [number, number, number, number] | null;
  interactive: boolean;
  draggable: boolean;
  editing: boolean;
  handlers: NodeHandlers;
}

const path2dCache = new WeakMap<object, Path2D>();
const path2d = (key: { d: string }) => {
  let p = path2dCache.get(key);
  if (!p) path2dCache.set(key, (p = new Path2D(key.d)));
  return p;
};

type HitShape = Konva.Shape & { colorKey: string };

function common(p: Props) {
  const { el, handlers } = p;
  return {
    id: el.id,
    name: 'element',
    x: el.x,
    y: el.y,
    rotation: el.rotation,
    opacity: el.style.opacity ?? 1,
    draggable: p.draggable,
    listening: p.interactive,
    perfectDrawEnabled: false,
    onPointerDown: (e: KonvaEventObject<PointerEvent>) => handlers.onPointerDown(e, el),
    onDblClick: () => handlers.onDblClick(el),
    onDblTap: () => handlers.onDblClick(el),
    onDragStart: (e: KonvaEventObject<DragEvent>) => handlers.onDragStart(e, el),
    onDragEnd: (e: KonvaEventObject<DragEvent>) => handlers.onDragEnd(e, el),
  };
}

function StrokeNode(p: Props) {
  const { el } = p;
  return (
    <Shape
      {...common(p)}
      width={el.width}
      height={el.height}
      sceneFunc={(ctx) => {
        const c = ctx._context;
        c.fillStyle = el.style.stroke ?? '#111827';
        c.fill(path2d(strokeGeometry(el)));
      }}
      hitFunc={(ctx, shape) => {
        // Widen the hit area so thin strokes are easy to grab.
        const c = ctx._context;
        const path = path2d(strokeGeometry(el));
        c.fillStyle = c.strokeStyle = (shape as HitShape).colorKey;
        c.lineWidth = 12;
        c.fill(path);
        c.stroke(path);
      }}
    />
  );
}

function ShapeNode(p: Props) {
  const { el } = p;
  const isLine = el.data.shape === 'line' || el.data.shape === 'arrow';
  return (
    <Shape
      {...common(p)}
      width={el.width}
      height={el.height}
      sceneFunc={(ctx) => paintOps(ctx._context, shapePaths(el))}
      hitFunc={(ctx, shape) => {
        const c = ctx._context;
        c.fillStyle = c.strokeStyle = (shape as HitShape).colorKey;
        if (isLine) {
          const pts = el.data.points ?? [[0, 0], [el.width, el.height]];
          c.lineWidth = Math.max(14, (el.style.strokeWidth ?? 2) + 10);
          c.beginPath();
          c.moveTo(pts[0][0], pts[0][1]);
          c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
          c.stroke();
        } else {
          c.fillRect(0, 0, el.width, el.height);
        }
      }}
    />
  );
}

function TextNode(p: Props) {
  const { el } = p;
  return (
    <Text
      {...common(p)}
      visible={!p.editing}
      text={el.data.text || ' '}
      fontFamily={el.style.fontFamily ?? 'Caveat'}
      fontSize={el.style.fontSize ?? 24}
      fill={el.style.stroke ?? '#111827'}
      lineHeight={TEXT_LINE_HEIGHT}
    />
  );
}

function StickyNode(p: Props) {
  const { el } = p;
  return (
    <Group {...common(p)}>
      <Rect
        width={el.width}
        height={el.height}
        fill={el.style.fill ?? '#FEF08A'}
        cornerRadius={4}
        shadowColor="#000"
        shadowOpacity={0.16}
        shadowBlur={12}
        shadowOffsetY={4}
        shadowForStrokeEnabled={false}
        perfectDrawEnabled={false}
      />
      <Text
        x={STICKY_PADDING}
        y={STICKY_PADDING}
        width={el.width - STICKY_PADDING * 2}
        height={el.height - STICKY_PADDING * 2}
        visible={!p.editing}
        text={el.data.text ?? ''}
        fontFamily={el.style.fontFamily ?? 'Caveat'}
        fontSize={el.style.fontSize ?? 24}
        fill={el.style.stroke ?? '#1F2937'}
        lineHeight={TEXT_LINE_HEIGHT}
        wrap="word"
        ellipsis
        listening={false}
      />
    </Group>
  );
}

function ImageNode(p: Props) {
  const { el } = p;
  const { img, failed } = useImage(el.data.src);
  // Stable outer node so an attached Transformer survives the placeholder → image swap.
  return (
    <Group {...common(p)}>
      {img ? (
        <KonvaImage image={img} width={el.width} height={el.height} perfectDrawEnabled={false} />
      ) : (
        <>
          <Rect width={el.width} height={el.height} fill="#F3F4F6" stroke="#D1D5DB" dash={[6, 4]} cornerRadius={6} />
          <Text
            width={el.width}
            height={el.height}
            align="center"
            verticalAlign="middle"
            text={failed ? 'Image failed to load' : 'Loading image…'}
            fontFamily="Inter"
            fontSize={14}
            fill="#6B7280"
            listening={false}
          />
        </>
      )}
    </Group>
  );
}

function ConnectorNode(p: Props) {
  const { el, ends } = p;
  if (!ends) return null;
  return (
    <Shape
      id={el.id}
      name="element"
      listening={p.interactive}
      perfectDrawEnabled={false}
      onPointerDown={(e) => p.handlers.onPointerDown(e, el)}
      sceneFunc={(ctx) => paintOps(ctx._context, connectorPaths(el, ...ends))}
      hitFunc={(ctx, shape) => {
        const c = ctx._context;
        c.strokeStyle = (shape as HitShape).colorKey;
        c.lineWidth = 14;
        c.beginPath();
        c.moveTo(ends[0], ends[1]);
        c.lineTo(ends[2], ends[3]);
        c.stroke();
      }}
    />
  );
}

function ElementNodeImpl(p: Props) {
  switch (p.el.type) {
    case 'stroke':
      return <StrokeNode {...p} />;
    case 'shape':
      return <ShapeNode {...p} />;
    case 'text':
      return <TextNode {...p} />;
    case 'sticky':
      return <StickyNode {...p} />;
    case 'image':
      return <ImageNode {...p} />;
    case 'connector':
      return <ConnectorNode {...p} />;
  }
}

const sameEnds = (a?: Props['ends'], b?: Props['ends']) => a === b || (!!a && !!b && a.every((v, i) => v === b[i]));

export const ElementNode = memo(
  ElementNodeImpl,
  (a, b) =>
    a.el === b.el &&
    a.interactive === b.interactive &&
    a.draggable === b.draggable &&
    a.editing === b.editing &&
    a.handlers === b.handlers &&
    sameEnds(a.ends, b.ends),
);

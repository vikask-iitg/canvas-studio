import { useLayoutEffect, useRef, useState } from 'react';
import Konva from 'konva';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { elementsRemoved, elementsUpdated } from '../../slices/documentSlice';
import { editingStarted } from '../../slices/viewSlice';
import { STICKY_PADDING, TEXT_LINE_HEIGHT } from '../../canvas/constants';

function measure(text: string, fontFamily: string, fontSize: number) {
  const t = new Konva.Text({ text: text || ' ', fontFamily, fontSize, lineHeight: TEXT_LINE_HEIGHT });
  const size = { width: t.width(), height: t.height() };
  t.destroy();
  return size;
}

/** Inline textarea positioned over the text or sticky note being edited. */
export function TextEditor() {
  const dispatch = useAppDispatch();
  const editingId = useAppSelector((s) => s.editor.view.editingId);
  const el = useAppSelector((s) => s.editor.document.elements.find((e) => e.id === s.editor.view.editingId));
  const vp = useAppSelector((s) => s.editor.view.viewport);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState('');
  const committed = useRef(false);

  // Focus synchronously so the first keystrokes land in the editor, not the tool shortcuts.
  useLayoutEffect(() => {
    if (!el) return;
    committed.current = false;
    setValue(el.data.text ?? '');
    ref.current?.focus();
    ref.current?.select();
    // Only when a new element starts editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  const fontFamily = el?.style.fontFamily ?? 'Caveat';
  const fontSize = el?.style.fontSize ?? 24;
  const isSticky = el?.type === 'sticky';

  useLayoutEffect(() => {
    const ta = ref.current;
    if (!ta || !el || isSticky) return;
    const m = measure(value, fontFamily, fontSize);
    ta.style.width = `${Math.max(m.width + fontSize, 60) * vp.scale}px`;
    ta.style.height = `${Math.max(m.height, fontSize * TEXT_LINE_HEIGHT) * vp.scale + 4}px`;
  }, [value, el, isSticky, fontFamily, fontSize, vp.scale]);

  if (!el) return null;

  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    const text = value.replace(/\s+$/, '');
    if (el.type === 'text' && !text.trim()) {
      dispatch(elementsRemoved([el.id]));
    } else if (text !== (el.data.text ?? '')) {
      const size = el.type === 'text' ? measure(text, fontFamily, fontSize) : { width: el.width, height: el.height };
      dispatch(elementsUpdated([{ id: el.id, data: { text }, width: size.width, height: size.height }]));
    }
    dispatch(editingStarted(null));
  };

  const pad = isSticky ? STICKY_PADDING : 0;
  const rot = (el.rotation * Math.PI) / 180;
  // Offset the inner padding along the element's rotated axes.
  const left = (el.x + pad * Math.cos(rot) - pad * Math.sin(rot)) * vp.scale + vp.x;
  const top = (el.y + pad * Math.sin(rot) + pad * Math.cos(rot)) * vp.scale + vp.y;

  return (
    <textarea
      ref={ref}
      aria-label={isSticky ? 'Sticky note text' : 'Text'}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
          e.preventDefault();
          commit();
        }
      }}
      spellCheck={false}
      wrap={isSticky ? 'soft' : 'off'}
      className="absolute z-20 resize-none overflow-hidden border-0 bg-transparent p-0 outline-none ring-1 ring-primary/50 ring-offset-0"
      style={{
        left,
        top,
        transform: `rotate(${el.rotation}deg)`,
        transformOrigin: 'top left',
        fontFamily: `${fontFamily}, cursive`,
        fontSize: fontSize * vp.scale,
        lineHeight: TEXT_LINE_HEIGHT,
        color: el.style.stroke ?? '#111827',
        whiteSpace: isSticky ? 'pre-wrap' : 'pre',
        ...(isSticky ? { width: (el.width - pad * 2) * vp.scale, height: (el.height - pad * 2) * vp.scale } : {}),
      }}
    />
  );
}

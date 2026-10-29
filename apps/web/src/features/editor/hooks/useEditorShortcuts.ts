import { useEffect } from 'react';
import { useAppDispatch, useAppStore } from '@/app/hooks';
import { redo, undo } from '../slices/documentSlice';
import { toolSelected } from '../slices/toolsSlice';
import { backgroundPanelToggled, editorDialogOpened, editingStarted, selectionChanged } from '../slices/viewSlice';
import {
  copySelection,
  deleteSelection,
  duplicateSelection,
  groupSelection,
  nudgeSelection,
  pasteFromClipboard,
  pickAndInsertImage,
  reorderSelection,
  selectAll,
  ungroupSelection,
  zoomBy,
  zoomTo,
  zoomToFit,
} from '../actions';

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

const TOOL_KEYS: Record<string, Parameters<typeof toolSelected>[0]> = {
  v: 'select',
  h: 'hand',
  p: 'pen',
  m: 'highlighter',
  e: 'eraser',
  s: 'shape',
  t: 'text',
  n: 'sticky',
  c: 'connector',
};

export function useEditorShortcuts(enabled = true) {
  const dispatch = useAppDispatch();
  const store = useAppStore();

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || store.getState().editor.view.editingId || document.querySelector('[role="dialog"], [role="menu"]')) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const state = store.getState();
      const hasSelection = state.editor.view.selectedIds.length > 0;

      if (mod) {
        const handled = (() => {
          switch (key) {
            case 'z':
              dispatch(e.shiftKey ? redo() : undo());
              return true;
            case 'y':
              dispatch(redo());
              return true;
            case 'd':
              dispatch(duplicateSelection());
              return true;
            case 'a':
              dispatch(selectAll());
              return true;
            case 'c':
              dispatch(copySelection());
              return hasSelection;
            case 'x':
              dispatch(copySelection(true));
              return hasSelection;
            case 'g':
              dispatch(e.shiftKey ? ungroupSelection() : groupSelection());
              return true;
            case '0':
              dispatch(zoomTo(1));
              return true;
            case '=':
            case '+':
              dispatch(zoomBy(1.2));
              return true;
            case '-':
              dispatch(zoomBy(1 / 1.2));
              return true;
          }
          return false;
        })();
        if (handled) e.preventDefault();
        return;
      }

      if (e.altKey) return;
      if (TOOL_KEYS[key] && !e.shiftKey) {
        dispatch(toolSelected(TOOL_KEYS[key]));
        return;
      }
      switch (e.key) {
        case 'i':
          dispatch(pickAndInsertImage());
          break;
        case 'Delete':
        case 'Backspace':
          if (hasSelection) {
            e.preventDefault();
            dispatch(deleteSelection());
          }
          break;
        case 'Escape':
          if (state.editor.view.backgroundPanelOpen) dispatch(backgroundPanelToggled(false));
          dispatch(selectionChanged([]));
          dispatch(editingStarted(null));
          break;
        case 'Enter': {
          const [id] = state.editor.view.selectedIds;
          const el = state.editor.document.elements.find((x) => x.id === id);
          if (el && (el.type === 'text' || el.type === 'sticky')) {
            e.preventDefault();
            dispatch(editingStarted(el.id));
          }
          break;
        }
        case '?':
          dispatch(editorDialogOpened('shortcuts'));
          break;
        case '!':
          dispatch(zoomToFit());
          break;
        case '@':
          dispatch(zoomToFit(true));
          break;
        case '+':
        case '=':
          dispatch(zoomBy(1.2));
          break;
        case '-':
          dispatch(zoomBy(1 / 1.2));
          break;
        case ']':
          dispatch(reorderSelection(e.shiftKey ? 'front' : 'forward'));
          break;
        case '[':
          dispatch(reorderSelection(e.shiftKey ? 'back' : 'backward'));
          break;
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown': {
          if (!hasSelection) return;
          e.preventDefault();
          const d = e.shiftKey ? 10 : 1;
          const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
          const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
          dispatch(nudgeSelection(dx, dy));
          break;
        }
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      if (dispatch(pasteFromClipboard(e.clipboardData))) e.preventDefault();
    };
    const onCopy = (e: ClipboardEvent) => {
      if (isTyping(e.target) || window.getSelection()?.toString()) return;
      if (store.getState().editor.view.selectedIds.length) {
        e.preventDefault();
        dispatch(copySelection());
      }
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    window.addEventListener('copy', onCopy);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('copy', onCopy);
    };
  }, [enabled, dispatch, store]);
}

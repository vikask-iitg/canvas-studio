import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { Modal } from '@/components/ui/Modal';
import { editorDialogOpened } from '../../slices/viewSlice';

const mod = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl';

const GROUPS: Array<[string, Array<[string, string]>]> = [
  [
    'Tools',
    [
      ['Select', 'V'],
      ['Hand (pan)', 'H or hold Space'],
      ['Pen', 'P'],
      ['Marker', 'M'],
      ['Eraser', 'E'],
      ['Shapes', 'S'],
      ['Text', 'T'],
      ['Image', 'I'],
      ['Sticky note', 'N'],
      ['Connector', 'C'],
    ],
  ],
  [
    'Edit',
    [
      ['Undo', `${mod} Z`],
      ['Redo', `${mod} ⇧ Z`],
      ['Duplicate', `${mod} D`],
      ['Copy / Cut / Paste', `${mod} C / X / V`],
      ['Select all', `${mod} A`],
      ['Delete', 'Delete'],
      ['Group / Ungroup', `${mod} G / ${mod} ⇧ G`],
      ['Bring forward / back', '] / ['],
      ['Nudge', 'Arrows (⇧ ×10)'],
      ['Edit text', 'Enter or double-click'],
    ],
  ],
  [
    'View',
    [
      ['Zoom in / out', '+ / −'],
      ['Zoom to fit', '⇧ 1'],
      ['Zoom to selection', '⇧ 2'],
      ['Reset zoom', `${mod} 0`],
      ['Zoom', `${mod} + scroll / pinch`],
      ['Pan', 'Scroll or Space + drag'],
      ['Shortcuts', '?'],
    ],
  ],
];

export function ShortcutsDialog() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.editor.view.dialog === 'shortcuts');
  return (
    <Modal open={open} onOpenChange={(o) => !o && dispatch(editorDialogOpened(null))} title="Keyboard shortcuts" className="max-w-3xl">
      <div className="grid gap-6 sm:grid-cols-3">
        {GROUPS.map(([title, rows]) => (
          <section key={title}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
            <dl className="space-y-1.5">
              {rows.map(([label, keys]) => (
                <div key={label} className="flex items-center justify-between gap-3 text-sm">
                  <dt>{label}</dt>
                  <dd>
                    <kbd className="whitespace-nowrap rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-xs text-muted">{keys}</kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}

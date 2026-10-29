import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';

export function RenameDialog({ open, initial, onClose, onSubmit }: { open: boolean; initial: string; onClose(): void; onSubmit(title: string): void }) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);
  const submit = () => {
    const t = value.trim();
    if (t && t !== initial) onSubmit(t.slice(0, 120));
    onClose();
  };
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Rename board"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={submit} disabled={!value.trim()}>
            Save
          </button>
        </>
      }
    >
      <input
        autoFocus
        aria-label="Board title"
        className="input"
        value={value}
        maxLength={120}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        onFocus={(e) => e.target.select()}
      />
    </Modal>
  );
}

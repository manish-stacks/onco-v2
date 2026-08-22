import { useState } from 'react';
import { useMutation } from '@/hooks/useApi';
import { api, mediaUrl } from '@/lib/api';
import { Button, Field, Input, Select, Textarea } from './index';
import { Modal } from './Modal';

/**
 * A generic modal for small CRUD entities — banners, deals, offers,
 * cities all run through it.
 *
 * Writing a separate modal for each one makes no sense when the only difference
 * is the fields. For a new form just pass a `fields` array.
 *
 *   fields: [
 *     { key: 'title', label: 'Title', required: true },
 *     { key: 'status', label: 'Status', type: 'select', options: [...], default: 'active' },
 *   ]
 */
export function SimpleFormModal({
  open, onClose, record, idKey, path, title, fields, onDone, fileField, json,
}) {
  const isEdit = !!record?.[idKey];
  const [form, setForm] = useState({});
  const [file, setFile] = useState(null);
  const [lastId, setLastId] = useState(null);

  // Modal khulne pe / dusra record aane pe form reset
  if (open && lastId !== (record?.[idKey] ?? 'new')) {
    setLastId(record?.[idKey] ?? 'new');
    const init = {};
    fields.forEach((f) => { init[f.key] = record?.[f.key] ?? f.default ?? ''; });
    setForm(init);
    setFile(null);
  }

  const save = useMutation(
    () => {
      // If there is no file, send plain JSON — FormData turns everything into a string
      if (json && !fileField) {
        return isEdit ? api.put(`${path}/${record[idKey]}`, form) : api.post(path, form);
      }
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v !== '' && v !== null) fd.append(k, v); });
      if (file && fileField) fd.append(fileField, file);
      return isEdit ? api.form(`${path}/${record[idKey]}`, fd, 'PUT') : api.form(path, fd, 'POST');
    },
    {
      success: isEdit ? `${title} updated` : `${title} added`,
      onSuccess: () => { onClose(); onDone(); },
    }
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open={open} onClose={onClose}
      title={`${isEdit ? 'Edit' : 'New'} ${title}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save.run} loading={save.loading}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        {fileField && (
          <Field label="Image">
            <div className="flex items-center gap-3">
              {(file || record?.[fileField]) && (
                <img
                  src={file ? URL.createObjectURL(file) : mediaUrl(record[fileField])}
                  alt=""
                  className="w-16 h-16 rounded border border-line object-cover bg-paper-sunk"
                />
              )}
              <Input
                type="file" accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0])}
                className="py-1.5 text-2xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-paper-sunk file:text-2xs"
              />
            </div>
          </Field>
        )}

        {fields.map((f) => (
          <Field key={f.key} label={f.label} required={f.required} hint={f.hint}>
            {f.type === 'textarea' ? (
              <Textarea rows={2} value={form[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />
            ) : f.type === 'select' ? (
              <Select value={form[f.key] ?? ''} options={f.options}
                onChange={(e) => set(f.key, e.target.value)} />
            ) : (
              <Input type={f.type || 'text'} mono={f.mono} value={form[f.key] ?? ''}
                onChange={(e) => set(f.key, e.target.value)} />
            )}
          </Field>
        ))}
      </div>
    </Modal>
  );
}

export default SimpleFormModal;
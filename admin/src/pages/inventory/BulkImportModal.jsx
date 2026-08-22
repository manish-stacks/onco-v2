import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertTriangle, Download } from 'lucide-react';
import { useMutation } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { num } from '@/lib/format';
import { Button, Field, Input, Code, EmptyState, cx } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';

/**
 * Bulk stock import. The CSV is parsed in the browser, a preview is shown,
 * then goes to `/admin/inventory/bulk`.
 *
 * Expected columns: product_id, stock_quantity, note (optional)
 * The header is case-insensitive and extra columns are ignored.
 */

const REQUIRED = ['product_id', 'stock_quantity'];

/** A small CSV parser — handles quoted fields and embedded commas */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i += 1; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && next === '\n') i += 1;
      row.push(field);
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = []; field = '';
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);

  return rows;
}

function toRecords(rows) {
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const records = rows.slice(1).map((r, i) => {
    const rec = { _line: i + 2 };
    headers.forEach((h, j) => { rec[h] = (r[j] ?? '').trim(); });
    return rec;
  });
  return { headers, records };
}

function validate(records) {
  return records.map((r) => {
    const errors = [];
    const pid = parseInt(r.product_id, 10);
    const qty = parseInt(r.stock_quantity, 10);

    if (!r.product_id) errors.push('product_id missing');
    else if (Number.isNaN(pid) || pid < 1) errors.push('product_id is not a valid number');

    if (r.stock_quantity === '' || r.stock_quantity === undefined) errors.push('stock_quantity missing');
    else if (Number.isNaN(qty) || qty < 0) errors.push('stock_quantity must be 0 or greater');

    return { ...r, product_id: pid, stock_quantity: qty, _errors: errors };
  });
}

export default function BulkImportModal({ open, onClose, onDone }) {
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [parseError, setParseError] = useState('');
  const inputRef = useRef(null);

  const reset = () => {
    setRows(null); setFileName(''); setResult(null); setParseError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const close = () => { reset(); onClose(); };

  const handleFile = async (file) => {
    if (!file) return;
    setParseError(''); setResult(null);
    setFileName(file.name);

    try {
      const text = await file.text();
      const { headers, records } = toRecords(parseCsv(text));

      const missing = REQUIRED.filter((c) => !headers.includes(c));
      if (missing.length) {
        setParseError(`These columns are missing: ${missing.join(', ')}. Download the sample CSV to compare.`);
        setRows(null);
        return;
      }
      if (!records.length) {
        setParseError('The file has no data rows.');
        setRows(null);
        return;
      }
      setRows(validate(records));
    } catch {
      setParseError('The file could not be read. Is it a valid CSV?');
      setRows(null);
    }
  };

  const valid = rows?.filter((r) => !r._errors.length) || [];
  const invalid = rows?.filter((r) => r._errors.length) || [];

  const submit = useMutation(
    () => api.post('/admin/inventory/bulk', {
      updates: valid.map((r) => ({
        product_id: r.product_id,
        stock_quantity: r.stock_quantity,
        note: r.note || `CSV import — ${fileName}`,
      })),
    }),
    {
      success: (res) => `Stock updated for ${res.data.updated} products`,
      onSuccess: (res) => { setResult(res.data); onDone?.(); },
    }
  );

  const downloadSample = () => {
    const csv = 'product_id,stock_quantity,note\n101,50,Supplier invoice INV-2201\n102,0,Batch expired\n103,120,\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'stock-import-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open={open} onClose={close} size="xl"
      title="Bulk stock import"
      subtitle="After stock-taking or a supplier delivery — update all products at once"
      footer={
        result ? (
          <Button variant="primary" onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button
              variant="primary" onClick={submit.run} loading={submit.loading}
              disabled={!valid.length}
            >
              {valid.length ? `Update ${valid.length} products` : 'Update stock'}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <ImportResult result={result} />
      ) : (
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
            className={cx(
              'relative border-2 border-dashed rounded-lg px-5 py-8 text-center transition-colors',
              rows ? 'border-teal/40 bg-teal-light/30' : 'border-line hover:border-teal bg-paper'
            )}
          >
            <input
              ref={inputRef} type="file" accept=".csv,text/csv"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            {rows ? (
              <div className="flex items-center justify-center gap-2.5">
                <FileSpreadsheet size={18} className="text-teal" />
                <div className="text-left">
                  <p className="text-[0.8125rem] font-medium text-ink">{fileName}</p>
                  <p className="text-2xs text-ink-500 tabular-nums">{rows.length} rows read</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); reset(); }}
                  className="relative z-10 ml-2 p-1 text-ink-300 hover:text-signal-danger"
                  aria-label="Remove file"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <>
                <Upload size={20} className="mx-auto text-ink-300 mb-2" />
                <p className="text-[0.8125rem] text-ink font-medium">Drop a CSV file here, or click</p>
                <p className="text-2xs text-ink-500 mt-1">
                  Required columns: <Code className="text-2xs">product_id</Code>,{' '}
                  <Code className="text-2xs">stock_quantity</Code>, aur optional{' '}
                  <Code className="text-2xs">note</Code>
                </p>
              </>
            )}
          </div>

          {parseError && (
            <div className="flex items-start gap-2 text-2xs text-signal-danger bg-signal-dangerBg border border-signal-danger/20 rounded px-3 py-2">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <p>{parseError}</p>
            </div>
          )}

          {!rows && (
            <button
              onClick={downloadSample}
              className="inline-flex items-center gap-1.5 text-2xs text-teal hover:underline"
            >
              <Download size={12} /> Download sample CSV
            </button>
          )}

          {rows && (
            <>
              <div className="flex flex-wrap gap-2">
                <Stat label="Ready to import" value={valid.length} tone="ok" />
                {invalid.length > 0 && <Stat label="Skip honge (errors)" value={invalid.length} tone="danger" />}
              </div>

              {invalid.length > 0 && (
                <div className="border border-signal-danger/25 bg-signal-dangerBg rounded overflow-hidden">
                  <p className="px-3 py-2 text-2xs font-semibold text-signal-danger border-b border-signal-danger/20">
                    These rows will be skipped — fix them and upload again
                  </p>
                  <ul className="max-h-32 overflow-y-auto divide-y divide-signal-danger/10">
                    {invalid.slice(0, 20).map((r) => (
                      <li key={r._line} className="px-3 py-1.5 text-2xs flex gap-2">
                        <span className="font-mono text-signal-danger shrink-0">L{r._line}</span>
                        <span className="text-ink-700">{r._errors.join(', ')}</span>
                      </li>
                    ))}
                    {invalid.length > 20 && (
                      <li className="px-3 py-1.5 text-2xs text-ink-500">…aur {invalid.length - 20} rows</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="border border-line rounded overflow-hidden">
                <p className="px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-ink-500 bg-paper border-b border-line">
                  Preview — pehli 50 rows
                </p>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-2xs">
                    <thead className="sticky top-0 bg-paper">
                      <tr className="border-b border-line">
                        <th className="text-left font-semibold text-ink-500 px-3 py-1.5">Line</th>
                        <th className="text-left font-semibold text-ink-500 px-3 py-1.5">Product ID</th>
                        <th className="text-right font-semibold text-ink-500 px-3 py-1.5">New stock</th>
                        <th className="text-left font-semibold text-ink-500 px-3 py-1.5">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {rows.slice(0, 50).map((r) => (
                        <tr key={r._line} className={r._errors.length ? 'bg-signal-dangerBg/40' : ''}>
                          <td className="px-3 py-1.5 font-mono text-ink-500">{r._line}</td>
                          <td className="px-3 py-1.5 font-mono text-ink-700">{r.product_id || '—'}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-ink">
                            {Number.isNaN(r.stock_quantity) ? '—' : num(r.stock_quantity)}
                          </td>
                          <td className="px-3 py-1.5 text-ink-500 truncate max-w-[200px]">{r.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-2xs text-ink-500">
                This <strong className="text-ink-700">sets the exact stock</strong> (it does not add to it).
                Every change is recorded in the inventory ledger.
              </p>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className={cx(
      'flex items-baseline gap-2 px-3 py-1.5 rounded border',
      tone === 'ok' ? 'bg-signal-okBg border-signal-ok/20' : 'bg-signal-dangerBg border-signal-danger/20'
    )}>
      <span className={cx('text-base font-semibold tabular-nums',
        tone === 'ok' ? 'text-signal-ok' : 'text-signal-danger')}>{value}</span>
      <span className="text-2xs text-ink-700">{label}</span>
    </div>
  );
}

function ImportResult({ result }) {
  return (
    <div className="text-center py-4">
      <div className="w-11 h-11 rounded-full bg-signal-okBg flex items-center justify-center mx-auto mb-3">
        <CheckCircle2 size={20} className="text-signal-ok" />
      </div>
      <p className="text-sm font-semibold text-ink">Import complete</p>
      <p className="text-2xs text-ink-500 mt-1 tabular-nums">
        {result.updated} of {result.total} products updated
      </p>

      {result.failed?.length > 0 && (
        <div className="mt-4 text-left border border-signal-warn/25 bg-signal-warnBg rounded overflow-hidden">
          <p className="px-3 py-2 text-2xs font-semibold text-signal-warn border-b border-signal-warn/20">
            {result.failed.length} products could not be updated
          </p>
          <ul className="max-h-32 overflow-y-auto divide-y divide-signal-warn/10">
            {result.failed.map((f) => (
              <li key={f.product_id} className="px-3 py-1.5 text-2xs flex gap-2">
                <span className="font-mono text-ink-700">#{f.product_id}</span>
                <span className="text-ink-500">{f.error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

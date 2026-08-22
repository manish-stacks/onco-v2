import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, KeyRound, ChevronDown, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { api } from '@/lib/api';
import { useMutation } from '@/hooks/useApi';
import { Button, Field, Input, cx } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';

export default function Topbar({ onMenu, onRefresh, refreshing }) {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const initials = (admin?.admin_name || admin?.admin_username || '?')
    .split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <header className="sticky top-0 z-20 h-14 bg-paper-card border-b border-line flex items-center gap-3 px-4 shrink-0">
      <button
        onClick={onMenu}
        className="lg:hidden p-1.5 -ml-1.5 text-ink-500 hover:text-ink rounded"
        aria-label="Open menu"
      >
        <Menu size={19} />
      </button>

      <div className="flex-1" />

      {onRefresh && (
        <Button size="sm" variant="ghost" onClick={onRefresh} disabled={refreshing} aria-label="Refresh">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </Button>
      )}

      <div className="relative" ref={ref}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded hover:bg-paper-sunk transition-colors"
        >
          <span className="w-7 h-7 rounded bg-ink text-white text-2xs font-semibold flex items-center justify-center shrink-0">
            {initials}
          </span>
          <span className="hidden sm:block text-left min-w-0">
            <span className="block text-[0.8125rem] font-medium text-ink leading-tight truncate max-w-[140px]">
              {admin?.admin_name || admin?.admin_username}
            </span>
            <span className="block text-2xs text-ink-500 leading-tight">{admin?.role_name}</span>
          </span>
          <ChevronDown size={13} className={cx('text-ink-300 transition-transform', menuOpen && 'rotate-180')} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-52 bg-paper-card border border-line rounded-lg shadow-pop py-1 animate-fade-up">
            <div className="px-3 py-2 border-b border-line">
              <p className="text-[0.8125rem] font-medium text-ink truncate">{admin?.admin_email || admin?.admin_username}</p>
              <p className="text-2xs text-ink-500 mt-0.5">{admin?.department || admin?.role_name}</p>
            </div>
            <button
              onClick={() => { setMenuOpen(false); setPwOpen(true); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[0.8125rem] text-ink-700 hover:bg-paper-sunk transition-colors"
            >
              <KeyRound size={14} /> Change password
            </button>
            <button
              onClick={async () => { await logout(); navigate('/login'); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[0.8125rem] text-signal-danger hover:bg-signal-dangerBg transition-colors"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}
      </div>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </header>
  );
}

function ChangePasswordModal({ open, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({ old_password: '', new_password: '', confirm: '' });
  const [err, setErr] = useState('');

  const save = useMutation(
    (body) => api.post('/admin/auth/change-password', body),
    { success: 'Password changed', onSuccess: onClose }
  );

  const submit = async () => {
    setErr('');
    if (form.new_password.length < 8) return setErr('Naya password kam se kam 8 characters ka ho');
    if (form.new_password !== form.confirm) return setErr('The two passwords do not match');
    const res = await save.run({ old_password: form.old_password, new_password: form.new_password });
    if (res) setForm({ old_password: '', new_password: '', confirm: '' });
    return null;
  };

  return (
    <Modal
      open={open} onClose={onClose} title="Change password" size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={save.loading}>Update password</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Current password" required>
          <Input type="password" value={form.old_password} autoComplete="current-password"
            onChange={(e) => setForm({ ...form, old_password: e.target.value })} />
        </Field>
        <Field label="New password" required hint="At least 8 characters">
          <Input type="password" value={form.new_password} autoComplete="new-password"
            onChange={(e) => setForm({ ...form, new_password: e.target.value })} />
        </Field>
        <Field label="Confirm new password" required error={err}>
          <Input type="password" value={form.confirm} autoComplete="new-password"
            onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

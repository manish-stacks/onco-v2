import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button, Field, Input, PageLoader } from '@/components/ui';

export default function Login() {
  const { admin, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><PageLoader /></div>;
  if (admin) return <Navigate to={location.state?.from || '/'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(form.username.trim(), form.password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center p-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-7 text-center">
          <div className="inline-flex items-baseline gap-0.5 mb-2">
            <span className="font-mono text-xl font-semibold text-white tracking-tight">onco</span>
            <span className="text-xl font-semibold text-teal">healthmart</span>
          </div>
          <p className="text-sm text-white/45">Admin console</p>
        </div>

        <form onSubmit={submit} className="bg-paper-card rounded-lg p-6 shadow-pop">
          <div className="space-y-4">
            <Field label="Username" required>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                autoComplete="username"
                autoFocus
                required
                placeholder="superadmin"
              />
            </Field>

            <Field label="Password" required error={error}>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
            </Field>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              icon={LogIn}
              loading={busy}
              className="w-full"
            >
              Sign in
            </Button>
          </div>
        </form>

        <p className="mt-5 text-center text-2xs text-white/30">
          Sirf authorised staff. Har login record hota hai.
        </p>
      </div>
    </div>
  );
}

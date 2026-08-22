import { useState } from 'react';
import {
  ShieldCheck, Plus, Pencil, Trash2, KeyRound, Users, History, Lock,
} from 'lucide-react';
import { useList, useResource, useMutation } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { PERMISSIONS as P } from '@/lib/constants';
import { num, dateTime, titleCase } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import {
  Card, Button, StatusPill, Code, Field, Input, Select, Checkbox, Tabs, EmptyState, cx,
} from '@/components/ui';
import { DataTable, Pagination, FilterBar, FilterSelect } from '@/components/ui/DataTable';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';

const TABS = [
  { value: 'members', label: 'Team members' },
  { value: 'roles', label: 'Roles & permissions' },
  { value: 'activity', label: 'Activity log' },
];

export default function Team() {
  const [tab, setTab] = useState('members');
  const { can } = useAuth();

  return (
    <>
      <PageHeader
        title="Team & access"
        subtitle="Sub-admins, employees and their permissions"
      />
      <Card dense>
        <Tabs tabs={TABS.filter((t) => (t.value === 'roles' ? can(P.ROLES_VIEW) : true))}
          value={tab} onChange={setTab} className="px-4 pt-1" />
        {tab === 'members' && <Members />}
        {tab === 'roles' && <Roles />}
        {tab === 'activity' && <Activity />}
      </Card>
    </>
  );
}

/* =========================================================================
 * MEMBERS
 * ======================================================================= */
function Members() {
  const { can, admin: me } = useAuth();
  const { rows, pagination, filters, setFilter, loading, reload } = useList('/admin/admins');
  const { data: roles } = useResource('/admin/roles');
  const [editing, setEditing] = useState(null);
  const [resetting, setResetting] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const del = useMutation(
    (id) => api.del(`/admin/admins/${id}`),
    { success: 'Team member removed', onSuccess: () => { setToDelete(null); reload(); } }
  );
  const toggle = useMutation(
    ({ id, status }) => api.patch(`/admin/admins/${id}/status`, { status }),
    { success: 'Status updated', onSuccess: reload }
  );

  const canManage = can(P.ADMINS_MANAGE);

  const columns = [
    {
      key: 'admin_name', label: 'Member',
      render: (a) => (
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded bg-ink text-white text-2xs font-semibold flex items-center justify-center shrink-0">
            {(a.admin_name || a.admin_username || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[0.8125rem] text-ink truncate max-w-[150px]">{a.admin_name || a.admin_username}</p>
              {a.admin_id === me?.admin_id && (
                <span className="code-chip text-[0.625rem] bg-teal-light text-teal-dark border-teal/20">you</span>
              )}
            </div>
            <Code className="text-2xs">{a.admin_username}</Code>
          </div>
        </div>
      ),
    },
    {
      key: 'role_name', label: 'Role',
      render: (a) => (
        <span className="text-2xs font-medium text-ink-700 bg-paper-sunk border border-line px-2 py-0.5 rounded">
          {a.role_name || `#${a.user_type}`}
        </span>
      ),
    },
    {
      key: 'department', label: 'Department',
      render: (a) => (
        <div className="text-2xs text-ink-500">
          <p className="text-ink-700">{a.department || '—'}</p>
          {a.employee_code && <Code className="text-2xs">{a.employee_code}</Code>}
        </div>
      ),
    },
    {
      key: 'admin_email', label: 'Contact',
      render: (a) => (
        <div className="text-2xs text-ink-500">
          <p className="truncate max-w-[170px]">{a.admin_email || '—'}</p>
          {a.admin_phone && <Code className="text-2xs">{a.admin_phone}</Code>}
        </div>
      ),
    },
    {
      key: 'last_login', label: 'Last login',
      render: (a) => (
        <div className="text-2xs tabular-nums text-ink-500">
          <p>{a.last_login ? dateTime(a.last_login) : 'never'}</p>
          {a.last_ip && <Code className="text-2xs">{a.last_ip}</Code>}
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (a) => <StatusPill status={a.status} size="xs" /> },
    {
      key: 'actions', label: '', align: 'right',
      render: (a) => canManage && (
        <div className="flex items-center justify-end gap-0.5">
          <Button size="xs" variant="ghost" title="Reset password" onClick={() => setResetting(a)}>
            <KeyRound size={13} />
          </Button>
          <Button size="xs" variant="ghost" title="Edit" onClick={() => setEditing(a)}>
            <Pencil size={13} />
          </Button>
          {a.admin_id !== me?.admin_id && (
            <Button size="xs" variant="dangerGhost" title="Remove" onClick={() => setToDelete(a)}>
              <Trash2 size={13} />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <FilterBar hasFilters={!!filters.role_id} onReset={() => setFilter('role_id', '')}>
        <FilterSelect
          label="Role" value={filters.role_id} placeholder="All roles"
          options={(roles || []).map((r) => ({ value: r.type_id, label: r.name }))}
          onChange={(v) => setFilter('role_id', v)}
        />
        <FilterSelect label="Status" value={filters.status} placeholder="All"
          options={['Active', 'Inactive']} onChange={(v) => setFilter('status', v)} />
        <div className="flex-1" />
        {canManage && (
          <Button size="sm" variant="primary" icon={Plus} onClick={() => setEditing({})}>Add member</Button>
        )}
      </FilterBar>

      <DataTable
        columns={columns} rows={rows} loading={loading} rowKey="admin_id"
        rowTone={(a) => (a.status === 'Active' ? 'ok' : 'idle')}
        emptyIcon={Users} emptyTitle="No team members"
      />
      <Pagination pagination={pagination} onPage={(p) => setFilter('page', p)} />

      <MemberModal open={!!editing} onClose={() => setEditing(null)}
        member={editing} roles={roles || []} onDone={reload} />
      <ResetPasswordModal member={resetting} onClose={() => setResetting(null)} />
      <ConfirmDialog
        open={!!toDelete} onClose={() => setToDelete(null)}
        onConfirm={() => del.run(toDelete.admin_id)} loading={del.loading}
        title="Remove team member" confirmLabel="Remove"
        message={`${toDelete?.admin_name || toDelete?.admin_username} will lose access. The changes they made stay in the activity log.`}
      />
    </>
  );
}

function MemberModal({ open, onClose, member, roles, onDone }) {
  const isEdit = !!member?.admin_id;
  const [form, setForm] = useState({});
  const [lastId, setLastId] = useState(null);

  if (open && lastId !== (member?.admin_id ?? 'new')) {
    setLastId(member?.admin_id ?? 'new');
    setForm({
      admin_username: member?.admin_username || '',
      admin_name: member?.admin_name || '',
      password: '',
      admin_email: member?.admin_email || '',
      admin_phone: member?.admin_phone || '',
      department: member?.department || '',
      employee_code: member?.employee_code || '',
      user_type: member?.user_type || '',
      status: member?.status || 'Active',
    });
  }

  const save = useMutation(
    () => {
      const body = { ...form };
      if (isEdit) delete body.password;
      return isEdit
        ? api.patch(`/admin/admins/${member.admin_id}`, body)
        : api.post('/admin/admins', body);
    },
    { success: isEdit ? 'Member updated' : 'Member added', onSuccess: () => { onClose(); onDone(); } }
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const err = save.fieldErrors || {};

  return (
    <Modal
      open={open} onClose={onClose} size="lg"
      title={isEdit ? 'Edit team member' : 'Add team member'}
      subtitle={isEdit ? undefined : 'Sub-admin or employee — the role decides what they can do'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save.run} loading={save.loading}>
            {isEdit ? 'Save changes' : 'Create member'}
          </Button>
        </>
      }
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Full name" required error={err.admin_name}>
          <Input value={form.admin_name || ''} onChange={(e) => set('admin_name', e.target.value)} autoFocus />
        </Field>
        <Field label="Username" required error={err.admin_username} hint={isEdit ? undefined : 'Used to sign in'}>
          <Input mono value={form.admin_username || ''} disabled={isEdit}
            onChange={(e) => set('admin_username', e.target.value)} />
        </Field>

        {!isEdit && (
          <Field label="Password" required error={err.password} hint="Kam se kam 8 characters" className="sm:col-span-2">
            <Input type="password" value={form.password || ''} autoComplete="new-password"
              onChange={(e) => set('password', e.target.value)} />
          </Field>
        )}

        <Field label="Role" required hint="This decides what access they get">
          <Select value={form.user_type || ''} placeholder="Select role"
            options={roles.map((r) => ({ value: r.type_id, label: r.name }))}
            onChange={(e) => set('user_type', e.target.value)} />
        </Field>
        <Field label="Status">
          <Select value={form.status} options={['Active', 'Inactive']}
            onChange={(e) => set('status', e.target.value)} />
        </Field>

        <Field label="Email">
          <Input type="email" value={form.admin_email || ''} onChange={(e) => set('admin_email', e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input mono value={form.admin_phone || ''} onChange={(e) => set('admin_phone', e.target.value)} />
        </Field>

        <Field label="Department">
          <Input value={form.department || ''} placeholder="Pharmacy / Dispatch"
            onChange={(e) => set('department', e.target.value)} />
        </Field>
        <Field label="Employee code">
          <Input mono value={form.employee_code || ''} onChange={(e) => set('employee_code', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ member, onClose }) {
  const [pw, setPw] = useState('');
  const save = useMutation(
    () => api.post(`/admin/admins/${member.admin_id}/reset-password`, { new_password: pw }),
    { success: 'Password reset', onSuccess: () => { onClose(); setPw(''); } }
  );

  return (
    <Modal
      open={!!member} onClose={onClose} size="sm"
      title="Reset password" subtitle={member?.admin_username}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save.run} loading={save.loading} disabled={pw.length < 8}>
            Reset password
          </Button>
        </>
      }
    >
      <Field label="New password" required hint="At least 8 characters. Share it with them separately.">
        <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}

/* =========================================================================
 * ROLES
 * ======================================================================= */
function Roles() {
  const { can } = useAuth();
  const { data: roles, loading, reload } = useResource('/admin/roles');
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const del = useMutation(
    (id) => api.del(`/admin/roles/${id}`),
    { success: 'Role deleted', onSuccess: () => { setToDelete(null); reload(); } }
  );

  const canManage = can(P.ROLES_MANAGE);

  const columns = [
    {
      key: 'name', label: 'Role',
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[0.8125rem] font-medium text-ink">{r.name}</p>
              {!!r.is_system && <Lock size={11} className="text-ink-300" title="System role" />}
            </div>
            {r.description && <p className="text-2xs text-ink-500 mt-0.5">{r.description}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'admin_count', label: 'Members', align: 'right',
      render: (r) => <span className="text-[0.8125rem] tabular-nums text-ink-700">{num(r.admin_count)}</span>,
    },
    {
      key: 'permission_count', label: 'Permissions', align: 'right',
      render: (r) => <span className="text-[0.8125rem] tabular-nums text-ink-700">{num(r.permission_count)}</span>,
    },
    { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} size="xs" /> },
    {
      key: 'actions', label: '', align: 'right',
      render: (r) => canManage && (
        <div className="flex items-center justify-end gap-0.5">
          <Button size="xs" variant="ghost" onClick={() => setEditing(r)} title="Edit permissions">
            <Pencil size={13} />
          </Button>
          {!r.is_system && (
            <Button size="xs" variant="dangerGhost" onClick={() => setToDelete(r)}><Trash2 size={13} /></Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <FilterBar>
        <p className="text-2xs text-ink-500 flex-1 py-1.5">
          System roles cannot be deleted, but you can edit their permissions.
        </p>
        {canManage && <Button size="sm" variant="primary" icon={Plus} onClick={() => setEditing({})}>New role</Button>}
      </FilterBar>

      <DataTable
        columns={columns} rows={roles || []} loading={loading} rowKey="type_id"
        rowTone={(r) => (r.status === 'Active' ? 'ok' : 'idle')}
        emptyIcon={ShieldCheck} emptyTitle="No roles"
      />

      <RoleModal open={!!editing} onClose={() => setEditing(null)} role={editing} onDone={reload} />
      <ConfirmDialog
        open={!!toDelete} onClose={() => setToDelete(null)}
        onConfirm={() => del.run(toDelete.type_id)} loading={del.loading}
        title="Delete role" confirmLabel="Delete"
        message={`"${toDelete?.name}" will be deleted. If any member is on this role, move them to another role first.`}
      />
    </>
  );
}

function RoleModal({ open, onClose, role, onDone }) {
  const isEdit = !!role?.type_id;
  const { data: catalog } = useResource('/admin/roles/permissions');
  const { data: full } = useResource(isEdit && open ? `/admin/roles/${role.type_id}` : null);

  const [form, setForm] = useState({ name: '', description: '', permissions: [] });
  const [lastId, setLastId] = useState(null);

  if (open && lastId !== (role?.type_id ?? 'new')) {
    setLastId(role?.type_id ?? 'new');
    setForm({ name: role?.name || '', description: role?.description || '', permissions: [] });
  }
  // full role load hone pe permissions bhar do
  const [loadedPerms, setLoadedPerms] = useState(null);
  if (full && loadedPerms !== full.type_id) {
    setLoadedPerms(full.type_id);
    setForm((f) => ({ ...f, permissions: full.permissions || [] }));
  }

  const save = useMutation(
    () => (isEdit
      ? api.put(`/admin/roles/${role.type_id}`, form)
      : api.post('/admin/roles', form)),
    { success: isEdit ? 'Role updated' : 'Role created', onSuccess: () => { onClose(); onDone(); } }
  );

  const toggle = (p) => setForm((f) => ({
    ...f,
    permissions: f.permissions.includes(p)
      ? f.permissions.filter((x) => x !== p)
      : [...f.permissions, p],
  }));

  const toggleModule = (perms, allOn) => setForm((f) => ({
    ...f,
    permissions: allOn
      ? f.permissions.filter((x) => !perms.includes(x))
      : [...new Set([...f.permissions, ...perms])],
  }));

  const grouped = catalog?.grouped || {};

  return (
    <Modal
      open={open} onClose={onClose} size="xl"
      title={isEdit ? `Edit role — ${role.name}` : 'New role'}
      subtitle={`${form.permissions.length} permissions selected`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save.run} loading={save.loading} disabled={!form.name}>
            Save role
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Role name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={role?.is_system} placeholder="Dispatch Team" autoFocus />
          </Field>
          <Field label="Description">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What this role is for" />
          </Field>
        </div>

        <div>
          <p className="label mb-2">Permissions</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {Object.entries(grouped).map(([module, perms]) => {
              const on = perms.filter((p) => form.permissions.includes(p));
              const allOn = on.length === perms.length;
              return (
                <div key={module} className={cx(
                  'border rounded p-2.5 transition-colors',
                  on.length ? 'border-teal/30 bg-teal-light/40' : 'border-line bg-paper'
                )}>
                  <button
                    type="button"
                    onClick={() => toggleModule(perms, allOn)}
                    className="flex items-center justify-between w-full mb-1.5 text-left"
                  >
                    <span className="text-2xs font-semibold uppercase tracking-wider text-ink">
                      {titleCase(module)}
                    </span>
                    <span className="text-2xs text-ink-500 tabular-nums">{on.length}/{perms.length}</span>
                  </button>
                  <div className="space-y-1">
                    {perms.map((p) => (
                      <Checkbox
                        key={p}
                        label={<span className="font-mono text-2xs">{p.split('.')[1]}</span>}
                        checked={form.permissions.includes(p)}
                        onChange={() => toggle(p)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* =========================================================================
 * ACTIVITY LOG
 * ======================================================================= */
function Activity() {
  const { rows, pagination, filters, setFilter, resetFilters, loading } = useList('/admin/activity-logs', { limit: 50 });

  const columns = [
    {
      key: 'created_at', label: 'When',
      render: (l) => <span className="text-2xs tabular-nums text-ink-500">{dateTime(l.created_at)}</span>,
    },
    {
      key: 'admin_username', label: 'Who',
      render: (l) => <Code>{l.admin_username || 'system'}</Code>,
    },
    {
      key: 'action', label: 'Action',
      render: (l) => (
        <span className="text-2xs font-medium uppercase tracking-wide text-ink-700 bg-paper-sunk border border-line px-1.5 py-0.5 rounded">
          {l.action}
        </span>
      ),
    },
    {
      key: 'module', label: 'Module',
      render: (l) => <span className="text-2xs text-ink-500">{l.module || '—'}</span>,
    },
    {
      key: 'record_id', label: 'Record',
      render: (l) => (l.record_id ? <Code className="text-2xs">#{l.record_id}</Code> : <span className="text-ink-300">—</span>),
    },
    {
      key: 'description', label: 'Details',
      render: (l) => <span className="text-2xs text-ink-700 line-clamp-2 max-w-[280px]">{l.description || '—'}</span>,
    },
    {
      key: 'ip_address', label: 'IP',
      render: (l) => <Code className="text-2xs">{l.ip_address}</Code>,
    },
  ];

  return (
    <>
      <FilterBar hasFilters={!!(filters.module || filters.action)} onReset={resetFilters}>
        <FilterSelect
          label="Module" value={filters.module} placeholder="All modules"
          options={['orders', 'products', 'inventory', 'customers', 'prescriptions', 'admins', 'roles', 'auth']}
          onChange={(v) => setFilter('module', v)}
        />
        <FilterSelect
          label="Action" value={filters.action} placeholder="All actions"
          options={['login', 'logout', 'create', 'update', 'delete', 'status_change', 'export', 'cancel']}
          onChange={(v) => setFilter('action', v)}
        />
        <div>
          <span className="label">From</span>
          <Input type="date" value={filters.from_date || ''} className="py-1.5 text-[0.8125rem]"
            onChange={(e) => setFilter('from_date', e.target.value)} />
        </div>
      </FilterBar>

      <DataTable
        columns={columns} rows={rows} loading={loading} rowKey="id" compact
        emptyIcon={History} emptyTitle="No activity"
        emptyDescription="Admin actions are recorded here."
      />
      <Pagination pagination={pagination} onPage={(p) => setFilter('page', p)} />
    </>
  );
}

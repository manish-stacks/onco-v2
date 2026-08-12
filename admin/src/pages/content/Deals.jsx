import { useState } from 'react';
import { Tag, Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { useResource, useMutation } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api, mediaUrl } from '@/lib/api';
import { PERMISSIONS as P } from '@/lib/constants';
import { PageHeader } from '@/components/layout/Layout';
import { Card, Button, StatusPill } from '@/components/ui';
import { DataTable } from '@/components/ui/DataTable';
import { SimpleFormModal } from '@/components/ui/SimpleFormModal';
import { ConfirmDialog } from '@/components/ui/Modal';

/** Homepage ke promotional strips */
export default function Deals() {
  const { can } = useAuth();

  const {
    data: rows,
    loading,
    reload,
  } = useResource('/admin/deals');

  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  
  const del = useMutation(
    (id) => api.del(`/admin/deals/${id}`),
    {
      success: 'Deal delete ho gaya',
      onSuccess: () => {
        setToDelete(null);
        reload();
      },
    }
  );

  const canManage = can(P.SETTINGS_MANAGE);

  return (
    <>
      <PageHeader
        title="Deals"
        subtitle="Homepage pe dikhne wale promotional strips"
        actions={
          canManage && (
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setEditing({})}
            >
              Add deal
            </Button>
          )
        }
      />

      <Card dense>
        <DataTable
          rowKey="id"
          rows={rows || []}
          loading={loading}
          rowTone={(d) =>
            Number(d.active_status) ? 'ok' : 'idle'
          }
          columns={[
            {
              key: 'title',
              label: 'Deal',
              render: (d) => (
                <div className="flex items-center gap-2.5">
                  {d.image && (
                    <img
                      src={mediaUrl(d.image)}
                      alt=""
                      className="w-10 h-10 rounded object-cover border border-line"
                    />
                  )}

                  <div className="min-w-0">
                    <p className="text-[0.8125rem] text-ink">
                      {d.title}
                    </p>

                    <p className="text-2xs text-ink-500 line-clamp-1 max-w-[260px]">
                      {d.description}
                    </p>
                  </div>
                </div>
              ),
            },

            {
              key: 'cta',
              label: 'CTA',
              render: (d) => (
                <span className="text-2xs font-medium text-ink">
                  {d.cta || '—'}
                </span>
              ),
            },

            {
              key: 'link',
              label: 'Link',
              render: (d) =>
                d.link ? (
                  <a
                    href={d.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 max-w-[220px] text-2xs text-blue-600 hover:underline truncate"
                  >
                    <span className="truncate">{d.link}</span>
                    <ExternalLink
                      size={12}
                      className="shrink-0"
                    />
                  </a>
                ) : (
                  <span className="text-2xs text-ink-500">
                    —
                  </span>
                ),
            },

            {
              key: 'position',
              label: 'Position',
              align: 'center',
              render: (d) => (
                <span className="text-2xs tabular-nums text-ink-500">
                  {d.position ?? '—'}
                </span>
              ),
            },

            {
              key: 'active_status',
              label: 'Status',
              render: (d) => (
                <StatusPill
                  status={
                    Number(d.active_status)
                      ? 'Active'
                      : 'Inactive'
                  }
                  size="xs"
                />
              ),
            },

            {
              key: 'actions',
              label: '',
              align: 'right',
              render: (d) =>
                canManage && (
                  <div className="flex justify-end gap-0.5">
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => setEditing(d)}
                    >
                      <Pencil size={13} />
                    </Button>

                    <Button
                      size="xs"
                      variant="dangerGhost"
                      onClick={() => setToDelete(d)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                ),
            },
          ]}
          emptyIcon={Tag}
          emptyTitle="Koi deal nahi"
          emptyDescription="Homepage pe promotional strip dikhane ke liye deal add karo."
          emptyAction={
            canManage && (
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => setEditing({})}
              >
                Add deal
              </Button>
            )
          }
        />
      </Card>

      <SimpleFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        record={editing}
        idKey="id"
        path="/admin/deals"
        title="deal"
        onDone={reload}
        fileField="image"
        fields={[
          {
            key: 'title',
            label: 'Title',
            required: true,
          },

          {
            key: 'description',
            label: 'Description',
            type: 'textarea',
          },

          {
            key: 'cta',
            label: 'CTA Button Text',
            hint: 'Example: Shop Now, Buy Now, Explore',
          },

          {
            key: 'link',
            label: 'CTA Link URL',
            hint: 'Example: /category/health-essentials',
          },

          {
            key: 'position',
            label: 'Sort position',
            type: 'number',
            hint: 'Chhota number pehle aayega',
          },

         
          {
            key: 'active_status',
            label: 'Active',
            type: 'select',
            options: [
              {
                value: '1',
                label: 'Active',
              },
              {
                value: '0',
                label: 'Inactive',
              },
            ],
            default: '1',
          },
        ]}
      />

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => del.run(toDelete.id)}
        loading={del.loading}
        title="Delete deal"
        confirmLabel="Delete"
        message={`"${toDelete?.title}" homepage se hat jayega.`}
      />
    </>
  );
}
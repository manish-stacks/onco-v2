import { useState } from 'react';
import { Image, Plus, Pencil, Trash2 } from 'lucide-react';
import { useResource, useMutation } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api, mediaUrl } from '@/lib/api';
import { PERMISSIONS as P } from '@/lib/constants';
import { PageHeader } from '@/components/layout/Layout';
import {
  Card,
  Button,
  StatusPill,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import { SimpleFormModal } from '@/components/ui/SimpleFormModal';
import { ConfirmDialog } from '@/components/ui/Modal';

/**
 * Homepage carousel banners
 *
 * Supports:
 * 1. Normal Banner
 * 2. Rich Banner
 */
export default function Banners() {
  const { can } = useAuth();

  const {
    data: rows,
    loading,
    reload,
  } = useResource('/admin/banners');

  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const del = useMutation(
    (id) => api.del(`/admin/banners/${id}`),
    {
      success: 'Banner deleted',
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
        title="Banners"
        subtitle="The slides shown in the homepage carousel"
        actions={
          canManage && (
            <Button
              variant="primary"
              icon={Plus}
              onClick={() =>
                setEditing({
                  banner_type: 'normal',
                  status: 'active',
                })
              }
            >
              Add banner
            </Button>
          )
        }
      />

      {/* ============================================================
          BANNER LIST
      ============================================================ */}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-48"
            />
          ))}
        </div>
      ) : rows?.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((b) => (
            <div
              key={b.banner_id}
              className="card overflow-hidden"
            >
              {/* Image */}
              <div className="aspect-[16/7] bg-paper-sunk">
                {b.banner_image ? (
                  <img
                    src={mediaUrl(b.banner_image)}
                    alt={b.title_top || 'Banner'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-ink-400">
                    No image
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusPill
                      status={b.status}
                      size="xs"
                    />

                    {/* Banner Type */}
                    <span className="text-2xs px-2 py-0.5 rounded bg-paper-sunk text-ink-600">
                      {b.banner_type === 'rich'
                        ? 'Rich'
                        : 'Normal'}
                    </span>
                  </div>

                  {/* Rich Banner Title */}
                  {b.banner_type === 'rich' && (
                    <div className="mt-1">
                      {b.ribbon && (
                        <p className="text-2xs font-semibold text-primary-600 uppercase">
                          {b.ribbon}
                        </p>
                      )}

                      {b.title_top && (
                        <p className="text-xs font-semibold text-ink-800 truncate">
                          {b.title_top}
                        </p>
                      )}

                      {b.title_bottom && (
                        <p className="text-xs text-ink-600 truncate">
                          {b.title_bottom}
                        </p>
                      )}

                      {b.price && (
                        <p className="text-xs font-semibold text-primary-600">
                          {b.price}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Link */}
                  {b.banner_link && (
                    <p className="text-2xs text-ink-500 truncate mt-1">
                      {b.banner_link}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {canManage && (
                  <div className="flex gap-0.5 shrink-0">
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => setEditing(b)}
                    >
                      <Pencil size={13} />
                    </Button>

                    <Button
                      size="xs"
                      variant="dangerGhost"
                      onClick={() => setToDelete(b)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card dense>
          <EmptyState
            icon={Image}
            title="No banners"
            description="Add the first banner for the homepage carousel."
            action={
              canManage && (
                <Button
                  variant="primary"
                  icon={Plus}
                  onClick={() =>
                    setEditing({
                      banner_type: 'normal',
                      status: 'active',
                    })
                  }
                >
                  Add banner
                </Button>
              )
            }
          />
        </Card>
      )}

      {/* ============================================================
          ADD / EDIT BANNER
      ============================================================ */}

      <SimpleFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        record={editing}
        idKey="banner_id"
        path="/admin/banners"
        title="banner"
        onDone={reload}
        fileField="banner_image"

        fields={[
          // ----------------------------------------------------------
          // Banner Type
          // ----------------------------------------------------------
          {
            key: 'banner_type',
            label: 'Banner Type',
            type: 'select',
            options: [
              'Normal',
              'Rich',
            ],
            default: 'Normal',
          },

          // ----------------------------------------------------------
          // Image / Link
          // ----------------------------------------------------------
          {
            key: 'banner_link',
            label: 'Link URL',
            hint: 'Where it goes on click',
          },

          // ----------------------------------------------------------
          // Rich Banner Content
          // ----------------------------------------------------------
          {
            key: 'ribbon',
            label: 'Ribbon / Small Heading',
            hint: 'Example: EASY HEALTH CARE',
          },

          {
            key: 'title_top',
            label: 'Title Top',
            hint: 'Example: Medicine & Health Care',
          },

          {
            key: 'title_bottom',
            label: 'Title Bottom',
            hint: 'Example: For Your Family',
          },

          {
            key: 'body',
            label: 'Description',
            type: 'textarea',
            hint: 'Short description under the banner',
          },

          {
            key: 'price',
            label: 'Price / Offer',
            hint: 'Example: ₹250 / Up To 40% Off',
          },

          // ----------------------------------------------------------
          // Status
          // ----------------------------------------------------------
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              'Active',
              'Inactive',
            ],
            default: 'Active',
          },
        ]}
      />

      {/* ============================================================
          DELETE CONFIRMATION
      ============================================================ */}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() =>
          del.run(toDelete.banner_id)
        }
        loading={del.loading}
        title="Delete banner"
        confirmLabel="Delete"
        message="This banner will be removed from the homepage."
      />
    </>
  );
}
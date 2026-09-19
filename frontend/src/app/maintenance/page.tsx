export const dynamic = "force-dynamic";

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--paper)] px-6 text-center">
      <h1 className="font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">
        We&apos;ll be right back
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-[var(--ink-soft)]">
        {m || "We're currently doing some scheduled maintenance. Please check back shortly."}
      </p>
    </div>
  );
}

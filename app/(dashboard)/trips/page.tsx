import { Suspense } from 'react';
import Link from 'next/link';
import { getTripsWithDetailsForUser } from '@/lib/db/queries';
import { TripStatusBadge } from '@/components/trip-status-badge';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'booked', label: 'Booked' },
] as const;

function formatDate(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

interface StatusTabsProps {
  activeStatus: string;
}

function StatusTabs({ activeStatus }: StatusTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-glacier">
      {STATUS_TABS.map(({ key, label }) => {
        const isActive = activeStatus === key;
        return (
          <Link
            key={key}
            href={key === 'all' ? '/trips' : `/trips?status=${key}`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              isActive
                ? 'border-spruce text-spruce'
                : 'border-transparent text-ink-mute hover:text-ink-soft hover:border-glacier'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

type TripRow = Awaited<ReturnType<typeof getTripsWithDetailsForUser>>[number];

interface TripCardProps {
  trip: TripRow;
}

function TripCard({ trip }: TripCardProps) {
  const destCount = trip.destinationCount ?? 0;

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group flex items-center justify-between px-5 py-4 bg-white border border-glacier rounded-lg hover:border-spruce/30 hover:shadow-sm transition-all"
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-display text-base text-ink truncate group-hover:text-spruce transition-colors">
          {trip.label}
        </span>
        <div className="flex items-center gap-3 mt-0.5">
          {trip.clientName && (
            <span className="text-xs text-ink-soft">{trip.clientName}</span>
          )}
          {trip.clientName && destCount > 0 && (
            <span className="text-ink-mute/60 text-xs">·</span>
          )}
          {destCount > 0 && (
            <span className="text-xs text-ink-mute">
              {destCount} {destCount === 1 ? 'destination' : 'destinations'}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 flex-shrink-0 ml-4">
        {trip.totalFromInr != null && (
          <span className="text-sm text-ink-soft hidden sm:block">
            from {formatInr(trip.totalFromInr)}
          </span>
        )}
        <TripStatusBadge status={trip.status} />
        <span className="text-xs text-ink-mute hidden md:block">
          {formatDate(trip.updatedAt)}
        </span>
      </div>
    </Link>
  );
}

function TripsEmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="font-display text-xl text-ink mb-2">
        {hasFilter ? 'No trips with this status' : 'No trips yet'}
      </p>
      <p className="text-sm text-ink-mute mb-6 max-w-xs">
        {hasFilter
          ? 'Try a different filter, or create a new trip.'
          : 'Create your first trip to get started.'}
      </p>
      <Link
        href="/trips/new"
        className="inline-flex items-center gap-2 bg-spruce text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-spruce-light transition-colors"
      >
        New trip
      </Link>
    </div>
  );
}

async function TripsList({ status }: { status: string }) {
  const allTrips = await getTripsWithDetailsForUser();

  const filtered =
    status === 'all'
      ? allTrips
      : allTrips.filter((t) => t.status === status);

  if (filtered.length === 0) {
    return <TripsEmptyState hasFilter={status !== 'all'} />;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {filtered.map((trip) => (
        <TripCard key={trip.id} trip={trip} />
      ))}
    </div>
  );
}

function TripsListSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-[70px] bg-white border border-glacier rounded-lg animate-pulse"
        />
      ))}
    </div>
  );
}

interface TripsPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function TripsPage({ searchParams }: TripsPageProps) {
  const { status: rawStatus } = await searchParams;
  const validStatuses = STATUS_TABS.map((t) => t.key as string);
  const status = rawStatus && validStatuses.includes(rawStatus) ? rawStatus : 'all';

  return (
    <div className="max-w-4xl mx-auto px-5 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-ink">Trips</h1>
        <Link
          href="/trips/new"
          className="inline-flex items-center gap-2 bg-spruce text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-spruce-light transition-colors"
        >
          New trip
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="mb-6">
        <StatusTabs activeStatus={status} />
      </div>

      {/* Trips list */}
      <Suspense fallback={<TripsListSkeleton />}>
        <TripsList status={status} />
      </Suspense>
    </div>
  );
}

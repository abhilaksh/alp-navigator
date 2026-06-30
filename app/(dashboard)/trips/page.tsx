import { getTripsWithDetailsForUser, getHoldExpiryByTrip, getUser, getCommissionSummaryForUser } from '@/lib/db/queries';
import { PipelineView, type PipelineTrip } from './pipeline-view';

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { archived } = await searchParams;
  const includeArchived = archived === '1';

  const user = await getUser();
  const [allTrips, holdMap, commissionSummary] = await Promise.all([
    getTripsWithDetailsForUser(includeArchived),
    user ? getHoldExpiryByTrip(user.id) : Promise.resolve(new Map<number, string>()),
    getCommissionSummaryForUser(),
  ]);

  const trips: PipelineTrip[] = allTrips.map(t => ({
    ...t,
    destinationCount: t.destinationCount ?? null,
    minHoldExpiry: holdMap.get(t.id) ?? null,
    firstViewedAt: (t.firstViewedAt as number | null) ?? null,
  }));

  return (
    <div className="max-w-6xl mx-auto px-5 lg:px-8 py-8">
      <PipelineView trips={trips} commissionSummary={commissionSummary} showingArchived={includeArchived} />
    </div>
  );
}

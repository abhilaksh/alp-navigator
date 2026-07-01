import { getTripsWithDetailsForUser, getHoldExpiryByTrip, getUser, getCommissionSummaryForUser, getBlueprintsForUser } from '@/lib/db/queries';
import { PipelineView, type PipelineTrip } from './pipeline-view';

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { archived } = await searchParams;
  const includeArchived = archived === '1';

  const user = await getUser();
  const [allTrips, holdMap, commissionSummary, blueprints] = await Promise.all([
    getTripsWithDetailsForUser(includeArchived),
    user ? getHoldExpiryByTrip(user.id) : Promise.resolve(new Map<number, string>()),
    getCommissionSummaryForUser(),
    getBlueprintsForUser(),
  ]);

  const trips: PipelineTrip[] = allTrips.map(t => ({
    ...t,
    destinationCount: t.destinationCount ?? null,
    minHoldExpiry: holdMap.get(t.id) ?? null,
    firstViewedAt: (t.firstViewedAt as number | null) ?? null,
  }));

  return (
    <div className="max-w-6xl mx-auto px-5 lg:px-8 py-8">
      <PipelineView trips={trips} blueprints={blueprints} commissionSummary={commissionSummary} showingArchived={includeArchived} />
    </div>
  );
}

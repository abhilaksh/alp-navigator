import { getTripsWithDetailsForUser, getHoldExpiryByTrip, getUser } from '@/lib/db/queries';
import { PipelineView, type PipelineTrip } from './pipeline-view';

export default async function TripsPage() {
  const user = await getUser();
  const [allTrips, holdMap] = await Promise.all([
    getTripsWithDetailsForUser(),
    user ? getHoldExpiryByTrip(user.id) : Promise.resolve(new Map<number, string>()),
  ]);

  const trips: PipelineTrip[] = allTrips.map(t => ({
    ...t,
    destinationCount: t.destinationCount ?? null,
    minHoldExpiry: holdMap.get(t.id) ?? null,
    firstViewedAt: (t.firstViewedAt as number | null) ?? null,
  }));

  return (
    <div className="max-w-6xl mx-auto px-5 lg:px-8 py-8">
      <PipelineView trips={trips} />
    </div>
  );
}

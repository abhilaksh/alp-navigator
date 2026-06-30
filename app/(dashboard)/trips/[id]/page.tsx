import { redirect } from 'next/navigation';
import { getTripById } from '@/lib/db/queries';
import { getForaPartner } from '@/lib/fora/lookup';
import { Editor } from './editor';

interface TripPageProps {
  params: Promise<{ id: string }>;
}

export default async function TripPage({ params }: TripPageProps) {
  const { id } = await params;
  const tripId = parseInt(id, 10);
  if (isNaN(tripId)) redirect('/trips');

  const trip = await getTripById(tripId);
  if (!trip) redirect('/trips');

  // Enrich hotel details with Fora partner data (server-side, no DB query needed)
  const enriched = {
    ...trip,
    destinations: trip.destinations.map(d => ({
      ...d,
      items: d.items.map(item => {
        if (!item.hotelDetails?.foraId) return item;
        const partner = getForaPartner(item.hotelDetails.foraId);
        if (!partner) return item;
        return {
          ...item,
          hotelDetails: { ...item.hotelDetails, foraPartner: partner },
        };
      }),
    })),
  };

  return <Editor trip={enriched} />;
}

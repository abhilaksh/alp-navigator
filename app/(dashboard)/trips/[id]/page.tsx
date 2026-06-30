import { redirect } from 'next/navigation';
import { getTripById } from '@/lib/db/queries';
import { getForaPartner } from '@/lib/fora/lookup';
import { getVisaInfo } from '@/lib/visa/lookup';
import type { VisaInfo } from '@/lib/visa/lookup';
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

  // Enrich hotel details with Fora partner data + destinations with visa info
  const enriched = {
    ...trip,
    destinations: trip.destinations.map(d => ({
      ...d,
      visaInfo: getVisaInfo(d.country) as VisaInfo | null,
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

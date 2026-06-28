import { redirect } from 'next/navigation';
import { getTripById } from '@/lib/db/queries';
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

  return <Editor trip={trip} />;
}

// Best-effort auto-link: when an item is added in the Editor tab, silently
// create/find the matching Itinerary day and drop in a ref block, so the
// advisor doesn't have to manually re-link every item. Never throws -- this
// runs alongside the primary add-item flow and must not block it.

interface ItineraryDayRow {
  id: number;
  destinationId: number | null;
  dayNumber: number;
  date: string | null;
  blocks: Array<{ id: number; sortOrder: number }>;
}

interface AutoLinkParams {
  tripId: number;
  destinationId: number;
  destinationName: string;
  itemId: number;
  itemTitle: string;
  refType: 'hotel_ref' | 'flight_ref' | 'transfer_ref' | 'activity_ref';
  date: string | null; // YYYY-MM-DD -- skip silently if not yet known
}

export async function autoLinkItemToItinerary({
  tripId, destinationId, destinationName, itemId, itemTitle, refType, date,
}: AutoLinkParams): Promise<void> {
  if (!date) return;

  try {
    const daysRes = await fetch(`/api/itinerary/days?tripId=${tripId}`);
    if (!daysRes.ok) return;
    const days: ItineraryDayRow[] = await daysRes.json();

    let day = days.find(d => d.destinationId === destinationId && d.date === date);

    if (!day) {
      const nextDayNumber = days.length > 0 ? Math.max(...days.map(d => d.dayNumber)) + 1 : 1;
      const createRes = await fetch('/api/itinerary/days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          destinationId,
          dayNumber: nextDayNumber,
          date,
          title: `Day ${nextDayNumber} — ${destinationName}`,
          sortOrder: nextDayNumber - 1,
        }),
      });
      if (!createRes.ok) return;
      day = await createRes.json();
      if (!day) return;
    }

    await fetch('/api/itinerary/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dayId: day.id,
        type: refType,
        content: itemTitle,
        itemId,
        sortOrder: day.blocks?.length ?? 0,
      }),
    });
  } catch {
    // best-effort -- never block the primary add-item flow
  }
}

import type { getTripById } from '@/lib/db/queries';
import type { HotelItemState } from '@/components/editor/hotel-card';
import type { LineItemState } from '@/components/editor/line-item-card';

export type TripFull = NonNullable<Awaited<ReturnType<typeof getTripById>>>;

export type RateRow = {
  id: number; source: string; sourceLabel: string | null;
  rawText: string | null; status: string; isConfirmed: number;
  parsedData: string | null; proposals: string | null;
  errorMessage: string | null; history: string | null; sortOrder: number;
};

export type DestinationState = {
  id: number; name: string; country: string | null;
  checkin: string | null; checkout: string | null;
  nights: number | null; sortOrder: number;
  items: (HotelItemState | LineItemState)[];
};

export type { LineItemState };

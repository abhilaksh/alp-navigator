import type { HotelItemState } from '@/components/editor/hotel-card';
import type { LineItemState } from '@/components/editor/line-item-card';
import type { TripFull, DestinationState, RateRow, VisaInfoState } from './types';

export function isHotelItem(item: HotelItemState | LineItemState): item is HotelItemState {
  return item.type === 'hotel';
}

export function mapDestinations(raw: TripFull['destinations']): DestinationState[] {
  return raw.map(d => ({
    id: d.id, name: d.name, country: d.country,
    checkin: d.checkin, checkout: d.checkout, nights: d.nights, sortOrder: d.sortOrder,
    visaInfo: (d as { visaInfo?: VisaInfoState | null }).visaInfo ?? null,
    items: d.items.map(i => {
      if (i.type === 'hotel') {
        return {
          id: i.id, type: i.type, title: i.title,
          bookingStatus: i.bookingStatus, sortOrder: i.sortOrder,
          cancellationFreeUntil: (i as { cancellationFreeUntil?: string | null }).cancellationFreeUntil ?? null,
          visaRequired: (i as { visaRequired?: number }).visaRequired ?? 0,
          hotelDetails: i.hotelDetails ? {
            id: i.hotelDetails.id, itemId: i.hotelDetails.itemId,
            stars: i.hotelDetails.stars, rating: i.hotelDetails.rating,
            locationScore: i.hotelDetails.locationScore,
            recommendation: i.hotelDetails.recommendation,
            foraId: i.hotelDetails.foraId, hotelWebsite: i.hotelDetails.hotelWebsite,
            thumbnail: i.hotelDetails.thumbnail, lat: i.hotelDetails.lat,
            lng: i.hotelDetails.lng, googleRateInr: i.hotelDetails.googleRateInr,
            holdExpiresAt: i.hotelDetails.holdExpiresAt ?? null,
            foraPartner: (i.hotelDetails as { foraPartner?: unknown }).foraPartner ?? null,
            rates: (i.hotelDetails.rates ?? []) as RateRow[],
          } : null,
        } as HotelItemState;
      }
      return {
        id: i.id,
        type: i.type as LineItemState['type'],
        title: i.title,
        bookingStatus: i.bookingStatus,
        bookingRef: i.bookingRef ?? null,
        confirmedTotalInr: i.confirmedTotalInr ?? null,
        startDate: i.startDate ?? null,
        endDate: i.endDate ?? null,
        cancellationFreeUntil: (i as { cancellationFreeUntil?: string | null }).cancellationFreeUntil ?? null,
        visaRequired: (i as { visaRequired?: number }).visaRequired ?? 0,
        detailsJson: i.detailsJson
          ? (() => { try { return JSON.parse(i.detailsJson!); } catch { return null; } })()
          : null,
        sortOrder: i.sortOrder,
      } as LineItemState;
    }),
  }));
}

export function updateDest(
  prev: DestinationState[],
  destId: number,
  fn: (d: DestinationState) => DestinationState,
): DestinationState[] {
  return prev.map(d => d.id === destId ? fn(d) : d);
}

export function updateItem(
  prev: DestinationState[],
  itemId: number,
  fn: (i: HotelItemState) => HotelItemState,
): DestinationState[] {
  return prev.map(d => ({
    ...d,
    items: d.items.map(i => (i.id === itemId && isHotelItem(i)) ? fn(i) : i),
  }));
}

export function updateLineItem(
  prev: DestinationState[],
  itemId: number,
  fn: (i: LineItemState) => LineItemState,
): DestinationState[] {
  return prev.map(d => ({
    ...d,
    items: d.items.map(i => (i.id === itemId && !isHotelItem(i)) ? fn(i as LineItemState) : i),
  }));
}

export function updateRate(
  prev: DestinationState[],
  rateId: number,
  fn: (r: RateRow) => RateRow,
): DestinationState[] {
  return prev.map(d => ({
    ...d,
    items: d.items.map(i => {
      if (!isHotelItem(i) || !i.hotelDetails) return i;
      return { ...i, hotelDetails: { ...i.hotelDetails, rates: i.hotelDetails.rates.map(r => r.id === rateId ? fn(r) : r) } };
    }),
  }));
}

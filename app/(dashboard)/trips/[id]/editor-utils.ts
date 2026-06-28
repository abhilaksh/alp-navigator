import type { HotelItemState } from '@/components/editor/hotel-card';
import type { TripFull, DestinationState, RateRow } from './types';

export function mapDestinations(raw: TripFull['destinations']): DestinationState[] {
  return raw.map(d => ({
    id: d.id, name: d.name, country: d.country,
    checkin: d.checkin, checkout: d.checkout, nights: d.nights, sortOrder: d.sortOrder,
    items: d.items.filter(i => i.type === 'hotel').map(i => ({
      id: i.id, type: i.type, title: i.title,
      bookingStatus: i.bookingStatus, sortOrder: i.sortOrder,
      hotelDetails: i.hotelDetails ? {
        id: i.hotelDetails.id, itemId: i.hotelDetails.itemId,
        stars: i.hotelDetails.stars, rating: i.hotelDetails.rating,
        locationScore: i.hotelDetails.locationScore,
        recommendation: i.hotelDetails.recommendation,
        foraId: i.hotelDetails.foraId, hotelWebsite: i.hotelDetails.hotelWebsite,
        thumbnail: i.hotelDetails.thumbnail, lat: i.hotelDetails.lat,
        lng: i.hotelDetails.lng, googleRateInr: i.hotelDetails.googleRateInr,
        rates: (i.hotelDetails.rates ?? []) as RateRow[],
      } : null,
    })),
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
  return prev.map(d => ({ ...d, items: d.items.map(i => i.id === itemId ? fn(i) : i) }));
}

export function updateRate(
  prev: DestinationState[],
  rateId: number,
  fn: (r: RateRow) => RateRow,
): DestinationState[] {
  return prev.map(d => ({
    ...d,
    items: d.items.map(i => ({
      ...i,
      hotelDetails: i.hotelDetails
        ? { ...i.hotelDetails, rates: i.hotelDetails.rates.map(r => r.id === rateId ? fn(r) : r) }
        : null,
    })),
  }));
}

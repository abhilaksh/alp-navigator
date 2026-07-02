// Deep-link builders for travel-agent portal hotel searches, pre-filled with
// hotel name / dates so the advisor lands directly on a search results page
// instead of a bare homepage.

interface ForaSearchParams {
  hotelName: string;
  checkin?: string | null;
  checkout?: string | null;
  adults?: number | null;
  children?: number | null;
}

export function buildForaSearchUrl({ hotelName, checkin, checkout, adults, children }: ForaSearchParams): string {
  const params = new URLSearchParams({
    view_mode: 'list',
    location: hotelName,
    currency: 'INR',
    ...(checkin && { check_in: checkin }),
    ...(checkout && { check_out: checkout }),
    ...(adults && { adults: String(adults) }),
    ...(children && { children: String(children) }),
  });
  return `https://advisor.fora.travel/partners/hotels?${params.toString()}`;
}

interface ExpediaSearchParams {
  hotelName: string;
  checkin?: string | null;
  checkout?: string | null;
  adults?: number | null;
  lat?: number | null;
  lng?: number | null;
}

// Note: Expedia's own regionId/selected params (internal property/region IDs)
// can't be derived from our data -- this lands on a name+date-matched search
// results page rather than a pre-selected specific listing.
export function buildExpediaSearchUrl({ hotelName, checkin, checkout, adults, lat, lng }: ExpediaSearchParams): string {
  const params = new URLSearchParams({
    destination: hotelName,
    rooms: '1',
    packageRates: 'true',
    useRewards: 'false',
    rate_type: 'standalone',
    sort: 'RECOMMENDED',
    ...(checkin && { startDate: checkin, d1: checkin }),
    ...(checkout && { endDate: checkout, d2: checkout }),
    ...(adults && { adults: String(adults) }),
    ...(lat != null && lng != null && { latLong: `${lat},${lng}` }),
  });
  return `https://www.expediataap.com/Hotel-Search?${params.toString()}`;
}

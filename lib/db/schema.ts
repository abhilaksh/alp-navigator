import {
  mysqlTable,
  varchar,
  text,
  int,
  bigint,
  real,
  timestamp,
  date,
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

// ─── Auth / Teams ─────────────────────────────────────────────────────────────

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const teams = mysqlTable('teams', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  razorpayCustomerId: text('razorpay_customer_id'),
  razorpaySubscriptionId: text('razorpay_subscription_id'),
  razorpayPlanId: text('razorpay_plan_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
});

export const teamMembers = mysqlTable('team_members', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull().references(() => users.id),
  teamId: int('team_id').notNull().references(() => teams.id),
  role: varchar('role', { length: 50 }).notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const activityLogs = mysqlTable('activity_logs', {
  id: int('id').autoincrement().primaryKey(),
  teamId: int('team_id').notNull().references(() => teams.id),
  userId: int('user_id').references(() => users.id),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

export const invitations = mysqlTable('invitations', {
  id: int('id').autoincrement().primaryKey(),
  teamId: int('team_id').notNull().references(() => teams.id),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: int('invited_by').notNull().references(() => users.id),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
});

// ─── Clients ──────────────────────────────────────────────────────────────────

export const clients = mysqlTable('clients', {
  id: int('id').autoincrement().primaryKey(),
  teamId: int('team_id').notNull().references(() => teams.id),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 30 }),
  whatsapp: varchar('whatsapp', { length: 30 }),
  nationality: varchar('nationality', { length: 100 }),
  passportExpiry: varchar('passport_expiry', { length: 10 }),
  preferences: text('preferences'),  // JSON: dietary, room type, airline tier, etc.
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Trips ────────────────────────────────────────────────────────────────────

export const trips = mysqlTable('trips', {
  id: int('id').autoincrement().primaryKey(),
  teamId: int('team_id').notNull().references(() => teams.id),
  userId: int('user_id').notNull().references(() => users.id),
  clientId: int('client_id').references(() => clients.id),
  label: varchar('label', { length: 255 }).notNull(),
  adults: int('adults').notNull().default(2),
  children: int('children').notNull().default(0),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  // 'draft' | 'sent' | 'accepted' | 'booked' | 'in_progress' | 'completed' | 'archived'
  previewKey: varchar('preview_key', { length: 100 }),
  previewExpiresAt: bigint('preview_expires_at', { mode: 'number' }),
  totalFromInr: int('total_from_inr'),
  notes: text('notes'),             // internal advisor notes
  personalNote: text('personal_note'),     // client-facing personal note (advisor-written, top of proposal)
  journeyOverview: text('journey_overview'), // narrative overview of the trip arc (AI-assisted)
  // Exchange rate lock — documents the USD→INR rate used when building this quote
  fxDate: varchar('fx_date', { length: 10 }),
  fxSource: varchar('fx_source', { length: 50 }),       // 'RBI' | 'Wise' | 'XE' | 'manual'
  fxBufferPct: real('fx_buffer_pct'),                   // buffer % applied (e.g. 2.5)
  fxUsdToInr: real('fx_usd_to_inr'),                   // locked rate after buffer
  firstViewedAt: bigint('first_viewed_at', { mode: 'number' }),  // epoch ms, set on first preview load
  viewCount: int('view_count').notNull().default(0),              // total preview page loads
  paymentData: text('payment_data'),                              // JSON: PaymentTracking
  intakeStatus: varchar('intake_status', { length: 30 }).default('new_inquiry'),
  // 'new_inquiry' | 'acknowledged' | 'in_progress' | 'brief_complete' | 'research_ready'
  acknowledgedAt: bigint('acknowledged_at', { mode: 'number' }),  // epoch ms when status moved to acknowledged
  briefCompleteAt: bigint('brief_complete_at', { mode: 'number' }), // epoch ms when brief was completed
  // Budget & urgency (Phase 1 intake fields)
  budgetStatedInr: int('budget_stated_inr'),           // client-stated budget (often understated)
  budgetEstimatedInr: int('budget_estimated_inr'),     // advisor's estimate of actual spend
  urgencyFlag: varchar('urgency_flag', { length: 20 }).default('standard'),
  // 'standard' | 'urgent' | 'very_urgent'
  clarificationFlags: text('clarification_flags'),     // JSON: ClarificationFlag[]
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Destinations ─────────────────────────────────────────────────────────────

export const destinations = mysqlTable('destinations', {
  id: int('id').autoincrement().primaryKey(),
  tripId: int('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  country: varchar('country', { length: 100 }),
  checkin: varchar('checkin', { length: 10 }),
  checkout: varchar('checkout', { length: 10 }),
  nights: int('nights'),
  narrative: text('narrative'),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Trip Items (universal component envelope) ────────────────────────────────
//
// Every bookable or quotable element in a trip lives here.
// type = 'hotel' → see hotel_details table (complex, rate parsing)
// type = 'flight' | 'transfer' | 'train' | 'car_rental' |
//         'activity' | 'experience' | 'restaurant' | 'note'
//        → details stored as JSON in details_json (typed tables added per type later)
//
// booking_status tracks the progression from research → confirmed booking.

export const tripItems = mysqlTable('trip_items', {
  id: int('id').autoincrement().primaryKey(),
  destinationId: int('destination_id').references(() => destinations.id, { onDelete: 'cascade' }),
  tripId: int('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 30 }).notNull(),
  // 'hotel' | 'flight' | 'transfer' | 'train' | 'car_rental' |
  // 'activity' | 'experience' | 'restaurant' | 'note'
  title: varchar('title', { length: 255 }).notNull(),
  bookingStatus: varchar('booking_status', { length: 20 }).notNull().default('researching'),
  // 'researching' | 'quoted' | 'confirmed' | 'cancelled'
  bookingRef: varchar('booking_ref', { length: 100 }),    // PNR, booking number, etc.
  confirmedTotalInr: int('confirmed_total_inr'),          // set when booked
  startDate: varchar('start_date', { length: 10 }),
  endDate: varchar('end_date', { length: 10 }),
  startTime: varchar('start_time', { length: 8 }),        // HH:MM
  detailsJson: text('details_json'),                      // type-specific JSON for non-hotel types
  cancellationFreeUntil: date('cancellation_free_until'), // confirmed booking: last free-cancel date
  visaRequired: int('visa_required').notNull().default(0), // 1 = visa required for Indian passport
  specialRequests: text('special_requests'),              // JSON array of SpecialRequest objects
  sortOrder: int('sort_order').notNull().default(0),
  addedAt: timestamp('added_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Hotel Details ────────────────────────────────────────────────────────────
// One row per trip_item where type='hotel'. Holds all hotel-specific data
// including SerpAPI results, GPS, editorial notes, and linked rates.

export const hotelDetails = mysqlTable('hotel_details', {
  id: int('id').autoincrement().primaryKey(),
  itemId: int('item_id').notNull().unique().references(() => tripItems.id, { onDelete: 'cascade' }),
  stars: int('stars'),
  rating: real('rating'),
  reviews: int('reviews'),
  locationScore: real('location_score'),
  recommendation: text('recommendation'),   // "Our take" editorial note
  source: varchar('source', { length: 20 }).notNull().default('manual'),
  // 'serp' | 'db' | 'manual'
  foraId: varchar('fora_id', { length: 100 }),
  hotelWebsite: text('hotel_website'),
  googleRateInr: int('google_rate_inr'),    // cheapest nightly from SerpAPI at search time
  thumbnail: text('thumbnail'),
  lat: real('lat'),
  lng: real('lng'),
  serpData: text('serp_data'),              // full SerpAPI result JSON
  holdExpiresAt: date('hold_expires_at'),   // hold expiry for advance-purchase rates
  // Phase 2 research fields
  preferredStatus: varchar('preferred_status', { length: 20 }).default('none'),
  // 'fora' | 'virtuoso' | 'both' | 'none'
  eliminationNote: text('elimination_note'),           // "considered and cut" reason for this brief
  familiarityScore: int('familiarity_score'),           // 1–5 advisor familiarity
  familiarityDate: varchar('familiarity_date', { length: 10 }), // ISO date of last visit/FAM
});

// ─── Rates ────────────────────────────────────────────────────────────────────
// Quoted/parsed rate options for a hotel. Multiple rates = multiple options
// for the client to compare. One rate gets confirmed as the booking.

export const rates = mysqlTable('rates', {
  id: int('id').autoincrement().primaryKey(),
  hotelDetailId: int('hotel_detail_id').notNull().references(() => hotelDetails.id, { onDelete: 'cascade' }),
  source: varchar('source', { length: 30 }).notNull().default('fora'),
  // 'fora' | 'hotel_website' | 'expedia_taap' | 'booking' | 'direct' | 'other'
  sourceLabel: varchar('source_label', { length: 100 }),
  rawText: text('raw_text'),
  status: varchar('status', { length: 20 }).notNull().default('idle'),
  // 'idle' | 'parsing' | 'done' | 'error' | 'proposals'
  isConfirmed: int('is_confirmed').notNull().default(0),  // 1 = this is the booked rate
  parsedData: text('parsed_data'),          // JSON: ParsedRate
  proposals: text('proposals'),             // JSON: ParsedRate[]
  errorMessage: text('error_message'),
  history: text('history'),                 // JSON: [{parsed, rawText, timestamp}]
  expiresAt: date('expires_at'),            // rate validity deadline (when this quoted price expires)
  sortOrder: int('sort_order').notNull().default(0),
  addedAt: timestamp('added_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Trip Snapshots (proposal version history) ────────────────────────────────
// Immutable snapshots taken before each edit to a sent/accepted/booked proposal.
// The current live state is always in trips + destinations + trip_items + rates.
// Snapshots capture a serialised point-in-time view for rollback.

export const tripSnapshots = mysqlTable('trip_snapshots', {
  id: int('id').autoincrement().primaryKey(),
  tripId: int('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  version: int('version').notNull().default(1),
  label: varchar('label', { length: 100 }),        // e.g. "Before edit on 14 Oct"
  snapshotJson: text('snapshot_json').notNull(),    // full TripFull serialised as JSON
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Change Requests (client revision feedback per proposal) ─────────────────
// Logged whenever a client asks for a change to a sent or in-revision proposal.
// Category classifies the type of change so the advisor can triage and track.

export const changeRequests = mysqlTable('change_requests', {
  id: int('id').autoincrement().primaryKey(),
  tripId: int('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  snapshotVersion: int('snapshot_version'),        // proposal version this feedback responds to (nullable)
  category: varchar('category', { length: 30 }).notNull().default('other'),
  // 'hotel_swap' | 'date_change' | 'activity_add' | 'budget_adjust' | 'other'
  text: text('text').notNull(),                    // free-form client feedback text
  status: varchar('status', { length: 20 }).notNull().default('open'),
  // 'open' | 'implemented' | 'noted'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Itinerary (day-by-day guide) ─────────────────────────────────────────────
// Optional rich day-by-day planner and city guide layer. Separate from the
// trip_items booking layer — this is the narrative/guide layer.

export const itineraryDays = mysqlTable('itinerary_days', {
  id: int('id').autoincrement().primaryKey(),
  tripId: int('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  destinationId: int('destination_id').references(() => destinations.id),
  dayNumber: int('day_number').notNull(),
  date: varchar('date', { length: 10 }),
  title: varchar('title', { length: 255 }),
  summary: text('summary'),
  sortOrder: int('sort_order').notNull().default(0),
});

export const itineraryBlocks = mysqlTable('itinerary_blocks', {
  id: int('id').autoincrement().primaryKey(),
  dayId: int('day_id').notNull().references(() => itineraryDays.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 30 }).notNull(),
  // 'text' | 'hotel_ref' | 'activity_ref' | 'transport_note' |
  // 'tip' | 'meal' | 'image' | 'map_pin'
  content: text('content'),                 // rich text or JSON depending on type
  itemId: int('item_id').references(() => tripItems.id), // optional link to a trip_item
  sortOrder: int('sort_order').notNull().default(0),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
  trips: many(trips),
  clients: many(clients),
}));

export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  invitationsSent: many(invitations),
  trips: many(trips),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  team: one(teams, { fields: [invitations.teamId], references: [teams.id] }),
  invitedBy: one(users, { fields: [invitations.invitedBy], references: [users.id] }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  team: one(teams, { fields: [activityLogs.teamId], references: [teams.id] }),
  user: one(users, { fields: [activityLogs.userId], references: [users.id] }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  team: one(teams, { fields: [clients.teamId], references: [teams.id] }),
  trips: many(trips),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  team: one(teams, { fields: [trips.teamId], references: [teams.id] }),
  user: one(users, { fields: [trips.userId], references: [users.id] }),
  client: one(clients, { fields: [trips.clientId], references: [clients.id] }),
  destinations: many(destinations),
  items: many(tripItems),
  itineraryDays: many(itineraryDays),
  snapshots: many(tripSnapshots),
  changeRequests: many(changeRequests),
}));

export const tripSnapshotsRelations = relations(tripSnapshots, ({ one }) => ({
  trip: one(trips, { fields: [tripSnapshots.tripId], references: [trips.id] }),
}));

export const changeRequestsRelations = relations(changeRequests, ({ one }) => ({
  trip: one(trips, { fields: [changeRequests.tripId], references: [trips.id] }),
}));

export const destinationsRelations = relations(destinations, ({ one, many }) => ({
  trip: one(trips, { fields: [destinations.tripId], references: [trips.id] }),
  items: many(tripItems),
  itineraryDays: many(itineraryDays),
}));

export const tripItemsRelations = relations(tripItems, ({ one, many }) => ({
  trip: one(trips, { fields: [tripItems.tripId], references: [trips.id] }),
  destination: one(destinations, { fields: [tripItems.destinationId], references: [destinations.id] }),
  hotelDetails: one(hotelDetails, { fields: [tripItems.id], references: [hotelDetails.itemId] }),
  itineraryBlocks: many(itineraryBlocks),
}));

export const hotelDetailsRelations = relations(hotelDetails, ({ one, many }) => ({
  item: one(tripItems, { fields: [hotelDetails.itemId], references: [tripItems.id] }),
  rates: many(rates),
}));

export const ratesRelations = relations(rates, ({ one }) => ({
  hotelDetail: one(hotelDetails, { fields: [rates.hotelDetailId], references: [hotelDetails.id] }),
}));

export const itineraryDaysRelations = relations(itineraryDays, ({ one, many }) => ({
  trip: one(trips, { fields: [itineraryDays.tripId], references: [trips.id] }),
  destination: one(destinations, { fields: [itineraryDays.destinationId], references: [destinations.id] }),
  blocks: many(itineraryBlocks),
}));

export const itineraryBlocksRelations = relations(itineraryBlocks, ({ one }) => ({
  day: one(itineraryDays, { fields: [itineraryBlocks.dayId], references: [itineraryDays.id] }),
  item: one(tripItems, { fields: [itineraryBlocks.itemId], references: [tripItems.id] }),
}));

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
export type Destination = typeof destinations.$inferSelect;
export type NewDestination = typeof destinations.$inferInsert;
export type TripItem = typeof tripItems.$inferSelect;
export type NewTripItem = typeof tripItems.$inferInsert;
export type HotelDetail = typeof hotelDetails.$inferSelect;
export type Rate = typeof rates.$inferSelect;
export type NewRate = typeof rates.$inferInsert;
export type ItineraryDay = typeof itineraryDays.$inferSelect;
export type ItineraryBlock = typeof itineraryBlocks.$inferSelect;
export type TripSnapshot = typeof tripSnapshots.$inferSelect;
export type NewTripSnapshot = typeof tripSnapshots.$inferInsert;
export type ChangeRequest = typeof changeRequests.$inferSelect;
export type NewChangeRequest = typeof changeRequests.$inferInsert;

// Required by auth middleware
export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
  CREATE_TRIP = 'CREATE_TRIP',
  DELETE_TRIP = 'DELETE_TRIP',
}

export type ParsedRate = {
  hotel_name?: string;
  hotel_url?: string;
  room_type?: string;
  room_sqm?: number;
  checkin?: string;
  checkout?: string;
  nights?: number;
  adults?: number;
  rooms?: number;
  cancellation_free?: boolean;
  cancellation_deadline?: string;
  cancellation_note?: string;
  nightly_rates?: { date: string; rate_inr: number }[];
  subtotal_inr?: number;
  taxes_inr?: number;
  total_inr?: number;
  native_currency_code?: string;
  native_currency_total?: number;
  due_at_booking_inr?: number;
  due_later_inr?: number;
  board_basis?: string;
  breakfast_included?: boolean;
  inclusions?: string[];
  perks?: string[];
  key_amenities?: string[];
  vet_notes?: string;
};

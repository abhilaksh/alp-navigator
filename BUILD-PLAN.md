# Alp Quote Builder — SaaS Build Plan

> Last updated: 2026-06-27  
> Hosted at: navigator.alptravel.co  
> Built by: Claude Code

---

## What We're Building

A standalone web application that replaces the WordPress plugin version of the Alp Quote Builder. It will eventually become a multi-tenant SaaS product for independent Fora Pro advisors and travel agencies to manage client quotes.

**Phase 0 (internal tool):** Single-user, all features of the WP plugin, better UX.  
**Phase 1 (SaaS):** Multi-tenant with subscriptions, team members, billing via Razorpay.

---

## Stack (locked)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | Best-in-class SSR + API routes in one |
| Language | TypeScript | Type-safe from day one |
| DB | Turso (libSQL/SQLite edge) | 9 GB free forever, Drizzle-native, never pauses |
| ORM | Drizzle ORM | Lightweight, type-safe, Turso-native |
| Auth | Auth.js v5 (NextAuth) | Built into starter, email+password+magic link |
| Payments | Razorpay | INR-native, no monthly fee, 2% per txn |
| Email | Cloudflare Email Workers | Already configured on alptravel.co |
| Styling | Tailwind CSS v4 + design tokens | Matches WordPress theme tokens |
| Fonts | Fraunces + Schibsted Grotesk + Spline Sans Mono | Same as WP theme |
| Icons | Lucide React | Same as design comps |
| Motion | Framer Motion | Smooth transitions on editor |
| Base starter | leerob/next-saas-starter | Auth + billing + Drizzle pre-wired |
| Hosting | Vercel (Hobby → Pro) | Best Next.js support, CI/CD from git |
| Domain | navigator.alptravel.co | Cloudflare DNS CNAME → Vercel |

**Note on Hostinger MySQL:** The Hostinger API key doesn't have access to the existing hosting account. Turso is the free-forever alternative; migration to MySQL later is trivial (same Drizzle schema, just swap dialect).

---

## Design Tokens (carry over from WP theme)

```
Spruce:     #1E3A2F  (primary dark green — topbar, accents)
Brass:      #A98B52  (active state, highlights, prices)
Paper:      #F6F4EE  (main background)
Paper-deep: #EDEAE1  (card backgrounds, inputs)
Glacier:    #C9D2CC  (borders, dividers)
Ink:        #161A17  (primary text)
Ink-soft:   #4A514B  (secondary text)
Ink-mute:   #8A9189  (tertiary text, labels)
Green:      #2E6B45  (success states)
Red:        #8B2F2F  (error states)
```

---

## Database Schema

### `users`
| Column | Type | Notes |
|---|---|---|
| id | text PK | CUID2 |
| email | text unique | |
| name | text | |
| password_hash | text nullable | null = magic-link only user |
| role | text | 'admin' \| 'advisor' |
| created_at | integer | epoch ms |

### `teams` (future multi-tenant)
| Column | Type | Notes |
|---|---|---|
| id | text PK | |
| name | text | Agency name |
| slug | text unique | URL-safe |
| plan | text | 'free' \| 'pro' \| 'agency' |
| razorpay_subscription_id | text nullable | |
| created_at | integer | |

### `team_members`
| Column | Type | Notes |
|---|---|---|
| team_id | text FK | |
| user_id | text FK | |
| role | text | 'owner' \| 'member' |

### `trips`
| Column | Type | Notes |
|---|---|---|
| id | text PK | |
| team_id | text FK | |
| user_id | text FK | creator |
| label | text | "Nikita: Greece, Aug 2026" |
| client_name | text | |
| adults | integer | |
| status | text | 'draft' \| 'sent' \| 'accepted' \| 'booked' \| 'archived' |
| preview_key | text nullable | random token for share link |
| preview_expires_at | integer nullable | epoch ms |
| total_from_inr | integer nullable | computed: sum of cheapest rates |
| created_at | integer | |
| updated_at | integer | |

### `destinations`
| Column | Type | Notes |
|---|---|---|
| id | text PK | |
| trip_id | text FK | |
| name | text | "Mykonos" |
| checkin | text | ISO date |
| checkout | text | ISO date |
| nights | integer | |
| sort_order | integer | for drag-and-drop |
| created_at | integer | |

### `hotels`
| Column | Type | Notes |
|---|---|---|
| id | text PK | |
| destination_id | text FK | |
| name | text | |
| stars | integer nullable | |
| rating | real nullable | Google rating 0–10 |
| reviews | integer nullable | |
| location_score | real nullable | advisor's manual 1–10 |
| recommendation | text | "Our take" editorial note |
| source | text | 'serp' \| 'db' \| 'manual' |
| fora_id | text nullable | |
| hotel_website | text nullable | |
| google_rate_inr | integer nullable | lowest nightly from SerpAPI at search time |
| thumbnail | text nullable | image URL |
| lat | real nullable | |
| lng | real nullable | |
| serp_data | text | JSON blob — full SerpAPI result |
| sort_order | integer | |
| added_at | integer | |

### `rates`
| Column | Type | Notes |
|---|---|---|
| id | text PK | |
| hotel_id | text FK | |
| source | text | 'fora' \| 'hotel_website' \| 'expedia_taap' \| 'booking' \| 'direct' \| 'other' |
| source_label | text | when source = 'other' |
| raw_text | text | pasted rate confirmation |
| status | text | 'idle' \| 'parsing' \| 'done' \| 'error' \| 'proposals' |
| parsed_data | text | JSON: ParsedRate |
| proposals | text | JSON: ParsedRate[] |
| error_message | text | |
| history | text | JSON: [{parsed, rawText, timestamp}] |
| sort_order | integer | |
| added_at | integer | |
| updated_at | integer | |

---

## API Routes

### Auth
- `POST /api/auth/signup` — create account
- `POST /api/auth/login` — email/password
- `POST /api/auth/magic-link` — send magic link email
- `GET /api/auth/me` — current user

### Trips
- `GET /api/trips` — list user's trips (with status filter)
- `POST /api/trips` — create
- `GET /api/trips/:id` — full trip with destinations/hotels/rates
- `PATCH /api/trips/:id` — update label/client/adults/status
- `DELETE /api/trips/:id` — delete
- `POST /api/trips/:id/preview` — generate/refresh preview key
- `GET /api/preview/:key` — public preview page data (no auth)

### Destinations
- `POST /api/trips/:id/destinations` — add
- `PATCH /api/destinations/:id` — update name/dates
- `DELETE /api/destinations/:id` — delete
- `PATCH /api/destinations/:id/reorder` — update sort_order

### Hotels
- `POST /api/destinations/:id/hotels` — add hotel
- `PATCH /api/hotels/:id` — update name/score/recommendation/location
- `DELETE /api/hotels/:id` — delete
- `PATCH /api/hotels/:id/reorder` — update sort_order

### Rates
- `POST /api/hotels/:id/rates` — add rate
- `PATCH /api/rates/:id` — update source/parsed/status
- `DELETE /api/rates/:id` — delete
- `POST /api/rates/:id/parse` — trigger AI parse (calls Hapuppy, saves result)

### Search
- `POST /api/search/hotels` — proxy to SerpAPI (server-side, protects key)
- `POST /api/search/db` — search internal hotel database

### Billing
- `GET /api/billing/plans` — available plans
- `POST /api/billing/subscribe` — create Razorpay subscription
- `POST /api/billing/webhook` — Razorpay webhook handler
- `GET /api/billing/portal` — billing management

---

## Pages / Routes

| Route | Description |
|---|---|
| `/` | Marketing landing page |
| `/login` | Email/password + magic link |
| `/signup` | Create account |
| `/dashboard` | Trips list with status badges, search, filters |
| `/trips/new` | Create new trip → redirect to editor |
| `/trips/:id` | The quote editor (main app) |
| `/preview/:key` | Public client-facing quote preview |
| `/settings` | Profile, API keys, preferences |
| `/billing` | Plan, subscription, payment method |
| `/admin` | (Future) admin panel |

---

## Phase Checklist

### Phase 0 — Foundation (Week 1–2)
- [ ] Clone leerob starter, configure Turso + Drizzle
- [ ] Swap Stripe → Razorpay subscription flow
- [ ] Configure Cloudflare Email (magic link emails)
- [ ] Apply Alp brand tokens (Tailwind config)
- [ ] Auth pages (login/signup) in brand style
- [ ] Deploy to Vercel, wire navigator.alptravel.co

### Phase 1 — Trips Dashboard (Week 2–3)
- [ ] Trips list page with status badges + filters
- [ ] Create trip modal / page
- [ ] Trip status workflow (Draft → Sent → Accepted → Booked)
- [ ] Delete trip with confirmation
- [ ] Empty state (first-time use)

### Phase 2 — Quote Editor Core (Week 3–5)
- [ ] Editor layout (topbar + tabs + two-column)
- [ ] Destination tabs with add/remove/reorder
- [ ] Hotel cards with collapse/expand
- [ ] Rate cards (idle → parsing → done → proposals)
- [ ] Auto-save (debounced, 1s)
- [ ] Save status indicator (Saved / Saving / Unsaved / Error)

### Phase 3 — Search & AI (Week 5–6)
- [ ] SerpAPI hotel search (server-side proxy)
- [ ] Search result cards
- [ ] Filter bar (stars, rating, sort)
- [ ] Map view toggle (Leaflet)
- [ ] Add hotel from search results
- [ ] Hapuppy AI rate parsing
- [ ] Proposal picker (multi-room parse)
- [ ] Rate edit mode (re-paste + field grid)
- [ ] Google rate comparison highlight

### Phase 4 — Preview & Export (Week 6–7)
- [ ] Quote preview page (public, no auth)
- [ ] Destination sections with Leaflet maps
- [ ] Hotel comparison tables
- [ ] WhatsApp export (copy formatted text)
- [ ] WhatsApp direct send button (wa.me link)
- [ ] Copy preview link button
- [ ] Preview expiry date + Renew button
- [ ] Print / PDF styles

### Phase 5 — Data & Polish (Week 7–8)
- [ ] Trip total calculation (editor topbar + preview hero)
- [ ] Drag-and-drop hotel reorder (dnd-kit)
- [ ] Expand/Collapse all hotels
- [ ] Two-step inline delete confirmation
- [ ] Hotel detail modal (photos, amenities, nearby)
- [ ] Platform links (Fora, ExpediaTAAP, hotel website)
- [ ] Internal hotel database search

### Phase 6 — SaaS Features (Week 8–10)
- [ ] Razorpay subscription tiers (Free/Pro/Agency)
- [ ] Team member invites
- [ ] Billing portal
- [ ] Usage limits per plan
- [ ] Email notifications (quote shared, expiring soon)
- [ ] Analytics (quotes created, sent, accepted rate)

### Phase 7 — Marketing Site (Week 10+)
- [ ] Landing page (navigator.alptravel.co)
- [ ] Pricing page
- [ ] Feature highlights
- [ ] Demo / sign-up CTA

---

## Subscription Tiers (proposed)

| Tier | Price | Limits |
|---|---|---|
| Free | ₹0 | 3 trips/month, 1 user |
| Pro | ₹1,999/month | Unlimited trips, 1 user, priority support |
| Agency | ₹4,999/month | Unlimited trips, 5 team members, white-label preview |

---

## External APIs (all existing keys from WP plugin)

| Service | Key Location | Purpose |
|---|---|---|
| Hapuppy AI | `HAPUPPY_API_KEY` | Rate parsing (glm-5.2) |
| SerpAPI | `SERPAPI_KEY` | Google Hotels search |
| Razorpay | `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` | Subscriptions |
| Turso | `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` | Database |

---

## Decisions Log

- **2026-06-27**: Using Turso (not Hostinger MySQL) because Hostinger API key has limited scope. Schema is identical either way; migration is trivial.
- **2026-06-27**: Using leerob/next-saas-starter as base — already has Auth.js + Drizzle + subscription flow pre-wired.
- **2026-06-27**: Razorpay replaces Stripe. Webhook handler and subscription management will be rebuilt from scratch (Stripe-specific code stripped).
- **2026-06-27**: Cloudflare Email Workers replaces Resend/Postmark for transactional email.
- **2026-06-27**: Framer Motion for animations (not GSAP — overkill for a React app).

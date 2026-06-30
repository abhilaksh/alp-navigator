# Navigator — Sprint History & Build Plan

> **Project:** navigator.alptravel.co — Luxury travel quote builder for a solo Fora Pro advisor  
> **Stack:** Next.js 15 App Router, Drizzle ORM + MySQL, Tailwind CSS, Alpine.js  
> **Last updated:** 2026-07-01

---

## Completed Sprints

### Foundation (Sprints 1–3)
| Sprint | Feature | Notes |
|--------|---------|-------|
| 1 | **Live trip total in editor topbar** | Computed from parsed rates, debounced save to DB |
| 2 | **Non-hotel line items** — flights, transfers, activities | Full CRUD, `detailsJson` per type, inline edit forms |
| 3 | **Hold expiry alerts** — hotel cards + topbar banner | `holdExpiresAt` on hotel_details, red/amber badges |

### Search & Enrichment (Sprints 4–9)
| Sprint | Feature | Notes |
|--------|---------|-------|
| 4–5 | **Booking fields** — cancellation, visa flag, FX rate lock | Per-hotel fields, FX buffer % and locked USD→INR rate |
| 6 | **Stale rate warnings + From ₹X floor mode** | Rates expire; `isExpired` flag, brass "from" display |
| 7 | **Pipeline dashboard v1** — list + kanban views | Early version, later replaced by command center |
| 8 | **Fora partner intelligence** — Virtuoso/Fora perk data | Reads from `/data/fora-partners.json`, perks on rate cards |
| 9 | **Visa requirements integration** | Per-destination visa difficulty, fee, processing time |

### Editor Enhancement (Sprints 10–20)
| Sprint | Feature | Notes |
|--------|---------|-------|
| 10 | **Enhanced client profile** — structured preferences | Food, activities, pace, room type preferences |
| 11 | **Day-by-day itinerary builder** | `itinerary_days` + `itinerary_blocks` tables, sortable |
| 12 | **AI writing assist for itinerary** | Hapuppy AI generates day summaries from hotel/activity context |
| 13 | **Special requests per hotel** | Per-item field, shown on preview and bookings panel |
| 14 | **Client proposal redesign** | Photography-led preview, advisor overlay, editorial layout |
| 15 | **Bookings tab** — overview panel + status/ref sync | Aggregates booking status across all hotels |
| 16 | **AI destination narrative generator** | One-click editorial copy for destination sections |
| 17 | **Quote activity tracking** | `firstViewedAt` + `viewCount` — when client opens preview |
| 18 | **Pre-departure checklist generator** | AI-generated checklist tab per trip |
| 19 | **Share modal** — WhatsApp composer + email draft | Two tabs, pre-filled with hotel summaries and preview link |
| 20 | **Client context panel** — in-editor sidebar | Preferences, passport expiry, special notes during quoting |

### Operational (Sprints 21–35)
| Sprint | Feature | Notes |
|--------|---------|-------|
| 21 | **Payment tracking tab** | Deposit/balance deadlines, paid toggles, payment notes |
| 22 | **AI booking confirmation email parser** | Paste Fora/hotel email → extracts ref, dates, cancel policy |
| 23 | **Virtuoso/Fora partner perk value estimator** | Computes INR value of breakfast/credits/upgrades |
| 24 | **Rate expiry UX** — validity date badge + expired banner | Rates have `expiresAt`, shown as countdown |
| 25 | **Intake status pipeline** — pill in topbar + SLA alert | `new_inquiry → brief_complete → research_ready` |
| 26 | **Proposal version history** | Auto-snapshots on send/accept, manual saves, version list |
| 27 | **Follow-up cadence indicators** | "3 days since last contact" visual on trips list |
| 28 | **Personal note + journey overview fields** | Advisor's intro note and trip narrative on proposal |
| 29 | **AI WhatsApp summary tab** in share modal | Hapuppy-generated concise summary for WhatsApp |
| 30 | **Change request capture panel** | Client revision requests with category + open count badge |
| 31 | **Intake budget fields + urgency flag** | Budget stated/estimated, `urgent/very_urgent` flag |
| 32 | **Hotel preferred status + familiarity score** | Advisor's internal rating, shown in research workspace |
| 33 | **Research workspace** — brief-to-shortlist triage | Side-by-side preferred/eliminated hotel management |
| 34 | **Commission tracking per hotel** | `commissionPct`, `commissionAmountInr`, `commissionPaidAt` |
| 35 | **Advisor profile settings page** | Agency name, IATA, Virtuoso, WhatsApp, quote footer |

### Pipeline & Client Management (Sprints 36–44)
| Sprint | Feature | Notes |
|--------|---------|-------|
| 36 | **Advisor profile on preview page** | Agency name, tagline, WhatsApp CTA from profile |
| 37 | **Commission summary strip** on pipeline page | Expected/received/pending totals |
| 38 | **Trip duplication** — clone trip as draft | One-click copy with fresh status |
| 39 | **Client LTV stats strip** | Trips count, total spent, avg trip value on client detail |
| 40 | **Trip search + archive** in pipeline view | Text search, archive filter, status counts |
| 41 | **Itinerary on client preview + print styles** | Day-by-day shown on preview, `@media print` CSS |
| 42 | **Non-hotel line items on preview** | Flights/transfers/activities shown on client proposal |
| 43 | **From ₹X floor mode on preview** | `~₹X` with "estimated" label when any item is estimated |
| 44 | **Destination photography** | Pexels photo search, hero image on destination + trip |

### Phase 5 — Pipeline (Sprints 45–47)
| Sprint | Feature | Notes |
|--------|---------|-------|
| 45 | **Pipeline command center** (main dashboard) | Hold expiries, no-engagement alerts, pipeline counts, commission widget |
| 46 | **Client acceptance flow** on preview | "I'd like to proceed" CTA, optional note, confirmation overlay, expiry countdown |
| 47 | **Engagement & timeline tab** in editor | View count, first-view date, acceptance status, version history, WA reminder nudge |

---

## Pending Sprints

### Phase 6 — Analytics & Business Intelligence

| Sprint | Feature | Priority | Notes |
|--------|---------|----------|-------|
| 48 | **Analytics dashboard** — conversion funnel + revenue | High | Draft→Sent→Accepted→Booked rates; avg trip value; monthly revenue chart |
| 49 | **Top destinations report** | Medium | Which destinations appear most in booked trips |
| 50 | **Client acquisition source tracking** | Medium | How clients find the advisor (referral, website, etc.) |
| 51 | **Commission forecast** — projected vs received | High | Monthly commission pipeline with expected receive dates |

### Phase 6 — Sharing & Client UX

| Sprint | Feature | Priority | Notes |
|--------|---------|----------|-------|
| 52 | **Hotel option A/B comparison on preview** | High | When destination has 2+ hotels, show as radio-select comparison cards |
| 53 | **mailto: integration in share modal** | Medium | "Open in email app" button on email draft tab using mailto: link |
| 54 | **Proposal cover page** | Medium | Formal cover with client name, trip dates, advisor photo, personalized intro |
| 55 | **Printable itinerary document** | Low | Separate print view showing day-by-day only, no pricing |

### Phase 6 — Operational Improvements

| Sprint | Feature | Priority | Notes |
|--------|---------|----------|-------|
| 56 | **Bulk trip operations** | Medium | Archive or change status on multiple trips from list view |
| 57 | **Trip templates** | High | Save a completed trip as a template for future similar quotes |
| 58 | **Hotel notes library** | Medium | Reusable hotel editorial notes across trips, not per-trip |
| 59 | **Rate comparison across trips** | Low | See what you paid at the same hotel on past trips |
| 60 | **Drag-and-drop destination reorder** | Low | Move destinations within a trip by dragging |

### Phase 7 — SaaS Foundation

| Sprint | Feature | Priority | Notes |
|--------|---------|----------|-------|
| 61 | **Email notifications** — proposal viewed/expiring | High | Transactional emails when client views, when hold expires |
| 62 | **Razorpay subscription billing** | High | Free/Pro/Agency tiers; billing portal; usage limits |
| 63 | **Team member invites** | Medium | Multiple advisors per agency account |
| 64 | **White-label preview** | Low | Custom subdomain for proposal links (Agency tier) |
| 65 | **Public API with webhooks** | Low | Webhook on client accept, proposal view events |

### Phase 8 — Marketing Site

| Sprint | Feature | Priority | Notes |
|--------|---------|----------|-------|
| 66 | **Landing page** at navigator.alptravel.co | High | Feature highlights, pricing, sign-up CTA |
| 67 | **Pricing page** | Medium | Plan comparison table, FAQ |
| 68 | **Demo / interactive preview** | Low | Public sample proposal for prospective users |

---

## Current Architecture (as of Sprint 47)

### Database tables
`users` · `teams` · `team_members` · `trips` · `destinations` · `trip_items` · `hotel_details` · `hotel_rates` · `clients` · `trip_snapshots` · `change_requests` · `itinerary_days` · `itinerary_blocks` · `advisor_profiles`

### Editor tabs
Hotels (main) · Itinerary · Bookings · Checklist · Payment · Revisions · Engagement · Research

### External APIs wired
Hapuppy AI (rate parsing + writing) · SerpAPI (Google Hotels search) · Pexels (photography) · Fora partner data (local JSON)

### Key design tokens
Spruce `#1E3A2F` · Brass `#A98B52` · Paper `#F6F4EE` · Paper-deep `#EDEAE1` · Glacier `#C9D2CC` · Ink `#161A17`

---

## Migrations needed on production (not yet run)

| Migration | Endpoint | What it adds |
|-----------|----------|-------------|
| 0016 | `/api/migrate-0016?token=alp-migrate-2026` | `advisor_profiles` table |
| 0017 | `/api/migrate-0017?token=alp-migrate-2026` | `hero_image` on destinations + trips |
| 0018 | `/api/migrate-0018?token=alp-migrate-2026` | `client_accepted_at`, `client_acceptance_note` on trips |

---

## Push pending

All commits are local. To push to production:
```
git push origin main
```
Then run the three migrations above at navigator.alptravel.co.

Also needed: add `PEXELS_API_KEY` environment variable in Dokploy for photo search to work.

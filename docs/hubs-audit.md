# Hubs: replication-ready audit

## Purpose and boundary

Hubs are the shared firm-wide reference-data layer. They hold reusable controlled values consumed by intake, Matter work, scheduling and staff operations. They are not a second Matters workspace and should not be used to store a one-off case fact.

The Hubs directory is `/admin/hubs`. Its current elements are Holidays, Courts, Practice & Matter Taxonomy, Police Stations, and Prisons.

```text
Hubs (controlled shared data)
  -> Intake / website service choices
  -> Matter classification and filing
  -> Calendar / deadlines
  -> operational research and lookup
```

## 1. Directory-level requirements

The landing page is a directory only: it describes each hub, its data source, and a single action. It must not duplicate Holiday records or CRUD controls. Every hub must identify its source/provenance and preserve retired data for auditability where it is used operationally.

| Hub | Current route | Primary consumers | Current write capability |
|---|---|---|---|
| Holidays | `/admin/hubs/holidays` | Calendar, deadline calculations | Create, read, update API, deactivate. UI currently exposes create/list/deactivate. |
| Courts | `/admin/courts` | Matters, court calendar, filings | Full create/read/update/archive/restore. |
| Practice & Matter Taxonomy | `/admin/practice-areas` | Website services, Intake, Matter classification/templates | Full group/practice-area CRUD; matter-type/template model seeded and consumed. |
| Police Stations | `/admin/justice/police-stations` | Operational lookup | Browse/search only. |
| Prisons | `/admin/justice/prisons` | Operational lookup | Browse/search only. |

Important as-built finding: Police Stations and Prisons are not yet full CRUD hubs. They are static/reference datasets shown through the shared institution list. To meet the stated “100% CRUD” objective they need database tables, protected mutation APIs, an import/reconciliation job, provenance fields, archive/restore, and audit logging; do not claim this is implemented today.

## 2. Holidays hub

### Purpose

Maintain Kenya working-day/public-holiday rules used by Calendar and deadline computation. It is the authoritative firm reference list, not a widget on the Hubs landing page.

### Data and form contract

`public_holidays` contains: identity, `country_code` (forced to `KE`), name, holiday type, calculation rule, month/day where applicable, faith scope, non-working flag, notes, source URL, active state and timestamps.

The visible Add Holiday form currently collects:

| Field | Required | Values / rule |
|---|---:|---|
| Name | yes | Controlled holiday label. |
| Calculation rule | yes | `FIXED_DATE`, `GAZETTE_DECLARATION`, or `WESTERN_EASTER`. |
| Holiday type | supplied by UI | `PUBLIC`. |
| Source URL | supplied by UI | Kenya Law Public Holidays Act URL. |

The API supports more complete records and must validate `name`, `holiday_type`, and `calculation_rule`. Lunar/Gazette dates require annual operational overrides; do not silently calculate them as fixed dates.

### CRUD, permissions and lifecycle

| Action | API | Authority / outcome |
|---|---|---|
| List Kenya holidays | `GET /api/reference/holidays` | Authenticated profile. |
| Create | `POST` | `manage_reference_data`. |
| Update | `PATCH` with `id` | `manage_reference_data`. |
| Retire | `DELETE` with `id` | `manage_reference_data`; sets `is_active=false`, retains history. |

The current UI needs an Edit action wired to PATCH before the hub can honestly be called full UI CRUD; the server write contract already supports it. Migration: `041_kenya_holiday_reference.sql`.

## 3. Courts hub

### Purpose

One controlled Court record includes both court and registry attributes. There must not be separate Court and Court Registry entities where fields overlap. Matters link to this record, and court dates enrich the diary from the Matter’s `court_id`.

### Core data model / form

The Court editor requires `name` and `court_type`. Its broader model includes jurisdiction, station/location, registry type and relevant filing/contact/geo/service attributes introduced through the court migrations. Reference fields should include provenance and an active/archive state.

| Operation | Interface / API | Behaviour |
|---|---|---|
| List active or archived | `/admin/courts`, `GET /api/courts` | Trash toggle retrieves retired records. |
| Create | Court editor, `POST /api/courts` | Requires name and court type. |
| Update | Court editor, `PATCH /api/courts` | Updates the single controlled court record. |
| Archive | `DELETE /api/courts?id=` | Retains links from already-filed Matters. |
| Restore | PATCH `{ id, restore: true, is_active: true }` | Returns the record to active use. |

Court CRUD needs server-side reference-data permissions, audit history, and no hard delete. Required migration chain includes `025_courts_and_litigation.sql`, `026_courts_register_resource.sql`, `027_court_registry_type.sql`, and `042_courts_reference_contact_fields.sql`.

## 4. Practice & Matter Taxonomy hub

### Purpose

Taxonomy supplies the shared service/practice vocabulary. It drives public service presentation, intake selection, Matter classification, reusable event/activity templates and expected artefacts. It must remain in Hubs rather than evolve as free text on Matters.

### Entity hierarchy

```text
Practice area group
  -> Practice area
       -> Matter type
            -> Matter-type event/template
                 -> required artefact types
```

Additional shared vocabulary seeded alongside it includes `events`, `artifact_types`, engagements, relationship/timeline/access records and template joins.

### Forms and CRUD

The page has two management surfaces:

1. **Practice-area groups**: name/slug and group metadata through `GET|POST|PATCH|DELETE /api/practice-area-groups`. Deleting a group makes member practice areas ungrouped; it does not delete them.
2. **Practice areas**: title, slug (generated from title if empty), descriptions, group, service/highlight/public-display data, active/display-order and associated metadata through `GET|POST|PATCH|DELETE /api/practice-areas`.

Practice-area Delete moves the record to trash and PATCH `restore: true` reinstates it; bulk delete/restore uses the same protected endpoints. The visible list distinguishes ungrouped areas so public/intake taxonomy errors are discoverable.

`matter_types`, template events and artefact requirements are materially part of this Hub even where their controls are not all exposed in the current page. A full replication should provide equivalent protected CRUD screens/API for these dependent layers, not merely seed them. Migration: `039_matter_management_reference_layer.sql` (with the practice-area group migration used by the UI).

## 5. Police Stations hub

### Current implementation

`/admin/justice/police-stations` uses the shared `InstitutionList` component and a bundled/static national dataset. It provides reference browsing/search and a source warning (public directories; operational details must be verified with the National Police Service).

### Required future CRUD contract

To make this a genuine Hub, create a `police_stations` table with at least:

- ID, name, station/post type, county/sub-county, physical address, location coordinates;
- contacts, services/units, operating hours and emergency/after-hours notes;
- source URL/source name, source date, verification status/date/by whom;
- active/archive timestamps and audit fields.

Provide list/search/filter, detail, create, edit, archive, restore, bulk import/update with duplicate matching, and a full audit trail. Treat external directory data as imported reference data, never as automatically verified operational fact.

## 6. Prisons hub

### Current implementation

`/admin/justice/prisons` uses the same static institution-list pattern. Its listed provenance is an IEBC 2022 registered-voter reference, which is insufficient as an operational prison directory and must be visibly qualified.

### Required future CRUD contract

Create a `prisons` table and manage the same lifecycle as Police Stations. Model: name, facility category/security level, county/location/address/coordinates, contacts, visiting/process notes, source/provenance, verification state/date/owner, active/archive and audit fields. Add managed CRUD, import reconciliation, duplicate detection and a clear source confidence indicator.

## 7. Cross-hub rules for a replication

1. All hub mutations require `manage_reference_data` (or an explicitly stricter equivalent), are authenticated server-side, and write audit records.
2. Retire/archive rather than hard-delete values already referenced by Matters, Calendar entries, templates or history.
3. A referenced record must retain its historical display name or snapshot even after later editing/archiving.
4. Reference values must expose source, source date, verification state and steward. A static dataset must not masquerade as live verified data.
5. Matter and Intake forms fetch controlled records; they must not invent free-text courts, practice areas or matter types.
6. Every hub needs empty, loading, error, confirmation and restore states. An API PATCH without a reachable Edit flow is not complete interface CRUD.

## 8. Source map

- `src/app/admin/hubs/page.tsx`, `src/app/admin/hubs/holidays/page.tsx`
- `src/app/api/reference/holidays/route.ts`, `supabase/migrations/041_kenya_holiday_reference.sql`
- `src/app/admin/courts/page.tsx`, `src/app/api/courts/route.ts`, `src/app/api/admin/courts/route.ts`
- `src/app/admin/practice-areas/page.tsx`, `src/app/api/practice-areas/route.ts`, `src/app/api/practice-area-groups/route.ts`
- `src/app/admin/justice/[type]/InstitutionList.tsx`, `src/data/justice/`
- `supabase/migrations/025_courts_and_litigation.sql`, `026_courts_register_resource.sql`, `027_court_registry_type.sql`, `039_matter_management_reference_layer.sql`, `042_courts_reference_contact_fields.sql`

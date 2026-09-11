# Geography & Localization

> Assumptions and constraints for geography, currency, and localization.
> See R12, R13.

## Geography: no hard-coded Philippine structures (R12)

Geography uses a **generic typed-place model**:

- **Country** — ISO 3166-1 alpha-2 code (e.g. `PH`, `SG`, `US`).
- **Administrative levels** — an ordered list of named levels, each a free
  string label + value. No `barangay`, `municipality`, `city`, `province`
  columns.

```typescript
interface TypedPlace {
  country: string;                 // ISO 3166-1 alpha-2
  adminLevels: ReadonlyArray<{ label: string; value: string }>;
}
```

This means:

- Philippines: `[{label:"Region",...},{label:"Province",...},{label:"Municipality",...},{label:"Barangay",...}]`
- USA: `[{label:"State",...},{label:"County",...},{label:"City",...}]`
- Singapore: `[{label:"District",...}]`

A new country is data, not a schema change. The ordered levels preserve
hierarchy without naming it in the schema.

## Where geography applies

- **Organization locations** — an Organization (club, school, LGU, venue
  operator) has a `TypedPlace` address (future field).
- **Event venues** — a venue (an Organization of kind `venue_operator`) has a
  location. Event-to-venue assignment is future.
- **Person residency** — relevant for eligibility (future). Stored as
  `TypedPlace` on Person (future field), not as hard-coded columns.
- **Eligibility rules** — residency-based eligibility evaluates against
  `TypedPlace` using the country + level labels, not bespoke PH logic.

## Currency: no hard-coded PHP (R13)

`Money` carries an ISO 4217 `currency` code and integer minor units. See
`commerce-model.md`. The platform may default to PHP in Tenant PH and USD in
a future US tenant; the model is currency-agnostic. A future Tenant-settings
aggregate may hold a default currency per tenant.

## Localization assumptions

- **Default locale:** English (`en`) for Sprint 1 UI, with the architecture
  ready for `en-PH` and other locales.
- **UI strings** will be externalized (future i18n). Not built this sprint;
  the shell uses English.
- **Date/time** is stored as ISO-8601 UTC (`ISODateString`). Display
  formatting is a presentation concern, using the user's locale/timezone.
- **Names** are stored as `displayName` (free string) to respect naming
  conventions across cultures. No forced first/last split.
- **Phone numbers** (future) stored in E.164 format, not PH-specific.

## What is explicitly avoided

- No `region_code`, `province_code` PH-only columns.
- No assumption that admin level 1 is "region" (it differs by country).
- No hard-coded currency symbol or decimal placement (currency-driven).
- No hard-coded date format (locale-driven in presentation).

## Future: country-specific reference data

A future Tenant-settings/context may hold country-specific admin level
templates (the canonical labels for each country) to power UI dropdowns. This
is configuration, not domain logic, and lives at the application/adapter
boundary.

# Organizer interface foundation

SportsOS uses an **event-control editorial** direction: competition information reads like a well-composed event program, while operational state remains direct and utilitarian. Ink navy anchors navigation and active competition surfaces, warm paper reduces dashboard sterility, and signal orange is reserved for focus, movement, and SportsOS identity. Status always combines language, shape, and color.

Barlow Condensed gives headings and competition numbers an athletic cadence without implying a particular sport. Manrope supports compact operational text and structural identifiers. The type scale deliberately avoids marketing-sized headings inside the workspace.

The spacing system follows a compact 4/8 rhythm with 14–18px surface radii. Desktop uses a persistent 244px organization sidebar and an asymmetric content grid. Tablet removes the sidebar; phones add a purpose-built bottom navigation and compact organization bar. Workspace tabs and the bracket scroll locally on narrow screens, preventing page-level horizontal overflow.

The bracket renders application-provided stages, contests, participant positions, results, and progression labels. It does not calculate progression or create participants. Empty participant positions are presented as striped “Bye” slots with “No entry assigned”; this makes absence clear without inventing an entry. Participant identity is intentionally structural: a seed label plus an obscured entry suffix where available.

Unsupported destinations are visibly marked “Later” and disabled. Single Elimination is the only bracket format presented as available. Loading uses layout-matched skeletons; empty, forbidden, unavailable, and unsupported states use plain organizer-facing language without persistence details.

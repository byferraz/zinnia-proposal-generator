---
version: 1
slug: "app-proposal-page-tsx"
primary_target: "app/proposal/page.tsx"
related_targets: []
---

# Proposal print output (A4)

Scope: the printable proposal built by `buildPrintHTML()` in app/proposal/page.tsx (HTML download + PDF via browser print). Mode: Read.
Audience: senior decision makers at asset/wealth-management firms who print on A4. Job: understand scope, timing and investment, then decide.
Constraints: A4 paginated, prints on office printers, light ground; compact header on page 1 (no cover); no duplicated section titles; fee prominent; AI content varies in length.

## Direction contract
THESIS: The proposal is an investment memo a wealth-management principal would sign: a ruled header table, numbered phases, the investment stated on page one. Refuses the agency brochure with full-bleed navy bars.
OWN-WORLD: White A4 sheet, navy #1B2035 ink, hairline rules #E3E6EE, one navy row carrying the investment in lime #DFF266, blue-soft #D1E2F4 duration tags, lime highlighter under the prospect name. Space Grotesk headings and numerals, Geist body.
STORY: Reader sees who it is for and what it costs in the first glance, then reads each phase with its timing, additional services, the fee schedule and Zinnia's closing note.
FIRST VIEWPORT: Logo left, "Estrictamente confidencial" right; title "Propuesta de servicios para <prospect>" with highlighted name; 5-row ruled table (Preparado para, Preparado por, Fecha, Servicios chips, navy Inversión row); then section 01 with large numeral in a 150px left gutter.
FORM: Investment memo, dealt lead of the surface roll (position 6 of 7). seed:c350d3eb4d662ee3
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

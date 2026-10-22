# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Operator:** Leo (Zinnia Group, leonardo@zinniagroup.io) fills a short form about a prospect, lets the app draft the proposal, edits it inline, and exports it.
- **Reader:** decision makers at the prospect firm (asset & wealth managers, multi-family offices, advisory and capital firms; principals, often senior). Most of them print documents and read on paper.

## Product Purpose
Internal tool that turns a prospect's website plus a few form choices into a tailored Zinnia Group commercial proposal (phases, additional services, fee structure, closing note), in Spanish or English, saved to a per-client history. Success: a proposal Leo can send the same day that reads as a premium Zinnia document on screen and prints cleanly on A4.

## Positioning
Zinnia Group is a strategic marketing partner specialised in asset and wealth management (brand strategy alignment, LinkedIn positioning, executive positioning, media, AI visibility). The proposal is a sales document from that firm, not a generic agency quote.

## Operating Context
- Export paths: HTML download, PDF via the browser print dialog ("Guardar como PDF"; confirmed 2026-10-22 to keep the print dialog rather than server-side PDF), and Word (.docx).
- Output must paginate on A4 and print well on office printers.
- Content is AI-generated per prospect, so section lengths vary; layout must survive long and short proposals.

## Capabilities and Constraints
- Next.js app on Vercel (project `zinniaproposal`), Supabase history, Claude API for generation.
- Sections: Phase 1 (brand strategy alignment), Phase 2 (LinkedIn positioning), additional services, fee structure, closing note.
- Confirmed 2026-10-22: compact header on page 1 (no separate cover page); remove duplicated section titles; make the fee/investment block more prominent.

## Brand Commitments
- Zinnia brand: navy #1B2035, lime #DFF266, blue-soft #D1E2F4; Space Grotesk (headlines) + Geist (body). Logo files in `public/` (`zinnia-logo-dark.svg`, `zinnia-logo-white.svg`).
- Zinnia's own printed/landscape documents (`~/Downloads/BookletZinnia.pdf`, `1. ZINNIA GROUP - PLANES [ESP]_compressed.pdf`) are the brand reference: light pages, navy text, lime and navy information blocks, small tracked labels, thin footer rule with "Strictly Confidential".
- Zinnia isotipo only as logo, never as decorative watermark.

## Evidence on Hand
- Real proposals produced by the app: `~/Downloads/Zinnia — Lantia Capital.pdf`, `zinnia-proposal-balqis-capital.*`, `zinnia-proposal-seven-stars.html`.
- No invented stats, clients, or claims may be added to proposals; all fee figures come from the form/AI output Leo approves.

## Product Principles
1. The printed page is the primary reading surface.
2. The fee and scope must be scannable in seconds by a senior reader.
3. Everything in the proposal comes from Leo's input or approved generation; the template never adds claims.

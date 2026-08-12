# Review & Refinement — ID Card Studio

The engine layers (sizes, orientation, designer, background, PDF, verification) are complete and the codebase typechecks clean. The gaps are all on the card **operations** side: the ID Cards list is read-only, so nothing you design can actually be previewed, printed or exported from there, and bulk issuing is still one-by-one.

## What to finish

### 1. ID Cards list becomes a working console
- Row actions: Preview, Print, Export PDF, Block / Unblock, Reissue.
- Filters for status (Active, Expired, Blocked, Draft) and template, alongside the existing search.
- Multi-select checkboxes with a selection toolbar (batch print / batch PDF).

### 2. Card preview & print dialog
- Opens a live front/back preview at true physical scale using the shared renderer, honouring the card's stored orientation and template version.
- Buttons: Browser print (exact mm page size, no scaling) and Download PDF (front + optional back).
- Every print or export writes a print-history entry.

### 3. Batch A4 sheet dialog
- Choose paper (A4 / A3), paper orientation, margins, gap, crop marks and bleed.
- Live count of cards per sheet and total sheets, then export the imposed PDF.

### 4. CSV import for bulk generation
- Upload CSV, map columns to card fields, preview the first rows with validation errors flagged.
- Choose template + card size, then generate all cards with automatic sequential numbering, showing a success/failure summary.

### 5. Status lifecycle & roles
- Block / unblock / reissue actions persisted with reason and timestamp; expiry auto-derives status.
- Hide destructive actions from Viewer/Operator where the existing role model says they shouldn't have them.

## Technical notes
- Reuse `CardRenderer`, `exportCardPdf`, `exportSheetPdf`, `sheet.ts` and `status.ts` as-is — no new rendering path.
- Card actions go through new helpers in `src/services/db.ts` (`updateCardStatus`, `createCardsBulk`) plus `logPrint`.
- CSV parsing uses the already-installed `papaparse`; import runs client-side against Supabase with RLS.
- Preview/print/batch dialogs live in `src/components/cards/` so the create flow can reuse them.
- New pages get their own `head()` metadata; typecheck and production build run at the end.

## Not included
No schema changes are expected beyond optional status-reason columns; if blocking needs a reason field, that migration will be raised separately for approval.

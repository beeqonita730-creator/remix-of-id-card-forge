# Remix of ID Card Forge

MASTER PROMPT

AUTOMATIC ID CARD DESIGN & PRINTING PLATFORM

Build a production-ready web application for creating, designing, importing, generating, and printing ID Cards automatically.

Application name:

ID CARD STUDIO

Core concept:

Upload or design a template → define card size → create/import biodata → upload photo → automatically populate template → preview → print/export PDF.

The application must function as a real ID Card production system, not merely a CRUD application or static UI mockup.

1. CORE PRODUCT CONCEPT

The system must separate three independent concepts:

A. PERSON DATA

Contains:

Full Name

ID Number

NIK / Identification Number

Birth Place

Birth Date

Gender

Address

Phone

Email

Organization

Department

Position

Membership Number

Issue Date

Expiry Date

Photo

Other custom fields

B. DESIGN TEMPLATE

Defines:

Background

Logo

Photo area

Text fields

QR Code

Barcode

Shapes

Lines

Icons

Images

Typography

Colors

Front side

Back side

Field positions

Field sizes

Field formatting

Visibility rules

C. CARD SIZE / PRINT FORMAT

Defines the physical dimensions of the card.

A template must NOT be permanently locked to one card size.

The system must allow the user to select a card size independently.

2. SUPPORTED CARD SIZES

Create a centralized Card Size Library.

Every card size must store:

name

code

width_mm

height_mm

orientation

description

category

active

Initial predefined sizes:

ISO STANDARD — CR80

Code:

CR80

Width:

85.6 mm

Height:

54 mm

Equivalent:

8.56 cm × 5.4 cm

Category:

Standard ID Card

EVENT CARD — B1

Code:

B1

Width:

102 mm

Height:

65 mm

Equivalent:

10.2 cm × 6.5 cm

Category:

Event / Committee Card

EVENT CARD — B2

Code:

B2

Width:

105 mm

Height:

70 mm

Equivalent:

10.5 cm × 7 cm

Category:

Event / Committee Card

JUMBO ID — JUMBO-90

Code:

JUMBO-90

Width:

90 mm

Height:

54 mm

Equivalent:

9 cm × 5.4 cm

Category:

Large ID Card

ID-2

Code:

ID2

Width:

105 mm

Height:

74 mm

Equivalent:

10.5 cm × 7.4 cm

Category:

Large ID Card

3. CUSTOM CARD SIZE

Users must also be able to create custom sizes.

Fields:

Name

Width

Height

Unit

mm

cm

inch

Orientation

The application must internally normalize all dimensions into millimeters.

Example:

100 mm × 70 mm

must be stored as:

width_mm = 100
height_mm = 70


Never use screen pixels as the authoritative physical measurement.

4. CARD SIZE LIBRARY UI

Create:

/card-sizes

Display:

NameCodeWidthHeightCategoryStatusISO CR80CR8085.6 mm54 mmStandardActiveEvent B1B1102 mm65 mmEventActiveEvent B2B2105 mm70 mmEventActiveJumboJUMBO-9090 mm54 mmLargeActiveID-2ID2105 mm74 mmLargeActive

Actions:

Edit

Duplicate

Delete

Set Default

5. TEMPLATE SYSTEM

Create a professional template management system.

Route:

/templates

Functions:

Create Template

Upload Template

Edit Template

Duplicate Template

Preview Template

Activate / Deactivate

Delete Template

Templates must support:

Front side

Back side

Portrait

Landscape

Transparent elements

Background image

Background color

Logo

Photo

Text

QR Code

Barcode

Shapes

Lines

Icons

6. TEMPLATE IMPORT

Users must be able to upload an existing design/template.

Support:

PNG

JPG

JPEG

SVG

PDF where technically feasible

When uploading a template, ask:

TEMPLATE IMPORT

Name:

________________

Card Size:

[ CR80 ▼ ]

Side:

[ Front ▼ ]

Orientation:

[ Landscape ▼ ]

Then store the uploaded design as the template background.

Important:

An uploaded template must remain editable by overlaying dynamic elements.

For example:

UPLOADED TEMPLATE
        +
Dynamic Name
        +
Dynamic Photo
        +
Dynamic Position
        +
Dynamic ID
        +
Dynamic QR


7. VISUAL TEMPLATE DESIGNER

Build a visual drag-and-drop ID Card Designer.

Route:

/designer/:templateId

The designer should behave like a lightweight Canva/Figma-style editor specifically optimized for ID Cards.

Canvas must use real physical dimensions.

Example:

CR80:

85.6 mm × 54 mm

Do NOT use arbitrary canvas dimensions as the source of truth.

8. DESIGNER ELEMENTS

Provide an element toolbar.

Elements:

TEXT

Static Text

Dynamic Text

Dynamic fields:

{{full_name}}

{{id_number}}

{{nik}}

{{birth_place}}

{{birth_date}}

{{gender}}

{{address}}

{{phone}}

{{email}}

{{organization}}

{{department}}

{{position}}

{{membership_number}}

{{issue_date}}

{{expiry_date}}

IMAGE

Logo

Photo

Signature

Background

Custom Image

CODE

QR Code

Barcode

SHAPES

Rectangle

Rounded Rectangle

Circle

Line

Divider

OTHER

Icon

Badge

Decorative Element

9. DRAG AND DROP

Every element must be:

draggable

resizable

rotatable

duplicable

deletable

Support:

X position

Y position

Width

Height

Rotation

Opacity

Layer order

Use physical units internally.

Example:

x = 12.5 mm
y = 8.2 mm
width = 45 mm
height = 8 mm


10. TEXT CONFIGURATION

For every text element support:

Font family

Font size

Font weight

Alignment

Letter spacing

Line height

Color

Uppercase

Lowercase

Text transform

Overflow behavior

Support automatic text fitting.

For example:

If a person's name is very long:

MUHAMMAD ABDUL RAHMAN AL FARUQ

the system must automatically reduce font size or adjust the text according to configured rules.

11. PHOTO ELEMENT

The designer must allow a photo placeholder.

Properties:

X

Y

Width

Height

Border radius

Border

Object fit

Object position

Support:

square

portrait

circle

rounded rectangle

When a user uploads a person's photo, the system automatically inserts it into this placeholder.

12. QR CODE ELEMENT

Allow QR Code to be placed anywhere on the card.

QR content should support dynamic values.

Recommended:

https://DOMAIN/verify/{{qr_token}}


QR must be generated automatically for every ID Card.

Do not place sensitive personal information directly into the QR URL.

13. FRONT AND BACK DESIGN

Every template can have:

FRONT

Main identity information.

BACK

Additional information such as:

Organization information

Contact

Address

Rules

Emergency information

Verification instruction

QR Code

Signature

Designer must allow switching between:

FRONT | BACK

14. TEMPLATE VARIABLES

Create a Dynamic Field Library.

Example:

PERSON

{{full_name}}
{{id_number}}
{{nik}}
{{birth_place}}
{{birth_date}}
{{gender}}
{{address}}
{{phone}}
{{email}}

ORGANIZATION

{{organization}}
{{department}}
{{position}}
{{membership_number}}

CARD

{{issue_date}}
{{expiry_date}}
{{status}}

SYSTEM

{{qr_token}}
{{verification_url}}
{{generated_date}}


The user can drag a variable from the field library onto the canvas.

15. DATA ENTRY

Create:

/id-cards/create

The workflow must be extremely simple.

Step 1:

SELECT TEMPLATE

Step 2:

SELECT CARD SIZE

Step 3:

ENTER DATA

Step 4:

UPLOAD PHOTO

Step 5:

PREVIEW

Step 6:

GENERATE

Step 7:

PRINT / PDF

16. PERSON DATA FORM

Required:

Full Name

Organization

Position

Photo

Issue Date

Expiry Date

Optional:

ID Number

NIK

Birth Place

Birth Date

Gender

Address

Phone

Email

Department

Membership Number

Allow administrators to define additional custom fields.

17. AUTOMATIC ID NUMBER

Automatically generate a unique ID Card Number.

Default:

ORG-YYYY-000001


Example:

GDM-2026-000001


Prefix must be configurable.

Sequence must be database-controlled.

Never generate IDs using only frontend state.

18. LIVE PREVIEW

As soon as the operator enters data:

The card preview must update immediately.

Example:

{{full_name}}


becomes:

MUHAMMAD ILYAS


And:

{{position}}


becomes:

OFFICIAL


And:

{{photo}}


becomes the uploaded photograph.

The preview must visually match the final print/PDF output.

19. PHOTO UPLOAD

Support:

JPG

JPEG

PNG

WEBP

Maximum file size configurable.

Provide:

Crop

Zoom

Rotate

Position

Preview

Compression

Automatically optimize the image for print without unnecessarily reducing quality.

20. PRINT SYSTEM

Printing must be based on physical dimensions.

Example:

CR80:

85.6 mm × 54 mm


B1:

102 mm × 65 mm


B2:

105 mm × 70 mm


Jumbo:

90 mm × 54 mm


ID-2:

105 mm × 74 mm


The print engine must preserve the selected physical dimensions.

Never stretch the design.

Never distort the aspect ratio.

21. PRINT OPTIONS

Create:

PRINT SINGLE CARD

Print exactly one card.

PRINT FRONT + BACK

Generate front and back.

PRINT MULTIPLE CARDS

Select multiple cards.

PRINT SHEET

Automatically arrange cards on:

A4

A3

Letter

Custom paper

22. A4 SHEET LAYOUT ENGINE

The application must automatically calculate how many cards fit on an A4 sheet.

A4:

210 mm × 297 mm


Allow configuration:

Paper orientation

Top margin

Bottom margin

Left margin

Right margin

Horizontal gap

Vertical gap

Calculate:

columns
rows
total cards
used area
remaining area


Do not allow cards to overlap.

Do not scale cards unexpectedly.

23. PRINT CUTTING GUIDES

Optional print settings:

Crop marks

Cut marks

Bleed

Safe area

Card border

Allow:

Show Crop Marks

Show Bleed

Show Safe Area

24. BLEED

Allow templates to define bleed.

Default:

3 mm

The application must distinguish:

SAFE AREA

Important content must remain inside.

TRIM AREA

Final physical card size.

BLEED AREA

Background/design may extend beyond trim.

Display these guides in the designer.

25. PDF EXPORT

Provide:

PDF Single Card

PDF Front/Back

PDF Batch

PDF A4 Sheet

PDF must preserve physical dimensions.

Do not create a PDF that merely embeds a screenshot at an arbitrary size.

26. CARD DATABASE

Create:

id_cards

Fields:

id

organization_id

template_id

card_size_id

card_number

full_name

identification_number

birth_place

birth_date

gender

address

phone

email

organization

department

position

membership_number

issue_date

expiry_date

photo_url

qr_token

status

created_by

created_at

updated_at

27. TEMPLATE DATABASE

Create:

card_templates

Fields:

id

organization_id

name

description

card_size_id

orientation

front_design

back_design

thumbnail_url

background_url

version

active

created_at

updated_at

Store the design structure as structured JSON where appropriate.

Do not store the entire design only as a flattened image.

28. CARD SIZE DATABASE

Create:

card_sizes

Fields:

id

organization_id

name

code

width_mm

height_mm

orientation

category

description

is_system_default

active

created_at

updated_at

System defaults:

CR80
B1
B2
JUMBO-90
ID2

29. TEMPLATE VERSIONING

Templates must support versions.

Example:

Template:
SPORT OFFICIAL

Version 1
Version 2
Version 3


When a template is changed, existing generated cards should not unexpectedly change.

Store the template version used when generating a card.

30. GENERATED CARD SNAPSHOT

When an ID Card is finalized, store a rendering snapshot/reference.

This ensures:

If the template changes tomorrow,

old cards remain reproducible exactly as they were generated.

31. BATCH DATA IMPORT

Add optional CSV/Excel import.

Operator can upload:

Name
ID
Position
Organization
Birth Date
Phone
...


System should validate the data before import.

Display:

valid rows

invalid rows

duplicate rows

missing fields

Then:

IMPORT

This allows hundreds of cards to be generated efficiently.

32. BATCH PHOTO MATCHING

Support optional automatic photo matching.

Example filenames:

001.jpg
002.jpg
003.jpg


If the CSV contains:

ID = 001


automatically associate:

001.jpg


with that person.

Also support:

NIK.jpg
IDCARD.jpg
membership_number.jpg


according to configured matching rules.

33. QR VERIFICATION

Every active card should have a secure verification URL:

/verify/{token}


Verification states:

ACTIVE

✓ VERIFIED

EXPIRED

⚠ EXPIRED

BLOCKED

✕ BLOCKED

INVALID

✕ INVALID CARD

Do not expose unnecessary sensitive data.

34. CARD STATUS

Statuses:

DRAFT

ACTIVE

EXPIRED

BLOCKED

CANCELLED

Automatically mark cards as expired when:

current_date > expiry_date


Do not rely only on frontend status.

35. DESIGNER USER EXPERIENCE

Designer layout:

┌─────────────────────────────────────────────────────────┐
│ Toolbar                                                  │
├──────────────┬──────────────────────────┬───────────────┤
│ ELEMENTS     │                          │ PROPERTIES    │
│              │                          │               │
│ Text         │                          │ X             │
│ Image        │       ID CARD            │ Y             │
│ Photo        │       CANVAS             │ Width         │
│ QR Code      │                          │ Height        │
│ Barcode      │                          │ Font          │
│ Shape        │                          │ Color         │
│ Line         │                          │ Rotation      │
│ Icon         │                          │ Layer         │
│              │                          │               │
└──────────────┴──────────────────────────┴───────────────┘


36. DESIGNER TOOLS

Toolbar:

Select

Text

Image

Photo

QR

Barcode

Shape

Line

Undo

Redo

Duplicate

Delete

Bring Forward

Send Backward

Zoom

Grid

Snap

Safe Area

Bleed

Preview

37. GRID AND SNAP

Provide:

Grid

Snap to grid

Alignment guides

Center alignment

Horizontal alignment

Vertical alignment

Equal spacing

This is important for accurate ID Card production.

38. MEASUREMENT

Show rulers in:

mm

Example:

0      10      20      30      40      50      60      70      80 mm


Users should be able to position elements accurately.

39. ORGANIZATION

Support multiple organizations.

Each organization has:

logo

name

address

contact

templates

card sizes

ID prefix

users

cards

Enforce organization-level data isolation.

40. AUTHENTICATION

Implement:

Login

Logout

Password reset

Protected routes

Roles:

ADMIN

Full access.

DESIGNER

Can create/edit templates.

OPERATOR

Can create cards and print.

VIEWER

Can view and verify.

41. SECURITY

Implement:

Supabase Auth

PostgreSQL RLS

Organization-scoped access

Role-based authorization

Secure Storage policies

Input validation

File validation

Secure QR token

Server-side authorization

Never trust frontend role checks alone.

42. STORAGE

Create storage buckets:

organization-assets
template-assets
card-photos
generated-documents


Use secure policies.

43. DASHBOARD

Dashboard statistics:

Total Cards

Active Cards

Expired Cards

Blocked Cards

Templates

Card Sizes

Cards Generated Today

Cards Printed Today

Quick actions:

CREATE ID CARD

DESIGN TEMPLATE

UPLOAD TEMPLATE

BATCH IMPORT

PRINT QUEUE

44. CARD LIST

Route:

/id-cards

Columns:

Photo

Card Number

Name

Organization

Position

Card Size

Template

Status

Expiry

Actions

Actions:

View

Edit

Duplicate

Preview

Print

PDF

Reprint

Block

Delete

45. TEMPLATE LIBRARY

Template cards should display:

Thumbnail

Template name

Size

Orientation

Version

Status

Actions:

DESIGN

DUPLICATE

PREVIEW

USE TEMPLATE

46. PRINT HISTORY

Record:

Card

User

Date

Time

Print type

Template version

Card size

Printer workflow

Print types:

ORIGINAL

REPRINT

BATCH

47. DESIGN SYSTEM

Use a professional application UI.

Prefer:

dark navy / neutral interface

clean white canvas

strong visual hierarchy

modern cards

compact professional toolbar

responsive layout

The designer canvas should visually resemble a professional design application.

48. RESPONSIVE DESIGN

Dashboard:

Desktop-first.

Designer:

Desktop optimized.

Mobile:

Allow viewing and basic management, but clearly prioritize desktop for template design and printing.

49. PERFORMANCE

Optimize:

image loading

template rendering

PDF generation

batch operations

large datasets

Use pagination.

Use lazy loading where appropriate.

Avoid unnecessary re-renders in the designer.

50. ARCHITECTURE

Use:

UI
 ↓
Application Services
 ↓
Repositories
 ↓
Supabase
 ↓
PostgreSQL / Storage


Separate:

UI

business logic

rendering engine

database

storage

print engine

PDF engine

verification

Do not place all logic inside React components.

51. IMPORTANT RENDERING PRINCIPLE

The same design definition must be usable by:

Designer Preview

Card Preview

Browser Print

PDF Export

Avoid implementing four independent rendering systems.

There must be a single source of truth for:

position

size

typography

image

QR

layers

dimensions

This is critical for print accuracy.

52. PRINT ACCURACY

The selected physical card dimensions are authoritative.

Example:

If user selects:

CR80

the output must be:

85.6 mm × 54 mm


If user selects:

B1

the output must be:

102 mm × 65 mm


Do not automatically resize CR80 into B1.

If the user changes the card size, explicitly recalculate or adapt the design according to configured scaling behavior.

53. SCALE MODES

When applying an existing template to another card size, offer:

KEEP ABSOLUTE SIZE

Preserve element dimensions.

SCALE EVERYTHING

Scale the entire design proportionally.

FIT TO CARD

Scale design to fill the target card.

CUSTOM

Allow manual adjustment.

Never silently change the user's design.

54. QUALITY CONTROL

Before allowing final print, display:

PRINT CHECK

Card dimensions

Template

Front design

Back design

Photo resolution

Missing fields

Overflowing text

QR availability

Bleed

Safe area

Resolution warning

Example:

✓ Card size valid

✓ Photo valid

✓ QR generated

⚠ Name exceeds recommended width

55. EXPORT

Support:

PNG Preview

JPG Preview

PDF

Browser Print

For production print, PDF should be the preferred output.

56. ACCEPTANCE TEST

The complete system must support this workflow:

Login.

Create organization.

Create/select card size.

Upload an existing template.

Open template in designer.

Add dynamic fields.

Add photo placeholder.

Add QR code.

Save template.

Create ID Card.

Select template.

Select CR80/B1/B2/JUMBO/ID2.

Enter biodata.

Upload photo.

Preview automatically.

Generate unique card number.

Generate QR.

Save card.

Print card.

Export PDF.

Generate A4 batch sheet.

Scan QR.

Open verification page.

Block card.

Verify that QR displays BLOCKED.

Reprint card.

Verify print history.

57. INITIAL SEED DATA

Create the five system card sizes:

CR80
85.6 × 54 mm

B1
102 × 65 mm

B2
105 × 70 mm

JUMBO-90
90 × 54 mm

ID2
105 × 74 mm


Do not hard-code these values in React components.

They must be seeded into the card_sizes database table.

58. NO DEMO-DATA ARCHITECTURE

Do not import fake demo data into production components.

Production data must come from:

Supabase Database
Supabase Storage
Authenticated User
Organization Context


Seed data is allowed only for system-defined card sizes and optional initial templates.

59. IMPLEMENTATION PHASES

Implement systematically.

PHASE 1

Foundation

Authentication

Organization

Database

Storage

Navigation

Design system

PHASE 2

Card Size Engine

Card Size Library

CR80

B1

B2

JUMBO-90

ID2

Custom Size

Unit conversion

Orientation

PHASE 3

Template Management

Upload template

Template library

Template metadata

Template versions

PHASE 4

Visual Designer

Canvas

Elements

Dynamic fields

Photo

QR

Layers

Grid

Rulers

Snap

Safe area

Bleed

PHASE 5

ID Card Generator

Biodata

Photo upload

Dynamic rendering

Card number

QR

Preview

PHASE 6

Print Engine

Physical dimensions

Single print

Front/back

Batch

A4

A3

Custom paper

Crop marks

Bleed

PHASE 7

PDF Engine

Single card

Front/back

Batch PDF

A4 sheet PDF

PHASE 8

QR Verification

Secure token

Verification page

Active

Expired

Blocked

Invalid

PHASE 9

Batch Processing

CSV import

Excel import where supported

Batch generation

Photo matching

Batch print

PHASE 10

Security & QA

RLS

RBAC

Storage policies

Audit

TypeScript

Build

Print accuracy

PDF accuracy

Responsive testing

60. FINAL PRODUCT REQUIREMENT

The final application must provide this simple workflow:

                 ┌──────────────────────┐
                 │   UPLOAD TEMPLATE     │
                 └──────────┬───────────┘
                            ↓
                 ┌──────────────────────┐
                 │    DESIGN TEMPLATE   │
                 └──────────┬───────────┘
                            ↓
                 ┌──────────────────────┐
                 │    SELECT SIZE       │
                 │ CR80 / B1 / B2 /     │
                 │ JUMBO / ID2 / CUSTOM  │
                 └──────────┬───────────┘
                            ↓
                 ┌──────────────────────┐
                 │    ENTER BIODATA     │
                 └──────────┬───────────┘
                            ↓
                 ┌──────────────────────┐
                 │     UPLOAD FOTO      │
                 └──────────┬───────────┘
                            ↓
                 ┌──────────────────────┐
                 │   AUTO GENERATE      │
                 │ NAME / ID / QR / ETC │
                 └──────────┬───────────┘
                            ↓
                 ┌──────────────────────┐
                 │       PREVIEW        │
                 └──────────┬───────────┘
                            ↓
              ┌─────────────┴─────────────┐
              ↓                           ↓
        ┌───────────┐               ┌───────────┐
        │   PRINT   │               │    PDF    │
        └───────────┘               └───────────┘


The application should make the operator feel that creating an ID Card is as simple as:

SELECT TEMPLATE → SELECT SIZE → ENTER DATA → UPLOAD PHOTO → PRINT

The system must handle the complexity automatically.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/05e825f0-91b6-438b-907d-cdf15eaf35e6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

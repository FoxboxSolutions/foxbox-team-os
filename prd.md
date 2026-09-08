# FOXBOX CALCULATOR — Product Requirements Document

**Version:** 1.0  
**Status:** Draft / Ready for validation  
**Product:** Foxbox Calculator  
**Brand:** Foxbox Solutions  
**Primary market:** COD e-commerce, with initial focus on Algeria  
**Primary currency workflow:** RMB → USD → DZD

---

## 1. Product Vision

Foxbox Calculator is a premium product research, economics, and decision platform designed specifically for Cash-on-Delivery (COD) e-commerce.

The platform minimizes manual data entry:

> **Paste supplier link → Analyze → Import data/media → Complete missing data → Calculate → Score → Test → Decide → Purchase**

The core objective is to help an e-commerce operator determine whether a product is worth testing and/or purchasing by combining supplier information, logistics costs, COD assumptions, advertising economics, and product performance.

The interface must feel like a premium SaaS/financial intelligence product, not an Excel spreadsheet.

---

## 2. Core Principles

1. **Link-first workflow**
   - The primary product input is a supplier/product URL, especially a 1688 product URL.
   - The system should automatically extract available product information.
   - Manual entry is only required when information is unavailable or needs correction.

2. **Automation with human override**
   - Automatically extracted values remain editable.
   - Missing values can be entered manually.
   - Manual values must not be silently overwritten by future re-analysis.

3. **RMB as supplier source currency**
   - Supplier product prices are stored in RMB/CNY.
   - USD and DZD are calculated/display currencies.

4. **COD-first economics**
   - Profitability must account for COD-specific costs and rates rather than simple product markup.

5. **Decision-oriented UX**
   - The platform must make it easy to answer:
     - Is this product worth testing?
     - Is the test profitable?
     - Should I buy it?
     - How much capital is required?
     - What is the maximum acceptable CPA?

6. **Premium Foxbox design**
   - Luxury black + gold visual language.
   - Minimal, sophisticated, highly readable.
   - Gold is an accent, not an overwhelming background color.

---

# 3. Users

## Primary User

E-commerce operator/product tester running COD campaigns.

Typical workflow:

- Finds products on 1688/China suppliers.
- Adds products to a research pipeline.
- Tests creatives and offers.
- Runs Meta/other ads.
- Tracks COD order performance.
- Decides whether to reject, keep testing, approve for purchase, or scale.

---

# 4. Product Lifecycle

Products move through a configurable lifecycle:

```text
IDEA
  ↓
RESEARCH
  ↓
STANDBY
  ↓
TESTING
  ↓
APPROVED
  ↓
PURCHASE
  ↓
SCALING

A product may also move to:

REJECTED
Required statuses
IDEA
RESEARCH
STANDBY
TESTING
APPROVED
PURCHASE
SCALING
REJECTED

Status changes must be recorded in a history log.

5. Product Creation
5.1 Minimal Input

Primary field:

1688 Product URL

Example:

https://detail.1688.com/offer/1077486081466.html

Primary action:

ANALYZE PRODUCT

Optional fields at creation:

Internal product name
Notes
Tags
Category
Initial status

The system should not force the user to fill every product field before analysis.

6. Supplier/Product URL Analysis
6.1 Automatic extraction

For supported supplier pages, the system should attempt to retrieve:

Product identity
Product name
Product title
Supplier/platform
Product URL
Product ID / offer ID
Category
Description
Pricing
Current supplier price
Price ranges
MOQ
Quantity breaks
Variant-specific pricing where available
Variants
Colors
Sizes
Models
SKUs
Variant images
Variant prices
Logistics
Unit weight
Package weight
Product dimensions
Package dimensions
Carton information
Quantity per carton
Supplier information
Supplier/store name
Supplier URL
Rating where available
Transaction/order indicators where available
Years/platform information where available
Media
Main product images
Additional product images
Product videos where technically accessible
6.2 Extraction confidence/source

Every extracted field should have a source state:

AUTO — directly extracted
MANUAL — entered/overridden by user
ESTIMATED — system-generated estimate
MISSING — unavailable

Example:

Weight
180 g
AUTO

If missing:

Weight
Missing
MISSING

[ Enter manually ]

If user enters:

Weight
180 g
MANUAL
6.3 Manual override rule

A manual value must never be silently overwritten by a future scrape/re-analysis.

Example:

Original:

1688 weight = 150g

User changes it to:

180g

The system stores:

Source value: 150g
Current value: 180g
Source: MANUAL

If the page is analyzed again, the system must preserve 180g unless the user explicitly chooses to replace it.

7. Creative Import

The user can attach creatives by simply pasting URLs.

Supported intended inputs:

Image URL
Video URL
Product media URL
Public media file URL

Workflow:

Paste URL
   ↓
Validate URL
   ↓
Download media
   ↓
Store media
   ↓
Generate thumbnail/metadata
   ↓
Attach to product

Each creative should store:

Type
Source URL
Stored asset URL
Thumbnail
Filename
Dimensions
Duration for video
File size
Date imported
Product association

Creative statuses:

IMPORTED
FAILED
MISSING

If download fails, the original URL must remain available for retry.

8. Product Detail Page

The product detail page is the central workspace.

Header

Display:

Product image
Product name
Supplier
Source link
Current lifecycle status
Product score
Last analyzed date

Actions:

Re-analyze
Edit
Duplicate
Add creative
Change status
Archive
Sections
A. Product Overview
Main image
Gallery
Video
Product information
Variants
B. Supplier Data
1688 URL
Supplier
Supplier metrics
MOQ
Price
Variant pricing
C. Logistics
Weight
Package dimensions
Carton quantity
Shipping profile
Shipping rate
D. Cost Calculator
Purchase quantity
Product cost
Shipping
Other costs
Landed cost
Unit landed cost
E. COD Economics
Selling price
Customer delivery fee
Advertising cost / CPA
Confirmation cost
Delivery rate
Return rate
Return cost
Other COD costs
F. Product Score

Score from 0–100 with category breakdown.

G. Decision
Approve
Standby
Reject
Testing
Scaling
H. Notes

Free-form operator notes.

I. Decision History

Every important status/decision change with:

Date/time
Previous status
New status
Optional reason
User
9. Currency System
9.1 Base supplier currency

Supplier prices are always stored in:

RMB / CNY / ¥

9.2 Initial working exchange rates

The product specification uses:

1 RMB = 0.15 USD
1 USD = 260 DZD

Therefore:

1 RMB = 39 DZD

These are initial configurable business rates, not immutable market rates.

9.3 Settings

Admin/user can configure:

RMB → USD
0.15

USD → DZD
260

RMB → DZD
AUTO

The system should calculate cross-rates automatically.

9.4 Display

Product cost should be viewable as:

¥22.00 RMB
$3.30 USD
858 DA

The underlying supplier price remains RMB.

10. Shipping Profiles

Shipping should be configurable independently from products.

Example:

Profile: China → Algeria Air Cargo

Rate:
$9.40 / KG

Minimum charge:
1 KG

Estimated transit:
7–10 days

A product can select a shipping profile.

The system then calculates shipping automatically from product weight and purchase quantity.

Example:

Unit weight = 180g
Quantity = 100

Total weight = 18 KG

Shipping = 18 × $9.40
         = $169.20

If package/carton rules apply, the shipping engine should support:

Per KG
Minimum chargeable weight
Volumetric weight
Per carton
Fixed fee
Other configurable rules
11. Product Cost Calculator
Inputs
Supplier
Unit price in RMB
Purchase quantity
MOQ
Logistics
Unit weight
Package weight
Dimensions
Shipping profile
Shipping rate
Other costs
Packaging
Customs/tax placeholder
Agent fees
Payment fees
Other import costs
Outputs
Product subtotal
Shipping cost
Other costs
Total investment
Landed cost / unit
Landed cost in RMB
Landed cost in USD
Landed cost in DZD

Example:

Product cost
¥2,200

International shipping
$169.20

Other costs
$20

TOTAL INVESTMENT
$539.20

Landed cost / PCS
≈ calculated automatically
12. COD Economics Calculator

This is a core feature.

Inputs
Selling price
Customer delivery fee
Advertising CPA
Confirmation cost
Expected confirmation rate
Expected delivery rate
Expected return rate
Return cost
Fulfillment cost
Other costs
Outputs
Gross margin
Expected cost/order
Expected delivered revenue
Expected profit
Profit per successful delivery
Profit per acquired order
ROI
ROAS
Break-even CPA
Maximum acceptable CPA
Required selling price
Minimum viable selling price

The calculation engine must clearly distinguish between:

Per placed order
Per confirmed order
Per shipped order
Per delivered order
Expected economic outcome

The UI must show assumptions used in the projection.

Example:

Delivery rate: 75%
Return rate: 25%
CPA: 700 DA

The platform must label these numbers as assumptions/projections, not guaranteed results.

13. Offers / Quantity Pricing

A product can contain multiple commercial offers.

Example:

Offer 1
1 PCS
4,500 DA

Offer 2
2 PCS
7,500 DA

Offer 3
3 PCS
9,900 DA

For each offer calculate:

Revenue
Product cost
Shipping impact
COD costs
Estimated profit
Margin
ROI

The platform should identify:

Most profitable offer

and optionally:

Best perceived-value offer

14. Product Score

Score range:

0–100

Initial scoring dimensions:

Profitability — 30%
Margin
Landed cost
Break-even CPA
Expected profit
COD Potential — 25%
Weight
Return risk
Confirmation friendliness
Product simplicity
Market Potential — 20%
Perceived value
Problem/benefit
Impulse-buy potential
Audience potential
Competition — 15%
Competitive pressure
Product saturation indicators where available
Logistics — 10%
Weight
Volume
Shipping complexity
Fragility

The scoring weights must be configurable later.

Output:

91 / 100

EXCELLENT POTENTIAL

The score should be explainable and show the reasons behind it.

15. AI Product Analysis

The system may generate an analysis from the collected product information.

Possible outputs:

Product summary
Main selling angles
Potential customer profile
Product strengths
Product risks
COD-specific risks
Logistics risks
Recommended selling price range
Recommended test approach
Recommendation

Example:

RECOMMENDED FOR TEST

Reasons:
- Lightweight
- Low landed cost
- Strong visual potential
- Multiple use cases
- High perceived value

Risks:
- Electronics return/defect risk
- Competitive category

AI recommendations must be labeled as analysis/estimates, not guarantees.

16. Testing Module

For products in TESTING, track:

Ad spend
Impressions
Clicks
CTR
CPC
Landing page visits
Orders
Confirmed orders
Shipped orders
Delivered orders
Returned orders
Revenue
CPA
ROAS
Net profit

COD funnel:

Clicks
 ↓
Orders
 ↓
Confirmed
 ↓
Shipped
 ↓
Delivered
 ↓
Successful

The system should calculate conversion rates between each stage.

17. Product Performance

For each product:

Advertising
Spend
CPA
CTR
CPC
CPM
ROAS
COD
Orders
Confirmation rate
Delivery rate
Return rate
Financial
Revenue
Product cost
Shipping
Advertising cost
COD costs
Net profit
Profit/order

Support date ranges for performance analysis.

18. Purchase Queue

When a product is approved, it can be added to a purchase queue.

Display:

Product
Supplier
Quantity
Unit price
Shipping
Other costs
Total investment
Currency values

Aggregate:

Total required capital

in:

RMB
USD
DZD

The user should be able to mark:

Planned
Ordered
Partially received
Received
Cancelled
19. Supplier Management

Supplier records can contain:

Supplier name
Platform
Supplier URL
Contact information
Rating
Notes
Products
Historical prices
Historical purchases

Support supplier comparison for the same product.

20. Dashboard

Dashboard should provide an executive overview.

KPI cards
Total products
Testing
Approved
Standby
Rejected
Scaling
Potential profit
Total invested
Active tests
Product pipeline

Visual lifecycle:

IDEAS → RESEARCH → TESTING → APPROVED → PURCHASE → SCALING
Best product

Show:

Product
Score
Estimated profit
Status
Alerts

Examples:

Missing critical product data
Shipping cost too high
Margin below target
CPA above break-even
High return rate
Product ready for review
21. Search / Filters

Products must be searchable by:

Product name
Supplier
Category
Status
Score
Date
Price
Profit
ROI
Tags

Filters:

Approved
Testing
Standby
Rejected
Scaling
Missing data
High potential
Low margin
22. Product Table

Recommended columns:

Product
Image
Supplier
RMB Cost
Landed Cost
Selling Price
Estimated Profit
Score
Status
Last Updated

Users should be able to customize visible columns later.

23. Design System — FOXBOX LUXURY
Brand direction

Luxury Gold + Black

Design principles:

Premium
Minimal
Dark
Sophisticated
High contrast
Financial/product-intelligence feeling
Colors

Suggested base palette:

Obsidian Black
Deep Black
Dark Charcoal
Luxury Gold
Soft Gold
Off White
Muted Gray

Gold should be an accent.

Avoid excessive bright gold surfaces.

Cards

Cards should use:

Dark surfaces
Very subtle borders
Soft shadows
Subtle gold highlights
Large spacing
Premium hover transitions

Avoid generic white dashboard cards.

Icons

Use a consistent icon library such as Lucide.

Rules:

Thin/clean strokes
No emoji in the application UI
Gold for active/highlighted states
Neutral gray/white for secondary states
Buttons

Primary:

Dark/gold premium treatment
Strong hover state
Subtle glow where appropriate

Secondary:

Obsidian/transparent
Fine border

Danger:

Red should be reserved for destructive/rejection actions.

Success:

Green for approval/success.

Standby:

Orange.

Testing:

Blue.

Scaling:

Purple.
Inputs

Inputs should feel premium:

Dark background
Fine border
Strong focus state
Gold focus accent
Clear labels
Helper text where necessary
Source badge (AUTO, MANUAL, ESTIMATED)
24. Responsive Design

Primary target:

Desktop

Secondary:

Tablet

Mobile must remain usable for:

Reviewing products
Changing status
Viewing calculations
Adding notes
Checking analytics

Complex data tables can switch to cards on small screens.

25. Recommended Technical Stack

Frontend:

React
TypeScript
Vite
Tailwind CSS
shadcn/ui, heavily customized
Lucide Icons
Framer Motion

Backend:

API-based architecture
Relational database
Background job/queue system for scraping and media downloads
Object storage for images/videos

The exact backend provider is intentionally not locked in this PRD.

26. Core Data Model
Product
id
name
source_url
source_platform
source_product_id
description
category
status
score
notes
created_at
updated_at
last_analyzed_at
ProductField / extracted data
product_id
field_name
source_value
current_value
source_type
confidence
updated_at
Variant
id
product_id
name
sku
color
size
price_rmb
stock
image_url
Creative
id
product_id
type
source_url
storage_url
thumbnail_url
metadata
status
created_at
Supplier
id
name
platform
url
rating
notes
ShippingProfile
id
name
origin
destination
method
rate
rate_unit
minimum_charge
volumetric_rule
notes
CurrencyRate
id
from_currency
to_currency
rate
effective_at
source
CostScenario
product_id
quantity
purchase_cost_rmb
shipping_cost_usd
other_cost_usd
landed_cost_usd
landed_cost_dzd
CODScenario
product_id
selling_price_dzd
delivery_fee_dzd
advertising_cpa_dzd
confirmation_cost_dzd
confirmation_rate
delivery_rate
return_rate
return_cost_dzd
other_cost_dzd
Offer
id
product_id
name
quantity
selling_price_dzd
Test
id
product_id
start_date
end_date
ad_spend
impressions
clicks
orders
confirmed
shipped
delivered
returned
revenue
notes
DecisionHistory
id
product_id
old_status
new_status
reason
created_at
created_by
27. Data Integrity Rules
Supplier price must remain stored in RMB.
Currency conversion must use the configured rate snapshot relevant to the calculation.
Manual overrides must be preserved.
Every calculated financial output must be traceable to its inputs.
Calculations should show assumptions.
Re-analysis must not destroy manual corrections.
Failed scraping must not delete existing product data.
Failed media download must not remove the source URL.
Status changes must be logged.
Archived products remain recoverable.
28. Error / Missing Data UX

If analysis fails partially:

Product imported with warnings

✓ Name
✓ Images
✓ Price
✓ Variants

⚠ Weight unavailable
⚠ Package dimensions unavailable

[ COMPLETE MISSING DATA ]

The product should still be usable.

If the entire analysis fails:

Unable to analyze this URL.

Possible reasons:
- Page unavailable
- Access restricted
- Unsupported URL
- Temporary supplier issue

[ RETRY ]
[ ENTER DATA MANUALLY ]
29. Security / Reliability

The system must:

Validate external URLs.
Sanitize extracted text.
Restrict unsafe media/file types.
Protect stored credentials/secrets.
Rate-limit scraping jobs.
Use background processing for long operations.
Log scraper failures.
Prevent duplicate product imports where possible.
30. MVP Scope
Must Have
Product Research
Add product by URL
1688 analysis/extraction architecture
Product data display
Manual editing
Auto/manual/estimated/missing indicators
Manual override persistence
Media
Import image/video by URL
Download/store media
Product creative gallery
Currency
RMB base supplier price
RMB → USD
USD → DZD
Configurable rates
Calculator
Product cost
Quantity
Weight
Shipping
Other costs
Landed cost
Selling price
COD assumptions
Expected profit
ROI
Break-even CPA
Decisions
Approved
Standby
Rejected
Testing
Scaling
Decision history
UI
Luxury Foxbox dark/gold design
Dashboard
Product list
Product detail
Calculator
Settings
31. Phase 2
AI product analysis
Product score
Advanced COD analytics
Testing dashboard
Supplier comparison
Purchase queue
Offers/quantity bundles
Advanced charts
Notifications
Bulk product import
CSV import/export
32. Phase 3

Potential integrations:

YouCan
Shopify
WooCommerce
Advertising platforms
Shipping/fulfillment platforms
Supplier/order platforms

Potential automation:

Approved
   ↓
Create purchase
   ↓
Order supplier
   ↓
Receive stock
   ↓
Import product to store
   ↓
Launch test
   ↓
Track COD performance
   ↓
Scale / Reject
33. Key UX Requirement

The entire platform must optimize for speed.

The ideal first-time workflow:

1. Paste 1688 URL
2. Click Analyze
3. Review extracted data
4. Fill only missing values
5. Add creative URLs
6. Enter purchase quantity
7. Select shipping profile
8. Enter COD selling assumptions
9. Review score/profit
10. Approve / Standby / Reject

The user should never be forced to manually rebuild a product record that the system can extract automatically.

34. Success Metrics

The product is successful if it significantly reduces:

Time to evaluate one product
Manual data entry
Calculation errors
Decision-making time

And improves:

Number of products evaluated
Quality of product selection
Visibility of true COD profitability
Testing discipline
Purchase decision confidence

Primary UX metric:

Time from supplier URL → complete product economics

Target for a supported product:

Less than 2 minutes, excluding external delays such as supplier page access or large media downloads.

35. Non-Goals for MVP

The first version should NOT attempt to:

Fully automate supplier purchasing
Guarantee product success
Guarantee ad performance
Replace the user's final purchase decision
Treat AI scores as financial certainty
Depend on one supplier/platform forever
Build a full warehouse management system
36. Product Philosophy

Foxbox Calculator should answer one question better than anything else:

“If I put money into this product, what is my realistic COD economics and is it worth testing or buying?”

Everything in the product should support that decision.

37. Final UX Concept
                    FOXBOX CALCULATOR

                         ↓

                  PASTE PRODUCT URL

                         ↓

                   AUTO ANALYZE

                         ↓

             PRODUCT + MEDIA + VARIANTS

                         ↓

                 COMPLETE MISSING DATA

                         ↓

                  COST CALCULATOR

                         ↓

                   COD ECONOMICS

                         ↓

                 PRODUCT SCORE /100

                         ↓

        ┌──────────┬──────────┬──────────┐
        │ APPROVED │ STANDBY  │ REJECTED │
        └──────────┴──────────┴──────────┘

                         ↓

                       TEST

                         ↓

              REAL COD PERFORMANCE

                         ↓

                   PURCHASE / SCALE
Final Product Definition

Foxbox Calculator is a luxury dark/gold SaaS platform that transforms supplier product links into structured product intelligence and COD profitability decisions.

Its differentiator is the combination of:

Automatic product extraction
Automatic media collection
Manual override for missing data
RMB-first supplier economics
Configurable currency conversion
Shipping/landed-cost calculation
COD-specific profitability
Product scoring
Testing performance
Clear approval workflow
Purchase capital planning
Premium Foxbox UX

The product should feel like a professional product intelligence terminal for COD e-commerce, not a generic calculator.
"""
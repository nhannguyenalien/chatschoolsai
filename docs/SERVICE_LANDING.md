# Landing pages of the done-for-you setup service (VN / ID / PH)

Pages: `dash-tabler/landing-vn.html`, `landing-id.html`, `landing-ph.html`, linked from a new "Setup · Cài đặt hộ"
section on `landing.html`. Each page has the three packages, process, FAQ, a lead form, and the chat widget of its
own tenant (`schoolsai-vn`, `schoolsai-id`, `schoolsai-ph`).

The pages are generated from one template: edit copy or prices in `scripts/build-service-landings.mjs`, then run
`node scripts/build-service-landings.mjs` and commit the three HTML files. Prices must match the bot knowledge
(`docs/service-training/README.md`).

## Payment: Whop links (current, nothing in old config touched)

Each package card has a button to a plain Whop product page. Products were created on 2026-11-20 in the
SchoolsAI business on Whop (USD, "Accept local currency payments" left on by Whop's default):

| Package | Whop product | Price |
|---|---|---|
| Setup | `schools-ai-setup-done-for-you-ai-chatbot-setup` | 100 USD, one-time |
| Managed | `schools-ai-managed-monthly-chatbot-management` | 35 USD / month |
| Growth | `schools-ai-growth-monthly-chatbot-loyalty-and-content` | 89 USD / month |

Links: `https://whop.com/schoolsai/<product>/`. All three markets share the same three products. Orders appear only in
Whop; staff match them to the lead by e-mail (the pages ask buyers to use the same e-mail as the form) and start the
service by hand. Nothing is activated automatically. The links live in `scripts/build-service-landings.mjs` (`WHOP`);
change prices in Whop, and the USD text in `USD` / `PAYCOPY`, then rebuild the pages.

## AI Social Content (global, English): `landing-social.html`

One service: the buyer picks posts per month. Manual-first: orders land in Whop, the team makes and publishes the
posts to one Facebook Page per customer. Nothing is automatic yet (no `post_credit` metering, no video).

| Plan | Whop product | Price (USD, monthly) |
|---|---|---|
| 4 posts | `schools-ai-social-content-4-posts-per-month` | 3.99 |
| 12 posts | `schools-ai-social-content-12-posts-per-month` | 11.99 |
| 30 posts | `schools-ai-social-content-30-posts-per-month` | 29.99 |
| 90 posts | `schools-ai-social-content-90-posts-per-month` | 89.99 |

- Built from the same script (`scripts/build-service-landings.mjs`, `SOCIAL`), same lead form with market `gl` and
  plans `social_4/12/30/90` (Worker lead endpoint extended and tested). The optional Facebook Page link goes into
  the lead's `message`. No chat widget on this page (no bot for this service yet).
- Page terms (owner's decisions, from the pricing proposal, please confirm): unused posts do not carry over; a post
  that fails on our side is not counted; simple caption edits included, custom design not; videos not included yet;
  a free sample post on request.
- Staff must deliver by hand: get Page access from the buyer, create and publish the monthly posts, track the count.

## Whop product settings (all 7 products)

Whop showed a **fake strikethrough price and "Save 20%"** on every new product (product page > Growth tools > "Show
discount" is on by default with 20%), plus a member count. Both were turned off on all seven products on 2026-11-20
and the public pages were checked afterwards. Check this again for any product you create later.

### What the three bots (schoolsai-vn / -id / -ph) say about payment

Their knowledge has an "online payment through Whop" section (USD amounts: Setup 100 once, Managed 35/month, Growth
89/month, buyers should use the same e-mail as the form). **The bots never write a payment URL**: they tell the buyer to
click the "Pay … via Whop" button on the package card, or say staff will send the link when the buyer is not on the
page. Reason: in tests a bot invented a Whop link that does not exist (`whop.com/products/managed-ai-agent-vietnam`)
even with an explicit rule to copy links; with real money a wrong link is not acceptable. The hard-coded buttons on the
pages are the only source of links. Last check (18 questions): 0 URLs in answers; 16 stated the right USD amount, 2
quoted only the local price (safe, not wrong). Answers vary from run to run, so keep reading real conversations.

The in-form "register and pay" flow below is built and tested but **off** (`PAY_FORM = false` in the build script).
To use it instead, add the three market plans to `BGATE_CATALOG_JSON` (see "Before it works in production") and set
`PAY_FORM = true`.

## Form flow (`dash-tabler/_shared/service-landing.js`)

With `PAY_FORM = false` the form only sends the free-consultation lead (mode 1). Mode 2 applies when `PAY_FORM = true`.

1. **Free consultation**: `POST /api/public/service-leads` only. Stored in PocketBase `service_leads`, Telegram alert
   to `SETUP_ALERT_CHAT_ID` (same chat as the onboarding-package alert). Rate limit 10/hour/IP, honeypot field,
   10-minute duplicate guard, consent required, no secrets in the browser.
2. **Register and pay Setup now**:
   `POST /api/onboarding/register` (account + workspace, slug from the business name) →
   lead saved with the workspace slug → PocketBase login → `GET /api/account/billing/plans?market=<vn|id|ph>` →
   the page shows the **server's** amount and asks for a click → `POST /api/account/billing/checkout`
   (`plan`, `request_id`, `tenant` only; price/product/provider come from the Worker catalog) → redirect to the
   Whop checkout URL. The sessionStorage keys are the same as `billing.js`, so the dashboard Billing page can
   confirm the order afterwards. If the plan is not in the catalog yet, the page says payment is not ready and the
   lead still reaches staff.
3. Fulfilment is the existing onboarding flow: a verified paid order sets `bot_configs.setup_status = paid`, staff
   move it to `in_progress` and `done` in PocketBase.

## Before it works in production (nothing below was done by the code change)

Only steps 1 and 3 are needed while `PAY_FORM = false`; step 2 is only for the in-form payment flow.

1. PocketBase (done by the owner on 2026-11-20): `PB=... PB_EMAIL=... PB_PASS=... node scripts/pb-service-leads-schema.mjs` (dry run), then `--apply`.
   Without the collection the lead endpoint answers 503 and the form shows an error.
2. Worker secret `BGATE_CATALOG_JSON`: add the market plans (amount is in **USD**, Whop only; this code supports
   nothing else). Example, to be set by the owner:

   ```json
   "setup_vn": { "product": "schoolsai-setup-vn", "provider": "whop", "amount": 100, "currency": "USD", "kind": "setup", "market": "vn", "label": "Setup Việt Nam" },
   "setup_id": { "product": "schoolsai-setup-id", "provider": "whop", "amount": 100, "currency": "USD", "kind": "setup", "market": "id", "label": "Setup Indonesia" },
   "setup_ph": { "product": "schoolsai-setup-ph", "provider": "whop", "amount": 100, "currency": "USD", "kind": "setup", "market": "ph", "label": "Setup Philippines" }
   ```

   `market` hides these plans from the dashboard Billing page (they only show with `?market=`). The existing global
   `setup` plan (300 USD) is untouched.
3. Deploy the Worker (`wrangler deploy`) and the Pages site (dash-tabler). `SETUP_ALERT_CHAT_ID` and
   `TELEGRAM_BOT_TOKEN` are needed for lead alerts.
4. Check with the payment provider that the new product codes are accepted (BGate takes application-defined codes
   according to `bgate.js`; the first real order is the proof).

## Open decisions

- **Currency**: the pages and bots show local prices (2.500.000đ, Rp1.650.000, ₱5,800) but online payment is in USD
  (Whop). The page says so and shows the exact USD amount before the redirect. The bot knowledge still says
  payment methods are "to be confirmed by staff".
- Only the one-time **Setup** is paid online. Managed and Growth (monthly) are chosen in the form and started by staff
  after setup; no subscription product exists for them in the catalog.

## Tests

`cd worker-chat-d/knowledge-worker && node --test test/service-leads.test.js test/bgate.test.js test/billing-usage.test.js`
covers lead validation, honeypot, duplicates, failure modes, the market filter and the binding of a market plan to
price/product/workspace (provider mocked). Not covered: a real payment, the real PocketBase collection, the Worker
deployed.

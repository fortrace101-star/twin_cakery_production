# Twin Cakery ERP — Complete System Architecture & Build Specification

**Business:** Twin Cakery  
**Slogan:** Taste the Secret  
**Stack:** React + Vite + TypeScript / Express.js + TypeScript / PostgreSQL  
**Architecture:** Modular monolith with role-based interfaces and a shared backend/database

## 1. System Vision

Twin Cakery will use one integrated ERP to manage the complete lifecycle:

**Customer inquiry → quotation → order confirmation → production planning → inventory → purchasing → production → quality control → delivery → payment → feedback → customer retention and analytics**

The platform consists of:

1. Internal ERP application
2. Public website
3. Public product catalogue
4. Public order form
5. Express API/backend
6. PostgreSQL database
7. Automation/notification integrations

PostgreSQL is the single source of truth. The public website, catalogue and order form must use the same backend rather than separate product/order databases.

Use a **modular monolith initially**, not microservices. Keep modules clearly separated so services can be extracted later if required.

---

## 2. Recommended Technical Stack

### Frontend

- React
- Vite
- TypeScript
- React Router
- Server/API state management of choice
- Shared TypeScript types
- Shared validation schemas

### Backend

- Node.js
- Express.js
- TypeScript
- REST API under `/api/v1`
- Server-side authorization
- Transactional business services

### Database

- PostgreSQL
- Migration system
- Foreign keys and indexes
- Database constraints for critical business rules
- Transaction support

### Repository

Recommended monorepo:

```text
twin-cakery/
├── apps/
│   ├── erp/
│   ├── website/
│   └── order-form/
├── server/
│   ├── modules/
│   ├── middleware/
│   ├── database/
│   ├── services/
│   └── routes/
├── packages/
│   ├── types/
│   ├── validation/
│   ├── api-client/
│   └── config/
└── docs/
```

---

# 3. Core Business Roles

## 3.1 Admin / Proprietor

Admin has broad business control.

### Access

- Dashboard
- Customers
- Inquiries where escalation/oversight is needed
- Quotations
- Order confirmation
- Order administration
- Catalogue management
- Product categories
- Product types
- Products and variants
- Recipes/configuration
- Finance
- Payments
- Expenses
- Analytics
- Business settings
- Users and roles
- Audit logs

### Admin owns

- Quotation decisions
- Commercial negotiation
- Order confirmation
- Financial administration
- System configuration
- Business oversight

### Admin does NOT own

- Day-to-day delivery operations
- Primary incoming inquiry handling

Delivery is owned by Production Manager. Customer Support/CSR owns incoming customer support.

---

## 3.2 Customer Support / CSR

CSR is the customer-facing support function.

### Responsibilities

- Handle incoming inquiries
- Respond to customer questions
- Guide customers through catalogue/order process
- Assist with order forms
- Record communication history
- Handle complaints
- Document customer issues
- Escalate commercial decisions to Admin
- Support customers before and after orders

### CSR does not normally own

- Final quotations
- Commercial approval
- Final order confirmation
- Production
- Inventory control
- Delivery
- Finance administration

Admin and CSR may initially be the same people operationally. Therefore, implement granular permissions rather than assuming one user can have only one responsibility.

---

## 3.3 Sales Manager

Sales Manager owns sales growth and commercial performance analysis.

### Responsibilities

- Sales pipeline
- Sales targets
- Inquiry conversion
- Quotation conversion
- Customer segmentation
- Customer retention strategy
- Repeat-customer analysis
- Product/category sales performance
- Average order value
- Customer value
- Growth opportunities
- Sales team performance
- Marketing insights

Sales Manager does not need automatic authority to confirm every order. Confirmation remains an Admin permission unless explicitly delegated.

---

## 3.4 Production Manager

Production Manager owns operational fulfillment.

### Responsibilities

- Production planning
- Production scheduling
- Production timelines
- Stock checks
- Stock reservations
- Ingredient/material requirements
- Purchasing requirements
- Production execution
- Actual ingredient usage
- Wastage
- Production costing
- Quality control
- Rework
- Delivery

**Important:** Production Manager manages delivery. Admin does not manage delivery.

---

# 4. Product Catalogue Architecture

The product catalogue must be completely configurable by Admin.

Do **not** hardcode categories such as cakes, pastries, cookies, buns, etc. The system must allow Twin Cakery to define its own taxonomy and expand it without code changes.

## Hierarchy

```text
Product Category
      ↓
Product Type
      ↓
Product
      ↓
Product Variant / Options
      ↓
Recipe / Pricing / Catalogue Information
```

## Product Category

Fields:

- id
- name
- code
- description
- image
- display_order
- active
- catalogue_visible
- created_at
- updated_at

Admin can:

- Create category
- Rename category
- Reorder category
- Archive category
- Restore category
- Control catalogue visibility

## Product Type

Fields:

- id
- category_id
- name
- code
- description
- display_order
- active
- catalogue_visible
- timestamps

## Product

Fields should include:

- id
- SKU/product code
- category_id
- product_type_id
- name
- description
- base price
- cost reference
- catalogue visibility
- production enabled
- image/media
- active/archived state
- notes
- timestamps

## Product variants/options

Do not hardcode fields such as `cake_flavour` or `cake_size` into the core model. Support generic configurable options so the Admin can define what matters to Twin Cakery.

Examples could include size, flavour, design, quantity, packaging or future attributes, but these must remain configurable.

## Catalogue principle

```text
Admin changes ERP catalogue
        ↓
Shared backend data changes
        ↓
Public catalogue reflects the change
```

No duplicate catalogue database.

---

# 5. Customer & CRM Module

Customer record:

- customer_id
- name
- phone
- email
- addresses
- preferred contact method
- source
- notes
- status
- first_order_date
- last_order_date
- total_orders
- total_spend
- feedback history

Customer interaction:

- customer_id
- channel
- staff member
- date/time
- subject
- summary
- outcome
- follow-up requirement
- related inquiry/order

The CRM should provide a complete customer history.

---

# 6. Inquiry & Automated Intake

The initial customer journey is largely automated.

### Customer entry points

- WhatsApp
- Phone call
- Public website
- Public order form

### WhatsApp automation

The default automated response should direct customers to two primary paths:

1. Product catalogue
2. Order form

The customer can:

```text
WhatsApp
   ↓
Catalogue
   ↓
Decide what they want
   ↓
Order form OR call back
```

or:

```text
WhatsApp
   ↓
Order form
   ↓
Order proposal/inquiry
   ↓
ERP
```

The system should capture the customer and inquiry data in the ERP.

CSR handles the inquiry and customer communication.

Commercial quotation and confirmation then move to Admin.

---

# 7. Quotation Workflow

Quotation is a distinct business stage before a confirmed order.

```text
Inquiry
   ↓
Admin reviews proposal
   ↓
Quotation
   ↓
Customer discussion/negotiation
   ↓
Customer accepts
   ↓
Admin confirms order
```

Quotation should contain:

- quotation number
- customer
- proposed products
- variants/options
- quantities
- unit prices
- discounts
- delivery charges if applicable
- total
- notes
- validity/expiry if required
- status
- created by
- timestamps

Quotation statuses may include:

- DRAFT
- SENT
- NEGOTIATION
- ACCEPTED
- REJECTED
- EXPIRED
- CANCELLED
- CONVERTED

A quotation acceptance must not automatically bypass the Admin-controlled confirmation stage unless that behavior is explicitly configured.

---

# 8. Order Management

The order is the central business object linking the ERP modules.

```text
Customer
   ↓
Inquiry
   ↓
Quotation
   ↓
Confirmed Order
   ├── Payment
   ├── Production
   ├── Inventory
   ├── Purchasing
   ├── Delivery
   ├── Feedback
   └── Finance
```

## Recommended order statuses

```text
INQUIRY
QUOTATION
AWAITING_CONFIRMATION
CONFIRMED
PRODUCTION_REVIEW
READY_FOR_PRODUCTION
IN_PRODUCTION
QUALITY_CHECK
REWORK_REQUIRED
READY_FOR_DELIVERY
OUT_FOR_DELIVERY
AWAITING_PICKUP
COMPLETED
CANCELLED
```

Order status must be separate from payment status and delivery status.

Example:

```text
Order:    IN_PRODUCTION
Payment:  PARTIALLY_PAID
Delivery: PENDING
```

## Order status history

Every transition records:

- order_id
- previous status
- new status
- changed_by
- reason
- timestamp

Never silently overwrite important historical state.

---

# 9. Complete Production Workflow

The Production Manager owns the production side after an order is confirmed.

```text
CONFIRMED ORDER
      ↓
PRODUCTION REVIEW
      ↓
CHECK RECIPE / REQUIREMENTS
      ↓
CHECK INVENTORY
      ↓
RESERVE AVAILABLE STOCK
      ↓
IDENTIFY SHORTAGES
      ↓
PURCHASE IF REQUIRED
      ↓
READY FOR PRODUCTION
      ↓
IN PRODUCTION
      ↓
RECORD ACTUAL USAGE
      ↓
RECORD WASTAGE / SUBSTITUTIONS
      ↓
QUALITY CHECK
      ↓
PASS ─────────────→ READY FOR DELIVERY
  │
  └── FAIL → REWORK REQUIRED → QUALITY CHECK
                         ↓
                  READY FOR DELIVERY
                         ↓
                  DELIVERY / PICKUP
                         ↓
                     COMPLETED
```

Production Manager should see:

- order number
- customer
- product
- product options
- quantity
- required date/time
- recipe/version
- required materials
- available stock
- reserved stock
- shortages
- purchase requirements
- estimated production cost
- actual production cost
- production status
- quality status
- delivery requirements

---

# 10. Recipes & Costing

Each production-capable product may have one or more recipe versions.

```text
Recipe
  └── Recipe Version
       ├── Ingredient
       ├── Ingredient quantity
       ├── Packaging/material
       └── Expected wastage
```

Recipe versioning is mandatory for historical costing.

When a recipe changes:

```text
Old Recipe Version → remains historical
New Recipe Version → becomes active
```

Old orders must remain tied to the recipe version used at the time.

Recipe item data:

- ingredient/material
- quantity
- unit
- expected waste
- notes
- version
- effective date

Costing should distinguish:

- standard costs
- current market/material costs
- order-specific costs
- actual costs

---

# 11. Inventory Management

Inventory must use a transaction/ledger model.

Do not rely only on a manually editable `current_quantity` field.

## Stock calculation

```text
Opening Stock
+ Purchases
+ Positive Adjustments
- Production Consumption
- Wastage
- Damage
- Negative Adjustments
± Transfers
= Physical Stock
```

Then:

```text
Available Stock = Physical Stock - Reserved Stock
```

## Inventory transactions

Types:

- OPENING_BALANCE
- PURCHASE_RECEIPT
- PRODUCTION_CONSUMPTION
- WASTAGE
- DAMAGE
- ADJUSTMENT_IN
- ADJUSTMENT_OUT
- TRANSFER_IN
- TRANSFER_OUT
- RETURN

Each transaction should record:

- item
- quantity
- unit
- transaction type
- reference
- user
- timestamp
- unit cost where applicable
- notes

## Inventory tracking

Track:

- ingredient/material
- packaging
- consumables
- stock level
- reserved quantity
- available quantity
- reorder level
- supplier
- cost history
- wastage
- expiry where relevant

## Inventory alerts

- Low stock
- Out of stock
- Reorder required
- Expiry risk
- Unusual wastage
- Significant price changes

---

# 12. Purchasing & Supplier Management

Production Manager identifies purchasing requirements based on production and stock.

### Workflow

```text
Production Requirement / Reorder Alert
          ↓
Purchase Requirement
          ↓
Purchase Order
          ↓
Supplier
          ↓
Goods Received
          ↓
Inventory Updated
          ↓
Supplier Cost History Updated
```

Supplier fields:

- id
- business name
- contact person
- phone
- email
- address
- products/materials supplied
- payment terms
- notes
- active status

Purchase order fields:

- PO number
- supplier
- date
- expected date
- items
- quantities
- unit prices
- total
- status
- notes

Goods receipt must create inventory transactions.

Supplier price history should support cost analysis and supplier comparison.

---

# 13. Finance Module

Finance is a full module, not merely a dashboard.

It tracks both revenue and costs across the business.

## Revenue

Track:

- quoted amount
- confirmed order amount
- discounts
- payments received
- outstanding balance
- payment method
- payment date
- reference

## Direct order costs

Track:

- ingredient costs
- packaging
- production costs
- delivery costs
- wastage
- order-specific expenses

## Operating expenses

Examples:

- rent
- utilities
- salaries
- marketing
- transport
- maintenance
- repairs
- equipment
- supplies
- miscellaneous operating costs

Expense record:

- category
- amount
- date
- payment method
- reference
- description
- attachment if supported
- recorded_by

## Profitability

At minimum:

```text
Revenue
- Direct Costs
= Gross Profit

Gross Profit
- Operating Expenses
= Net Operating Result
```

The accounting model can become more sophisticated later, but the data model must preserve the underlying transactions.

## Finance dashboard

Show:

- revenue
- payments received
- outstanding payments
- direct costs
- expenses
- gross profit
- net profit/operating result
- cash movement

Support daily, weekly, monthly and yearly views.

---

# 14. Payments

Payment status must be independent from order status.

Payment statuses:

- UNPAID
- PARTIALLY_PAID
- PAID
- REFUNDED
- OVERPAID

Payment record:

- payment_id
- order_id
- amount
- method
- date
- reference
- received_by
- notes

Outstanding balance must be calculated server-side.

---

# 15. Delivery

**Production Manager owns delivery operations.**

Delivery record:

- delivery_id
- order_id
- delivery/pickup type
- destination
- scheduled date
- scheduled time
- actual dispatch time
- delivery person
- delivery fee
- status
- notes
- customer confirmation

Statuses:

- PENDING
- READY_FOR_DISPATCH
- OUT_FOR_DELIVERY
- DELIVERED
- AWAITING_PICKUP
- PICKED_UP
- FAILED

Delivery is separate from order status.

Example:

```text
Order: READY_FOR_DELIVERY
Payment: PAID
Delivery: OUT_FOR_DELIVERY
```

---

# 16. Quality Control

Quality is a formal production stage.

```text
Production Complete
        ↓
Quality Check
   ┌────┴────┐
 PASS       FAIL
  ↓           ↓
READY      REWORK
FOR          ↓
DELIVERY   CHECK AGAIN
```

Record:

- production job
- result
- checked_by
- date/time
- issues
- notes
- rework_required
- rework cost
- wastage caused by rework

Do not silently erase failed quality checks.

---

# 17. Feedback

Feedback belongs to the customer/order history.

Support:

- rating
- complaint
- compliment
- product feedback
- delivery feedback
- service feedback
- general feedback
- resolution
- follow-up required
- follow-up completed

CSR/Admin can document feedback.

Sales Manager uses feedback and customer history for retention and growth analysis.

---

# 18. Sales Manager Analytics

Sales Manager should have a commercial dashboard showing:

- inquiries
- quotations
- accepted quotations
- confirmed orders
- conversion rate
- lost inquiries
- revenue
- average order value
- repeat-customer rate
- customer lifetime value
- best-performing categories
- best-performing products
- customer segments
- sales trends
- retention opportunities

The dashboard should support date filters and drill-down.

---

# 19. Analytics & Recommendations

The ERP should answer questions such as:

- How much money did we make this month?
- How much did we spend?
- What are our largest expenses?
- Which products sell most?
- Which categories sell most?
- Which products have the best margins?
- Which customers return most often?
- What causes the most wastage?
- Which ingredients are becoming expensive?
- Which suppliers are most cost-effective?
- Which orders are delayed?
- Where are production bottlenecks?

## Recommendation engine

Initially use rule-based recommendations, for example:

- reorder item X
- supplier price increased by X%
- product has unusually high wastage
- order is at risk of missing deadline
- customer has not ordered again within expected interval
- category is growing/declining
- expense category is unusually high

AI/ML can be added later without changing the core ERP model.

---

# 20. Dashboard

## Admin/Proprietor dashboard

Answer: **How is Twin Cakery doing right now?**

Cards/widgets:

- Today's orders
- Orders in production
- Orders due today
- Pending inquiries
- Pending quotations
- Outstanding payments
- Low-stock items
- Today's revenue
- Monthly revenue
- Direct costs
- Gross profit
- Expenses
- Delivery status
- Recent feedback

Every metric should drill down to source records where the user has permission.

## Production dashboard

- Today's production
- Upcoming production
- Delayed jobs
- Stock shortages
- Purchase requirements
- Production cost
- Wastage
- Quality failures
- Deliveries due

## Sales dashboard

- New inquiries
- Conversion rate
- Quotations
- Confirmed orders
- Revenue
- Repeat customers
- Customer segments
- Product/category performance

## CSR dashboard

- New inquiries
- Unanswered inquiries
- Customer issues
- Follow-ups needing attention
- Recent customer interactions

---

# 21. RBAC Architecture

Do not hardcode role names into authorization logic. Define granular permissions and assign them to roles.

Examples:

```text
orders.view
orders.create
orders.edit
orders.confirm
orders.cancel

customers.view
customers.create
customers.edit
customers.interact

products.view
products.create
products.edit
products.archive

production.view
production.schedule
production.start
production.complete
production.quality_check
production.record_wastage

inventory.view
inventory.adjust
inventory.reserve
inventory.consume

purchasing.view
purchasing.create
purchasing.approve
purchasing.receive

finance.view
finance.record_payment
finance.record_expense
finance.view_reports

payments.view
payments.record

deliveries.view
deliveries.create
deliveries.dispatch
deliveries.complete

feedback.view
feedback.create
feedback.resolve

users.manage
roles.manage
settings.manage
audit.view
```

A user may have multiple roles if required.

---

# 22. Core Database Entities

## Identity

- users
- roles
- permissions
- role_permissions
- user_roles

## Customers

- customers
- customer_addresses
- customer_interactions

## Catalogue

- product_categories
- product_types
- products
- product_variants
- product_options
- product_option_values

## Recipes

- recipes
- recipe_versions
- recipe_items
- ingredients/materials

## CRM/Sales

- inquiries
- quotations
- quotation_items

## Orders

- orders
- order_items
- order_status_history

## Production

- production_jobs
- production_steps
- production_consumption
- production_costs
- production_wastage
- quality_checks

## Inventory

- inventory_items
- inventory_transactions
- stock_locations
- stock_reservations

## Purchasing

- suppliers
- purchase_requirements
- purchase_orders
- purchase_order_items
- goods_receipts
- goods_receipt_items
- supplier_price_history

## Finance

- payments
- expenses
- expense_categories

## Delivery

- deliveries

## Feedback

- customer_feedback

## System

- notifications
- audit_logs

---

# 23. API Architecture

All API endpoints should be versioned under:

```text
/api/v1
```

## Authentication

```http
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

## Catalogue

```http
GET    /api/v1/product-categories
POST   /api/v1/product-categories
PATCH  /api/v1/product-categories/:id

GET    /api/v1/product-types
POST   /api/v1/product-types
PATCH  /api/v1/product-types/:id

GET    /api/v1/products
POST   /api/v1/products
GET    /api/v1/products/:id
PATCH  /api/v1/products/:id
POST   /api/v1/products/:id/archive
```

## Customers

```http
GET    /api/v1/customers
POST   /api/v1/customers
GET    /api/v1/customers/:id
PATCH  /api/v1/customers/:id
```

## Inquiries

```http
GET    /api/v1/inquiries
POST   /api/v1/inquiries
GET    /api/v1/inquiries/:id
PATCH  /api/v1/inquiries/:id
```

## Quotations

```http
GET    /api/v1/quotations
POST   /api/v1/quotations
GET    /api/v1/quotations/:id
PATCH  /api/v1/quotations/:id
POST   /api/v1/quotations/:id/send
POST   /api/v1/quotations/:id/accept
```

## Orders

```http
GET    /api/v1/orders
POST   /api/v1/orders
GET    /api/v1/orders/:id
PATCH  /api/v1/orders/:id
POST   /api/v1/orders/:id/confirm
POST   /api/v1/orders/:id/cancel
```

## Production

```http
GET  /api/v1/production/jobs
GET  /api/v1/production/jobs/:id
POST /api/v1/production/jobs/:id/start
POST /api/v1/production/jobs/:id/complete
POST /api/v1/production/jobs/:id/quality-check
POST /api/v1/production/jobs/:id/wastage
```

## Inventory

```http
GET  /api/v1/inventory
GET  /api/v1/inventory/:id
POST /api/v1/inventory/adjustments
POST /api/v1/inventory/reservations
```

## Purchasing

```http
GET  /api/v1/purchase-orders
POST /api/v1/purchase-orders
POST /api/v1/purchase-orders/:id/receive
```

## Finance

```http
GET  /api/v1/finance/payments
POST /api/v1/finance/payments
GET  /api/v1/finance/expenses
POST /api/v1/finance/expenses
GET  /api/v1/finance/reports
```

## Delivery

```http
GET  /api/v1/deliveries
POST /api/v1/deliveries
POST /api/v1/deliveries/:id/dispatch
POST /api/v1/deliveries/:id/complete
```

## Feedback

```http
GET  /api/v1/feedback
POST /api/v1/feedback
PATCH /api/v1/feedback/:id
```

## Public API

```http
GET  /api/v1/public/catalogue
GET  /api/v1/public/products/:id
POST /api/v1/public/inquiries
POST /api/v1/public/order-proposals
```

Public endpoints must never expose internal costs, supplier prices, staff information, private notes or private customer data.

---

# 24. Business Transactions

Operations that affect multiple modules must be executed transactionally.

## Confirming an order

Potential transaction:

1. Validate quotation/order
2. Confirm order
3. Create order status history
4. Create production requirement/job
5. Reserve or prepare stock requirements
6. Emit internal event
7. Create notifications

## Receiving stock

1. Validate purchase order
2. Create goods receipt
3. Create inventory transaction
4. Update purchase receipt state
5. Record supplier price
6. Update available stock

## Recording production consumption

1. Validate stock/reservations
2. Create consumption transactions
3. Calculate actual cost
4. Record production cost
5. Release/update reservations
6. Preserve audit history

---

# 25. Event-Driven Automation

Use application events internally.

Suggested events:

```text
InquiryCreated
QuotationCreated
QuotationAccepted
OrderConfirmed
ProductionStarted
StockShortageDetected
PurchaseRequirementCreated
GoodsReceived
ProductionCompleted
QualityFailed
QualityPassed
DeliveryDispatched
OrderCompleted
PaymentReceived
FeedbackRecorded
```

Events can trigger:

- staff notifications
- customer notifications
- reminders
- dashboard updates
- analytics updates
- background jobs

Example:

```text
OrderConfirmed
      ↓
Production Job Created
      ↓
Production Manager Notified
      ↓
Stock Check
      ↓
Shortage?
   /       \
 YES       NO
 ↓          ↓
Purchase   Schedule
Requirement Production
```

External WhatsApp/email integrations should consume API/events rather than directly writing to PostgreSQL.

---


# Cross-Account Notification Architecture

Cross-account notifications are a first-class ERP capability. The notification system must allow one business event to notify one or more authorized users across different ERP accounts while respecting RBAC, notification preferences, and data visibility.

## Notification Service

Add a central Notification Service inside the modular monolith. Business modules publish internal events; the Notification Service determines recipients and delivery channels. It must not allow external integrations to write directly to PostgreSQL.

```text
Business Module
      ↓
Internal Event
      ↓
Notification Service
      ↓
Recipient Resolution
      ↓
Notification Record
      ↓
 ┌────┼──────────┬────────┐
 ↓    ↓          ↓        ↓
In-App WhatsApp  Email    SMS/Push
```

The notification service should support:

- cross-account staff notifications
- role/permission-based recipient routing
- user-specific recipients
- order/customer/production assignments
- priority levels
- read/unread state
- notification preferences
- delivery status and retry handling
- deep links to the relevant ERP record
- actionable notifications
- auditability

## Cross-Account Recipient Rules

Notifications must never be broadcast blindly to all users. Recipients are resolved using business rules, permissions, assignments, and organizational responsibility.

Examples:

| Event | Primary recipient(s) | Possible additional recipient(s) |
|---|---|---|
| InquiryCreated | CSR | Assigned support staff |
| QuotationRequired | Admin | Sales Manager |
| OrderConfirmed | Production Manager | Sales Manager, Finance |
| StockShortageDetected | Production Manager | Admin/Sales Manager when delivery risk exists |
| PurchaseRequirementCreated | Production Manager | Authorized purchasing users |
| GoodsReceived | Production Manager | Finance/Admin |
| QualityFailed | Production Manager | Assigned operational staff |
| QualityPassed | Production Manager | Relevant delivery staff |
| DeliveryDue | Production Manager | Assigned delivery staff |
| OrderCompleted | Admin | Sales Manager |
| PaymentReceived | Finance/Admin | Relevant order owner |
| CustomerComplaint | CSR | Responsible manager(s) |
| FeedbackRecorded | Sales Manager | Production Manager when operational feedback exists |

A user may receive a notification only when their account is authorized to access the underlying record.

## Notification Data Model

Add the following system entities:

### notifications

- id
- event_type
- title
- message
- priority
- entity_type
- entity_id
- action_url/deep_link
- created_at
- created_by/event_source where applicable

### notification_recipients

- id
- notification_id
- user_id
- delivery_channel
- delivered_at
- read_at
- failed_at
- failure_reason

### notification_preferences

- id
- user_id
- event_type
- channel
- enabled

### notification_templates

- id
- event_type
- channel
- title_template
- message_template
- active

Notification delivery history should be retained so the ERP can determine whether a notification was created, delivered, read, or failed.

## Notification Channels

### 1. In-App

The primary internal channel is real-time ERP notification delivery. The React application should show:

- unread notification count
- notification center
- timestamp
- priority
- notification category
- read/unread state
- link to the related order/customer/task
- mark as read
- mark all as read

Use WebSockets (for example Socket.IO) or Server-Sent Events so important notifications can appear without a page refresh.

### 2. WhatsApp

WhatsApp is an external delivery channel. It may be used for customer notifications and, where configured, authorized staff notifications. It must consume application events/API interfaces and must never write directly to PostgreSQL.

### 3. Email

Email can be used for notifications requiring a persistent message or where the user has enabled email delivery.

### 4. SMS / Push

SMS or mobile push can be added later without changing the business event model.

## Actionable Notifications

Notifications should support actions, not merely informational text.

Example:

```text
STOCK SHORTAGE — Order #TC-1045
2kg of required material is unavailable.

[View Order] [Create Purchase Requirement]
```

Another example:

```text
CUSTOMER FOLLOW-UP DUE
Order #TC-1038 was completed.

[View Customer] [Record Feedback]
```

Actions must still pass through normal API authorization and business rules. A notification button must never bypass RBAC or approval rules.

## Notification Preferences

Users should be able to control supported channels for non-critical notifications. Critical operational notifications may be mandatory according to business policy. Preferences must not override access control.

Example preferences:

```text
Order confirmed        In-App ✓  Email ✓  WhatsApp —
Payment received       In-App ✓  Email ✓  WhatsApp —
Customer complaint     In-App ✓  Email ✓  WhatsApp ✓
Marketing notifications In-App —  Email —  WhatsApp —
```

## Notification API

Internal ERP API should expose, as appropriate:

```http
GET  /api/v1/notifications
GET  /api/v1/notifications/unread-count
PATCH /api/v1/notifications/:id/read
POST /api/v1/notifications/mark-all-read
GET  /api/v1/notification-preferences
PATCH /api/v1/notification-preferences
```

Administrative notification-management endpoints should be protected by granular permissions.

## Notification Security

Notifications can contain sensitive operational information. Therefore:

- recipient resolution must be server-side
- notification APIs must enforce RBAC
- deep links must enforce authorization again when opened
- public users must never receive internal notifications
- supplier costs, internal production costs, private customer information, and private notes must not leak through notifications
- external channels must use approved templates and sanitized data

## Notification Reliability

Notifications should be designed so business operations do not fail merely because an external notification provider is unavailable.

```text
OrderConfirmed
      ↓
Database transaction commits
      ↓
Internal event / outbox
      ↓
Notification processing
      ↓
In-App delivery
      ↓
WhatsApp / Email / SMS
      ↓
Retry failed external deliveries
```

For reliable delivery, implement an outbox/job mechanism as the system grows. The core transaction remains the source of truth; notification delivery is asynchronous.

## Cross-Account Notification Workflow Examples

### Confirmed Order

```text
Admin confirms order
        ↓
OrderConfirmed event
        ↓
Notification Service
        ↓
Production Manager account notified
        ↓
Sales Manager account optionally notified
        ↓
Finance/Admin account notified when payment action is required
```

### Completed Order

```text
Production Manager completes delivery/order
        ↓
OrderCompleted event
        ↓
Admin receives real-time follow-up notification
        ↓
Admin calls/WhatsApps customer
        ↓
Feedback recorded
        ↓
Sales Manager + Production Manager can analyze relevant feedback
```

### Stock Shortage

```text
Production Manager checks inventory
        ↓
StockShortageDetected
        ↓
Production Manager notified/action available
        ↓
Purchase Requirement created
        ↓
Authorized purchasing users notified
        ↓
Goods received
        ↓
Production Manager notified that stock is available
```

## Dashboard and Notification Relationship

Notifications complement dashboards; they do not replace them. Dashboards show the current operational state, while notifications highlight changes or actions requiring attention.

The ERP should therefore support:

- persistent dashboard state
- real-time notifications
- notification history
- task/action links
- unread counts
- event audit trail

# 26. Complete End-to-End Workflow

```text
CUSTOMER
   ↓
WhatsApp / Call / Website
   ↓
Automated WhatsApp Response
   ↓
Catalogue + Order Form
   ↓
Customer Inquiry / Order Proposal
   ↓
CRM
   ↓
CSR Handles Inquiry
   ↓
Commercial Decision Needed?
   ↓
ADMIN
   ↓
Quotation
   ↓
Negotiation / Adjustments
   ↓
Customer Accepts
   ↓
ADMIN CONFIRMS ORDER
   ↓
CONFIRMED ORDER
   ↓
PRODUCTION MANAGER
   ↓
Production Review
   ↓
Recipe + Inventory Check
   ↓
Reserve Stock
   ↓
Shortage?
  /   \
YES   NO
 |     |
Purchase |
 |     |
Receive Stock
  \     /
   READY FOR PRODUCTION
          ↓
      IN PRODUCTION
          ↓
Actual Usage / Wastage / Cost
          ↓
      QUALITY CHECK
       /       \
    PASS       FAIL
     ↓           ↓
READY FOR     REWORK
DELIVERY        ↓
     |       QUALITY CHECK
     ↓
PRODUCTION MANAGER
     ↓
DELIVERY / PICKUP
     ↓
CUSTOMER RECEIVES
     ↓
ORDER COMPLETED
     ↓
PAYMENT RECONCILIATION
     ↓
CUSTOMER FEEDBACK
     ↓
CRM
     ↓
SALES MANAGER ANALYSIS
     ↓
RETENTION / GROWTH STRATEGY
```

---

# 27. What the ERP Tracks

## Customer

- identity
- demographics/segments where voluntarily collected and appropriate
- contact information
- source
- interaction history
- order history
- spending
- feedback
- repeat behavior

## Orders

- order value
- product/category
- customer
- date
- required date
- status
- assigned staff
- quotation history
- payment
- production
- delivery
- feedback

## Production

- schedule
- responsible manager/staff
- recipe version
- planned ingredients
- actual ingredients
- production time
- wastage
- substitutions
- cost
- quality result
- rework

## Inventory

- physical stock
- reserved stock
- available stock
- purchases
- consumption
- wastage
- adjustments
- reorder levels
- supplier prices

## Finance

- revenue
- payments
- outstanding balances
- direct order costs
- expenses
- gross profit
- net operating result
- cash movement

## Sales

- inquiries
- quotations
- conversions
- lost opportunities
- product/category performance
- repeat customers
- customer segments
- sales trends

---

# 28. ERP Navigation

Recommended navigation:

```text
Dashboard

CRM
  ├── Customers
  ├── Inquiries
  ├── Interactions
  └── Feedback

Sales
  ├── Quotations
  ├── Orders
  └── Sales Analytics

Catalogue
  ├── Categories
  ├── Product Types
  ├── Products
  └── Variants / Options

Production
  ├── Schedule
  ├── Jobs
  ├── Quality
  └── Production Costs

Inventory
  ├── Stock
  ├── Reservations
  ├── Transactions
  ├── Adjustments
  └── Alerts

Purchasing
  ├── Suppliers
  ├── Requirements
  ├── Purchase Orders
  └── Goods Received

Finance
  ├── Payments
  ├── Expenses
  ├── Profitability
  └── Reports

Delivery
  ├── Upcoming
  ├── Dispatch
  └── Completed

Administration
  ├── Users
  ├── Roles
  ├── Permissions
  ├── Business Settings
  └── Audit Log
```

Navigation must be permission-aware.

---

# 29. Public Website

The public website is a separate frontend application using the same backend.

Suggested pages:

- Home
- About
- Catalogue
- Product details
- Contact
- Order
- FAQ if desired

The website should consume the catalogue from:

```http
GET /api/v1/public/catalogue
```

It should not maintain a hardcoded duplicate catalogue.

---

# 30. Public Order Form

The public order form should dynamically use the catalogue structure.

Possible fields:

- customer name
- phone
- email
- product
- product options
- quantity
- preferred date
- preferred time
- delivery/pickup
- delivery location
- customer notes
- reference image if enabled

The form creates an inquiry/order proposal. It does not bypass Admin confirmation.

Server-side validation is mandatory.

---

# 31. WhatsApp Integration

WhatsApp is an external communication channel.

Initial automated message should provide:

- catalogue link
- order form link

Future integration can support:

- inquiry creation
- quotation notifications
- order confirmations
- payment reminders
- delivery notifications
- feedback requests

The ERP remains the system of record.

---

# 32. API Error Format

Use a consistent response model:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The submitted order is invalid.",
    "details": {}
  }
}
```

Do not expose stack traces, database internals or secrets to clients.

---

# 33. Search, Filtering & Pagination

Use server-side pagination for large datasets.

Example:

```text
?page=1
&pageSize=25
&search=...
&status=...
&from=...
&to=...
&sortBy=...
&sortOrder=asc
```

Use consistent filtering across Orders, Customers, Products, Inventory, Finance and Production.

---

# 34. Audit Trail

Important business actions must be auditable.

Audit record:

- actor/user
- action
- entity type
- entity ID
- previous state where appropriate
- new state where appropriate
- timestamp
- reason where appropriate

Audit:

- order confirmation
- order cancellation
- price changes
- payments
- expenses
- stock adjustments
- production completion
- quality decisions
- delivery completion
- recipe changes
- product changes
- user/role changes

---

# 35. Security

Required baseline:

- HTTPS in production
- secure password hashing
- secure authentication/session/token handling
- server-side RBAC
- request validation
- database constraints
- rate limiting
- CORS configuration
- secure secrets management
- audit logging
- least privilege
- safe file upload handling
- production-safe error handling

Never expose publicly:

- passwords
- password hashes
- secrets
- supplier costs
- internal production costs
- private staff information
- private customer information
- internal notes

---

# 36. Historical Integrity

Historical records must remain reconstructable.

Examples:

- Old order prices must not change when product prices change.
- Old production must remain tied to its recipe version.
- Inventory history should remain ledger-based.
- Payment history must be preserved.
- Status history must be preserved.
- Supplier price history must be preserved.
- Corrections should generally create adjustment records instead of silently rewriting history.

---

# 37. Testing Strategy

## Unit tests

Test:

- calculations
- validation
- permission checks
- state transitions
- inventory calculations
- financial calculations

## Integration tests

Test:

- API + database
- order confirmation
- stock reservation
- production consumption
- goods receipt
- payment recording
- delivery completion

## End-to-end tests

Test the entire customer-to-completion journey.

Critical scenario:

```text
Customer submits order
→ inquiry created
→ CSR handles inquiry
→ Admin creates quotation
→ customer accepts
→ Admin confirms order
→ Production Manager receives order
→ stock check
→ purchase shortage if needed
→ goods received
→ production
→ wastage/cost recorded
→ quality check
→ rework if failed
→ quality passed
→ delivery
→ payment reconciled
→ feedback
→ analytics updated
```

---

# 38. Development Roadmap

## Phase 1 — Foundation

- monorepo
- React/Vite/TypeScript
- Express/TypeScript
- PostgreSQL
- migrations
- shared types
- shared validation
- API client
- environment configuration

## Phase 2 — Identity & RBAC

- login
- logout
- current user
- users
- roles
- permissions
- route guards
- API authorization

## Phase 3 — Catalogue

- categories
- product types
- products
- variants/options
- catalogue visibility
- public catalogue endpoint

## Phase 4 — CRM / Intake

- customers
- interactions
- inquiries
- public inquiry endpoint
- CSR workspace

## Phase 5 — Quotations

- quotation creation
- quotation items
- pricing
- discounts
- negotiation
- acceptance
- conversion

## Phase 6 — Orders

- order creation
- confirmation
- status lifecycle
- status history
- payment status

## Phase 7 — Recipes

- ingredients/materials
- recipes
- recipe versions
- recipe items

## Phase 8 — Inventory

- inventory items
- transactions
- reservations
- adjustments
- wastage
- reorder levels

## Phase 9 — Production

- jobs
- scheduling
- production steps
- consumption
- actual costing
- quality
- rework

## Phase 10 — Purchasing

- suppliers
- requirements
- purchase orders
- goods receipt
- price history

## Phase 11 — Finance

- payments
- expenses
- direct costs
- profitability
- reports

## Phase 12 — Delivery

- scheduling
- dispatch
- delivery tracking
- pickup
- completion

## Phase 13 — Feedback & Sales Intelligence

- feedback
- complaints
- resolutions
- segmentation
- retention
- sales analytics

## Phase 14 — Automation

- notifications
- reminders
- event handlers
- WhatsApp integration
- email integration if needed

## Phase 15 — Public Website + Order Form

- website
- catalogue
- product pages
- order form
- contact/inquiry flows

---

# 39. First Vertical Slice

Do not build every module in isolation first. Prove one complete business path.

```text
Admin creates category
        ↓
Admin creates product type
        ↓
Admin creates product
        ↓
Product appears in public catalogue
        ↓
Customer submits order form
        ↓
Inquiry enters CRM
        ↓
CSR handles inquiry
        ↓
Admin creates quotation
        ↓
Customer accepts
        ↓
Admin confirms order
        ↓
Production Manager sees confirmed order
        ↓
Stock check
        ↓
Production scheduled
        ↓
Production completed
        ↓
Quality passed
        ↓
Production Manager completes delivery
        ↓
Payment reconciled
        ↓
Feedback recorded
        ↓
Analytics updated
```

This is the first major acceptance test for the platform.

---

# 40. Non-Negotiable Architecture Rules

1. One ERP platform, not disconnected systems.
2. One PostgreSQL source of truth.
3. Backend owns business rules.
4. React owns presentation.
5. Use granular permissions.
6. Product categories and product types must be configurable by Admin.
7. Never hardcode Twin Cakery's catalogue taxonomy.
8. Public catalogue is generated from ERP data.
9. Order is the central business object.
10. Order status, payment status and delivery status are separate.
11. Inventory is transaction/ledger based.
12. Recipe versions preserve historical costing.
13. Admin owns quotations, commercial negotiation and order confirmation.
14. CSR owns incoming customer support and communication.
15. Production Manager owns production, inventory operations, purchasing requirements and delivery.
16. Sales Manager owns sales analysis, retention and growth strategy.
17. Finance is a complete ERP module.
18. Important actions are auditable.
19. Historical records remain reconstructable.
20. Cross-module business operations use database transactions.
21. API is versioned.
22. Public endpoints cannot expose internal data.
23. Start as a modular monolith.
24. Build a complete vertical slice before expanding every feature.
25. Keep business modules independently testable.

---

# 41. Coding Agent Instructions

Treat this document as the master architecture specification.

The coding agent should:

- preserve modular boundaries
- use TypeScript throughout frontend and backend
- keep business logic in backend services
- validate input at API boundaries
- enforce authorization server-side
- use database transactions for cross-module changes
- use migrations for schema changes
- preserve historical records
- use event-driven internal notifications
- avoid hardcoded product categories/types
- avoid duplicate catalogue data
- keep order/payment/delivery state separate
- keep inventory ledger-based
- make role permissions granular
- write tests for critical workflows
- expose only public-safe fields through public APIs

The implementation should be designed for future expansion without requiring a fundamental rewrite.

---

# 42. Final Architecture

```text
                         CUSTOMER
                            |
                   WhatsApp / Website / Call
                            |
                  +---------v---------+
                  | Public Catalogue  |
                  | Public Order Form |
                  +---------+---------+
                            |
                       Inquiry/Proposal
                            |
                    +-------v--------+
                    |      CRM       |
                    +-------+--------+
                            |
                           CSR
                            |
                    Commercial Decision
                            |
                          ADMIN
                            |
                       QUOTATION
                            |
                     Customer Accepts
                            |
                    ORDER CONFIRMED
                            |
                +-----------v------------+
                |    ORDER MANAGEMENT    |
                +-----------+------------+
                            |
                   PRODUCTION MANAGER
                            |
             +--------------+--------------+
             |              |              |
        INVENTORY       PURCHASING     PRODUCTION
             |              |              |
             +--------------+--------------+
                            |
                       QUALITY CHECK
                            |
                         DELIVERY
                            |
                       COMPLETED
                            |
                    PAYMENT / FINANCE
                            |
                        FEEDBACK
                            |
                     SALES ANALYTICS
                            |
                  RETENTION / GROWTH

                    POSTGRESQL
                         ^
                         |
                  EXPRESS API
                         ^
                         |
        +----------------+----------------+
        |                |                |
      ERP UI          Website        Order Form
```

## End State

Twin Cakery's ERP should become the single operational system connecting:

**Customer acquisition + Sales + Catalogue + Orders + Production + Inventory + Purchasing + Finance + Delivery + Quality + Customer Experience + Analytics + Growth.**

The system should be configurable enough that the proprietor can define how Twin Cakery organizes its products and operations while preserving strong technical controls, auditability, financial traceability and role-based access.

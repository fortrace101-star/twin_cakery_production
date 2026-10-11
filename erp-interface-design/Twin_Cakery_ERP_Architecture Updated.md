# **TWIN CAKERY ERP Architecture Specification** 

Taste the Secret 

Master technical blueprint covering the React frontend, Express API, PostgreSQL database, business workflows, permissions, integrations, and coding-agent instructions. 

Twin Cakery | ERP Architecture 

Page 1 

## **Twin Cakery ERP — Complete System Architecture & Build Specification** 

**Business:** Twin Cakery **Slogan:** Taste the Secret **Stack:** React + Vite + TypeScript / Express.js + TypeScript / PostgreSQL **Architecture:** Modular monolith with role-based interfaces and a shared backend/database 

### **1. System Vision** 

Twin Cakery will use one integrated ERP to manage the complete lifecycle: 

**Customer inquiry** → **quotation** → **order confirmation** → **production planning** → **inventory** → **purchasing** → **production** → **quality control** → **delivery** → **payment** → **feedback** → **customer retention and analytics** 

The platform consists of: 

1. Internal ERP application 

2. Public website 

3. Public product catalogue 

4. Public order form 

5. Express API/backend 

6. PostgreSQL database 

7. Automation/notification integrations 

PostgreSQL is the single source of truth. The public website, catalogue and order form must use the same backend rather than separate product/order databases. 

Use a **modular monolith initially** , not microservices. Keep modules clearly separated so services can be extracted later if required. 

### **2. Recommended Technical Stack** 

#### **_Frontend_** 

- React 

- Vite 

- TypeScript 

- React Router 

- Server/API state management of choice 

- Shared TypeScript types 

- Shared validation schemas 

#### **_Backend_** 

- Node.js 

- Express.js 

- TypeScript 

- REST API under `/api/v1` 

- Server-side authorization 

- Transactional business services 

#### **_Database_** 

Twin Cakery | ERP Architecture 

Page 2 

- PostgreSQL 

- Migration system 

- Foreign keys and indexes 

- Database constraints for critical business rules 

- Transaction support 

#### **_Repository_** 

Recommended monorepo: 

`twin-cakery/` III `apps/` I III `erp/` I III `website/` I III `order-form/` III `server/` I III `modules/` I III `middleware/` I III `database/` I III `services/` I III `routes/` III `packages/` I III `types/` I III `validation/` I III `api-client/` I III `config/` III `docs/` 

## **3. Core Business Roles** 

### **3.1 Admin / Proprietor** 

Admin has broad business control. 

#### **_Access_** 

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

#### **_Admin owns_** 

Twin Cakery | ERP Architecture 

Page 3 

- Quotation decisions 

- Commercial negotiation 

- Order confirmation 

- Financial administration 

- System configuration 

- Business oversight 

#### **_Admin does NOT own_** 

- Day-to-day delivery operations 

- Primary incoming inquiry handling 

Delivery is owned by Production Manager. Customer Support/CSR owns incoming customer support. 

### **3.2 Customer Support / CSR** 

CSR is the customer-facing support function. 

#### **_Responsibilities_** 

- Handle incoming inquiries 

- Respond to customer questions 

- Guide customers through catalogue/order process 

- Assist with order forms 

- Record communication history 

- Handle complaints 

- Document customer issues 

- Escalate commercial decisions to Admin 

- Support customers before and after orders 

#### **_CSR does not normally own_** 

- Final quotations 

- Commercial approval 

- Final order confirmation 

- Production 

- Inventory control 

- Delivery 

- Finance administration 

Admin and CSR may initially be the same people operationally. Therefore, implement granular permissions rather than assuming one user can have only one responsibility. 

### **3.3 Sales Manager** 

Sales Manager owns sales growth and commercial performance analysis. 

#### **_Responsibilities_** 

- Sales pipeline 

Twin Cakery | ERP Architecture 

Page 4 

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

### **3.4 Production Manager** 

Production Manager owns operational fulfillment. 

#### **_Responsibilities_** 

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

## **4. Product Catalogue Architecture** 

The product catalogue must be completely configurable by Admin. 

Do **not** hardcode categories such as cakes, pastries, cookies, buns, etc. The system must allow Twin Cakery to define its own taxonomy and expand it without code changes. 

### **Hierarchy** 

Twin Cakery | ERP Architecture 

Page 5 

`Product Category` ↓ `Product Type` ↓ `Product` ↓ `Product Variant / Options` ↓ `Recipe / Pricing / Catalogue Information` 

### **Product Category** 

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

### **Product Type** 

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

### **Product** 

Fields should include: 

- id 

- SKU/product code 

Twin Cakery | ERP Architecture 

Page 6 

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

### **Product variants/options** 

Do not hardcode fields such as `cake_flavour` or `cake_size` into the core model. Support generic configurable options so the Admin can define what matters to Twin Cakery. 

Examples could include size, flavour, design, quantity, packaging or future attributes, but these must remain configurable. 

### **Catalogue principle** 

`Admin changes ERP catalogue` ↓ `Shared backend data changes` ↓ `Public catalogue reflects the change` 

No duplicate catalogue database. 

## **5. Customer & CRM Module** 

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

Twin Cakery | ERP Architecture 

Page 7 

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

### **Customer Order History & Repeat-Order Intelligence** 

Customer order history is a first-class CRM capability. Every order must be linked to a canonical `customer_id` , while preserving the customer/contact snapshot captured at the time of the order. The customer name must not be the only relationship used to find or group orders. 

#### **_Orders by Customer Name_** 

The ERP shall provide a dedicated customer-order view accessible from both **Customers** and **Orders** . Staff can search by customer name or phone number, select a customer, and immediately see all orders belonging to that customer. The Orders view should also support filtering/grouping by customer name. 

Each customer order list should show at minimum: 

- Customer name 

- Order number 

- Order date 

- Occasion/event 

- Product 

- Size/weight/quantity 

- Order value 

- Payment status 

- Order status 

- Delivery/collection date 

Selecting an order opens its complete record, including quotation information, customization, payment, delivery, production specifications and historical ingredients used. 

#### **_Customer 360° View_** 

The customer profile shall provide a chronological timeline from newest to oldest containing: 

- Complete customer contact information 

- Total number of orders 

- Total spending 

- Customer preferences and recurring instructions 

- Communication/interactions 

- All previous orders 

- Event/reminder records 

Twin Cakery | ERP Architecture 

Page 8 

##### • Feedback and complaints 

The customer order history shall support filters for date range, status, occasion, product/category and payment status, plus print/export of the selected customer's history. 

#### **_Exact Historical Production Record_** 

Every completed order must preserve the exact production information used to fulfill it, including: 

- Recipe/version used 

- Ingredient/material names 

- Exact quantities and units 

- Actual ingredients/materials consumed 

- Substitutions or adjustments 

- Design/customization specifications 

- Production notes 

- Special preparation requirements 

- Actual production cost where recorded 

Historical production records are immutable snapshots. Future recipe, ingredient price, product price or customer-profile changes must never alter the historical record. 

#### **_Repeat Order_** 

Every eligible historical order shall provide a **Repeat Order** action. The system creates a new draft order using the previous order as a template. The copied specification should include product, options, design/customization, production specifications and relevant notes, while allowing the authorized user to change: 

- New order date 

- Delivery/collection date 

- Quantity/size/weight 

- Price 

- Design/customization 

- Ingredients or production specifications 

- Delivery details 

- Customer instructions 

The original order remains unchanged. The new order receives its own order number, status history, payment records and production record. 

#### **_Recurring Event Reminders_** 

For single-event orders associated with recurring annual occasions such as birthdays, wedding anniversaries, graduations or other customer events, the system shall store: 

- Event type 

- Event date 

- Recurrence rule/frequency 

- Customer 

- Related previous order 

- Reminder/contact status 

- Last reminder/contact date 

- Staff member who followed up 

Twin Cakery | ERP Architecture 

Page 9 

- Follow-up notes 

Near the same date in a future year, the system shall automatically create an internal reminder. It must **not automatically contact the customer** unless a separate automated communication feature is explicitly enabled. 

Reminder views shall support: 

- Next 30 days 

- Specific month 

- Specific week 

The dashboard Notifications area shall display upcoming customer-event reminders and link directly to the customer profile and previous order. Staff can mark a reminder as **Reminded/Contacted** and record the outcome. 

#### **_Printable Reminder List_** 

Authorized users shall be able to generate a printable customer follow-up list filtered by the next 30 days, month or week. The document should contain: 

- Customer name 

- Contact details 

- Event type 

- Event date 

- Previous order/product 

- Reminder/contact status 

- Staff follow-up notes 

This is a staff workflow; it is not an automatic customer messaging function. 

#### **_Customer Order History Rules_** 

- One customer may have many orders. 

- Every order must reference one canonical customer record. 

- Customer name/phone search must resolve to the canonical customer where possible. 

- Duplicate customer records should be prevented or flagged for authorized merging. 

- Historical order snapshots must remain unchanged after a customer profile is edited. 

- Customer order history must be permission-aware. 

- Printing/exporting customer history must respect the same authorization rules as viewing it. 

## **6. Inquiry & Automated Intake** 

The initial customer journey is largely automated. 

#### **_Customer entry points_** 

- WhatsApp 

- Phone call 

- Public website 

- Public order form 

#### **_WhatsApp automation_** 

The default automated response should direct customers to two primary paths: 

Twin Cakery | ERP Architecture 

Page 10 

##### 1. Product catalogue 

##### 2. Order form 

The customer can: 

`WhatsApp` ↓ `Catalogue` ↓ `Decide what they want` ↓ `Order form OR call back` 

or: 

`WhatsApp` ↓ `Order form` ↓ `Order proposal/inquiry` ↓ `ERP` 

The system should capture the customer and inquiry data in the ERP. 

CSR handles the inquiry and customer communication. 

Commercial quotation and confirmation then move to Admin. 

## **7. Quotation Workflow** 

Quotation is a distinct business stage before a confirmed order. 

`Inquiry` ↓ `Admin reviews proposal` ↓ `Quotation` ↓ `Customer discussion/negotiation` ↓ `Customer accepts` ↓ `Admin confirms order` 

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

Twin Cakery | ERP Architecture 

Page 11 

- DRAFT 

- SENT 

- NEGOTIATION 

- ACCEPTED 

- REJECTED 

- EXPIRED 

- CANCELLED 

- CONVERTED 

A quotation acceptance must not automatically bypass the Admin-controlled confirmation stage unless that behavior is explicitly configured. 

## **8. Order Management** 

The order is the central business object linking the ERP modules. 

`Customer` ↓ `Inquiry` ↓ `Quotation` ↓ `Confirmed Order` III `Payment` III `Production` III `Inventory` III `Purchasing` III `Delivery` III `Feedback` III `Finance` 

### **Recommended order statuses** 

```
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

```
Order:    IN_PRODUCTION
Payment:  PARTIALLY_PAID
Delivery: PENDING
```

### **Customer-linked order history** 

Every order must be linked to a canonical customer record. The order record should preserve a historical customer/contact snapshot so later edits to the customer profile do not rewrite what was recorded at the time of sale. 

The Orders workspace shall support: 

- Search by customer name or phone 

- Filter/group orders by customer 

- Open the customer profile from an order 

Twin Cakery | ERP Architecture 

Page 12 

- Open all orders from a selected customer 

- Filter by date, occasion, product, status and payment status 

- Print/export a customer's selected or complete order history 

- Repeat a previous order without modifying the original 

### **Order status history** 

Every transition records: 

- order_id 

- previous status 

- new status 

- changed_by 

- reason 

- timestamp 

Never silently overwrite important historical state. 

## **9. Complete Production Workflow** 

The Production Manager owns the production side after an order is confirmed. 

`CONFIRMED ORDER` ↓ `PRODUCTION REVIEW` ↓ `CHECK RECIPE / REQUIREMENTS` ↓ `CHECK INVENTORY` ↓ `RESERVE AVAILABLE STOCK` ↓ `IDENTIFY SHORTAGES` ↓ `PURCHASE IF REQUIRED` ↓ `READY FOR PRODUCTION` ↓ `IN PRODUCTION` ↓ `RECORD ACTUAL USAGE` ↓ `RECORD WASTAGE / SUBSTITUTIONS` ↓ `QUALITY CHECK` ↓ `PASS` IIIIIIIIIIIII→ `READY FOR DELIVERY` I III `FAIL` → `REWORK REQUIRED` → `QUALITY CHECK` ↓ `READY FOR DELIVERY` ↓ `DELIVERY / PICKUP` ↓ `COMPLETED` 

Production Manager should see: 

- order number 

- customer 

- product 

- product options 

- quantity 

- required date/time 

- recipe/version 

Twin Cakery | ERP Architecture 

Page 13 

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

## **10. Recipes & Costing** 

Each production-capable product may have one or more recipe versions. 

```
Recipe
```

III `Recipe Version` III `Ingredient` III `Ingredient quantity` III `Packaging/material` III `Expected wastage` 

Recipe versioning is mandatory for historical costing. 

When a recipe changes: 

`Old Recipe Version` → `remains historical New Recipe Version` → `becomes active` 

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

## **11. Inventory Management** 

Inventory must use a transaction/ledger model. 

Do not rely only on a manually editable `current_quantity` field. 

Twin Cakery | ERP Architecture 

Page 14 

### **Stock calculation** 

```
Opening Stock
+ Purchases
+ Positive Adjustments
- Production Consumption
```

```
- Wastage
```

```
- Damage
```

- `Negative Adjustments` 

- `± Transfers = Physical Stock` 

Then: 

```
Available Stock = Physical Stock - Reserved Stock
```

### **Inventory transactions** 

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

### **Inventory tracking** 

Track: 

- ingredient/material 

- packaging 

- consumables 

- stock level 

- reserved quantity 

- available quantity 

- reorder level 

Twin Cakery | ERP Architecture 

Page 15 

- supplier 

- cost history 

- wastage 

- expiry where relevant 

### **Inventory alerts** 

• Low stock 

- Out of stock 

- Reorder required 

- Expiry risk 

- Unusual wastage 

- Significant price changes 

## **12. Purchasing & Supplier Management** 

Production Manager identifies purchasing requirements based on production and stock. 

#### **_Workflow_** 

`Production Requirement / Reorder Alert` ↓ `Purchase Requirement` ↓ `Purchase Order` ↓ `Supplier` ↓ `Goods Received` ↓ `Inventory Updated` ↓ `Supplier Cost History Updated` 

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

Twin Cakery | ERP Architecture 

Page 16 

- unit prices 

- total 

- status 

- notes 

Goods receipt must create inventory transactions. 

Supplier price history should support cost analysis and supplier comparison. 

## **13. Finance Module** 

Finance is a full module, not merely a dashboard. 

It tracks both revenue and costs across the business. 

### **Revenue** 

Track: 

- quoted amount 

- confirmed order amount 

- discounts 

- payments received 

- outstanding balance 

- payment method 

- payment date 

- reference 

### **Direct order costs** 

Track: 

- ingredient costs 

- packaging 

- production costs 

- delivery costs 

- wastage 

- order-specific expenses 

### **Operating expenses** 

Examples: 

- rent 

- utilities 

- salaries 

- marketing 

- transport 

- maintenance 

Twin Cakery | ERP Architecture 

Page 17 

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

### **Profitability** 

At minimum: 

```
Revenue
- Direct Costs
```

```
= Gross Profit
```

```
Gross Profit
```

- `Operating Expenses` 

```
= Net Operating Result
```

The accounting model can become more sophisticated later, but the data model must preserve the underlying transactions. 

### **Finance dashboard** 

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

## **14. Payments** 

Payment status must be independent from order status. 

Payment statuses: 

- UNPAID 

- PARTIALLY_PAID 

Twin Cakery | ERP Architecture 

Page 18 

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

## **15. Delivery** 

##### **Production Manager owns delivery operations.** 

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

Twin Cakery | ERP Architecture 

Page 19 

```
Order: READY_FOR_DELIVERY
Payment: PAID
Delivery: OUT_FOR_DELIVERY
```

## **16. Quality Control** 

Quality is a formal production stage. 

`Production Complete` ↓ `Quality Check` IIIIIIIIIII `PASS       FAIL` ↓ ↓ `READY      REWORK FOR` ↓ `DELIVERY   CHECK AGAIN` 

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

## **17. Feedback** 

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

Twin Cakery | ERP Architecture 

Page 20 

## **18. Staff Management & Salary / Remuneration** 

Staff management is intentionally lightweight rather than a full HR system. The module manages staff identity, roles, schedules/attendance, and confidential remuneration records. 

### **18.1 Staff Management** 

Track staff ID, name, contact information, role(s), employment status, start date, schedule/work pattern, attendance records and notes. Staff roles and permissions remain controlled through RBAC. 

### **18.2 Salary & Remuneration — Admin Only** 

Salary and remuneration management is a confidential **Admin / Proprietor-only** function by default. Only the Admin may view, create, edit, approve, process, record, or close salary/remuneration records unless an explicit permission is later delegated. 

The module supports basic salary, payment frequency, allowances, deductions, staff advances, bonuses/commissions, other approved payments, payment records, salary history, printable payslips/statements and reports. 

### **18.3 Admin-Defined Payment Periods** 

The ERP must **not assume salaries are monthly** . The Admin determines the payment period for each salary/remuneration run. Supported periods include weekly, biweekly, monthly, quarterly and custom date ranges. 

Each period records a period ID, period type, start date, end date, intended payment date, status, creator, approver where applicable, and timestamps. The Admin may select any valid start and end dates, and the actual payment date may differ from the period being paid. 

### **18.4 Salary Processing Workflow** 

`ADMIN CREATES PAYMENT PERIOD` ↓ `SELECT STAFF / REMUNERATION ITEMS` ↓ `CALCULATE SALARY` ↓ `REVIEW / ADJUST` ↓ `APPROVE PERIOD` ↓ `RECORD ACTUAL PAYMENT` ↓ `MARK PAID` ↓ `CLOSE PERIOD` 

Salary calculation supports: 

```
Basic Salary
+ Allowances / Bonuses / Commissions
- Deductions / Recoveries / Advance Amounts
= Net Amount Payable
```

The Admin must review and adjust applicable amounts before approval. 

### **18.5 Salary & Remuneration Dashboard** 

The Admin interface should show total remuneration due for the selected period, paid amount, pending amount, allowances, deductions, outstanding staff advances, period status and upcoming payment dates, with drill-down to the underlying records. 

### **18.6 Advances, Deductions & Other Payments** 

The Admin can record and track staff advances, advance repayments/recoveries, one-off deductions, allowances, bonuses, commissions and other approved staff payments. Outstanding advance balances must be tracked separately and must not be silently overwritten. 

Twin Cakery | ERP Architecture 

Page 21 

### **18.7 Payment Records & Historical Integrity** 

Each remuneration payment records the staff member, payment period, amount, payment date, payment method, transaction/reference number where applicable, payment status, recorder and notes. Period statuses may include OPEN, PROCESSING, APPROVED, PARTIALLY_PAID, PAID and CLOSED. Once closed, calculations and payment records remain historically reconstructable; corrections create adjustment records rather than silently rewriting closed history. 

### **18.8 Payslips & Reports** 

The Admin can generate printable/downloadable individual payslips, staff payment statements, period salary summaries, allowance reports, deduction reports, advance reports and outstanding remuneration reports. All salary documents inherit Admin-only authorization. 

## **19. Sales Manager Analytics** 

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

## **19. Analytics & Recommendations** 

The ERP should answer questions such as: 

- How much money did we make this month? 

- How much did we spend? 

- What are our largest expenses? 

- Which products sell most? 

- Which categories sell most? 

- Which products have the best margins? 

- Which customers return most often? 

- What causes the most wastage? 

Twin Cakery | ERP Architecture 

Page 22 

- Which ingredients are becoming expensive? 

- Which suppliers are most cost-effective? 

- Which orders are delayed? 

- Where are production bottlenecks? 

### **Recommendation engine** 

Initially use rule-based recommendations, for example: 

- reorder item X 

- supplier price increased by X% 

- product has unusually high wastage 

- order is at risk of missing deadline 

- customer has not ordered again within expected interval 

- category is growing/declining 

- expense category is unusually high 

AI/ML can be added later without changing the core ERP model. 

## **20. Dashboard** 

### **Admin/Proprietor dashboard** 

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

- Salary/remuneration due for selected period 

- Salaries paid and pending 

- Outstanding staff advances 

- Delivery status 

- Recent feedback 

Every metric should drill down to source records where the user has permission. 

Twin Cakery | ERP Architecture 

Page 23 

### **Production dashboard** 

- Today's production 

- Upcoming production 

- Delayed jobs 

- Stock shortages 

- Purchase requirements 

- Production cost 

- Wastage 

- Quality failures 

- Deliveries due 

### **Sales dashboard** 

- New inquiries 

- Conversion rate 

- Quotations 

- Confirmed orders 

- Revenue 

- Repeat customers 

- Customer segments 

- Product/category performance 

### **CSR dashboard** 

- New inquiries 

- Unanswered inquiries 

- Customer issues 

- Follow-ups needing attention 

- Recent customer interactions 

## **21. RBAC Architecture** 

Do not hardcode role names into authorization logic. Define granular permissions and assign them to roles. 

##### Examples: 

```
orders.view
orders.create
orders.edit
orders.confirm
orders.cancel
```

```
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
```

Twin Cakery | ERP Architecture 

Page 24 

```
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
```

```
staff.view
staff.manage
staff.attendance
remuneration.view
remuneration.create
remuneration.edit
remuneration.approve
remuneration.process
remuneration.record_payment
remuneration.close_period
remuneration.view_reports
```

```
payments.view
payments.record
```

```
deliveries.view
deliveries.create
deliveries.dispatch
deliveries.complete
```

```
feedback.view
feedback.create
feedback.resolve
users.manage
roles.manage
settings.manage
audit.view
```

A user may have multiple roles if required. 

## **22. Core Database Entities** 

### **Identity** 

- users 

- roles 

- permissions 

- role_permissions 

- user_roles 

### **Customers** 

- customers 

- customer_addresses 

- customer_interactions 

- customer_events 

- customer_event_reminders 

### **Catalogue** 

- product_categories 

- product_types 

- products 

Twin Cakery | ERP Architecture 

Page 25 

- product_variants 

- product_options 

- product_option_values 

### **Recipes** 

- recipes 

- recipe_versions 

- recipe_items 

- ingredients/materials 

### **CRM/Sales** 

- inquiries 

- quotations 

- quotation_items 

### **Orders** 

- orders 

- order_items 

- order_customer_snapshots 

- order_status_history 

### **Production** 

- production_jobs 

- production_steps 

- production_consumption 

- production_material_snapshots 

- production_costs 

- production_wastage 

- quality_checks 

### **Inventory** 

- inventory_items 

- inventory_transactions 

- stock_locations 

- stock_reservations 

### **Purchasing** 

- suppliers 

- purchase_requirements 

- purchase_orders 

- purchase_order_items 

- goods_receipts 

- goods_receipt_items 

Twin Cakery | ERP Architecture 

Page 26 

- supplier_price_history 

### **Finance** 

- payments 

- expenses 

- expense_categories 

### **Staff & Remuneration** 

- staff 

- staff_attendance 

- salary_profiles 

- remuneration_periods 

- remuneration_items 

- staff_advances 

- remuneration_payments 

- payslips 

### **Delivery** 

- deliveries 

### **Feedback** 

- customer_feedback 

### **System** 

- notifications 

- notification_recipients 

- notification_preferences 

- notification_templates 

- audit_logs 

## **23. API Architecture** 

All API endpoints should be versioned under: 

```
/api/v1
```

### **Authentication** 

```
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

### **Catalogue** 

```
GET    /api/v1/product-categories
POST   /api/v1/product-categories
PATCH  /api/v1/product-categories/:id
```

```
GET    /api/v1/product-types
POST   /api/v1/product-types
```

Twin Cakery | ERP Architecture 

Page 27 

```
PATCH  /api/v1/product-types/:id
```

```
GET    /api/v1/products
POST   /api/v1/products
GET    /api/v1/products/:id
PATCH  /api/v1/products/:id
POST   /api/v1/products/:id/archive
```

### **Customers** 

```
GET    /api/v1/customers
POST   /api/v1/customers
GET    /api/v1/customers/:id
PATCH  /api/v1/customers/:id
GET    /api/v1/customers/:id/orders
GET    /api/v1/customers/:id/events
POST   /api/v1/customers/:id/events
GET    /api/v1/customer-reminders
PATCH  /api/v1/customer-reminders/:id/contacted
GET    /api/v1/customers/:id/order-history/print
```

### **Inquiries** 

```
GET    /api/v1/inquiries
POST   /api/v1/inquiries
GET    /api/v1/inquiries/:id
PATCH  /api/v1/inquiries/:id
```

### **Quotations** 

```
GET    /api/v1/quotations
POST   /api/v1/quotations
GET    /api/v1/quotations/:id
PATCH  /api/v1/quotations/:id
POST   /api/v1/quotations/:id/send
POST   /api/v1/quotations/:id/accept
```

### **Orders** 

```
GET    /api/v1/orders
POST   /api/v1/orders
GET    /api/v1/orders/:id
PATCH  /api/v1/orders/:id
POST   /api/v1/orders/:id/confirm
POST   /api/v1/orders/:id/cancel
POST   /api/v1/orders/:id/repeat
GET    /api/v1/orders/:id/production-record
```

### **Production** 

```
GET  /api/v1/production/jobs
GET  /api/v1/production/jobs/:id
POST /api/v1/production/jobs/:id/start
POST /api/v1/production/jobs/:id/complete
POST /api/v1/production/jobs/:id/quality-check
POST /api/v1/production/jobs/:id/wastage
```

### **Inventory** 

```
GET  /api/v1/inventory
GET  /api/v1/inventory/:id
POST /api/v1/inventory/adjustments
POST /api/v1/inventory/reservations
```

### **Purchasing** 

```
GET  /api/v1/purchase-orders
POST /api/v1/purchase-orders
POST /api/v1/purchase-orders/:id/receive
```

### **Finance** 

```
GET  /api/v1/finance/payments
POST /api/v1/finance/payments
GET  /api/v1/finance/expenses
```

Twin Cakery | ERP Architecture 

Page 28 

```
POST /api/v1/finance/expenses
GET  /api/v1/finance/reports
```

### **Delivery** 

```
GET  /api/v1/deliveries
POST /api/v1/deliveries
POST /api/v1/deliveries/:id/dispatch
POST /api/v1/deliveries/:id/complete
```

### **Feedback** 

```
GET  /api/v1/feedback
POST /api/v1/feedback
PATCH /api/v1/feedback/:id
```

### **Public API** 

```
GET  /api/v1/public/catalogue
GET  /api/v1/public/products/:id
POST /api/v1/public/inquiries
POST /api/v1/public/order-proposals
```

Public endpoints must never expose internal costs, supplier prices, staff information, private notes or private customer data. 

## **24. Business Transactions** 

Operations that affect multiple modules must be executed transactionally. 

### **Confirming an order** 

Potential transaction: 

1. Validate quotation/order 

2. Confirm order 

3. Create order status history 

4. Create production requirement/job 

5. Reserve or prepare stock requirements 

6. Emit internal event 

7. Create notifications 

### **Receiving stock** 

1. Validate purchase order 

2. Create goods receipt 

3. Create inventory transaction 

4. Update purchase receipt state 

5. Record supplier price 

6. Update available stock 

### **Recording production consumption** 

1. Validate stock/reservations 

2. Create consumption transactions 

3. Calculate actual cost 

Twin Cakery | ERP Architecture 

Page 29 

4. Record production cost 

5. Release/update reservations 

6. Preserve audit history 

## **25. Event-Driven Automation** 

Use application events internally. 

Suggested events: 

```
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

`OrderConfirmed` ↓ `Production Job Created` ↓ `Production Manager Notified` ↓ `Stock Check` ↓ `Shortage? /       \ YES       NO` ↓ ↓ `Purchase   Schedule Requirement Production` 

External WhatsApp/email integrations should consume API/events rather than directly writing to PostgreSQL. 

## **Cross-Account Notification Architecture** 

Cross-account notifications are a first-class ERP capability. The notification system must allow one business event to notify one or more authorized users across different ERP accounts while respecting RBAC, notification preferences, and data visibility. 

### **Notification Service** 

Add a central Notification Service inside the modular monolith. Business modules publish internal events; the Notification Service determines recipients and delivery channels. It must not allow external integrations to write directly to PostgreSQL. 

```
Business Module
```

Twin Cakery | ERP Architecture 

Page 30 

↓ `Internal Event` ↓ `Notification Service` ↓ `Recipient Resolution` ↓ `Notification Record` ↓ IIIIIIIIIIIIIIIIIIIIIIIIII 

↓ ↓ ↓ ↓ `In-App WhatsApp  Email    SMS/Push` 

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

### **Cross-Account Recipient Rules** 

Notifications must never be broadcast blindly to all users. Recipients are resolved using business rules, permissions, assignments, and organizational responsibility. 

Examples: 

|Event|Primary recipient(s)|Possible additional recipient(s)|
|---|---|---|
|InquiryCreated|CSR|Assigned support staff|
|QuotationRequired|Admin|Sales Manager|
|OrderConfirmed|Production Manager|Sales Manager, Finance|
|StockShortageDetected|Production Manager|Admin/Sales Manager when delivery risk exists|
|PurchaseRequirementCreated|Production Manager|Authorized purchasing users|
|GoodsReceived|Production Manager|Finance/Admin|
|QualityFailed|Production Manager|Assigned operational staff|
|QualityPassed|Production Manager|Relevant delivery staff|
|DeliveryDue|Production Manager|Assigned delivery staff|
|OrderCompleted|Admin|Sales Manager|
|PaymentReceived|Finance/Admin|Relevant order owner|
|CustomerComplaint|CSR|Responsible manager(s)|
|FeedbackRecorded|Sales Manager|Production Manager when operational feedback<br>exists|



A user may receive a notification only when their account is authorized to access the underlying record. 

### **Notification Data Model** 

Add the following system entities: 

#### **_notifications_** 

Twin Cakery | ERP Architecture 

Page 31 

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

#### **_notification_recipients_** 

- id 

- notification_id 

- user_id 

- delivery_channel 

- delivered_at 

- read_at 

- failed_at 

- failure_reason 

#### **_notification_preferences_** 

- id 

- user_id 

- event_type 

- channel 

- enabled 

#### **_notification_templates_** 

- id 

- event_type 

- channel 

- title_template 

- message_template 

- active 

Notification delivery history should be retained so the ERP can determine whether a notification was created, delivered, read, or failed. 

### **Notification Channels** 

#### **_1. In-App_** 

The primary internal channel is real-time ERP notification delivery. The React application should show: 

- unread notification count 

- notification center 

Twin Cakery | ERP Architecture 

Page 32 

- timestamp 

- priority 

- notification category 

- read/unread state 

- link to the related order/customer/task 

- mark as read 

- mark all as read 

Use WebSockets (for example Socket.IO) or Server-Sent Events so important notifications can appear without a page refresh. 

#### **_2. WhatsApp_** 

WhatsApp is an external delivery channel. It may be used for customer notifications and, where configured, authorized staff notifications. It must consume application events/API interfaces and must never write directly to PostgreSQL. 

#### **_3. Email_** 

Email can be used for notifications requiring a persistent message or where the user has enabled email delivery. 

#### **_4. SMS / Push_** 

SMS or mobile push can be added later without changing the business event model. 

### **Actionable Notifications** 

Notifications should support actions, not merely informational text. 

##### Example: 

```
STOCK SHORTAGE — Order #TC-1045
2kg of required material is unavailable.
```

```
[View Order] [Create Purchase Requirement]
```

##### Another example: 

```
CUSTOMER FOLLOW-UP DUE
Order #TC-1038 was completed.
```

```
[View Customer] [Record Feedback]
```

Actions must still pass through normal API authorization and business rules. A notification button must never bypass RBAC or approval rules. 

### **Notification Preferences** 

Users should be able to control supported channels for non-critical notifications. Critical operational notifications may be mandatory according to business policy. Preferences must not override access control. 

Example preferences: 

```
Order confirmed        In-App   Email   WhatsApp —
Payment received       In-App   Email   WhatsApp —
Customer complaint     In-App   Email   WhatsApp
Marketing notifications In-App —  Email —  WhatsApp —
```

### **Notification API** 

Internal ERP API should expose, as appropriate: 

```
GET  /api/v1/notifications
GET  /api/v1/notifications/unread-count
PATCH /api/v1/notifications/:id/read
```

Twin Cakery | ERP Architecture 

Page 33 

```
POST /api/v1/notifications/mark-all-read
GET  /api/v1/notification-preferences
PATCH /api/v1/notification-preferences
```

Administrative notification-management endpoints should be protected by granular permissions. 

### **Notification Security** 

Notifications can contain sensitive operational information. Therefore: 

- recipient resolution must be server-side 

- notification APIs must enforce RBAC 

- deep links must enforce authorization again when opened 

- public users must never receive internal notifications 

- supplier costs, internal production costs, private customer information, and private notes must not leak through notifications 

- external channels must use approved templates and sanitized data 

### **Notification Reliability** 

Notifications should be designed so business operations do not fail merely because an external notification provider is unavailable. 

`OrderConfirmed` ↓ `Database transaction commits` ↓ `Internal event / outbox` ↓ `Notification processing` ↓ `In-App delivery` ↓ `WhatsApp / Email / SMS` ↓ `Retry failed external deliveries` 

For reliable delivery, implement an outbox/job mechanism as the system grows. The core transaction remains the source of truth; notification delivery is asynchronous. 

### **Cross-Account Notification Workflow Examples** 

#### **_Confirmed Order_** 

`Admin confirms order` ↓ `OrderConfirmed event` ↓ `Notification Service` ↓ `Production Manager account notified` ↓ `Sales Manager account optionally notified` ↓ `Finance/Admin account notified when payment action is required` 

#### **_Completed Order_** 

`Production Manager completes delivery/order` ↓ `OrderCompleted event` ↓ `Admin receives real-time follow-up notification` ↓ `Admin calls/WhatsApps customer` ↓ `Feedback recorded` ↓ `Sales Manager + Production Manager can analyze relevant feedback` 

#### **_Stock Shortage_** 

```
Production Manager checks inventory
```

Twin Cakery | ERP Architecture 

Page 34 

↓ `StockShortageDetected` ↓ `Production Manager notified/action available` ↓ `Purchase Requirement created` ↓ `Authorized purchasing users notified` ↓ `Goods received` ↓ `Production Manager notified that stock is available` 

### **Dashboard and Notification Relationship** 

Notifications complement dashboards; they do not replace them. Dashboards show the current operational state, while notifications highlight changes or actions requiring attention. 

The ERP should therefore support: 

- persistent dashboard state 

- real-time notifications 

- notification history 

- task/action links 

- unread counts 

- event audit trail 

## **26. Complete End-to-End Workflow** 

`CUSTOMER` ↓ `WhatsApp / Call / Website` ↓ `Automated WhatsApp Response` ↓ `Catalogue + Order Form` ↓ `Customer Inquiry / Order Proposal` ↓ `CRM` ↓ `CSR Handles Inquiry` ↓ `Commercial Decision Needed?` ↓ `ADMIN` ↓ `Quotation` ↓ `Negotiation / Adjustments` ↓ `Customer Accepts` ↓ `ADMIN CONFIRMS ORDER` ↓ `CONFIRMED ORDER` ↓ `PRODUCTION MANAGER` ↓ `Production Review` ↓ `Recipe + Inventory Check` ↓ `Reserve Stock` ↓ `Shortage? /   \ YES   NO |     | Purchase | |     | Receive Stock \     / READY FOR PRODUCTION` ↓ `IN PRODUCTION` ↓ `Actual Usage / Wastage / Cost` ↓ `QUALITY CHECK /       \` 

Twin Cakery | ERP Architecture 

Page 35 

`PASS       FAIL` ↓ ↓ `READY FOR     REWORK DELIVERY` ↓ `|       QUALITY CHECK` ↓ `PRODUCTION MANAGER` ↓ `DELIVERY / PICKUP` ↓ `CUSTOMER RECEIVES` ↓ `ORDER COMPLETED` ↓ `PAYMENT RECONCILIATION` ↓ `CUSTOMER FEEDBACK` ↓ `CRM` ↓ `SALES MANAGER ANALYSIS` ↓ `RETENTION / GROWTH STRATEGY` 

## **27. What the ERP Tracks** 

### **Customer** 

- identity 

- demographics/segments where voluntarily collected and appropriate 

- contact information 

- source 

- interaction history 

- order history 

- spending 

- feedback 

- repeat behavior 

### **Orders** 

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

### **Production** 

- schedule 

- responsible manager/staff 

Twin Cakery | ERP Architecture 

Page 36 

- recipe version 

- planned ingredients 

- actual ingredients 

- production time 

- wastage 

- substitutions 

- cost 

- quality result 

- rework 

### **Inventory** 

- physical stock 

- reserved stock 

- available stock 

- purchases 

- consumption 

- wastage 

- adjustments 

- reorder levels 

- supplier prices 

### **Finance** 

- revenue 

- payments 

- outstanding balances 

- direct order costs 

- expenses 

- gross profit 

- net operating result 

- cash movement 

### **Sales** 

- inquiries 

- quotations 

- conversions 

- lost opportunities 

- product/category performance 

- repeat customers 

- customer segments 

- sales trends 

## **28. ERP Navigation** 

Twin Cakery | ERP Architecture 

Page 37 

Recommended navigation: 

```
Dashboard
```

`CRM` III `Customers` I III `Customer Order History` III `Customer Events & Reminders` III `Inquiries` III `Interactions` III `Feedback Sales` III `Quotations` III `Orders` I III `Orders by Customer` III `Sales Analytics Catalogue` III `Categories` III `Product Types` III `Products` III `Variants / Options Production` III `Schedule` III `Jobs` III `Quality` III `Production Costs Inventory` III `Stock` III `Reservations` III `Transactions` III `Adjustments` III `Alerts Purchasing` III `Suppliers` III `Requirements` III `Purchase Orders` III `Goods Received Finance` III `Payments` III `Expenses` III `Profitability` III `Reports Staff Management` III `Staff Profiles` III `Roles & Permissions` III `Attendance / Schedules` III `Salary & Remuneration (Admin Only)` III `Remuneration Periods` III `Process Salary` III `Advances & Deductions` III `Payments` III `Payslips / Statements` III `Reports Delivery` III `Upcoming` III `Dispatch` III `Completed Administration` III `Users` III `Roles` III `Permissions` III `Business Settings` III `Audit Log` 

Navigation must be permission-aware. 

## **29. Public Website** 

The public website is a separate frontend application using the same backend. 

Suggested pages: 

- Home 

- About 

- Catalogue 

Twin Cakery | ERP Architecture 

Page 38 

- Product details 

- Contact 

- Order 

- FAQ if desired 

The website should consume the catalogue from: 

```
GET /api/v1/public/catalogue
```

It should not maintain a hardcoded duplicate catalogue. 

## **30. Public Order Form** 

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

## **31. WhatsApp Integration** 

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

Twin Cakery | ERP Architecture 

Page 39 

• feedback requests 

The ERP remains the system of record. 

## **32. API Error Format** 

Use a consistent response model: 

```
{
```

```
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
```

```
    "message": "The submitted order is invalid.",
```

```
    "details": {}
  }
}
```

Do not expose stack traces, database internals or secrets to clients. 

## **33. Search, Filtering & Pagination** 

Use server-side pagination for large datasets. 

Example: 

```
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

## **34. Audit Trail** 

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

Twin Cakery | ERP Architecture 

Page 40 

- expenses 

- stock adjustments 

- production completion 

- quality decisions 

- delivery completion 

- recipe changes 

- product changes 

- user/role changes 

## **35. Security** 

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

## **36. Historical Integrity** 

Historical records must remain reconstructable. 

Examples: 

- Old order prices must not change when product prices change. 

- Old production must remain tied to its recipe version. 

Twin Cakery | ERP Architecture 

Page 41 

- Inventory history should remain ledger-based. 

- Payment history must be preserved. 

- Status history must be preserved. 

- Supplier price history must be preserved. 

- Corrections should generally create adjustment records instead of silently rewriting history. 

## **37. Testing Strategy** 

### **Unit tests** 

Test: 

- calculations 

- validation 

- permission checks 

- state transitions 

- inventory calculations 

- financial calculations 

### **Integration tests** 

Test: 

- API + database 

- order confirmation 

- stock reservation 

- production consumption 

- goods receipt 

- payment recording 

- delivery completion 

### **End-to-end tests** 

Test the entire customer-to-completion journey. 

Critical scenario: 

`Customer submits order` → `inquiry created` → `CSR handles inquiry` → `Admin creates quotation` → `customer accepts` → `Admin confirms order` 

→ `Production Manager receives order` → `stock check` → `purchase shortage if needed` → `goods received` → `production` → `wastage/cost recorded` → `quality check` → `rework if failed` → `quality passed` → `delivery` → `payment reconciled` → `feedback` → `analytics updated` 

Twin Cakery | ERP Architecture 

Page 42 

## **38. Development Roadmap** 

### **Phase 1 — Foundation** 

- monorepo 

- React/Vite/TypeScript 

- Express/TypeScript 

- PostgreSQL 

- migrations 

- shared types 

- shared validation 

- API client 

- environment configuration 

### **Phase 2 — Identity & RBAC** 

- login 

- logout 

- current user 

- users 

- roles 

- permissions 

- route guards 

- API authorization 

### **Phase 3 — Catalogue** 

- categories 

- product types 

- products 

- variants/options 

- catalogue visibility 

- public catalogue endpoint 

### **Phase 4 — CRM / Intake** 

- customers 

- interactions 

- customer order history 

- orders-by-customer search/filtering 

- customer events 

- customer reminder records 

- printable reminder list 

- inquiries 

- public inquiry endpoint 

- CSR workspace 

Twin Cakery | ERP Architecture 

Page 43 

### **Phase 5 — Quotations** 

- quotation creation 

- quotation items 

- pricing 

- discounts 

- negotiation 

- acceptance 

- conversion 

### **Phase 6 — Orders** 

- order creation 

- confirmation 

- customer linkage and historical snapshot 

- customer-specific order history 

- repeat order 

- status lifecycle 

- status history 

- payment status 

### **Phase 7 — Recipes** 

- ingredients/materials 

- recipes 

- recipe versions 

- recipe items 

### **Phase 8 — Inventory** 

- inventory items 

- transactions 

- reservations 

- adjustments 

- wastage 

- reorder levels 

### **Phase 9 — Production** 

- jobs 

- scheduling 

- production steps 

- consumption 

- actual costing 

- quality 

- rework 

### **Phase 10 — Purchasing** 

Twin Cakery | ERP Architecture 

Page 44 

• suppliers 

- requirements 

- purchase orders 

- goods receipt 

- price history 

### **Phase 11 — Finance** 

- payments 

- expenses 

- direct costs 

- profitability 

- reports 

### **Phase 12 — Delivery** 

- scheduling 

- dispatch 

- delivery tracking 

- pickup 

- completion 

### **Phase 13 — Feedback & Sales Intelligence** 

- feedback 

- complaints 

- resolutions 

- segmentation 

- retention 

- sales analytics 

### **Phase 14 — Automation** 

- notifications 

- customer event reminder generation 

- 30-day/month/week reminder views 

- reminder/contact status tracking 

- printable reminder jobs 

- event handlers 

- WhatsApp integration 

- email integration if needed 

### **Phase 15 — Public Website + Order Form** 

- website 

- catalogue 

- product pages 

- order form 

Twin Cakery | ERP Architecture 

Page 45 

• contact/inquiry flows 

## **39. First Vertical Slice** 

Do not build every module in isolation first. Prove one complete business path. 

`Admin creates category` ↓ `Admin creates product type` ↓ `Admin creates product` ↓ `Product appears in public catalogue` ↓ `Customer submits order form` ↓ `Inquiry enters CRM` ↓ `CSR handles inquiry` ↓ `Admin creates quotation` ↓ `Customer accepts` ↓ `Admin confirms order` ↓ `Production Manager sees confirmed order` ↓ `Stock check` ↓ `Production scheduled` ↓ `Production completed` ↓ `Quality passed` ↓ `Production Manager completes delivery` ↓ `Payment reconciled` ↓ `Feedback recorded` ↓ `Analytics updated` 

This is the first major acceptance test for the platform. 

## **40. Non-Negotiable Architecture Rules** 

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

Twin Cakery | ERP Architecture 

Page 46 

17. Finance is a complete ERP module. 

18. Important actions are auditable. 

19. Historical records remain reconstructable. 

20. Cross-module business operations use database transactions. 

21. API is versioned. 

22. Public endpoints cannot expose internal data. 

23. Start as a modular monolith. 

24. Build a complete vertical slice before expanding every feature. 

25. Keep business modules independently testable. 

26. Every order is linked to a canonical customer and remains searchable by customer name/phone. 

27. Customer order history must preserve historical order and production snapshots. 

28. Repeat Order creates a new order and never mutates the original order. 

29. Recurring customer-event reminders notify staff internally; customer contact is manual unless explicitly automated. 

30. Reminder lists must support next-30-days, month and week filtering and printing. 

31. Salary and remuneration records are Admin/Proprietor-only by default. 

32. Salary payment periods are Admin-defined and may be weekly, biweekly, monthly, quarterly or custom date ranges. 

33. Salary/remuneration records must preserve period, calculation, approval and payment history and must not silently overwrite closed periods. 

34. Staff management remains lightweight; do not introduce a full HR/payroll suite unless explicitly required. 

## **41. Coding Agent Instructions** 

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

- enforce Admin-only authorization for salary/remuneration records 

- support Admin-defined salary payment periods including custom date ranges 

- preserve remuneration period, approval and payment history 

- write tests for critical workflows 

- expose only public-safe fields through public APIs 

Twin Cakery | ERP Architecture 

Page 47 

The implementation should be designed for future expansion without requiring a fundamental rewrite. 

## **42. Final Architecture** 



<!-- Start of picture text -->
                         CUSTOMER<br>                            |<br>                   WhatsApp / Website / Call<br>                            |<br>                  +---------v---------+<br>                  | Public Catalogue  |<br>                  | Public Order Form |<br>                  +---------+---------+<br>                            |<br>                       Inquiry/Proposal<br>                            |<br>                    +-------v--------+<br>                    |      CRM       |<br>                    +-------+--------+<br>                            |<br>                           CSR<br>                            |<br>                    Commercial Decision<br>                            |<br>                          ADMIN<br>                            |<br>                       QUOTATION<br>                            |<br>                     Customer Accepts<br>                            |<br>                    ORDER CONFIRMED<br>                            |<br>                +-----------v------------+<br>                |    ORDER MANAGEMENT    |<br>                +-----------+------------+<br>                            |<br>                   PRODUCTION MANAGER<br>                            |<br>             +--------------+--------------+<br>             |              |              |<br>        INVENTORY       PURCHASING     PRODUCTION<br>             |              |              |<br>             +--------------+--------------+<br>                            |<br>                       QUALITY CHECK<br>                            |<br>                         DELIVERY<br>                            |<br>                       COMPLETED<br>                            |<br>                    PAYMENT / FINANCE<br>                            |<br>                        FEEDBACK<br>                            |<br>                     SALES ANALYTICS<br>                            |<br>                  RETENTION / GROWTH<br>                    POSTGRESQL<br>                         ^<br>                         |<br>                  EXPRESS API<br>                         ^<br>                         |<br>        +----------------+----------------+<br>        |                |                |<br>      ERP UI          Website        Order Form<br><!-- End of picture text -->

### **End State** 

Twin Cakery's ERP should become the single operational system connecting: 

##### **Customer acquisition + Sales + Catalogue + Orders + Production + Inventory + Purchasing + Finance + Delivery + Quality + Customer Experience + Analytics + Growth.** 

The system should be configurable enough that the proprietor can define how Twin Cakery organizes its products and operations while preserving strong technical controls, auditability, financial traceability and role-based access. 

Twin Cakery | ERP Architecture 

Page 48 


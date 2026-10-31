# Twin Cakery --- Customers & CRM UI/UX Improvement Guide

## 1. Purpose

This document proposes a focused redesign of the **customer details
panel** in Twin Cakery's Customers & CRM module.

The existing screen already has a useful foundation:

-   A persistent left navigation sidebar.
-   A customer directory on the left.
-   A selected-customer details panel on the right.
-   A dark interface with gold accents.
-   Existing order history, occasions, reminders and feedback
    functionality.

The recommendation is **not to rebuild the whole module**. Keep the
existing two-column customer workspace and improve how customer
information is grouped, prioritized and accessed.

The central design direction is a **customer profile with tabbed
navigation**.

------------------------------------------------------------------------

## 2. Assessment of the current interface

Based on the three supplied screenshots, the main usability issues are:

  -----------------------------------------------------------------------
  Current issue                       Recommended improvement
  ----------------------------------- -----------------------------------
  Order history is displayed as       Present orders in a structured
  loosely grouped text                table or compact order cards

  Customer identity and key           Add a clear customer profile header
  information lack hierarchy          

  Feedback form permanently occupies  Move feedback entry into a modal or
  space                               side drawer opened from the
                                      Feedback tab

  Occasions and reminders create      Use compact sections and useful
  large empty areas                   empty states

  Several unrelated sections are      Group information into dedicated
  stacked vertically                  tabs

  Available panel width is not used   Use a consistent grid and align
  effectively                         content into clear sections

  Customer identity is repeated in    Establish one persistent profile
  the details panel                   header

  Important actions are not           Provide clear Edit, Print and other
  immediately obvious                 contextual actions
  -----------------------------------------------------------------------

### Design principles

1.  **Prioritize identity:** The selected customer's name, ID and status
    should be immediately visible.
2.  **Make information scannable:** Use labels, consistent alignment,
    tables and concise cards.
3.  **Separate viewing from editing:** Do not show large data-entry
    forms by default.
4.  **Keep context visible:** The customer header should remain visible
    while users switch between tabs.
5.  **Use empty space intentionally:** Empty states should be compact
    and explain what the user can do next.
6.  **Preserve existing functionality:** Reuse current data and business
    logic wherever possible.

------------------------------------------------------------------------

## 3. Recommended overall layout

Retain the existing two-column desktop layout:

-   **Left column:** Customer directory, search and customer selection.
-   **Right column:** Selected customer's profile and tabbed details.

### 3.1 Customer directory

At the top of the directory, show:

-   Customer count.
-   Search field.
-   Add customer action.
-   Optional filters for customer type and status.

Each customer row should display:

-   Initials or avatar.
-   Customer name.
-   Customer ID.
-   Customer type, such as Internal or External.
-   Order count.
-   Active/inactive status.

The selected row should have a subtle gold border or background. Keep
the directory independently scrollable so scrolling through customers
does not move the details panel.

### 3.2 Customer workspace

The right panel should contain:

1.  Customer profile header.
2.  Customer summary metrics.
3.  Tab navigation.
4.  Active tab content.

On smaller screens, the directory can become a collapsible panel or a
separate customer-selection view.

------------------------------------------------------------------------

## 4. Customer profile header

The profile header should be the first thing users see after selecting a
customer.

### Recommended content

-   Customer avatar or initials.
-   Customer name.
-   Customer ID.
-   Customer type.
-   Customer status.
-   Optional customer category, such as Regular customer or VIP.
-   Contact details when available.
-   Contextual actions such as Edit customer, Print profile and More
    actions.

### Suggested summary metrics

Show three compact metrics beneath the identity:

  Metric         Description
  -------------- -----------------------------------------------
  Total orders   Number of orders associated with the customer
  Last order     Date and value of the most recent order
  Total spent    Sum of qualifying customer orders

Only display calculated values when the underlying data supports them.
For example, do not show a lifetime-spend figure based on only the three
most recent orders.

### Suggested component structure

``` text
CustomerProfileHeader
├── CustomerIdentity
│   ├── Avatar
│   ├── Name
│   ├── Customer ID
│   ├── Customer Type
│   └── Status Badge
├── CustomerContactSummary
├── CustomerMetrics
│   ├── TotalOrders
│   ├── LastOrder
│   └── TotalSpent
└── CustomerActions
    ├── EditCustomer
    ├── PrintProfile
    └── MoreActions
```

The profile header should remain visible when users switch tabs. If the
panel is long, make the header sticky within the details panel rather
than sticky across the entire application.

------------------------------------------------------------------------

## 5. Tabbed customer details

This is the most important proposed change.

Replace the current long, continuously scrolling customer record with
four main tabs:

  -----------------------------------------------------------------------
  Tab                                 Purpose
  ----------------------------------- -----------------------------------
  Overview                            Contact information, customer
                                      statistics and recent activity

  Orders                              Complete order history and order
                                      details

  Feedback                            Feedback records, comments and
                                      resolutions

  Occasions                           Birthdays, anniversaries and
                                      scheduled reminders
  -----------------------------------------------------------------------

### 5.1 Overview tab

The Overview tab should provide a concise snapshot of the customer.

Recommended sections:

**Contact information** - Phone number. - Email address. - Address or
location. - Customer type. - Customer ID. - Date added, if available.

**Customer summary** - Total orders. - Total spent. - Last order date. -
Last order amount. - Optional average order value.

**Recent activity** - Latest three to five orders. - Recent feedback
entries. - Upcoming occasion reminders, if any.

Provide links or actions to open the full Orders, Feedback or Occasions
tabs.

### 5.2 Orders tab

Replace the current plain-text order history with a structured table or
compact order cards.

Recommended columns:

  Field      Description
  ---------- ---------------------------
  Order ID   Clickable order reference
  Date       Order date
  Amount     Total order value
  Status     Current order status
  Action     Open order details

Use clear status badges, for example:

-   Ready --- green.
-   Pending --- amber.
-   Cancelled --- red.
-   Completed --- neutral or green, according to the application's
    status conventions.

The order ID should open the existing sales order details view. Reuse
the existing order-detail component and business logic rather than
implementing a second order-detail experience inside CRM.

Provide: - Pagination or incremental loading for customers with many
orders. - Sorting by date and amount. - Optional status filtering. - A
clear empty state when the customer has no orders.

### 5.3 Feedback tab

The Feedback tab should show recorded feedback, not an always-visible
feedback form.

At the top, show: - Total feedback records. - Optional feedback-category
breakdown. - A **Record feedback** action.

Each feedback record should display: - Related order. - Feedback type. -
Customer comment. - Resolution. - Date recorded. - Employee who recorded
it, if available.

When the user selects **Record feedback**, open a modal or side drawer
containing the existing fields:

1.  Select completed order.
2.  Feedback type.
3.  Comment.
4.  Resolution.
5.  Save feedback.

The form should validate required fields and provide clear success or
error feedback. Reset or close the form only after a successful save,
not before.

### 5.4 Occasions tab

Use this tab for important customer dates, including:

-   Birthdays.
-   Anniversaries.
-   Other custom occasions.

Each occasion should show: - Occasion name/type. - Date. - Optional
note. - Reminder lead time. - Next reminder date, where applicable.

Allow users to choose reminder lead times such as: - 7 days before. - 14
days before. - 30 days before. - A custom interval, if supported.

The reminder system should be clear about what it does. For example, if
reminders are internal only, state that they appear inside the
application and do not automatically contact the customer.

### 5.5 Reminders

Reminders can be displayed within the Occasions tab rather than taking
up a large separate section in the default profile view.

Show: - Upcoming reminders. - Due reminders. - Completed or dismissed
reminders, if the workflow requires them.

Use concise empty states when no reminders are due.

------------------------------------------------------------------------

## 6. Order history presentation

The existing order history is difficult to scan because order IDs,
dates, amounts and statuses appear as separate lines.

Use a consistent row structure:

``` text
ORDER       DATE          AMOUNT          STATUS
TC-1047     08 Oct 2026   UGX 67,000      Ready
TC-1046     08 Oct 2026   UGX 70,000      Ready
TC-1045     08 Oct 2026   UGX 56,000      Ready
```

Recommendations:

-   Right-align monetary values.
-   Keep date formats consistent throughout the application.
-   Use the same currency formatting used by Sales & Orders.
-   Make order references clickable.
-   Use status badges consistently.
-   Do not truncate important order identifiers.
-   Show a total order count and provide a **View all orders** action.

The example values above are based on the supplied screenshots and are
illustrative of the proposed presentation. Production values must come
from the actual order records.

------------------------------------------------------------------------

## 7. Feedback management interaction

### Default state

The Feedback tab should show a compact summary and a list of existing
feedback records.

If there is no feedback, show a compact empty state:

``` text
[Feedback icon]

No feedback recorded
Record feedback from a completed order.

[ + Record feedback ]
```

### Record feedback interaction

Open a modal or side drawer with:

``` text
Record customer feedback

Related completed order    [Choose an order...]

Feedback type              [General feedback]

Comment                    [Customer feedback...]

Resolution                 [How was it resolved?]

[Cancel]                   [Record feedback]
```

Use the existing feedback fields and validation rules. Avoid duplicating
feedback logic between the CRM and any other feedback-management area.

------------------------------------------------------------------------

## 8. Occasions and reminders presentation

The current empty occasions and reminders areas occupy too much vertical
space.

Use compact sections with a clear action:

``` text
Customer occasions                         [ + Add ]

[Calendar icon]
No occasions added
Add a birthday or anniversary.
```

``` text
Upcoming reminders

[Reminder icon]
No upcoming reminders
Upcoming reminders will appear here.
```

When records exist, show them as compact cards with the occasion, date
and reminder status.

------------------------------------------------------------------------

## 9. Visual design guidance

Preserve the existing Twin Cakery dark theme and gold accent. Improve
consistency rather than introducing a completely new visual identity.

### Colour usage

  Purpose                 Recommendation
  ----------------------- ------------------------------------
  Main background         Existing dark brown/charcoal
  Elevated surfaces       Slightly lighter dark surface
  Borders                 Subtle low-contrast neutral border
  Primary actions         Existing Twin Cakery gold
  Selected navigation     Gold-tinted background and border
  Active/success status   Green
  Pending status          Amber
  Error/overdue status    Red
  Secondary information   Muted neutral text

### Spacing and hierarchy

-   Use approximately 16--24px between major sections.
-   Use consistent 8px-based spacing increments for smaller gaps.
-   Use clear section titles and smaller muted labels.
-   Keep secondary metadata visually quieter than customer names and
    order amounts.
-   Avoid excessive borders around every individual piece of
    information.
-   Use cards only when they establish a meaningful grouping.

### Empty states

Empty states should: - Use a small relevant icon. - Have one short
title. - Explain what is missing or what will appear there. - Provide an
action where appropriate. - Avoid large blank areas or oversized
illustrations.

### Responsive behaviour

**Desktop** - Keep directory and details side by side. - Allow each
panel to scroll independently. - Keep the customer profile header
visible while switching tabs.

**Tablet** - Reduce directory width where appropriate. - Allow the
details panel to use the available width.

**Mobile** - Use a customer list view followed by a customer profile
view. - Provide an obvious Back to customers action. - Allow horizontal
tab scrolling or another compact tab-navigation pattern. - Keep
important actions accessible without requiring excessive scrolling.

------------------------------------------------------------------------

## 10. Suggested React component architecture

A possible component structure is:

``` text
CustomersCRM/
├── CustomersCRMPage
│   ├── CustomerDirectory
│   │   ├── CustomerSearch
│   │   ├── CustomerFilters
│   │   ├── CustomerList
│   │   └── CustomerListItem
│   │
│   └── CustomerDetailsPanel
│       ├── CustomerProfileHeader
│       │   ├── CustomerIdentity
│       │   ├── CustomerContactSummary
│       │   ├── CustomerMetrics
│       │   └── CustomerActions
│       │
│       ├── CustomerDetailsTabs
│       │   ├── CustomerOverview
│       │   ├── CustomerOrderHistory
│       │   ├── CustomerFeedback
│       │   └── CustomerOccasions
│       │
│       └── CustomerDialogs
│           ├── EditCustomerDialog
│           ├── RecordFeedbackDialog
│           └── AddOccasionDialog
```

### Component responsibilities

  -----------------------------------------------------------------------
  Component                           Responsibility
  ----------------------------------- -----------------------------------
  `CustomersCRMPage`                  Owns the page layout and selected
                                      customer

  `CustomerDirectory`                 Search, filter and select customers

  `CustomerListItem`                  Displays one customer in the
                                      directory

  `CustomerDetailsPanel`              Displays the selected customer's
                                      information

  `CustomerProfileHeader`             Displays customer identity, status
                                      and summary

  `CustomerDetailsTabs`               Controls active tab

  `CustomerOverview`                  Displays contact details and recent
                                      activity

  `CustomerOrderHistory`              Displays customer orders

  `CustomerFeedback`                  Displays feedback records and opens
                                      feedback form

  `CustomerOccasions`                 Displays occasions and reminders

  Dialog components                   Handle create/edit workflows
  -----------------------------------------------------------------------

### Data and state recommendations

-   Keep the selected customer ID at the page/workspace level.
-   Fetch or derive customer details based on the selected customer.
-   Keep tab state local to the details panel unless deep-linking is
    required.
-   Avoid refetching the entire customer directory when changing tabs.
-   Use the existing API/service layer for customer, order, feedback and
    occasion data.
-   Handle loading, error and empty states separately.
-   Ensure that changing the selected customer resets or updates the
    active tab appropriately.
-   Avoid hardcoding example customers, amounts, order statuses or
    counts.

------------------------------------------------------------------------

## 11. Implementation plan

Implement the redesign incrementally to avoid destabilizing existing CRM
functionality.

### Phase 1 --- Restructure the details panel

-   [ ] Preserve the existing customer directory.
-   [ ] Add the new customer profile header.
-   [ ] Add customer summary metrics using real data.
-   [ ] Introduce the four tabs.
-   [ ] Move existing information into the appropriate tab.
-   [ ] Keep existing customer selection behaviour working.

### Phase 2 --- Improve order history

-   [ ] Replace plain-text order history with a table or cards.
-   [ ] Add status badges.
-   [ ] Make order IDs open the existing order-detail view.
-   [ ] Add pagination or incremental loading if needed.
-   [ ] Confirm that amounts and dates match Sales & Orders.

### Phase 3 --- Improve feedback

-   [ ] Move the feedback form into a modal or side drawer.
-   [ ] Display existing feedback records in the Feedback tab.
-   [ ] Add a compact empty state.
-   [ ] Preserve order selection and feedback validation.
-   [ ] Confirm that saving feedback updates the displayed list.

### Phase 4 --- Improve occasions and reminders

-   [ ] Move occasions and reminders into the Occasions tab.
-   [ ] Replace large empty sections with compact empty states.
-   [ ] Add reminder lead-time options where supported.
-   [ ] Verify reminder scheduling and display behaviour.

### Phase 5 --- Polish and test

-   [ ] Check desktop, tablet and mobile layouts.
-   [ ] Verify independent scrolling of the directory and details panel.
-   [ ] Verify sticky profile-header behaviour.
-   [ ] Test customers with no orders.
-   [ ] Test customers with many orders.
-   [ ] Test customers with no feedback and multiple feedback records.
-   [ ] Test customers with no occasions and multiple occasions.
-   [ ] Test loading, error and empty states.
-   [ ] Confirm that all existing CRM actions still work.

------------------------------------------------------------------------

## 12. Instructions for the coding agent

Use the following implementation brief:

> Redesign the existing Twin Cakery Customers & CRM customer details
> panel using the recommendations in this document.
>
> Do not rebuild the entire CRM module and do not remove existing
> functionality.
>
> Preserve the current dark theme, gold accent, sidebar and two-column
> desktop layout.
>
> Start by inspecting the existing customer page, components, data
> models, API calls and state management. Reuse existing business logic
> and services.
>
> Introduce a customer profile header with customer identity, status,
> contact information and summary metrics.
>
> Replace the long vertically stacked customer record with four tabs:
> Overview, Orders, Feedback and Occasions.
>
> Move the feedback entry form into a modal or side drawer opened from
> the Feedback tab. Keep the existing fields, validation and save
> behaviour.
>
> Present order history in a structured table or compact cards. Make
> order references open the existing sales order details view.
>
> Move occasions and reminders into the Occasions tab and use compact
> empty states.
>
> Keep the customer directory independently scrollable from the details
> panel. Keep the profile header visible while users navigate the tabs.
>
> Use real application data. Do not introduce hardcoded customer
> records, order counts, amounts or statuses.
>
> Implement incrementally, test each area and avoid unrelated changes to
> the rest of the application.

------------------------------------------------------------------------

## 13. Visual reference links

The original screenshots supplied for this review are the primary
references for the current interface. The visual examples in the
accompanying discussion were inspiration images rather than verified
product screenshots or formal design-system specifications.

The following links open image-search results for the visual directions
discussed. They are inspiration references, not claims that a particular
image is the exact design to reproduce.

1.  [Dark CRM customer profile dashboard --- image
    references](https://www.google.com/search?tbm=isch&q=modern+premium+dark+CRM+customer+profile+dashboard+order+history+tabs+gold+accent)
2.  [Dark CRM customer feedback management --- image
    references](https://www.google.com/search?tbm=isch&q=modern+dark+CRM+customer+feedback+management+interface+feedback+timeline+form+drawer)
3.  [Dark CRM dashboard and customer workspace --- image
    references](https://www.google.com/search?tbm=isch&q=dark+CRM+customer+management+dashboard+split+view+customer+list+details)

### Further UI implementation references

These are additional practical references for implementing the
recommended patterns:

-   [Material Design ---
    Tabs](https://m3.material.io/components/tabs/overview)
-   [Material Design --- Data
    tables](https://m3.material.io/components/data-tables/overview)
-   [WAI-ARIA Authoring Practices --- Tabs
    pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
-   [WAI-ARIA Authoring Practices --- Dialog
    pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

------------------------------------------------------------------------

## 14. Final recommendation

The highest-value improvement is to move from a long, continuously
scrolling customer record to a structured customer profile with four
clear tabs.

Keep the existing CRM foundation. Improve the hierarchy, presentation
and interaction patterns around the customer details panel.

This approach should make the interface easier to scan, reduce
unnecessary scrolling, make feedback entry less intrusive and give the
customer record a more professional CRM feel --- while allowing the
existing business logic and data structures to be reused.

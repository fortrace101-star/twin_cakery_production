# Follow-up Fix 2: Follow-ups Must Include the Customer's Written Feedback

**Status:** Code changes applied to the uploaded project (`twin_cakery_production-main (7).zip`). Not run or type-checked, so please test before deploying.

## The problem

The **Follow-ups** tab in Customers & CRM lists completed orders, but a follow-up could only be closed with a **Mark done** button. Nothing was written down about what the customer said. The notification bell had the same shortcut, so a follow-up could be dismissed without any feedback being recorded.

Two bugs also meant that even "Mark done" did not stick:

- The server ignored `followUpCompletedAt` when the order was updated, so the mark was lost on refresh and the notification returned.
- Feedback saved through the API could end up with an empty customer, and editing feedback (`PATCH`) never saved.

## What a follow-up now is

A follow-up is only complete once the user has **written down the customer's feedback**. Registering one requires:

| Field | Required | Notes |
|---|---|---|
| Customer rating (1-5 stars) | Yes | |
| **Customer feedback text** | **Yes** | Free text written by the user |
| Feedback type | Defaults to General | Compliment, complaint, product, delivery, service |
| Action taken | No | e.g. discount offered |
| Needs another follow-up later | No | Checkbox |

The order is only marked as followed up **after** the feedback has been saved. If saving fails, the user sees an error and the follow-up stays pending. The saved feedback also appears on the customer's Feedback tab.

## Changes by file

| File | Change |
|---|---|
| `erp-interface-design/src/components/erp/crm-view.tsx` | "Mark done" replaced by **Register follow-up**, which opens a form with rating, type and required feedback text. Marks the order done only after the feedback saves. |
| `erp-interface-design/src/components/erp/topbar.tsx` | Removed the bell's "mark done" shortcut. Clicking a follow-up notification now opens the Follow-ups tab. Wording changed to "open it to write down the customer's feedback". |
| `erp-interface-design/src/components/erp/workspace.tsx` | Passes `onOpenFollowUps` to the top bar so the notification opens the Follow-ups tab. |
| `server/routes/feedback.ts` | Feedback text and a 1-5 rating are required. The customer is taken from the order. The signed-in user is recorded instead of "admin". `PATCH` now saves, and only on editable fields. |
| `server/routes/orders.ts` | `followUpCompletedAt` added to the allowed update fields so the done mark persists. |

## How to apply

1. Apply the diff below from the project root (for example `patch -p0 < followup-fix-2.diff`), or make the same edits by hand.
2. Rebuild the frontend and restart the server.

## How to test

1. Mark an order Completed / Delivered. The Follow-ups badge and a bell notification appear.
2. Click the notification. It should open Customers & CRM > Follow-ups.
3. Click **Register follow-up**. The Save button stays disabled until a rating and feedback text are entered.
4. Save. The order leaves the pending list and the badge count drops.
5. Refresh the page. The follow-up should still be gone.
6. Open the customer's **Feedback** tab and confirm the written feedback is there.
7. Turn the server off and try saving. You should see an error and the order should remain pending.

## Known limits

- If the notification link does not switch to the Follow-ups tab, it will land on Customers instead. In that case open the **Follow-ups** tab manually.
- No CSS was added for the new form. It reuses existing classes and may need spacing tweaks.
- Existing orders already stamped as followed up have no written feedback, because none was recorded at the time.

## Diff

```diff
--- server/routes/orders.ts	2026-11-15 12:20:03.000000000 +0000
+++ server/routes/orders.ts	2026-11-15 12:26:28.004027526 +0000
@@ -276,7 +276,7 @@
 
   // Non-status field updates (allowed subset).
   const allowedUpdates: Record<string, unknown> = {};
-  const allowed = ['notes', 'deliveryType', 'deliveryLocation', 'deliveryDate', 'deliveryTime', 'dueDate', 'dueTime', 'eventType', 'reference', 'guest', 'items', 'source', 'fulfilmentType'] as const;
+  const allowed = ['notes', 'deliveryType', 'deliveryLocation', 'deliveryDate', 'deliveryTime', 'dueDate', 'dueTime', 'eventType', 'reference', 'guest', 'items', 'source', 'fulfilmentType', 'followUpCompletedAt'] as const;
   for (const key of allowed) {
     if (key in patch) allowedUpdates[key] = (patch as any)[key];
   }
--- server/routes/feedback.ts	2026-11-15 12:20:03.000000000 +0000
+++ server/routes/feedback.ts	2026-11-15 12:26:28.004373174 +0000
@@ -37,20 +37,27 @@
 });
 
 router.post("/", required("feedback.create"), async (req, res) => {
-  const { customerId, orderId, productIds, rating, type, comment, resolution, followUpRequired, followUpCompleted, recordedBy } = req.body || {};
+  const { customerId, orderId, productIds, rating, type, comment, resolution, followUpRequired, followUpCompleted } = req.body || {};
   if (!orderId) return res.status(400).json({ error: "orderId is required" });
-  if (rating === undefined) return res.status(400).json({ error: "rating is required" });
+  const stars = Number(rating);
+  if (!Number.isFinite(stars) || stars < 1 || stars > 5) return res.status(400).json({ error: "rating must be between 1 and 5" });
+  if (!String(comment || "").trim()) return res.status(400).json({ error: "the customer's feedback text is required" });
+  // Take the customer from the order so a record can never be saved with an empty customer_id.
+  const order = store.orders().find((o) => o.id === orderId || o.orderNumber === orderId);
+  const resolvedCustomerId = String(customerId || order?.customerId || "");
+  if (!resolvedCustomerId) return res.status(400).json({ error: "customer could not be determined for this order" });
+  const session = await authService.getCurrentSession(extractToken(req.headers.authorization as string | undefined));
   const record = store.createCustomerFeedback({
-    customerId: customerId || "",
-    orderId: orderId || null,
+    customerId: resolvedCustomerId,
+    orderId: order?.id ?? orderId,
     productIds: productIds || "",
-    rating: rating || 0,
+    rating: stars,
     type: type || "GENERAL",
-    comment: comment || "",
+    comment: String(comment).trim(),
     resolution: resolution || null,
     followUpRequired: followUpRequired || false,
     followUpCompleted: followUpCompleted || false,
-    recordedBy: recordedBy || "admin",
+    recordedBy: session?.userId ?? "system",
   });
   store.persist();
   res.status(201).json(record);
@@ -62,9 +69,12 @@
   const target = feedback.find((f) => f.id === id);
   if (!target) throw new NotFoundError("Feedback not found");
   const patch = req.body || {};
-  const updated = { ...target, ...patch, updatedAt: new Date().toISOString() };
+  for (const key of ["rating", "type", "comment", "resolution", "followUpRequired", "followUpCompleted"] as const) {
+    if (key in patch) (target as any)[key] = patch[key];
+  }
+  target.updatedAt = new Date().toISOString();
   store.persist();
-  res.json(updated);
+  res.json(target);
 });
 
 export default router;
--- erp-interface-design/src/components/erp/crm-view.tsx	2026-11-15 12:20:03.000000000 +0000
+++ erp-interface-design/src/components/erp/crm-view.tsx	2026-11-15 12:26:28.004783234 +0000
@@ -8,7 +8,7 @@
 import { useDensity } from "@/lib/density";
 import { useIsMobile } from "@/hooks/use-mobile";
 import { buildCustomerRows, formatOccasionDate, formatPhoneDisplay, groupOccasions, initialOccasions, money, type CustomerRow, type Occasion, type OccasionPeriod, type Order } from "./data";
-import { createCustomerEvent, deleteCustomerEvent, listCustomerEvents, listCustomerFeedback, listCustomerOrders, listCustomers, orderStatusLabel, printCustomerOrders, type ServerCustomer, type ServerCustomerEvent, type ServerCustomerFeedback, type ServerCustomerOrder } from "@/lib/api";
+import { createCustomerEvent, createCustomerFeedback, deleteCustomerEvent, listCustomerEvents, listCustomerFeedback, listCustomerOrders, listCustomers, orderStatusLabel, printCustomerOrders, type ServerCustomer, type ServerCustomerEvent, type ServerCustomerFeedback, type ServerCustomerOrder } from "@/lib/api";
 import { useAsync, Empty, StarRating, feedbackTypeLabel } from "./crm-panels";
 
 type SortKey = "recent" | "name_asc" | "name_desc" | "spent" | "orders" | "balance" | "first";
@@ -202,6 +202,75 @@
   );
 }
 
+const FOLLOW_UP_TYPES: [string, string][] = [["GENERAL","General feedback"],["COMPLIMENT","Compliment"],["COMPLAINT","Complaint"],["PRODUCT_FEEDBACK","Product feedback"],["DELIVERY_FEEDBACK","Delivery feedback"],["SERVICE_FEEDBACK","Service feedback"]];
+
+/** One pending follow-up. A follow-up is only complete once the customer's feedback has been written down. */
+function FollowUpCard({ id, customer, customerId, connected, onOpenOrder, onDone }: { id: string; customer: string; customerId?: string; connected: boolean; onOpenOrder: (id: string)=>void; onDone: (id: string)=>void }) {
+  const [open, setOpen] = useState(false);
+  const [rating, setRating] = useState(0);
+  const [type, setType] = useState("GENERAL");
+  const [comment, setComment] = useState("");
+  const [resolution, setResolution] = useState("");
+  const [needsMore, setNeedsMore] = useState(false);
+  const [busy, setBusy] = useState(false);
+  const [error, setError] = useState("");
+  const canSave = !busy && rating > 0 && comment.trim().length > 0;
+
+  const save = async () => {
+    setError("");
+    if (!connected) { setError("Sign in and connect to the server to register a follow-up."); return; }
+    setBusy(true);
+    try {
+      let serverOrderId = id;
+      if (customerId) {
+        const theirs = await listCustomerOrders(customerId);
+        const match = theirs.find(o => o.orderNumber === id || o.id === id);
+        if (match) serverOrderId = match.id;
+      }
+      const record = await createCustomerFeedback({
+        ...(customerId ? { customerId } : {}),
+        orderId: serverOrderId,
+        rating,
+        type,
+        comment: comment.trim(),
+        resolution: resolution.trim() || undefined,
+        followUpRequired: needsMore,
+      });
+      if (!record) { setError("The feedback could not be saved. Nothing was marked as done - please try again."); setBusy(false); return; }
+      onDone(id); // only now is the follow-up stamped as done
+    } catch {
+      setError("The feedback could not be saved. Nothing was marked as done - please try again.");
+      setBusy(false);
+    }
+  };
+
+  return (
+    <li className="crm-followup-item" style={{display:"block"}}>
+      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px"}}>
+        <div>
+          <strong className="product-name">{customer}</strong>
+          <small className="cell-sub" style={{display:"block"}}>{id} · Completed / Delivered - waiting for follow-up</small>
+        </div>
+        <div className="flex items-center gap-2">
+          <Button variant="outline" size="sm" onClick={() => onOpenOrder(id)}>Open order</Button>
+          <Button size="sm" onClick={() => setOpen(o=>!o)}>{open ? "Cancel" : "Register follow-up"}</Button>
+        </div>
+      </div>
+      {open && (
+        <form className="erp-form crm-feedback-form" style={{marginTop:12}} onSubmit={e=>{ e.preventDefault(); if (canSave) void save(); }}>
+          <label>Customer rating<StarRating rating={rating} onChange={setRating}/></label>
+          <label>Feedback type<select value={type} onChange={e=>setType(e.target.value)}>{FOLLOW_UP_TYPES.map(([v,l])=> <option key={v} value={v}>{l}</option>)}</select></label>
+          <label>Customer feedback (required)<textarea rows={4} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Write what the customer told you about this order…"/></label>
+          <label>Action taken (optional)<textarea rows={2} value={resolution} onChange={e=>setResolution(e.target.value)} placeholder="e.g. Offered a discount on their next order"/></label>
+          <label style={{display:"flex",gap:8,alignItems:"center"}}><input type="checkbox" checked={needsMore} onChange={e=>setNeedsMore(e.target.checked)}/> Needs another follow-up later</label>
+          {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
+          <Button type="submit" disabled={!canSave}>{busy ? <Loader2 className="animate-spin"/> : <Check size={14}/>} Save follow-up</Button>
+        </form>
+      )}
+    </li>
+  );
+}
+
 export function CrmView({ tab, orders, search, setSearch, connected, onOpenOrder, followUps = [], onCompleteFollowUp }: { tab: string; orders: Order[]; search: string; setSearch: (s: string)=>void; connected: boolean; onOpenOrder: (orderId: string)=>void; followUps?: {id:string;customer:string}[]; onCompleteFollowUp?: (id:string)=>void }) {
   const isMobile = useIsMobile();
   const [sort, setSort] = useState<SortKey>("recent");
@@ -232,16 +301,7 @@
         ) : (
           <ul className="configuration-list crm-followup-list">
             {list.map((o) => (
-              <li key={o.id} className="crm-followup-item" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px"}}>
-                <div>
-                  <strong className="product-name">{o.customer}</strong>
-                  <small className="cell-sub" style={{display:"block"}}>{o.id} · Completed / Delivered — document the follow-up in CRM</small>
-                </div>
-                <div className="flex items-center gap-2">
-                  <Button variant="outline" size="sm" onClick={() => onOpenOrder(o.id)}>Open order</Button>
-                  {onCompleteFollowUp && <Button size="sm" onClick={() => onCompleteFollowUp(o.id)}><Check size={14}/> Mark done</Button>}
-                </div>
-              </li>
+              <FollowUpCard key={o.id} id={o.id} customer={o.customer} customerId={orders.find(x=>x.id===o.id)?.customerId} connected={connected} onOpenOrder={onOpenOrder} onDone={id=>onCompleteFollowUp?.(id)}/>
             ))}
           </ul>
         )}
--- erp-interface-design/src/components/erp/topbar.tsx	2026-11-15 12:20:03.000000000 +0000
+++ erp-interface-design/src/components/erp/topbar.tsx	2026-11-15 12:26:34.562576755 +0000
@@ -78,6 +78,7 @@
   setTheme,
   followUps = [],
   onCompleteFollowUp,
+  onOpenFollowUps,
   onMenu,
   menuOpen,
   isMobile = false,
@@ -98,6 +99,7 @@
   setTheme: (t: "light" | "dark") => void;
   followUps?: { id: string; customer: string }[];
   onCompleteFollowUp?: (id: string) => void;
+  onOpenFollowUps?: () => void;
   onMenu?: () => void;
   menuOpen?: boolean;
   isMobile?: boolean;
@@ -408,28 +410,16 @@
                 <div key={o.id} className="notification-followup" style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                   <Link
                     to="/workspace/crm"
-                    onClick={() => setNotification(false)}
+                    onClick={() => { setNotification(false); onOpenFollowUps?.(); }}
                     className="notification-followup-link"
                     style={{ display: "flex", gap: 10, alignItems: "flex-start", flex: 1, minWidth: 0, color: "inherit", textDecoration: "none" }}
                   >
                     <Users />
                     <div>
                       <strong>Follow up with {o.customer}</strong>
-                      <span>{o.id} is Completed / Delivered - document the follow-up in CRM.</span>
+                      <span>{o.id} is Completed / Delivered - open it to write down the customer's feedback.</span>
                     </div>
                   </Link>
-                  {onCompleteFollowUp && (
-                    <IconButton
-                      icon={CheckCheck}
-                      label={`Mark follow-up for ${o.id} as done`}
-                      onClick={(e) => {
-                        e.preventDefault();
-                        e.stopPropagation();
-                        onCompleteFollowUp(o.id);
-                        setNotice(`Follow-up for ${o.id} marked as done`);
-                      }}
-                    />
-                  )}
                 </div>
               ))}
 
--- erp-interface-design/src/components/erp/workspace.tsx	2026-11-15 12:20:03.000000000 +0000
+++ erp-interface-design/src/components/erp/workspace.tsx	2026-11-15 12:26:34.562941497 +0000
@@ -118,7 +118,7 @@
     <Sidebar {...sidebarProps} />
   )}
   <div className="main-shell">
-   <Topbar collapsed={collapsed} setCollapsed={setCollapsed} module={module} config={config} search={search} setSearch={setSearch} connected={connected} user={user} setLoginOpen={setLoginOpen} notification={notification} setNotification={setNotification} setNotice={setNotice} theme={theme} setTheme={setTheme} followUps={followUps} onCompleteFollowUp={completeFollowUp} onMenu={() => setNavOpen(true)} menuOpen={navOpen} isMobile={isMobile}/>
+   <Topbar collapsed={collapsed} setCollapsed={setCollapsed} module={module} config={config} search={search} setSearch={setSearch} connected={connected} user={user} setLoginOpen={setLoginOpen} notification={notification} setNotification={setNotification} setNotice={setNotice} theme={theme} setTheme={setTheme} followUps={followUps} onCompleteFollowUp={completeFollowUp} onOpenFollowUps={()=>{setTab('Follow-ups');setSearch('');}} onMenu={() => setNavOpen(true)} menuOpen={navOpen} isMobile={isMobile}/>
    <main className="content">
     <div className="page-heading"><div><div className="eyebrow">{module==='dashboard'?'YOUR BAKERY AT A GLANCE':'TWIN CAKERY BAKERY'}</div><h1>{module==='dashboard'?(()=>{const h=new Date().getHours();const g=h<12?'Good morning':h<18?'Good afternoon':'Good evening';return `${g}, ${user?.displayName || user?.username || 'Alex'}`;})():config?.label}<span className="heading-dot">.</span></h1><p>{module==='dashboard'?'Here’s what’s happening at Twin Cakery Bakery today.':subtitles[module]}</p></div><div className="heading-actions"><Button variant="outline" onClick={exportData}><Download/>Export</Button>{module !== 'inventory' && <Button onClick={()=>setNewOrder(true)}><Plus/>New order</Button>}</div></div>
     {module==='dashboard'?<>
```

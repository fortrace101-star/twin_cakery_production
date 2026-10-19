import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CalendarDays, Check, CircleAlert, ChevronLeft, ChevronRight, MapPin, Plus, Wallet } from "lucide-react";
import { money, orderOutstandingAmount, type Order } from "./data";
import { StatusBadge as Status } from "../data-table/StatusBadge";
import { useWorkspace } from "./store";
import { createCustomerEvent, findCustomerByName, listCustomers, type ServerCustomer } from "@/lib/api";
import { ORDER_STAGE_PIPELINE, orderStageIndex, orderStageTone } from "@/lib/theme-tokens";
import cake from "@/assets/chocolate-cake.jpg";
export function SignInDialog({open,onOpenChange}: {open:boolean;onOpenChange:(v:boolean)=>void}) {const {signIn,authError}=useWorkspace();const [username,setUsername]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;setError('');setBusy(true);const ok=await signIn(username.trim(),password);setBusy(false);if(ok){setPassword('');onOpenChange(false)}else{setError(authError||'Sign in failed. Check your credentials.')}}return <Dialog open={open} onOpenChange={v=>{if(!busy)onOpenChange(v)}}><DialogContent className="login-dialog"><DialogTitle>Sign in to Twin Cakery</DialogTitle><DialogDescription>Connect to your live workspace to view and manage real orders.</DialogDescription><form className="erp-form" onSubmit={submit}><label>Username<Input name="username" autoComplete="username" autoFocus value={username} onChange={e=>setUsername(e.target.value)} placeholder="manager" required/></label><label>Password<Input name="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error&&<p className="form-error">{error}</p>}<div className="dialog-actions"><Button type="button" variant="outline" onClick={()=>onOpenChange(false)} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}>{busy?'Signing in…':'Sign in'}</Button></div></form></DialogContent></Dialog>}
const orderSchema=z.object({customer:z.string().trim().min(2,'Enter a customer name.').max(100),product:z.string().min(1),amount:z.coerce.number().positive('Enter an amount greater than zero.').max(10000000),paidAmount:z.coerce.number().min(0,'Paid amount cannot be negative.').default(0),deliveryLocation:z.string().trim().max(200).optional().default(''),locationNote:z.string().trim().max(300).optional().default(''),isOccasion:z.coerce.boolean().optional().default(false),occasionType:z.string().trim().max(80).optional().default(''),occasionDate:z.string().trim().optional().default(''),occasionFrequency:z.enum(['WEEKLY','MONTHLY']).optional().default('MONTHLY'),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Choose a due date.'),options:z.string().trim().max(250),phone:z.string().trim().max(20).optional().default('')}).superRefine((data,ctx)=>{if(data.paidAmount>data.amount){ctx.addIssue({code:z.ZodIssueCode.custom,message:'Paid amount cannot exceed the total amount.',path:['paidAmount']});}if(data.isOccasion){if(!data.occasionDate){ctx.addIssue({code:z.ZodIssueCode.custom,message:'Pick the occasion date for the reminder.',path:['occasionDate']});}if(!data.occasionType.trim()){ctx.addIssue({code:z.ZodIssueCode.custom,message:'Name the occasion (e.g. Birthday).',path:['occasionType']});}}});
/** A brand-new customer must leave a reachable number (registered ones use their CRM record). */
const phoneSchema=z.string().trim().regex(/^\+?[\d\s()-]{7,20}$/,'Enter a valid phone number (e.g. +256 700 000 011).').refine(v=>(v.match(/\d/g)??[]).length>=7,'Enter at least 7 digits.');
/** The label map renders PARTIALLY_PAID as "Partial" — fold the alias together. */
function normalizePayment(value:string){return value==='Partial'?'Partially paid':value;}
/** Payment status is CALCULATED from what the customer has actually paid against
    the order total — there is no picker: paid in full → "Paid", part-paid →
    "Partially paid", nothing → "Unpaid". Orders with no paidAmount figure keep
    their stored label (rows created before paidAmount tracking). */
function resolvePayment(order:Pick<Order,"amount"|"payment"|"paidAmount">):string{
  const paid=order.paidAmount;
  if(paid===undefined)return normalizePayment(order.payment);
  if(paid<=0)return 'Unpaid';
  return paid>=order.amount?'Paid':'Partially paid';
}
export function NewOrderDialog({open,onOpenChange,onCreated}: {open:boolean;onOpenChange:(v:boolean)=>void;onCreated:(o:Order)=>void}) {
  const {orders,addOrder}=useWorkspace();
  const [error,setError]=useState('');
  const [customers,setCustomers]=useState<ServerCustomer[]>([]);
  const [customerChoice,setCustomerChoice]=useState('');
  // Registered customers double as the picker: their phone comes straight from
  // the CRM record — only a customer outside the list has to type one in.
  useEffect(()=>{if(!open)return;let keep=true;void listCustomers().then(list=>{if(keep)setCustomers(list)});return()=>{keep=false};},[open]);
  const selected=customerChoice===''?undefined:customers.find(c=>c.id===customerChoice);
  const isNewCustomer=customerChoice==='__new';
  const [isOccasion,setIsOccasion]=useState(false);
  function close(v:boolean){if(!v){setCustomerChoice('');setIsOccasion(false);setError('')}onOpenChange(v)}
  function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!customerChoice){setError('Choose a registered customer, or add a new one.');return}
    const data=Object.fromEntries(new FormData(e.currentTarget));
    const result=orderSchema.safeParse(data);
    if(!result.success){setError(result.error.issues[0]?.message||'Review the fields.');return}
    const {phone,...rest}=result.data;
    if(isNewCustomer){const parsed=phoneSchema.safeParse(phone);if(!parsed.success){setError(parsed.error.issues[0]?.message||'Add the customer phone number.');return}}
    const d=rest as typeof rest & { paidAmount: number; deliveryLocation: string; locationNote: string; isOccasion: boolean; occasionType: string; occasionDate: string; occasionFrequency: 'WEEKLY' | 'MONTHLY' };
    const paid = d.paidAmount ?? 0;
    const orderPayStatus = paid <= 0 ? 'Unpaid' : paid >= d.amount ? 'Paid' : 'Partially paid';
    const order:Order={...d,paidAmount:paid,id:`TC-${1049+orders.length-6}`,initials:d.customer.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase(),time:'10:00 AM',status:'Pending confirmation',payment:orderPayStatus,delivery:'Pending',channel:'Internal'};
    addOrder(order,phone);
    if (d.isOccasion) {
      const targetName = d.customer.trim();
      void (async () => {
        try {
          const existing = await findCustomerByName(targetName);
          const customerId = existing?.id ?? selected?.id;
          if (!customerId) return;
          await createCustomerEvent(customerId, {
            eventType: d.occasionType.trim(),
            eventDate: d.occasionDate,
            recurrenceRule: d.occasionFrequency,
            notes: `From order ${order.id} · ${order.product}`,
          });
        } catch { /* occasion is advisory — the order already saved */ }
      })();
    }
    close(false);
    onCreated(order);
  }
  return <Dialog open={open} onOpenChange={close}><DialogContent className="order-form-dialog"><DialogTitle>New order</DialogTitle><DialogDescription>A new reason to celebrate.</DialogDescription><form onSubmit={submit} className="erp-form order-form-scroll">
    <label>Customer<select value={customerChoice} onChange={e=>{setCustomerChoice(e.target.value);setError('')}}><option value="">Select a registered customer…</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.phone?` · ${c.phone}`:''}</option>)}<option value="__new">New customer (not in the list)</option></select></label>
    {selected&&<><input type="hidden" name="customer" value={selected.name}/>{selected.phone&&<input type="hidden" name="phone" value={selected.phone}/>}<p className="form-note"><Check size={15}/>Registered customer — the phone number comes from their record.</p></>}
    {isNewCustomer&&<><label>Customer name<input name="customer" placeholder="e.g. Sarah Mwangi" required maxLength={100}/></label><label>Customer phone<input name="phone" type="tel" placeholder="+256 700 000 011" required maxLength={20}/></label><p className="form-note"><CircleAlert size={15}/>New customer — this phone number is registered with their record.</p></>}
    <label>Product<select name="product"><option>Chocolate celebration cake</option><option>Red velvet cake</option><option>Vanilla cupcakes</option><option>Wedding cake</option><option>Carrot cake</option></select></label>
    <label>Product options<input name="options" placeholder="Size, flavour, occasion" maxLength={250}/></label>
    <label className="check-row"><input type="checkbox" name="isOccasion" value="true" checked={isOccasion} onChange={e=>setIsOccasion(e.target.checked)}/> This order is for a recurring occasion</label>
    {isOccasion&&<><div className="form-row"><label>Occasion<input name="occasionType" placeholder="e.g. Birthday, Anniversary" maxLength={80} required/></label><label>Occasion date<input name="occasionDate" type="date" required/></label></div><div className="form-row"><label>Reminder repeats<select name="occasionFrequency" defaultValue="MONTHLY"><option value="WEEKLY">Every week</option><option value="MONTHLY">Every month</option></select></label></div><p className="form-note"><CircleAlert size={15}/>A reminder is scheduled in CRM Occasions and repeats on this cycle.</p></>}
    <div className="form-row"><label>Delivery location<Input name="deliveryLocation" placeholder="e.g. 12 Gazebo Rd, Kamwokya" maxLength={200}/></label><label>Location note<Input name="locationNote" placeholder="Landmark / access instructions" maxLength={300}/></label></div>
    <div className="form-row"><label>Total amount (UGX)<input name="amount" type="number" min="1" max="10000000" placeholder="4,500" required/></label><label>Paid amount (UGX)<input name="paidAmount" type="number" min="0" max="10000000" placeholder="0" defaultValue="0"/></label></div>
    <label>Due date<input name="date" type="date" defaultValue="2026-10-08" required/></label>
    <p className="form-note"><CircleAlert size={15}/>Paid now cannot exceed the total amount — overpayments are blocked.</p>
    <p className="form-note"><CircleAlert size={15}/>Orders require proprietor confirmation before production.</p>
    {error&&<p className="form-error">{error}</p>}
    <div className="dialog-actions"><Button type="button" variant="outline" onClick={()=>close(false)}>Cancel</Button><Button type="submit"><Plus/>Create order</Button></div>
  </form></DialogContent></Dialog>
}
export function OrderDialog({order,onClose,onNotice}: {order:Order|null;onClose:()=>void;onNotice:(s:string)=>void}) {
  const {orders,updateOrder}=useWorkspace();
  const current=orders.find(o=>o.id===order?.id);
  const [override,setOverride]=useState<{key:string;value:string}|null>(null);
  // Record-a-payment form state (a hook — hoisted above the early return).
  const [payForm,setPayForm]=useState({amount:'',method:'Cash'});
  if(!current)return null;
  const outstandingAmount=orderOutstandingAmount(current);
  // Payment status is CALCULATED from the amount paid against the order total —
  // nothing on this dialog lets you set it by hand.
  const resolvedPayment=resolvePayment(current);
  // Amount already paid on a partially paid order — shown in brackets next to
  // the order total in the product header.
  const paidOnPartial=resolvedPayment==='Partially paid'?(current.paidAmount??0):0;
  const stageKey=`${current.id}:${current.status}`;
  const stageIdx=orderStageIndex(current.status);
  // The ACTIVE stage is the selected target when the modal opens — nothing
  // auto-advances; the user steps forward manually with the Next button.
  const nextStatus=override&&override.key===stageKey?override.value:current.status;
  const effIdx=orderStageIndex(nextStatus);
  const prevStage=effIdx>0?(ORDER_STAGE_PIPELINE[effIdx-1]??null):null;
  const nextStage=effIdx>=0&&effIdx<ORDER_STAGE_PIPELINE.length-1?(ORDER_STAGE_PIPELINE[effIdx+1]??null):null;
  const statusChanged=nextStatus!==current.status;
  // The calculated status differs from what the server holds → applying the
  // update persists it alongside the stage move.
  const paymentChanged=resolvedPayment!==normalizePayment(current.payment);
  function update(e:FormEvent){
    e.preventDefault();
    if(!current||(!statusChanged&&!paymentChanged))return;
    updateOrder(current.id,nextStatus,paymentChanged?resolvedPayment:undefined);
    onNotice(statusChanged&&paymentChanged?`${current.id} updated to ${nextStatus} · payment ${resolvedPayment}`:paymentChanged?`${current.id} payment resolved to ${resolvedPayment}`:`${current.id} updated to ${nextStatus}`);
    setOverride(null);
  }
  // Record a payment against this order: the store POSTs it to the server
  // ledger and accumulates paidAmount, which re-resolves the payment status
  // and the outstanding balance shown above.
  const recordPayment=()=>{
    const amt=Number(payForm.amount);
    if(!amt||amt<=0)return;
    updateOrder(current.id,current.status,undefined,amt,{method:payForm.method||'Cash'});
    onNotice(`Payment of ${money(amt)} recorded for ${current.id}`);
    setPayForm({amount:'',method:'Cash'});
  }
  return <Dialog open={Boolean(order)} onOpenChange={v=>{if(!v)onClose()}}><DialogContent className="order-detail-dialog"><div className="dialog-head"><div><DialogTitle>Order #{current.id}</DialogTitle><DialogDescription>{current.customer} · {current.channel}</DialogDescription></div><span className="dialog-head-loc" aria-label="Delivery location"><span className="dialog-head-loc-main"><MapPin size={14}/>{current.deliveryLocation||'No delivery location'}</span>{current.locationNote&&<small className="dialog-head-note">{current.locationNote}</small>}</span></div><div className="order-form-scroll"><div className="order-detail-product"><img src={cake} alt="Chocolate celebration cake sample" width={1024} height={768}/><div><h3>{current.product}</h3><p>{current.options}</p><strong>{money(current.amount)}{paidOnPartial>0&&<span className="amount-paid" title="Amount paid so far"> ({money(paidOnPartial)})</span>}</strong></div></div><div className="order-status-grid"><div className={`tone-${orderStageTone(current.status)}`}><small>ORDER</small><Status value={current.status}/></div><div className={`tone-${orderStageTone(resolvedPayment)}`}><small>PAYMENT</small><Status value={resolvedPayment}/></div><div className={`tone-${orderStageTone(current.delivery)}`}><small>DELIVERY</small><Status value={current.delivery}/></div></div><div className="detail-meta"><span><CalendarDays size={15}/>{current.date} · {current.time}</span><span>Recipe v1.2 · Price snapshot retained</span></div><form className="erp-form" onSubmit={update}><ol className="order-stage-strip" aria-label="Order pipeline stages">{ORDER_STAGE_PIPELINE.map((s,i)=><li key={s} className={`tone-${orderStageTone(s)}${s===current.status?' is-current':''}${s===nextStatus&&s!==current.status?' is-target':''}${i<stageIdx?' is-done':''}`} aria-current={s===current.status?'step':undefined}>{i<stageIdx&&<Check size={12}/>}{s}</li>)}</ol>{stageIdx<0&&<p className="text-xs text-muted-foreground">This order sits outside the production pipeline — stage navigation is unavailable.</p>}<div className="stage-nav"><Button type="button" variant="outline" className={`stage-nav-btn tone-${orderStageTone(prevStage||current.status)}`} disabled={!prevStage} onClick={()=>prevStage&&setOverride({key:stageKey,value:prevStage})}><ChevronLeft size={14}/>Previous{prevStage?`: ${prevStage}`:''}</Button><Button type="button" variant="outline" className={`stage-nav-btn tone-${orderStageTone(nextStage||current.status)}`} disabled={!nextStage} onClick={()=>nextStage&&setOverride({key:stageKey,value:nextStage})}>Next{nextStage?`: ${nextStage}`:''}<ChevronRight size={14}/></Button></div><label>Payment status<Input value={resolvedPayment} readOnly aria-label="Payment status"/></label>{paymentChanged&&<p className="form-note"><CircleAlert size={15}/>Calculated from the amount paid — will be saved as “{resolvedPayment}”.</p>}{outstandingAmount>0&&<p className="form-note balance-due"><CircleAlert size={15}/>Outstanding balance: <strong>{money(outstandingAmount)}</strong></p>}{resolvedPayment!=='Paid'&&<div className="payment-recorder"><p className="recorder-head"><Wallet size={15}/>Record a payment for this order</p><div className="recorder-fields"><label>Amount<Input type="number" min={0} value={payForm.amount} onChange={e=>setPayForm({...payForm,amount:e.target.value})}/></label><label>Method<Input value={payForm.method} onChange={e=>setPayForm({...payForm,method:e.target.value})}/></label></div></div>}<div className="dialog-actions">{resolvedPayment!=='Paid'&&<Button type="button" variant="outline" onClick={recordPayment} disabled={!payForm.amount}><Wallet size={14}/>Record payment</Button>}<Button type="submit" disabled={!statusChanged&&!paymentChanged}><Check/>Update status</Button></div></form></div></DialogContent></Dialog>
}

import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, PasswordInput } from "@/components/ui/input";
import { CalendarDays, Check, CircleAlert, ChevronLeft, ChevronRight, History, MapPin, Pencil, Plus, Wallet, X } from "lucide-react";
import { money, orderOutstandingAmount, type Order } from "./data";
import { StatusBadge as Status } from "../data-table/StatusBadge";
import { useWorkspace } from "./store";
import { createCustomerEvent, editOrderApi, findCustomerByName, listCustomers, listOrderRevisionsApi, previewOrderEditApi, recordPayment as recordPaymentApi, type EditOrderPreview, type ServerCustomer, type ServerOrderRevision } from "@/lib/api";
import { ORDER_STAGE_PIPELINE, orderStageIndex, orderStageTone } from "@/lib/theme-tokens";
import cake from "@/assets/chocolate-cake.jpg";
export function SignInDialog({open,onOpenChange}: {open:boolean;onOpenChange:(v:boolean)=>void}) {const {signIn,authError}=useWorkspace();const [username,setUsername]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;setError('');setBusy(true);const ok=await signIn(username.trim(),password);setBusy(false);if(ok){setPassword('');onOpenChange(false)}else{setError(authError||'Sign in failed. Check your credentials.')}}return <Dialog open={open} onOpenChange={v=>{if(!busy)onOpenChange(v)}}><DialogContent className="login-dialog"><DialogTitle>Sign in to Twin Cakery</DialogTitle><DialogDescription>Connect to your live workspace to view and manage real orders.</DialogDescription><form className="erp-form" onSubmit={submit}><label>Username<Input name="username" autoComplete="username" autoFocus value={username} onChange={e=>setUsername(e.target.value)} placeholder="manager" required/></label><label>Password<PasswordInput name="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error&&<p className="form-error">{error}</p>}<div className="dialog-actions"><Button type="button" variant="outline" onClick={()=>onOpenChange(false)} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}>{busy?'Signing in…':'Sign in'}</Button></div></form></DialogContent></Dialog>}
const orderSchema=z.object({customer:z.string().trim().min(2,'Enter a customer name.').max(100),product:z.string().min(1),amount:z.coerce.number().positive('Enter an amount greater than zero.').max(10000000),paidAmount:z.coerce.number().min(0,'Paid amount cannot be negative.').default(0),deliveryLocation:z.string().trim().max(200).optional().default(''),locationNote:z.string().trim().max(300).optional().default(''),isOccasion:z.coerce.boolean().optional().default(false),occasionType:z.string().trim().max(80).optional().default(''),occasionDate:z.string().trim().optional().default(''),occasionFrequency:z.enum(['WEEKLY','MONTHLY','ANNUAL']).optional().default('MONTHLY'),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Choose a due date.'),time:z.string().regex(/^\d{2}:\d{2}$/,'Choose a due time.'),options:z.string().trim().max(250),phone:z.string().trim().max(20).optional().default('')}).superRefine((data,ctx)=>{if(data.paidAmount>data.amount){ctx.addIssue({code:z.ZodIssueCode.custom,message:'Paid amount cannot exceed the total amount.',path:['paidAmount']});}if(data.isOccasion){if(!data.occasionDate){ctx.addIssue({code:z.ZodIssueCode.custom,message:'Pick the occasion date for the reminder.',path:['occasionDate']});}if(!data.occasionType.trim()){ctx.addIssue({code:z.ZodIssueCode.custom,message:'Name the occasion (e.g. Birthday).',path:['occasionType']});}}});
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
    const d=rest as typeof rest & { paidAmount: number; deliveryLocation: string; locationNote: string; isOccasion: boolean; occasionType: string; occasionDate: string; occasionFrequency: 'WEEKLY' | 'MONTHLY' | 'ANNUAL'; time: string };
    const paid = d.paidAmount ?? 0;
    const orderPayStatus = paid <= 0 ? 'Unpaid' : paid >= d.amount ? 'Paid' : 'Partially paid';
    const fmtTime = (hhmm: string) => { const parts=hhmm.split(':').map(Number); const h=parts[0]??10; const m=parts[1]??0; const hr=((h%12)||12); return `${hr}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`; };
    const order:Order={...d,paidAmount:paid,id:`TC-${1049+orders.length-6}`,initials:d.customer.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase(),time:fmtTime(d.time),status:'Pending confirmation',payment:orderPayStatus,delivery:'Pending',channel:'Internal',...(selected?{customerId:selected.id}:{}),...(selected?.phone||phone?{customerPhone:selected?.phone||phone}:{})};
    addOrder(order,phone);
    if (d.isOccasion) {
      const targetName = d.customer.trim();
      void (async () => {
        try {
          const existing = await findCustomerByName(targetName);
          const existingOne = Array.isArray(existing) ? existing[0] : existing;
          const customerId = existingOne?.id ?? selected?.id;
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
    {isOccasion&&<><div className="form-row"><label>Occasion<input name="occasionType" placeholder="e.g. Birthday, Anniversary" maxLength={80} required/></label><label>Occasion date<input name="occasionDate" type="date" required/></label></div><div className="form-row"><label>Reminder repeats<select name="occasionFrequency" defaultValue="MONTHLY"><option value="WEEKLY">Every week</option><option value="MONTHLY">Every month</option><option value="ANNUAL">Every year</option></select></label></div><p className="form-note"><CircleAlert size={15}/>A reminder is scheduled in CRM Occasions and repeats on this cycle.</p></>}
    <div className="form-row"><label>Delivery location<Input name="deliveryLocation" placeholder="e.g. 12 Gazebo Rd, Kamwokya" maxLength={200}/></label><label>Location note<Input name="locationNote" placeholder="Landmark / access instructions" maxLength={300}/></label></div>
    <div className="form-row"><label>Total amount (UGX)<input name="amount" type="number" min="1" max="10000000" placeholder="4,500" required/></label><label>Paid amount (UGX)<input name="paidAmount" type="number" min="0" max="10000000" placeholder="0" defaultValue="0"/></label></div>
    <div className="form-row"><label>Due date<input name="date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required/></label><label>Due time<input name="time" type="time" defaultValue="10:00" required/></label></div>
    <p className="form-note"><CircleAlert size={15}/>Paid now cannot exceed the total amount — overpayments are blocked.</p>
    <p className="form-note"><CircleAlert size={15}/>Orders require proprietor confirmation before production.</p>
    {error&&<p className="form-error">{error}</p>}
    <div className="dialog-actions"><Button type="button" variant="outline" onClick={()=>close(false)}>Cancel</Button><Button type="submit"><Plus/>Create order</Button></div>
  </form></DialogContent></Dialog>
}
export function OrderDialog({order,onClose,onNotice}: {order:Order|null;onClose:()=>void;onNotice:(s:string)=>void}) {
  const {orders,updateOrder,permissions}=useWorkspace();
  const current=orders.find(o=>o.id===order?.id);
  const [payForm,setPayForm]=useState({amount:'',method:'Cash',reference:''});
  const [payOpen,setPayOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [stageSuccess,setStageSuccess]=useState<{id:string;status:string;previous?:string}|null>(null);
  const [stageError,setStageError]=useState<{id:string;message:string}|null>(null);
  const [editOpen,setEditOpen]=useState(false);
  const [historyOpen,setHistoryOpen]=useState(false);
  useEffect(()=>{ setPayForm({amount:'',method:'Cash',reference:''}); setPayOpen(false); setBusy(false); setEditOpen(false); setHistoryOpen(false); },[current?.id]);
  async function undoStage():Promise<boolean>{
    const done=stageSuccess;
    const target=done?.previous;
    if(!done||!target)return false;
    const res=await updateOrder(done.id,target);
    if(!res.ok){setStageError({id:done.id,message:res.error||`Could not move ${done.id} back to ${target}.`});return false;}
    onNotice(`${done.id} moved back to ${target}`);
    setStageSuccess(null);
    return true;
  }
  if(!current)return null;
  if(stageError)return <OrderStatusErrorDialog error={stageError} onClose={()=>setStageError(null)}/>;
  if(stageSuccess)return <OrderStatusSuccessDialog result={stageSuccess} {...(stageSuccess.previous?{onUndo:undoStage}:{})} onClose={()=>{setStageSuccess(null);onClose()}}/>;
  if(editOpen) return <EditOrderDialog order={current} onClose={()=>setEditOpen(false)} onSaved={(msg)=>{setEditOpen(false); onNotice(msg)}} onNotice={onNotice}/>;
  if(historyOpen) return <OrderHistoryDialog order={current} onClose={()=>setHistoryOpen(false)}/>;
  const c=current;
  const outstandingAmount=orderOutstandingAmount(c);
  const resolvedPayment=resolvePayment(c);
  const paidAmount=c.paidAmount??0;
  const stageIdx=orderStageIndex(c.status);
  const stepCount=ORDER_STAGE_PIPELINE.length;
  const step=stageIdx>=0?stageIdx+1:0;
  const prevStage=stageIdx>0?(ORDER_STAGE_PIPELINE[stageIdx-1]??null):null;
  const nextStage=stageIdx>=0&&stageIdx<stepCount-1?(ORDER_STAGE_PIPELINE[stageIdx+1]??null):null;
  const isInTransit=c.status==='In Transit';
  const primaryLabel=!nextStage?null:outstandingAmount>0&&isInTransit?'Mark delivered anyway':isInTransit?'Mark delivered':`Move to ${nextStage}`;
  const needsRef=(payForm.method||'Cash').trim().toLowerCase()!=='cash';
  const canRecord=!!payForm.amount && Number(payForm.amount)>0 && (!needsRef || !!payForm.reference.trim());
  const terminal = c.status==='Completed / Delivered' || c.status==='Closed' || c.status==='Cancelled';
  const canEdit = !terminal && (permissions===null || permissions.includes('orders.update'));
  async function moveTo(target:string,prev:string){
    if(busy)return;
    setBusy(true);
    const res=await updateOrder(c.id,target);
    setBusy(false);
    if(res.ok){ onNotice(`${c.id} updated to ${target}`); setStageSuccess({id:c.id,status:target,previous:prev}); }
    else { const msg=res.error||`Failed to update ${c.id}.`; setStageError({id:c.id,message:msg}); onNotice(msg); }
  }
  async function recordPayment(){
    const amt=Math.round(Number(payForm.amount));
    if(!Number.isFinite(amt)||amt<=0)return;
    if(needsRef && !payForm.reference.trim())return;
    setBusy(true);
    const res=await updateOrder(c.id,c.status,undefined,amt,{method:payForm.method||'Cash',...(payForm.reference?.trim()?{reference:payForm.reference.trim()}:{})});
    setBusy(false);
    if(res.ok){ onNotice(`Payment of ${money(amt)} recorded for ${c.id}`); setPayForm({amount:'',method:'Cash',reference:''}); setPayOpen(false); }
    else { onNotice(res.error||`Failed to record payment for ${c.id}.`); }
  }
  return <Dialog open={Boolean(order)} onOpenChange={v=>{if(!v)onClose()}}>
    <DialogContent className="order-detail-dialog">
      <div className="dialog-head">
        <div>
          <DialogTitle>Order #{current.id}</DialogTitle>
          <DialogDescription>{current.customer} · {current.channel}{current.version? ` · v${current.version}`:''}</DialogDescription>
        </div>
        <div className="dialog-head-loc" aria-label="Delivery location">
          <span className="dialog-head-loc-main"><MapPin size={14}/><span>{current.deliveryLocation||'No delivery location'}</span></span>
          {current.locationNote&&<small className="dialog-head-note">{current.locationNote}</small>}
          {current.customerPhone&&<a className="dialog-head-call" href={`tel:${current.customerPhone}`}>Call</a>}
        </div>
      </div>
      <div className="order-detail-body">
        <div className="order-detail-product order-detail-product-compact">
          <img src={cake} alt={current.product} width={48} height={48}/>
          <div className="order-detail-product-text">
            <h3>{current.product}</h3>
            <p>{current.options}</p>
            <strong>{money(current.amount)}{paidAmount>0?<span className="amount-paid"> ({money(paidAmount)} paid)</span>:null}</strong>
          </div>
        </div>
        <div className="order-status-chips" aria-label="Order status">
          <span className={`order-chip tone-${orderStageTone(current.status)}`}><small>Order</small> {current.status}</span>
          <span className={`order-chip tone-${orderStageTone(resolvedPayment)}`}><small>Payment</small> {resolvedPayment}</span>
          <span className={`order-chip tone-${orderStageTone(current.delivery)}`}><small>Delivery</small> {current.delivery}</span>
        </div>
        {stageIdx>=0
          ? <div className="order-progress" aria-label="Order pipeline stages" role="group">
              <div className="order-progress-bar" role="progressbar" aria-valuemin={1} aria-valuemax={stepCount} aria-valuenow={step} aria-valuetext={`Step ${step} of ${stepCount} · ${current.status}`}>
                {ORDER_STAGE_PIPELINE.map((s,i)=><span key={s} title={s} className={`order-progress-seg${i<step?' is-done':''}${i===step-1?' is-current':''}`}/>) }
              </div>
              <div className="order-progress-label">Step {step} of {stepCount} · {current.status}</div>
            </div>
          : <p className="text-xs text-muted-foreground">This order sits outside the production pipeline — stage navigation is unavailable.</p>}
        {outstandingAmount>0&&<p className="form-note balance-due"><CircleAlert size={15}/>Balance due <strong>{money(outstandingAmount)}</strong></p>}
        {resolvedPayment!=='Paid'&&<div className="payment-recorder payment-recorder-collapsible">
          <button type="button" className="recorder-toggle" onClick={()=>{ if(!payOpen){ setPayForm(f=>({...f,amount:f.amount||String(outstandingAmount||'')})); } setPayOpen(o=>!o); }}>
            <Wallet size={15}/><span>Record payment</span><ChevronRight size={14} className={payOpen?'is-open':''}/>
          </button>
          {payOpen&&<div className="recorder-fields recorder-fields-inline">
            <label>Amount<Input type="number" min={0} step={1} value={payForm.amount} onChange={e=>setPayForm({...payForm,amount:e.target.value})}/></label>
            <label>Method<Input value={payForm.method} onChange={e=>setPayForm({...payForm,method:e.target.value})}/></label>
            {needsRef&&<label>Reference<Input value={payForm.reference} onChange={e=>setPayForm({...payForm,reference:e.target.value})} placeholder="Reference"/></label>}
            <Button type="button" onClick={recordPayment} disabled={busy||!canRecord}><Wallet size={14}/>Record</Button>
          </div>}
        </div>}
      </div>
      <div className="dialog-actions order-detail-footer">
        {outstandingAmount>0&&isInTransit&&nextStage&&<p className="footer-unpaid-note">{money(outstandingAmount)} still unpaid. Mark delivered anyway?</p>}
        <div className="order-detail-footer-buttons" style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'space-between',width:'100%'}}>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <Button type="button" variant="outline" onClick={()=>setHistoryOpen(true)}><History size={14}/>History</Button>
            {canEdit&&<Button type="button" variant="outline" onClick={()=>setEditOpen(true)}><Pencil size={14}/>Edit order</Button>}
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <Button type="button" variant="outline" aria-label={prevStage?`Back: ${prevStage}`:'Back'} disabled={!prevStage||busy} onClick={()=>prevStage&&moveTo(prevStage,current.status)}><ChevronLeft size={14}/>Back{prevStage?<span className="btn-sub">: {prevStage}</span>:null}</Button>
            {primaryLabel
              ? <Button type="button" disabled={busy} aria-label={primaryLabel} onClick={()=>nextStage&&moveTo(nextStage,current.status)}><Check size={14}/>{busy?'Updating…':primaryLabel}</Button>
              : <Button type="button" disabled aria-label="No next stage"><Check size={14}/>No next stage</Button>}
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}

type EditItem = { id?: string; productId?: string; name: string; quantity: number; unitPrice: number; notes?: string };
function EditOrderDialog({order,onClose,onSaved,onNotice}:{order:Order;onClose:()=>void;onSaved:(msg:string)=>void;onNotice:(s:string)=>void}){
  const {editOrder,permissions}=useWorkspace();
  const canPrice = permissions===null || permissions.includes('orders.update_price');
  const [reason,setReason]=useState('');
  const [notes,setNotes]=useState(order.notes||'');
  const [deliveryLocation,setDeliveryLocation]=useState(order.deliveryLocation||'');
  const [locationNote,setLocationNote]=useState(order.locationNote||'');
  const [deliveryAddress,setDeliveryAddress]=useState((order as any).deliveryAddress||'');
  const [deliveryType,setDeliveryType]=useState((order as any).deliveryType||'PICKUP');
  const [priority,setPriority]=useState((order as any).priority||'NORMAL');
  const [requiredBy,setRequiredBy]=useState(order.requiredBy||order.date||'');
  const [requiredAt,setRequiredAt]=useState(order.requiredAt||'');
  const [discount,setDiscount]=useState(String(order.discount ?? 0));
  const [deliveryCharge,setDeliveryCharge]=useState(String(order.deliveryCharge ?? 0));
  const [taxAmount,setTaxAmount]=useState(String(order.taxAmount ?? 0));
  const initialItems: EditItem[] = ((order as any).items || []).map((it:any)=>({ id: it.id, productId: it.productId || it.product_id, name: it.productName || it.product_name || 'Item', quantity: Number(it.quantity ?? 1), unitPrice: Number(it.unitPrice ?? it.unit_price ?? 0), notes: it.customizationNotes || it.customization_notes || '' }));
  const [items,setItems]=useState<EditItem[]>(initialItems.length ? initialItems : [{name: order.product || 'Item', quantity:1, unitPrice: Number(order.amount||0), notes: order.options||''}]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [preview,setPreview]=useState<EditOrderPreview|null>(null);
  const [saved,setSaved]=useState<{orderId:string;version:number}|null>(null);

  function payload(includeReason=true){
    const changes:any = {
      notes, deliveryLocation, locationNote, deliveryAddress, deliveryType, priority,
      requiredBy: requiredBy || null,
      requiredAt: requiredAt || null,
      items: items.map(it=>({ ...(it.id?{id:it.id}:{}), ...(it.productId?{productId:it.productId}:{}), name: it.name, quantity: Number(it.quantity||0), unitPrice: Number(it.unitPrice||0), notes: it.notes || '' })),
    };
    if (canPrice) {
      changes.discount = Number(discount||0);
      changes.deliveryCharge = Number(deliveryCharge||0);
      changes.taxAmount = Number(taxAmount||0);
    }
    const body:any = { expectedVersion: order.version ?? 1, changes };
    if (includeReason) body.reason = reason.trim();
    return body;
  }

  async function doPreview(){
    setError(''); setBusy(true);
    const p = await Promise.race([
      previewOrderEditApi(order.id, payload(false)),
      new Promise<null>(resolve => setTimeout(()=>resolve(null), 25000)),
    ]);
    setBusy(false);
    if(!p){ setError('Preview is taking too long or failed. Check your connection and try again.'); return; }
    setPreview(p);
  }
  async function save(){
    if(!reason.trim()){ setError('A reason for the change is required.'); return; }
    if(items.length===0 || items.some(it=>!String(it.name||'').trim() || Number(it.quantity)<=0 || Number(it.unitPrice)<0)){ setError('Each item needs a name, quantity > 0, and a non-negative unit price.'); return; }
    setBusy(true); setError('');
    const timeout = new Promise<{ok:false;error:string}>(resolve => setTimeout(()=>resolve({ok:false,error:'Saving is taking too long. The server may be slow or unreachable — check your connection and try again. (If the change was recorded, reopen the order to confirm.)'}), 25000));
    const res = await Promise.race([editOrder(order.id, payload(true)), timeout]);
    setBusy(false);
    if(!res.ok){ setError(res.error||'Failed to save changes.'); return; }
    setSaved({orderId: order.id, version: (order.version ?? 1) + 1});
  }
  function setItem(idx:number, patch:Partial<EditItem>){ setItems(prev=>prev.map((it,i)=>i===idx?{...it,...patch}:it)); setPreview(null); }
  function addItem(){ setItems(prev=>[...prev,{name:'',quantity:1,unitPrice:0,notes:''}]); setPreview(null); }
  function removeItem(idx:number){ setItems(prev=>prev.length<=1?prev:prev.filter((_,i)=>i!==idx)); setPreview(null); }

  const itemsTotal = items.reduce((s,it)=>s + Number(it.quantity||0)*Number(it.unitPrice||0), 0);

  if(saved){
    return <Dialog open onOpenChange={v=>{if(!v) onSaved(`${saved.orderId} updated`)}}>
      <DialogContent className="payment-record-dialog payment-record-success">
        <div className="payment-success-state" role="status" aria-live="polite">
          <span className="payment-success-tick" aria-hidden="true"><Check size={28} strokeWidth={3}/></span>
          <DialogTitle>Edit recorded</DialogTitle>
          <DialogDescription>Changes to order #{saved.orderId} have been recorded (revision v{saved.version}).</DialogDescription>
          <Button type="button" onClick={()=>onSaved(`${saved.orderId} updated`)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>;
  }

  return <Dialog open onOpenChange={v=>{if(!v)onClose()}}>
    <DialogContent className="order-form-dialog" style={{maxWidth:760}}>
      <DialogTitle>Edit order #{order.id}</DialogTitle>
      <DialogDescription>Adjust line items, schedule, delivery, notes, or pricing. Status/payment use their own actions. A reason is required.</DialogDescription>
      <div className="erp-form order-form-scroll">
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><strong>Line items</strong><Button type="button" variant="outline" size="sm" onClick={addItem}><Plus size={14}/>Add item</Button></div>
          <div style={{display:'grid',gap:8}}>
            {items.map((it,idx)=>(
              <div key={idx} style={{border:'1px solid var(--border,#e5e7eb)',borderRadius:8,padding:8,display:'grid',gap:6}}>
                <div className="form-row">
                  <label>Item name<Input value={it.name} onChange={e=>setItem(idx,{name:e.target.value})} placeholder="Product / item"/></label>
                  <label>Qty<Input type="number" min={1} step={1} value={it.quantity} onChange={e=>setItem(idx,{quantity:Number(e.target.value)})}/></label>
                  <label>Unit price<Input type="number" min={0} step={1} value={it.unitPrice} onChange={e=>setItem(idx,{unitPrice:Number(e.target.value)})} disabled={!canPrice}/></label>
                </div>
                <div className="form-row" style={{alignItems:'end'}}>
                  <label style={{flex:1}}>Item notes<Input value={it.notes||''} onChange={e=>setItem(idx,{notes:e.target.value})} placeholder="Customization / notes"/></label>
                  <Button type="button" variant="outline" onClick={()=>removeItem(idx)} disabled={items.length<=1}><X size={14}/>Remove</Button>
                </div>
              </div>
            ))}
          </div>
          <p className="form-note" style={{marginTop:6}}>Items subtotal (client): <strong>{money(itemsTotal)}</strong>{!canPrice && <span> · pricing fields locked without price permission</span>}</p>
        </div>
        <div className="form-row">
          <label>Required by<Input type="date" value={String(requiredBy).slice(0,10)} onChange={e=>{setRequiredBy(e.target.value);setPreview(null)}}/></label>
          <label>Required at<Input type="datetime-local" value={requiredAt?String(requiredAt).slice(0,16):''} onChange={e=>{setRequiredAt(e.target.value? new Date(e.target.value).toISOString(): '');setPreview(null)}}/></label>
        </div>
        <div className="form-row">
          <label>Delivery type<select value={deliveryType} onChange={e=>{setDeliveryType(e.target.value);setPreview(null)}}><option value="PICKUP">Pickup</option><option value="DELIVERY">Delivery</option></select></label>
          <label>Priority<select value={priority} onChange={e=>{setPriority(e.target.value);setPreview(null)}}><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></label>
        </div>
        <label>Delivery location<Input value={deliveryLocation} onChange={e=>{setDeliveryLocation(e.target.value);setPreview(null)}} maxLength={200}/></label>
        <label>Location note<Input value={locationNote} onChange={e=>{setLocationNote(e.target.value);setPreview(null)}} maxLength={300}/></label>
        <label>Delivery address<Input value={deliveryAddress} onChange={e=>{setDeliveryAddress(e.target.value);setPreview(null)}} maxLength={300}/></label>
        <label>Notes<textarea value={notes} onChange={e=>{setNotes(e.target.value);setPreview(null)}} rows={3} style={{width:'100%'}}/></label>
        {canPrice && <><div className="form-row"><label>Discount (UGX)<Input type="number" min={0} value={discount} onChange={e=>{setDiscount(e.target.value);setPreview(null)}}/></label><label>Delivery charge (UGX)<Input type="number" min={0} value={deliveryCharge} onChange={e=>{setDeliveryCharge(e.target.value);setPreview(null)}}/></label></div><label>Tax amount (UGX)<Input type="number" min={0} value={taxAmount} onChange={e=>{setTaxAmount(e.target.value);setPreview(null)}}/></label></>}
        <label>Reason for change<Input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Why are you editing this order?" required/></label>
        <p className="form-note"><CircleAlert size={15}/>Server recalculates totals and records an immutable revision (v{order.version ?? 1}).</p>
        {preview && <div className="form-note" style={{display:'block'}}><strong>Server preview</strong>
          <div style={{marginTop:4}}><small>Subtotal {money(preview.totals.subtotal)} · Discount {money(preview.totals.discount)} · Delivery {money(preview.totals.deliveryCharge)} · Tax {money(preview.totals.taxAmount)} · <strong>Total {money(preview.totals.total)}</strong></small></div>
          <div style={{marginTop:6}}>{preview.changes.length===0? <small>No field changes detected.</small> : preview.changes.map((ch,i)=>(
            <div key={i} style={{padding:'4px 0',borderTop:i? '1px dashed var(--border,#e5e7eb)':'none'}}><small><strong>{ch.label||ch.field}</strong></small><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><small style={{opacity:.8}}>Before: {typeof ch.before==='object'? JSON.stringify(ch.before): String(ch.before ?? '—')}</small><small>After: {typeof ch.after==='object'? JSON.stringify(ch.after): String(ch.after ?? '—')}</small></div></div>
          ))}</div>
          {preview.warnings.map((w,i)=><div key={'w'+i} style={{color:'var(--amber-ink, #92400e)',marginTop:4}}><small>⚠ {w}</small></div>)}{preview.errors.map((e,i)=><div key={'e'+i} className="form-error"><small>{e}</small></div>)}
        </div>}
        {error&&<p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" variant="outline" onClick={doPreview} disabled={busy}>Preview</Button>
          <Button type="button" onClick={save} disabled={busy || (preview? (!preview.canSave || preview.errors.length>0) : false)}><Pencil size={14}/>{busy?'Saving…':'Save changes'}</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
function OrderHistoryDialog({order,onClose}:{order:Order;onClose:()=>void}){
  const [loading,setLoading]=useState(true);
  const [revisions,setRevisions]=useState<ServerOrderRevision[]>([]);
  const [statusHistory,setStatusHistory]=useState<any[]>([]);
  useEffect(()=>{ let on=true; (async()=>{ const r=await listOrderRevisionsApi(order.id); if(on){ setRevisions(r.revisions||[]); setStatusHistory(r.statusHistory||[]); setLoading(false);} })(); return ()=>{on=false}; },[order.id]);
  return <Dialog open onOpenChange={v=>{if(!v)onClose()}}>
    <DialogContent className="order-detail-dialog">
      <DialogTitle>Order history · #{order.id}</DialogTitle>
      <DialogDescription>Edit revisions and status changes.</DialogDescription>
      <div className="order-detail-body" style={{maxHeight:'60vh',overflow:'auto'}}>
        {loading? <p>Loading history…</p> : <>
          <h4>Edit revisions</h4>
          {revisions.length===0? <p className="text-xs text-muted-foreground">No edit revisions recorded.</p> : revisions.map(r=>(
            <div key={r.id} style={{border:'1px solid var(--border,#e5e7eb)',borderRadius:8,padding:10,marginBottom:8}}>
              <div><strong>v{r.version}</strong> · {new Date(r.createdAt).toLocaleString()} {r.actorName?`· ${r.actorName}`:''}</div>
              <div><small>Reason: {r.reason||'—'}</small></div>
              <ul style={{margin:'6px 0 0 16px'}}>{(r.changes||[]).map((c,i)=><li key={i}><small><strong>{c.label||c.field}</strong>: {JSON.stringify(c.before)} → {JSON.stringify(c.after)}</small></li>)}</ul>
            </div>
          ))}
          <h4 style={{marginTop:12}}>Status history</h4>
          {statusHistory.length===0? <p className="text-xs text-muted-foreground">No status history recorded.</p> : statusHistory.map((h:any,i:number)=>(
            <div key={h.id||i} style={{padding:'6px 0',borderBottom:'1px solid var(--border,#e5e7eb)'}}><small>{new Date(h.timestamp||h.createdAt||Date.now()).toLocaleString()} · {h.previousStatus||h.fromStatus||'—'} → {h.newStatus||h.toStatus||h.action||'—'} {h.reason?`(${h.reason})`:''}</small></div>
          ))}
        </>}
      </div>
      <div className="dialog-actions"><Button type="button" variant="outline" onClick={onClose}>Close</Button></div>
    </DialogContent>
  </Dialog>;
}
/**
 * Stage-change receipt — the same green-tick confirmation a recorded payment
 * gets. Shown after an order moves stage so PC (modal footer / order dialog) and
 * mobile (drawer footer) end on a confirmation instead of just closing.
 * A known previous stage turns the receipt into an undo point.
 */
export function OrderStatusSuccessDialog({result,onUndo,onClose}:{result:{id:string;status:string;previous?:string}|null;onUndo?:()=>Promise<boolean>;onClose:()=>void}) {
  const [undoing,setUndoing]=useState(false);
  if(!result)return null;
  const headline=result.status==='In production'?'Order in production':`Order ${result.status}`;
  return <Dialog open onOpenChange={v=>{if(!v&&!undoing)onClose()}}><DialogContent className="payment-record-dialog payment-record-success"><div className="payment-success-state" role="status" aria-live="polite"><span className="payment-success-tick" aria-hidden="true"><Check size={28} strokeWidth={3}/></span><DialogTitle>{headline}</DialogTitle><DialogDescription>Order #{result.id} is now “{result.status}”.</DialogDescription>{onUndo&&<Button type="button" variant="outline" disabled={undoing} onClick={async()=>{setUndoing(true);const reverted=await onUndo();setUndoing(false);if(reverted)onClose()}}>{undoing?'Undoing…':`Undo — back to ${result.previous??'previous stage'}`}</Button>}</div></DialogContent></Dialog>;
}

/**
 * Failure receipt for a rejected stage/delivery move: the reason stays on
 * screen instead of a toast the user can miss while a dialog is still open.
 */
export function OrderStatusErrorDialog({error,onClose}:{error:{id:string;message:string}|null;onClose:()=>void}) {
  if(!error)return null;
  return <Dialog open onOpenChange={v=>{if(!v)onClose()}}><DialogContent className="payment-record-dialog payment-record-success"><div className="payment-success-state" role="alert"><span className="payment-error-tick" aria-hidden="true"><CircleAlert size={26} strokeWidth={2.5}/></span><DialogTitle>Status change failed</DialogTitle><DialogDescription>{error.message}</DialogDescription><Button type="button" variant="outline" onClick={onClose}>Close</Button></div></DialogContent></Dialog>;
}

export function RecordPaymentDialog({order,onClose,onNotice}: {order:Order|null;onClose:()=>void;onNotice?: (s:string)=>void}) {
  const {orders,updateOrder}=useWorkspace();
  const [payForm,setPayForm]=useState({amount:'',method:'Cash',reference:''});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState<{amount:number}|null>(null);
  useEffect(()=>{ setPayForm({amount:'',method:'Cash',reference:''}); setError(''); setBusy(false); setSuccess(null); },[order?.id]);
  if(!order) return null;
  const current = orders.find(o=>o.id===order.id) ?? order;
  const resolvedPayment=resolvePayment(current);
  const outstandingAmount=orderOutstandingAmount(current);
  const canSubmit = !busy && !!payForm.amount && Number(payForm.amount)>0 && ((payForm.method||'Cash').trim().toLowerCase()==='cash' || !!payForm.reference.trim());
  async function submit(e?:FormEvent){
    e?.preventDefault();
    if(!canSubmit) return;
    const amt=Math.round(Number(payForm.amount));
    if(!Number.isFinite(amt)||amt<=0){ setError('Enter a valid amount.'); return; }
    setBusy(true); setError('');
    const res=await updateOrder(current.id,current.status,undefined,amt,{method:payForm.method||'Cash',...(payForm.reference?.trim()?{reference:payForm.reference.trim()}:{})});
    setBusy(false);
    if(res.ok){ onNotice?.(`Payment of ${money(amt)} recorded for ${current.id}`); setSuccess({amount:amt}); }
    else { setError(res.error||'Failed to record payment.'); }
  }
  if(success){
    return <Dialog open={Boolean(order)} onOpenChange={v=>{ if(!v) onClose(); }}><DialogContent className="payment-record-dialog payment-record-success"><div className="payment-success-state" role="status" aria-live="polite"><span className="payment-success-tick" aria-hidden="true"><Check size={28} strokeWidth={3}/></span><DialogTitle>Payment recorded</DialogTitle><DialogDescription>Payment of {money(success.amount)} recorded for Order #{current.id}.</DialogDescription></div></DialogContent></Dialog>;
  }
  return <Dialog open={Boolean(order)} onOpenChange={v=>{ if(!v && !busy) onClose(); }}><DialogContent className="payment-record-dialog"><DialogTitle>Record payment</DialogTitle><DialogDescription>Order #{current.id} · {current.customer}</DialogDescription><form className="erp-form" onSubmit={submit}><label>Payment status<Input value={resolvedPayment} readOnly className={resolvedPayment==='Paid'?'payment-status-entry payment-status-paid':(resolvedPayment==='Unpaid'||resolvedPayment==='Not paid')?'payment-status-entry payment-status-unpaid':'payment-status-entry payment-status-partial'} /></label>{outstandingAmount>0&&<p className="form-note balance-due"><CircleAlert size={15}/>Outstanding balance: <strong>{money(outstandingAmount)}</strong></p>}<div className="payment-recorder"><p className="recorder-head"><Wallet size={15}/>Payment details</p><div className="recorder-fields"><label>Amount (UGX)<Input type="number" min={0} step={1} value={payForm.amount} onChange={e=>setPayForm({...payForm,amount:e.target.value})} required/></label><label>Method<Input value={payForm.method} onChange={e=>setPayForm({...payForm,method:e.target.value})}/></label>{(payForm.method||'Cash').trim().toLowerCase()!=='cash'&&<label>Reference<Input value={payForm.reference} onChange={e=>setPayForm({...payForm,reference:e.target.value})} placeholder="Transaction/reference"/></label>}</div></div>{error&&<p className="form-error">{error}</p>}<div className="dialog-actions"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" disabled={!canSubmit}><Wallet size={14}/>{busy?'Recording...':'Record payment'}</Button></div></form></DialogContent></Dialog>;
}

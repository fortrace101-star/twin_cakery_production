import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, ChefHat, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { money } from "./data";
import { StatusBadge as Status } from "../data-table/StatusBadge";
import { DataTable, type Column } from "../data-table/DataTable";
import { useDensity } from "@/lib/density";
import { useWorkspace } from "./store";
import {
  listProductionJobs, startProductionJob, completeProductionJob, recordQualityCheck, recordProductionWastage, getProductionCosts, getProductionConsumption,
  listInventoryItems, recordJobMaterials,
  type ServerProductionJob, type ServerProductionCost, type ServerProductionConsumption, type ServerInventoryItem,
} from "@/lib/api";

/* ── Production (live; E3) ─────────────────────────────────────────────── */
// Job board fed by GET /production/jobs. Row actions advance the state machine
// (Start → Complete → Quality check) and record wastage, all RBAC-guarded and
// persisted to Postgres. Falls back to a sign-in prompt when signed out.

const JOB_STAGE_LABEL: Record<string, string> = {
  PLAN: "Planning", REVIEW: "Review", CHECK_RECIPE: "Check recipe", CHECK_INVENTORY: "Check inventory",
  RESERVE: "Reserve stock", SHORTAGE: "Shortage", PURCHASE: "Purchase", PRODUCE: "Producing",
  QUALITY: "Quality check", DELIVER: "Ready to deliver", DONE: "Done",
};

export function jobStatusLabel(s: string): string {
  const map: Record<string, string> = {
    PENDING: "Pending", SCHEDULED: "Scheduled", READY_FOR_PRODUCTION: "Ready", IN_PRODUCTION: "In production",
    READY_FOR_QUALITY: "Ready for QC", QUALITY_CHECK: "Quality check", READY_FOR_DELIVERY: "Ready to deliver",
    REWORK_REQUIRED: "Rework required", COMPLETED: "Completed", CANCELLED: "Cancelled",
  };
  return map[s] ?? s;
}

const totalCost=(c:ServerProductionCost)=>c.ingredientCost+c.packagingCost+c.labourCost+c.overheadCost;

type Qc={result:'PASS'|'FAIL';issues:string;notes:string};
type Wastage={itemId:string;quantity:string;reason:string};
/** Pending "materials used" line — quantity kept as the raw input string. */
type Material={itemId:string;quantity:string;notes:string};

function ProductionDetail(props:{
  detail:ServerProductionJob|null; costs:ServerProductionCost[]; consumption:ServerProductionConsumption[];
  invItems:ServerInventoryItem[]; busy:boolean; qc:Qc|null; setQc:(q:Qc|null)=>void; wastage:Wastage|null; setWastage:(w:Wastage|null)=>void;
  materials:Material[]; setMaterials:(m:Material[])=>void; matForm:Material; setMatForm:(m:Material)=>void; addMaterial:()=>void; recordMaterials:()=>void;
  onClose:()=>void; act:(fn:()=>Promise<unknown>,msg:string)=>void;
}) {
  const {detail,costs,consumption,invItems,busy,qc,setQc,wastage,setWastage,materials,setMaterials,matForm,setMatForm,addMaterial,recordMaterials,onClose,act}=props;
  const selItem=invItems.find(i=>i.id===matForm.itemId);
  const overStock=Boolean(selItem&&Number(matForm.quantity)>selItem.physicalStock);
  return <Dialog open={Boolean(detail)} onOpenChange={v=>{if(!v)onClose();}}>
    <DialogContent className="order-detail-dialog">
      {detail&&<>
        <DialogTitle>{detail.productId||'Production job'}</DialogTitle>
        <DialogDescription>{detail.id} · order {detail.orderId} · {jobStatusLabel(detail.status)}</DialogDescription>
        <div className="configuration-list">
          <p><span>Quantity</span><strong>{detail.quantity}</strong></p>
          <p><span>Recipe version</span><strong>{detail.recipeVersion}</strong></p>
          <p><span>Stage</span><strong>{JOB_STAGE_LABEL[detail.stage]??detail.stage} ({detail.progress}%)</strong></p>
          {detail.requiredAt&&<p><span>Required by</span><strong>{new Date(detail.requiredAt).toLocaleString()}</strong></p>}
          <p><span>Status</span><Status value={jobStatusLabel(detail.status)}/></p>
        </div>
        <h3 className="text-sm font-semibold">Materials used</h3>
        {consumption.length===0?<p className="cell-sub">No materials recorded yet.</p>:<div className="configuration-list">{consumption.map(c=>{const it=invItems.find(i=>i.id===c.itemId);return <p key={c.id}><span>{it?.name??c.itemId}</span><strong>{c.quantity} {c.unit} · {money(c.actualCost)}</strong></p>;})}</div>}
        {(detail.status==='IN_PRODUCTION'||detail.status==='REWORK_REQUIRED')&&<>
          <div className="form-row"><Label htmlFor="m-item">Ingredient</Label>
            <select id="m-item" className="input" value={matForm.itemId} onChange={e=>setMatForm({...matForm,itemId:e.target.value})}><option value="">Choose ingredient…</option>{invItems.map(i=><option key={i.id} value={i.id}>{i.name} ({i.unit}) · {i.physicalStock} in stock</option>)}</select>
          </div>
          <div className="form-row"><Label htmlFor="m-qty">Quantity used</Label><Input id="m-qty" type="number" min={0} value={matForm.quantity} onChange={e=>setMatForm({...matForm,quantity:e.target.value})}/></div>
          <div className="form-row"><Label htmlFor="m-notes">Notes</Label><Input id="m-notes" value={matForm.notes} onChange={e=>setMatForm({...matForm,notes:e.target.value})} placeholder="Optional"/></div>
          {overStock&&selItem&&<p className="cell-sub">Only {selItem.physicalStock} {selItem.unit} of {selItem.name} in stock — reduce the quantity.</p>}
          <div className="dialog-actions"><Button variant="outline" disabled={!matForm.itemId||!Number(matForm.quantity)||overStock} onClick={addMaterial}>Add material</Button></div>
          {materials.length>0&&<>
            <h4 className="text-sm font-semibold">Pending materials ({materials.length})</h4>
            <div className="configuration-list">{materials.map((m,i)=>{const it=invItems.find(x=>x.id===m.itemId);return <p key={i}><span>{it?.name??m.itemId} · {m.quantity} {it?.unit??''}</span><strong>{money((it?.cost??0)*Number(m.quantity))}<Button variant="ghost" size="icon" aria-label={`Remove ${(it?.name??m.itemId)}`} onClick={()=>setMaterials(materials.filter((_,j)=>j!==i))}><X size={14}/></Button></strong></p>;})}</div>
            <div className="dialog-actions"><Button disabled={busy||materials.length===0} onClick={recordMaterials}>Record materials used ({materials.length})</Button></div>
          </>}
        </>}
        <h3 className="text-sm font-semibold">Costs</h3>
        {costs.length===0?<p className="cell-sub">No cost records yet.</p>:<div className="configuration-list">{costs.map(c=><p key={c.id}><span>{c.status}</span><strong>{money(totalCost(c))}</strong></p>)}</div>}
        <div className="dialog-actions">
          {(detail.status==='PENDING'||detail.status==='SCHEDULED'||detail.status==='READY_FOR_PRODUCTION')&&<Button disabled={busy} onClick={()=>act(()=>startProductionJob(detail.id),'Production started')}>Start production</Button>}
          {detail.status==='IN_PRODUCTION'&&<Button disabled={busy} onClick={()=>act(()=>completeProductionJob(detail.id),'Marked ready for quality check')}>Mark complete</Button>}
          {(detail.status==='READY_FOR_QUALITY'||detail.status==='QUALITY_CHECK')&&<>
            <Button disabled={busy} onClick={()=>setQc({result:'PASS',issues:'',notes:''})}>Quality check: Pass</Button>
            <Button variant="outline" disabled={busy} onClick={()=>setQc({result:'FAIL',issues:'',notes:''})}>Fail / rework</Button>
          </>}
          <Button variant="outline" disabled={busy} onClick={()=>setWastage({itemId:invItems[0]?.id??'',quantity:'',reason:''})}>Record wastage</Button>
        </div>
        {qc&&<div className="erp-form">
          <h3 className="text-sm font-semibold">Quality check — {qc.result==='PASS'?'Pass':'Fail / rework'}</h3>
          <div className="form-row"><Label htmlFor="qc-issues">Issues</Label><Input id="qc-issues" value={qc.issues} onChange={e=>setQc({...qc,issues:e.target.value})} placeholder="Optional"/></div>
          <div className="form-row"><Label htmlFor="qc-notes">Notes</Label><Textarea id="qc-notes" value={qc.notes} onChange={e=>setQc({...qc,notes:e.target.value})} placeholder="Optional"/></div>
          <div className="dialog-actions">
            <Button disabled={busy} onClick={()=>act(async()=>recordQualityCheck(detail.id,{result:qc.result,issues:qc.issues,notes:qc.notes,reworkRequired:qc.result==='FAIL'}),qc.result==='PASS'?'Quality check passed':'Rework required')}>Submit</Button>
            <Button variant="ghost" onClick={()=>setQc(null)}>Cancel</Button>
          </div>
        </div>}
        {wastage&&<div className="erp-form">
          <h3 className="text-sm font-semibold">Record wastage</h3>
          <div className="form-row"><Label htmlFor="w-item">Ingredient</Label>
            <select id="w-item" className="input" value={wastage.itemId} onChange={e=>setWastage({...wastage,itemId:e.target.value})}>{invItems.map(i=><option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}</select>
          </div>
          <div className="form-row"><Label htmlFor="w-qty">Quantity</Label><Input id="w-qty" type="number" value={wastage.quantity} onChange={e=>setWastage({...wastage,quantity:e.target.value})}/></div>
          <div className="form-row"><Label htmlFor="w-reason">Reason</Label><Input id="w-reason" value={wastage.reason} onChange={e=>setWastage({...wastage,reason:e.target.value})} placeholder="e.g. Burnt, spillage"/></div>
          <div className="dialog-actions">
            <Button disabled={busy||!wastage.itemId||!wastage.quantity} onClick={()=>act(()=>recordProductionWastage(detail.id,{itemId:wastage.itemId,quantity:Number(wastage.quantity),reason:wastage.reason}),'Wastage recorded')}>Submit</Button>
            <Button variant="ghost" onClick={()=>setWastage(null)}>Cancel</Button>
          </div>
        </div>}
      </>}
    </DialogContent>
  </Dialog>;
}

export function Production({tab,search,setSearch,onNotice,onSignIn}: {tab:string;search:string;setSearch:(s:string)=>void;onNotice:(s:string)=>void;onSignIn:()=>void}) {
  const { connected } = useWorkspace();
  const { density } = useDensity();
  const [jobs,setJobs]=useState<ServerProductionJob[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [detail,setDetail]=useState<ServerProductionJob|null>(null);
  const [costs,setCosts]=useState<ServerProductionCost[]>([]);
  const [consumption,setConsumption]=useState<ServerProductionConsumption[]>([]);
  const [qc,setQc]=useState<Qc|null>(null);
  const [wastage,setWastage]=useState<Wastage|null>(null);
  const [materials,setMaterials]=useState<Material[]>([]);
  const [matForm,setMatForm]=useState<Material>({itemId:'',quantity:'',notes:''});
  const [invItems,setInvItems]=useState<ServerInventoryItem[]>([]);

  const refresh=useCallback(async()=>{
    setLoading(true);
    const [j,inv]=await Promise.all([listProductionJobs(),listInventoryItems()]);
    setJobs(j); setInvItems(inv); setLoading(false);
  },[]);
  useEffect(()=>{ void refresh(); },[refresh]);

  const q=search.toLowerCase();
  const filtered=jobs.filter(j=>`${j.id} ${j.orderId} ${j.productId} ${jobStatusLabel(j.status)}`.toLowerCase().includes(q));

  async function openDetail(j:ServerProductionJob){
    setDetail(j);
    setMaterials([]); setMatForm({itemId:'',quantity:'',notes:''});
    const [c,cons]=await Promise.all([getProductionCosts(j.id),getProductionConsumption(j.id)]);
    setCosts(c); setConsumption(cons);
  }

  async function act(fn:()=>Promise<unknown>,msg:string){
    if(!connected){ onSignIn(); return; }
    setBusy(true);
    const r=await fn();
    setBusy(false);
    if(r===null||r===false){ onNotice('Action failed — check your permissions'); return; }
    onNotice(msg);
    await refresh();
    setDetail(null);
  }

  function addMaterial(){
    const qty=Number(matForm.quantity);
    if(!matForm.itemId||!Number.isFinite(qty)||qty<=0) return;
    setMaterials([...materials,{...matForm}]);
    setMatForm({itemId:matForm.itemId,quantity:'',notes:''});
  }

  async function recordMaterials(){
    if(!detail||materials.length===0) return;
    if(!connected){ onSignIn(); return; }
    setBusy(true);
    const created=await recordJobMaterials(detail.id,materials.map(m=>({itemId:m.itemId,quantity:Number(m.quantity),notes:m.notes||undefined})));
    setBusy(false);
    if(created===null){ onNotice('Materials not recorded — check stock levels and permissions'); return; }
    onNotice(`Materials recorded · ${created.length} line${created.length===1?'':'s'} deducted from inventory`);
    setMaterials([]); setMatForm({itemId:'',quantity:'',notes:''});
    await refresh();
    // Reload the open dialog so consumption/costs show what was just recorded.
    const job=(await listProductionJobs()).find(j=>j.id===detail.id);
    if(job) await openDetail(job); else setDetail(null);
  }

  if(!connected && jobs.length===0 && !loading){
    return <section className="panel module-table"><div className="panel-heading"><div><h2>{tab}</h2><p>Live production jobs</p></div></div><div className="empty-state"><ChefHat size={28}/><h3>Sign in to view production</h3><p>The production board reads live jobs from the ERP. This preview is read-only.</p><Button variant="outline" onClick={onSignIn}>Sign in</Button></div></section>;
  }

  return <section className="panel module-table">
    <div className="panel-heading"><div><h2>{tab}</h2><p>{loading?'Loading jobs…':`${filtered.length} production ${filtered.length===1?'job':'jobs'}`}</p></div></div>
    <div className="table-controls"><label className="search-box"><Search size={16}/><input aria-label="Search jobs" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search jobs, orders…"/></label></div>
    <DataTable
      columns={[
        { header:'Job / order', cell:(j)=><><strong className="product-name">{j.productId||'Job'}</strong><small className="cell-sub">{j.id} · order {j.orderId}</small></> },
        { header:'Qty', align:'right', cell:(j)=><span className="amount-cell">{j.quantity}</span> },
        { header:'Recipe', cell:(j)=>j.recipeVersion },
        { header:'Progress', cell:(j)=><div style={{minWidth:90}}><div className="progress-track"><div className="progress-bar" style={{width:`${j.progress}%`}}/></div><small className="cell-sub">{j.progress}% · {JOB_STAGE_LABEL[j.stage]??j.stage}</small></div> },
        { header:'Status', cell:(j)=><Status value={jobStatusLabel(j.status)}/> },
        { header:'', cell:(j)=><Button variant="ghost" size="icon" aria-label={`Open ${j.id}`} onClick={e=>{e.stopPropagation();void openDetail(j)}}><ArrowUpRight/></Button> },
      ] as Column<ServerProductionJob>[]}
      rows={filtered} rowKey={(j)=>j.id} onRowActivate={(j)=>void openDetail(j)} stickyHeader density={density}
      empty={<div className="empty-state"><Search/><h3>No jobs found</h3><p>Production jobs appear once orders are confirmed.</p></div>}
    />
    <div className="table-foot"><span>{filtered.length} jobs</span><span>{jobs.filter(j=>j.status==='IN_PRODUCTION').length} in production</span></div>
    <ProductionDetail
      detail={detail} costs={costs} consumption={consumption} invItems={invItems} busy={busy}
      qc={qc} setQc={setQc} wastage={wastage} setWastage={setWastage}
      materials={materials} setMaterials={setMaterials} matForm={matForm} setMatForm={setMatForm} addMaterial={addMaterial} recordMaterials={recordMaterials}
      onClose={()=>{setDetail(null);setQc(null);setWastage(null);setMaterials([]);setMatForm({itemId:'',quantity:'',notes:''});}} act={act}
    />
  </section>;
}



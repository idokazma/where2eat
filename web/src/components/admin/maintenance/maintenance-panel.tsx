'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/admin/api';

type Preview = { revision: string; warnings?: string[]; impact?: Record<string, unknown>; rows?: unknown; changes?: unknown };
type Operation = { id: string; kind: string; created_at: string; undone_at?: string };
type Costs = { label: string; month: string; estimated_usd: number; budget_usd: number; opening_spend_verified: boolean; price_review_overdue?: boolean; alert: boolean; stopped: boolean; runs: unknown; coverage: string };
const base='/api/admin/maintenance';
function message(e:unknown){const x=e as {message?:string;detail?:unknown;error?:string};return x.message||x.error||(typeof x.detail==='string'?x.detail:JSON.stringify(x.detail))||'Request failed';}

export function MaintenancePanel() {
  const [keep,setKeep]=useState('');const [drop,setDrop]=useState('');
  const [video,setVideo]=useState('');const [mention,setMention]=useState('');
  const [name,setName]=useState('');const [target,setTarget]=useState('');
  const [preview,setPreview]=useState<Preview|null>(null);const [action,setAction]=useState('');
  const [error,setError]=useState('');const [status,setStatus]=useState('');const [busy,setBusy]=useState(false);
  const [operations,setOperations]=useState<Operation[]>([]);const [costs,setCosts]=useState<Costs|null>(null);
  const changes: Record<string,string>={};if(name.trim())changes.name_hebrew=name.trim();if(target.trim())changes.restaurant_id=target.trim();
  const clear=()=>{setPreview(null);setAction('');setError('');setStatus('');};
  function load(){
    return Promise.all([apiFetch<{operations:Operation[]}>(`${base}/operations`),apiFetch<Costs>(`${base}/costs`)]);
  }
  async function refresh(){
    const [o,c]=await load();
    setOperations(o.operations);setCosts(c);
  }
  useEffect(()=>{
    let active=true;
    load().then(([o,c])=>{if(active){setOperations(o.operations);setCosts(c);}}).catch(e=>{if(active)setError(message(e));});
    return ()=>{active=false;};
  },[]);
  async function inspect(kind:string){
    setBusy(true);setError('');setStatus('');setPreview(null);
    try{
      let p:Preview;
      if(kind==='merge')p=await apiFetch(`${base}/merges/preview`,{method:'POST',body:JSON.stringify({keep_id:keep,drop_id:drop})});
      else if(kind==='delete')p=await apiFetch(`${base}/episodes/${encodeURIComponent(video)}/delete-preview`);
      else p=await apiFetch(`${base}/mentions/${encodeURIComponent(mention)}/preview`,{method:'POST',body:JSON.stringify({changes})});
      setPreview(p);setAction(kind);
    }catch(e){setError(message(e));}finally{setBusy(false);}
  }
  async function commit(){
    if(!preview||!window.confirm(action==='delete'?'Delete only this episode and the records shown in this preview?':'Apply the reviewed change? A snapshot will be saved.'))return;
    setBusy(true);setError('');
    try{
      let result:{operation_id:string};
      if(action==='merge')result=await apiFetch(`${base}/merges`,{method:'POST',body:JSON.stringify({keep_id:keep,drop_id:drop,revision:preview.revision})});
      else if(action==='delete')result=await apiFetch(`${base}/episodes/${encodeURIComponent(video)}`,{method:'DELETE',body:JSON.stringify({revision:preview.revision})});
      else result=await apiFetch(`${base}/mentions/${encodeURIComponent(mention)}`,{method:'PATCH',body:JSON.stringify({changes,revision:preview.revision})});
      setStatus(`Saved snapshot: ${result.operation_id}`);setPreview(null);await refresh();
    }catch(e){setError(message(e));setPreview(null);}finally{setBusy(false);}
  }
  async function undo(id:string){
    if(!window.confirm('Restore this snapshot? The server will refuse if affected data changed.'))return;
    setBusy(true);setError('');
    try{await apiFetch(`${base}/operations/${id}/undo`,{method:'POST'});setStatus(`Restored ${id}`);setPreview(null);await refresh();}
    catch(e){setError(message(e));}finally{setBusy(false);}
  }
  const inputStyle='border rounded-md px-3 py-2 w-full bg-white text-slate-900';const buttonStyle='border rounded-md px-4 py-2 bg-slate-100 text-slate-900 hover:bg-slate-200 disabled:opacity-50';
  return <main className="max-w-5xl mx-auto space-y-6 p-6 text-slate-900 bg-white">
    <header><h1 className="text-2xl font-semibold">Safe maintenance</h1><p className="text-slate-600 mt-2">Preview first. Every change saves a snapshot. Conflicts require a fresh preview, not an override.</p></header>
    {error&&<div role="alert" className="border border-red-500 p-4 rounded-md">{error}</div>}
    {status&&<div role="status" className="border border-green-600 p-4 rounded-md break-all">{status}</div>}
    <div className="grid lg:grid-cols-2 gap-6">
      <section className="border rounded-lg p-5 space-y-3"><h2 className="font-semibold text-lg">Merge duplicates</h2><p className="text-sm text-slate-600">Review identity, location, photos and every linked moment. Conflicting IDs and orphan timestamps block the merge.</p>
        <label className="block">Keep restaurant ID<input disabled={busy} aria-label="Keep restaurant ID" className={inputStyle} value={keep} onChange={e=>{setKeep(e.target.value);clear();}}/></label>
        <label className="block">Duplicate restaurant ID<input disabled={busy} aria-label="Duplicate restaurant ID" className={inputStyle} value={drop} onChange={e=>{setDrop(e.target.value);clear();}}/></label>
        <button className={buttonStyle} disabled={busy||!keep||!drop} onClick={()=>inspect('merge')}>Preview merge</button>
      </section>
      <section className="border rounded-lg p-5 space-y-3"><h2 className="font-semibold text-lg">Delete one episode</h2><p className="text-sm text-slate-600">Shared restaurants are preserved and linked to a remaining episode. Only this episode&apos;s mentions are removed.</p>
        <label className="block">Video ID<input disabled={busy} aria-label="Video ID" className={inputStyle} value={video} onChange={e=>{setVideo(e.target.value);clear();}}/></label>
        <button className={buttonStyle} disabled={busy||!video} onClick={()=>inspect('delete')}>Preview deletion</button>
      </section>
    </div>
    <section className="border rounded-lg p-5 space-y-3"><h2 className="font-semibold text-lg">Repair one mention</h2><p className="text-sm text-slate-600">Source name, quotes and timestamp are retained. Leave optional inputs empty to keep them unchanged.</p>
      <div className="grid md:grid-cols-3 gap-3">
        <label>Mention ID<input disabled={busy} aria-label="Mention ID" className={inputStyle} value={mention} onChange={e=>{setMention(e.target.value);clear();}}/></label>
        <label>Corrected name<input disabled={busy} aria-label="Corrected name" className={inputStyle} value={name} onChange={e=>{setName(e.target.value);clear();}}/></label>
        <label>Link to restaurant ID<input disabled={busy} aria-label="Link to restaurant ID" className={inputStyle} value={target} onChange={e=>{setTarget(e.target.value);clear();}}/></label>
      </div><button className={buttonStyle} disabled={busy||!mention||!Object.keys(changes).length} onClick={()=>inspect('repair')}>Preview repair</button>
    </section>
    {preview&&<section className="border rounded-lg p-5 space-y-3"><h2 className="font-semibold text-lg">Review {action}</h2>
      {!!preview.warnings?.length&&<ul role="alert" className="text-red-600 list-disc pl-5">{preview.warnings.map(w=><li key={w}>{w}</li>)}</ul>}
      <pre className="text-sm overflow-auto max-h-96 bg-slate-100 text-slate-900 p-4 rounded">{JSON.stringify(preview,null,2)}</pre>
      <button className={buttonStyle} disabled={busy||!!preview.warnings?.length} onClick={commit}>Confirm reviewed change</button>
    </section>}
    <section className="border rounded-lg p-5 space-y-3"><h2 className="font-semibold text-lg">Estimated costs</h2>
      {costs?<><p>{costs.label} · {costs.month} (UTC)</p><p className="text-xl">${costs.estimated_usd.toFixed(4)} / ${costs.budget_usd.toFixed(2)}</p>
        {!costs.opening_spend_verified&&<p role="alert">Opening spend is unverified. This month&apos;s estimate assumes $0 spent before tracking began; configure the opening amount from the billing console.</p>}
        {costs.price_review_overdue&&<p role="alert">Price constants are older than 90 days; review src/cost_ledger.py.</p>}
        {costs.alert&&<p role="alert">{costs.stopped?'Budget stop active':'Estimated spending reached the 80% alert threshold'}</p>}
        <p className="text-sm text-slate-600">{costs.coverage}</p><p className="text-sm text-slate-600">The public photo proxy is recorded but never blocked, so site images keep loading after a budget stop.</p><pre className="text-sm overflow-auto">{JSON.stringify(costs.runs,null,2)}</pre></>:<p>Loading estimates...</p>}
    </section>
    <section className="border rounded-lg p-5 space-y-3"><h2 className="font-semibold text-lg">Snapshots and undo</h2>
      {!operations.length&&<p className="text-slate-600">No maintenance operations yet.</p>}
      {operations.map(o=><div key={o.id} className="border-t py-3 flex flex-wrap gap-3 items-center justify-between"><div><p>{o.kind} · {new Date(o.created_at).toLocaleString()}</p><code className="text-xs break-all">{o.id}</code></div><button className={buttonStyle} disabled={busy||!!o.undone_at} onClick={()=>undo(o.id)}>{o.undone_at?'Restored':'Undo'}</button></div>)}
    </section>
  </main>;
}

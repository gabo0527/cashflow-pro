'use client'
import React, {useEffect,useMemo,useRef,useState} from 'react'
import {Download,RefreshCw,X} from 'lucide-react'
import {supabase} from '@/lib/supabase'
import {hoursLabel,mondayOf,reportDate,shiftDate} from '@/lib/resource-report'
import {buildProjectTimesheetReport,projectBudgetUsed,reportEntryKey,reportPeriod,ProjectTimesheetReport} from '@/lib/project-timesheet-report'
import type {ResourceReportProps} from './ResourceReportBuilder'

const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Puerto_Rico'})
const field='block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 mt-1'
const short=(date:string)=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'})
export default function ProjectTimesheetReportBuilder({entries,projects,resources,initialProjects,initialResources,logo,onClose,onAdvanced,budgetProjects=[],projectResources=[],budgetReferences=[],budgetSources=[]}:ResourceReportProps & {onAdvanced:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null)
  const [projectId,setProjectId]=useState(initialProjects[0] || projects[0]?.id || '')
  const [selectedResources,setResources]=useState(initialResources)
  const [mode,setMode]=useState<'week'|'month'>('week')
  const [week,setWeek]=useState(shiftDate(mondayOf(today()),-7)),[month,setMonth]=useState(today().slice(0,7))
  const [historyStart,setHistoryStart]=useState(shiftDate(mondayOf(today()),-7).slice(0,7)+'-01'),[customHistory,setCustomHistory]=useState(false)
  const [title,setTitle]=useState('Project timesheet report'),[scope,setScope]=useState<'week'|'period'>('week')
  const [sections,setSections]=useState({hours:true,summary:true,originals:true})
  const [includeBudget,setIncludeBudget]=useState(false),[review,setReview]=useState(false),[excluded,setExcluded]=useState<string[]>([])
  const [summaries,setSummaries]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[downloading,setDownloading]=useState(false),[error,setError]=useState('')
  const generation=useRef(0)
  useEffect(()=>{dialog.current?.showModal();return()=>{generation.current++}},[])
  const period=reportPeriod(mode,mode==='week'?week:month)
  const through=period?(period.end<today()?period.end:today()):''
  const selectedProject=projects.find(p=>p.id===projectId)
  const projectEntries=useMemo(()=>entries.filter(e=>e.project_id===projectId),[entries,projectId])
  const resourceIds=useMemo(()=>new Set([...projectEntries.map(e=>e.team_member_id),...projectResources.filter(a=>a.project_id===projectId).map(a=>a.team_member_id)]),[projectEntries,projectResources,projectId])
  const choices=resources.filter(r=>resourceIds.has(r.id))
  const chosen=selectedResources.filter(id=>resourceIds.has(id))
  const allContractorsSelected=choices.length>0&&choices.every(r=>chosen.includes(r.id))
  useEffect(()=>{if(!allContractorsSelected)setIncludeBudget(false)},[allContractorsSelected])
  const client=projectEntries[0]?.client_name || budgetProjects.find(p=>p.id===projectId)?.client || ''
  const budget=through?projectBudgetUsed(budgetSources,budgetReferences,projectId,through):undefined
  const report=useMemo(()=>{
    if(!period||!through)return null
    try{return buildProjectTimesheetReport({entries,projectId,project:selectedProject?.label || '',client,resources:choices,selectedResources:chosen,excluded,from:historyStart,through,detailScope:scope,title:title.trim()||'Project timesheet report',sections,...(includeBudget&&allContractorsSelected&&budget?{budget}:{})})}catch{return null}
  },[entries,projectId,selectedProject?.label,client,choices.map(r=>r.id+':'+r.label).join('|'),chosen.join('|'),excluded,historyStart,through,scope,title,sections,includeBudget,allContractorsSelected,budget?.percent,budget?.from,budget?.cadence,!!period])
  const currentRows=report?.summaries || []
  const missing=sections.summary?currentRows.filter(r=>r.notes.length&&!summaries[r.key]?.trim()):[]
  const candidates=entries.map((e,i)=>({e,key:reportEntryKey(e,i)})).filter(({e})=>e.project_id===projectId&&chosen.includes(e.team_member_id)&&e.date>=historyStart&&e.date<=through&&Number(e.hours)>0&&(scope==='period'||e.date>=mondayOf(through)))
  const valid=!!report&&chosen.length>0&&Object.values(sections).some(Boolean)
  const budgetBlocked=allContractorsSelected&&includeBudget&&budget?.percent===null
  function choosePeriod(nextMode:'week'|'month',value:string){
    generation.current++;setBusy(false);setError('');setMode(nextMode)
    if(nextMode==='week')setWeek(value);else setMonth(value)
    const next=reportPeriod(nextMode,value);if(next&&!customHistory)setHistoryStart(next.start.slice(0,7)+'-01')
  }
  function chooseProject(id:string){setProjectId(id);setResources(resources.filter(r=>entries.some(e=>e.project_id===id&&e.team_member_id===r.id)||projectResources.some(a=>a.project_id===id&&a.team_member_id===r.id)).map(r=>r.id));setExcluded([]);setIncludeBudget(false);setError('')}
  async function generate(){
    setBusy(true);setError('');const attempt=++generation.current
    try{
      const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('Sign in to draft summaries.')
      for(let i=0;i<missing.length;i+=6){
        const batch=missing.slice(i,i+6)
        const response=await fetch('/api/resource-report-summaries',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({lines:batch.map(r=>({key:r.key,notes:r.notes.slice(0,100).map(n=>({date:n.date,note:n.note.slice(0,4000)}))}))})})
        const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not draft summaries.')
        if(attempt!==generation.current)return
        setSummaries(prev=>({...prev,...Object.fromEntries(batch.filter(r=>!prev[r.key]?.trim()&&typeof result.summaries?.[r.key]==='string').map(r=>[r.key,result.summaries[r.key]]))}))
        if(batch.some(r=>!result.summaries?.[r.key]?.trim()))throw new Error('Some summaries are missing. Retry or write them below.')
      }
    }catch(e){if(attempt===generation.current)setError((e as Error).message)}finally{if(attempt===generation.current)setBusy(false)}
  }
  async function download(){
    if(!valid||!report||missing.length||budgetBlocked)return
    setDownloading(true);setError('')
    try{
      const image=new Image();image.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(logo.replace('<svg ','<svg width="664" ').replace('height="24"','height="131"'))}`;await image.decode()
      const canvas=document.createElement('canvas');canvas.width=664;canvas.height=131;const context=canvas.getContext('2d');if(!context)throw new Error('Could not render the Mano logo.');context.drawImage(image,0,0,664,131)
      const [png,regular,bold]=await Promise.all([fetch(canvas.toDataURL('image/png')).then(r=>r.arrayBuffer()),fetch('/fonts/DejaVuSans.ttf').then(r=>{if(!r.ok)throw new Error('Report font unavailable. Reload and retry.');return r.arrayBuffer()}),fetch('/fonts/DejaVuSans-Bold.ttf').then(r=>{if(!r.ok)throw new Error('Report font unavailable. Reload and retry.');return r.arrayBuffer()})])
      const {createProjectTimesheetPDF}=await import('@/lib/project-timesheet-pdf')
      const bytes=await createProjectTimesheetPDF(report,summaries,{logo:new Uint8Array(png),regular:new Uint8Array(regular),bold:new Uint8Array(bold)})
      const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/pdf'})),anchor=document.createElement('a')
      anchor.href=url;anchor.download=`Mano-timesheet-${projectId}-${historyStart}-to-${through}.pdf`;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)
    }catch(e){setError((e as Error).message)}finally{setDownloading(false)}
  }
  const mark=<img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(logo)}`} alt="Mano CG" className="w-36 max-w-[45%]" />
  const head=(label:string)=><div className="flex justify-between items-center gap-4 border-b-[3px] border-orange-500 pb-5 mb-6">{mark}<div className="text-right text-xs text-slate-500 uppercase tracking-wide">{client}<strong className="block text-slate-800 mt-1">{selectedProject?.label}</strong><span className="block mt-1">{label}</span></div></div>
  const footer=<div className="mt-8 pt-3 border-t border-slate-200 flex justify-between gap-3 text-[11px] text-slate-500"><span>Mano CG LLC · {selectedProject?.label}</span><span>Through {through&&reportDate(through)}</span></div>
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="project-timesheet-heading" className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none bg-slate-100 p-0 text-slate-900 backdrop:bg-slate-950/60">
    <div className="h-full flex flex-col"><header className="flex flex-wrap items-center justify-between gap-4 bg-[#182d43] text-white px-6 py-4"><div><p className="text-xs uppercase tracking-widest text-orange-200">Time tracking / Resource report</p><h1 id="project-timesheet-heading" className="text-xl font-semibold mt-1">Project timesheet report</h1></div><div className="flex gap-3 items-center"><button disabled={!valid||missing.length>0||busy||downloading||budgetBlocked} onClick={download} className="flex items-center gap-2 bg-white text-slate-900 px-4 py-2 rounded-lg font-semibold disabled:opacity-40"><Download size={16}/>{downloading?'Preparing PDF…':'Download PDF'}</button><button onClick={onClose} aria-label="Close resource report" className="p-2"><X size={22}/></button></div></header>
    <div className="flex-1 min-h-0 overflow-auto"><section className="bg-white p-5 sm:px-8 border-b border-slate-200"><fieldset disabled={busy||downloading} className="space-y-4 disabled:opacity-60">
      <div className="grid gap-4 sm:grid-cols-3"><label className="text-xs text-slate-500">Project<select aria-label="Report project" className={field} value={projectId} onChange={e=>chooseProject(e.target.value)}>{projects.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label><label className="text-xs text-slate-500">Report period<select aria-label="Report period" className={field} value={mode} onChange={e=>choosePeriod(e.target.value as 'week'|'month',e.target.value==='week'?week:month)}><option value="week">Week</option><option value="month">Month</option></select></label>{mode==='week'?<label className="text-xs text-slate-500">Week containing<input type="date" aria-label="Report week" value={week} onChange={e=>choosePeriod('week',e.target.value)} className={field}/></label>:<label className="text-xs text-slate-500">Month<input type="month" aria-label="Report month" value={month} onChange={e=>choosePeriod('month',e.target.value)} className={field}/></label>}</div>
      <div><div className="flex justify-between gap-4 text-xs text-slate-500 mb-2"><span>Contractors in this project</span><div className="flex gap-3"><button onClick={()=>setResources(choices.map(r=>r.id))} className="text-blue-700">Select all contractors</button><button onClick={()=>setResources([])}>Clear contractors</button></div></div><div className="flex gap-2 flex-wrap">{choices.map(r=><label key={r.id} className={`flex items-center gap-2 px-3 py-2 border rounded-md text-sm ${chosen.includes(r.id)?'border-blue-400 bg-blue-50':'border-slate-200'}`}><input type="checkbox" aria-label={`Include contractor ${r.label}`} checked={chosen.includes(r.id)} onChange={e=>setResources(e.target.checked?[...selectedResources,r.id]:selectedResources.filter(id=>id!==r.id))}/>{r.label}</label>)}{!choices.length&&<p className="text-sm text-slate-500">No contractors or submitted hours are linked to this project.</p>}</div></div>
      <div className="flex gap-x-6 gap-y-2 flex-wrap text-sm">{([['hours','Weekly hours table'],['summary','Current-week summary'],['originals','Original descriptions']] as const).map(([key,label])=><label key={key} className="flex items-center gap-2"><input type="checkbox" checked={sections[key]} onChange={e=>setSections({...sections,[key]:e.target.checked})}/>{label}</label>)}{budget&&allContractorsSelected&&<label className="flex items-center gap-2"><input aria-label="Include Budget used (%)" type="checkbox" checked={includeBudget} onChange={e=>setIncludeBudget(e.target.checked)}/>Budget used (%)</label>}</div>
      <div className="grid sm:grid-cols-3 gap-4"><label className="text-xs text-slate-500">Hours from<input type="date" aria-label="Hours from" value={historyStart} onChange={e=>{setCustomHistory(true);setHistoryStart(e.target.value)}} className={field}/></label><label className="text-xs text-slate-500">Original entries<select aria-label="Original entries" value={scope} onChange={e=>setScope(e.target.value as 'week'|'period')} className={field}><option value="week">Current report week</option><option value="period">Entire hours period</option></select></label><label className="text-xs text-slate-500">Report title<input aria-label="Report title" maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} className={field}/></label></div>
      <div className="flex flex-wrap gap-3 items-center justify-between pt-3 border-t border-slate-200"><p aria-live="polite" className="text-xs text-slate-500">{chosen.length} contractors · {hoursLabel(report?.hours.reduce((s,r)=>s+r.total,0)||0)} hours in period{report&&` · ${report.excludedCount} entries excluded`}</p><div className="flex gap-4 text-xs"><button className="text-blue-700" onClick={()=>setReview(!review)}>{review?'Close entry selection':`Review ${candidates.length} entries`}</button><button className="text-slate-500" onClick={onAdvanced}>Program / role report</button></div></div>
      {includeBudget&&allContractorsSelected&&budget&&<p className="text-xs text-slate-500">Budget used (%) covers the whole project and all contractors, {reportDate(budget.from)} through {reportDate(budget.through)}. Available only while all project contractors are selected. Entry exclusions do not change this whole-project percentage. No amounts are exported.</p>}
      {budget&&!allContractorsSelected&&<p className="text-xs text-slate-500">Select all project contractors to make Budget used (%) available.</p>}
      {budgetBlocked&&<p role="alert" className="text-sm text-amber-700">Budget used (%) is unavailable because billable entries have missing rates. Update project setup or deselect Budget before exporting.</p>}
      {!report&&<p role="alert" className="text-sm text-amber-700">Choose valid dates with the hours start on or before the report cutoff, within one year.</p>}
      {review&&<div className="border-t border-slate-200 pt-3"><p className="text-xs text-slate-500 mb-3">Selections update the hours table, current-week summary and original entries together.</p><div className="space-y-3">{candidates.map(({e,key})=><label key={key} className={`grid grid-cols-[18px_minmax(0,1fr)] gap-3 rounded-md border p-3 ${excluded.includes(key)?'bg-slate-50 text-slate-500':'border-slate-200'}`}><input aria-label={`Include entry ${e.team_member_name} ${e.date} ${key}`} type="checkbox" checked={!excluded.includes(key)} onChange={ev=>setExcluded(ev.target.checked?excluded.filter(k=>k!==key):[...excluded,key])}/><div><p className="text-xs font-semibold">{e.team_member_name} · {reportDate(e.date)} · {hoursLabel(e.hours)} hours</p><p className="text-sm whitespace-pre-wrap break-words mt-1">{e.notes||'No description submitted.'}</p></div></label>)}</div></div>}
    </fieldset>{error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}</section>
    <main className="max-w-5xl mx-auto p-3 sm:p-8 space-y-6" aria-label="Project report preview">
      {!chosen.length?<p className="text-center text-slate-500 p-12">Select at least one contractor to preview the report.</p>:report&&<>
      {(sections.hours||sections.summary||report.budget)&&<article className="bg-white border border-slate-200 shadow-sm p-5 sm:p-10">{head('Project timesheet report')}<h2 className="text-2xl font-semibold tracking-tight text-[#182d43]">{report.title}</h2><div className="grid sm:grid-cols-2 gap-3 py-4 my-5 border-y border-slate-200 text-xs"><div><span className="block text-slate-500 uppercase tracking-wide mb-1">Hours coverage</span>{reportDate(report.from)} – {reportDate(report.through)}</div><div><span className="block text-slate-500 uppercase tracking-wide mb-1">Activity summary covers</span>{reportDate(report.currentWeek.start)} – {reportDate(report.currentWeek.end)}</div></div>
      {sections.hours&&<HoursTable report={report}/>}
      {report.budget&&<section aria-label="Budget used (%)" className="mt-6 py-4 border-y border-slate-200 flex gap-4 justify-between items-center"><div><h3 className="font-semibold">Budget used (%)</h3><p className="text-xs text-slate-500">Whole project · {reportDate(report.budget.from)} – {reportDate(report.budget.through)}</p></div><strong className="text-xl tabular-nums">{report.budget.percent===null?'Unavailable':`${hoursLabel(report.budget.percent)}%`}</strong></section>}
      {sections.summary&&<section className="mt-7" aria-label="Current-week activity"><div className="flex flex-wrap justify-between gap-3 mb-3"><div><h3 className="font-semibold">Current-week activity</h3><p className="text-xs text-slate-500">{reportDate(report.currentWeek.start)} – {reportDate(report.currentWeek.end)} only</p></div><button disabled={busy||!missing.length} onClick={generate} className="text-xs text-blue-700 disabled:text-slate-400 flex items-center gap-2"><RefreshCw size={13}/>{busy?'Drafting…':'Draft current-week summaries'}</button></div>{currentRows.map(row=><div key={row.key} className="grid sm:grid-cols-[150px_minmax(0,1fr)] gap-3 py-4 border-b border-slate-200"><div className="text-sm font-semibold">{row.resource}<span className="block font-normal text-xs text-slate-500 mt-1">{hoursLabel(row.hours)} hours this week</span></div>{row.notes.length?<textarea aria-label={`Current-week summary for ${row.resource}`} value={summaries[row.key]||''} onChange={e=>setSummaries({...summaries,[row.key]:e.target.value})} rows={3} className="w-full resize-y border border-slate-200 rounded-md p-2 text-sm leading-relaxed" placeholder="Draft or write a reviewed summary for this week…"/>:<p className="text-sm text-slate-500">No description submitted.</p>}</div>)}{!currentRows.length&&<p className="text-sm text-slate-500 py-4">No selected entries in this report week.</p>}{missing.length>0&&<p className="text-xs text-amber-700 mt-3">Draft or write {missing.length} current-week summaries before exporting, or deselect the summary section.</p>}</section>}{footer}</article>}
      {sections.originals&&<article className="bg-white border border-slate-200 shadow-sm p-5 sm:p-10" aria-label="Original timesheet entries">{head('Original timesheet entries')}<h2 className="text-2xl font-semibold tracking-tight text-[#182d43]">Original descriptions</h2><p className="text-xs text-slate-500 mt-2">{reportDate(scope==='week'?report.currentWeek.start:report.from)} – {reportDate(report.through)} · entries reproduced in full</p>{Array.from(new Set(report.originals.map(e=>e.resourceId))).map(id=><section key={id} className="mt-6"><h3 className="bg-slate-100 border-l-[3px] border-[#294e72] px-3 py-2 text-sm font-semibold">{report.originals.find(e=>e.resourceId===id)?.resource}</h3>{report.originals.filter(e=>e.resourceId===id).map(e=><div key={e.key} className="grid sm:grid-cols-[90px_45px_minmax(0,1fr)] gap-3 py-4 border-b border-slate-200 text-sm"><span className="text-xs text-slate-500">{reportDate(e.date)}</span><span className="font-semibold tabular-nums">{hoursLabel(e.hours)} h</span><p className="whitespace-pre-wrap break-words leading-relaxed">{e.description||'No description submitted.'}</p></div>)}</section>)}{!report.originals.length&&<p className="py-8 text-sm text-slate-500">No selected entries in this detail window.</p>}{footer}</article>}
      </>}
    </main></div></div>
  </dialog>
}
function HoursTable({report}:{report:ProjectTimesheetReport}) {
  const groups=[];for(let i=0;i<report.weeks.length;i+=5)groups.push({weeks:report.weeks.slice(i,i+5),offset:i})
  return <section aria-label="Weekly hours"><h3 className="font-semibold mb-3">Weekly hours</h3>{groups.map(({weeks,offset})=><div key={offset} className="overflow-x-auto mb-4"><table className="w-full text-xs tabular-nums"><thead className="bg-slate-100 text-slate-500"><tr><th className="text-left p-3 min-w-[120px]">Contractor</th>{weeks.map(w=><th key={w.key} className={`text-right p-2 min-w-[75px] font-normal ${w.end===report.through?'bg-blue-50 text-blue-900':''}`}>{short(w.start)}–{short(w.end)}<span className="block text-[10px] mt-1">{w.end===report.through?'Report week':'Week'}</span></th>)}<th className="text-right p-3">Period total</th></tr></thead><tbody>{report.hours.map(row=><tr key={row.id} className="border-b border-slate-200"><td className="p-3 font-medium">{row.resource}</td>{weeks.map((w,i)=><td key={w.key} className={`text-right p-3 ${w.end===report.through?'bg-blue-50':''}`}>{hoursLabel(row.weeks[offset+i])}</td>)}<td className="text-right p-3 font-semibold bg-slate-50">{hoursLabel(row.total)}</td></tr>)}</tbody><tfoot><tr className="font-semibold border-t border-slate-300"><td className="p-3">Total hours</td>{weeks.map((w,i)=><td key={w.key} className="text-right p-3">{hoursLabel(report.hours.reduce((s,r)=>s+r.weeks[offset+i],0))}</td>)}<td className="text-right p-3">{hoursLabel(report.hours.reduce((s,r)=>s+r.total,0))}</td></tr></tfoot></table></div>)}</section>
}

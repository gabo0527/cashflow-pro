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
  const projectOptions=useMemo(()=>projects.map(p=>{
    const meta=budgetProjects.find(m=>m.id===p.id),entry=entries.find(e=>e.project_id===p.id)
    const client=meta?.client || entry?.client_name || 'Unassigned client'
    return {...p,clientId:meta?.clientId || `name:${client}`,client}
  }),[projects,budgetProjects,entries])
  const clientOptions=Array.from(new Map(projectOptions.map(p=>[p.clientId,{id:p.clientId,label:p.client}])).values()).sort((a,b)=>a.label.localeCompare(b.label))
  const initialProject=projectOptions.find(p=>initialProjects.includes(p.id)) || projectOptions[0]
  const [clientId,setClientId]=useState(initialProject?.clientId || '')
  const [projectIds,setProjectIds]=useState(()=>{const ids=projectOptions.filter(p=>p.clientId===initialProject?.clientId&&initialProjects.includes(p.id)).map(p=>p.id);return ids.length?ids:initialProject?[initialProject.id]:[]})
  const [selectedResources,setResources]=useState(initialResources)
  const [mode,setMode]=useState<'week'|'month'>('week')
  const [week,setWeek]=useState(shiftDate(mondayOf(today()),-7)),[month,setMonth]=useState(today().slice(0,7))
  const [historyStart,setHistoryStart]=useState(shiftDate(mondayOf(today()),-7).slice(0,7)+'-01'),[customHistory,setCustomHistory]=useState(false)
  const [title,setTitle]=useState('Project timesheet report'),[scope,setScope]=useState<'week'|'period'>('week')
  const [sections,setSections]=useState({hours:true,summary:true,originals:true})
  const [includeBudgets,setIncludeBudgets]=useState<string[]>([]),[review,setReview]=useState(false),[excluded,setExcluded]=useState<string[]>([])
  const [summaries,setSummaries]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[downloading,setDownloading]=useState(false),[error,setError]=useState('')
  const generation=useRef(0)
  useEffect(()=>{dialog.current?.showModal();return()=>{generation.current++}},[])
  const period=reportPeriod(mode,mode==='week'?week:month)
  const through=period?(period.end<today()?period.end:today()):''
  const clientProjects=projectOptions.filter(p=>p.clientId===clientId)
  const selectedProjects=clientProjects.filter(p=>projectIds.includes(p.id))
  const client=clientOptions.find(c=>c.id===clientId)?.label || ''
  const contexts=useMemo(()=>selectedProjects.map(project=>{
    const ids=new Set([...entries.filter(e=>e.project_id===project.id).map(e=>e.team_member_id),...projectResources.filter(a=>a.project_id===project.id).map(a=>a.team_member_id)])
    const choices=resources.filter(r=>ids.has(r.id)),chosen=selectedResources.filter(id=>ids.has(id))
    return {project,choices,chosen,all:choices.length>0&&choices.every(r=>chosen.includes(r.id)),budget:through?projectBudgetUsed(budgetSources,budgetReferences,project.id,through):undefined}
  }),[entries,projectIds.join('|'),clientId,projectOptions,projectResources,resources,selectedResources,through,budgetSources,budgetReferences])
  const choices=resources.filter(r=>contexts.some(c=>c.choices.some(choice=>choice.id===r.id)))
  const chosen=selectedResources.filter(id=>choices.some(r=>r.id===id))
  const eligible=contexts.filter(c=>c.budget&&c.all),eligibleIds=eligible.map(c=>c.project.id).join('|')
  useEffect(()=>{setIncludeBudgets(prev=>{const next=prev.filter(id=>eligible.some(c=>c.project.id===id));return next.length===prev.length?prev:next})},[eligibleIds])
  const reports=useMemo(()=>{
    if(!period||!through)return null
    try{return contexts.map(c=>buildProjectTimesheetReport({entries,projectId:c.project.id,project:c.project.label,client,resources:c.choices,selectedResources:c.chosen,excluded,from:historyStart,through,detailScope:scope,title:title.trim()||'Project timesheet report',sections,...(includeBudgets.includes(c.project.id)&&c.all&&c.budget?{budget:c.budget}:{})}))}catch{return null}
  },[entries,contexts,client,excluded,historyStart,through,scope,title,sections,includeBudgets,!!period])
  const currentRows=reports?.flatMap(r=>r.summaries) || []
  const missing=sections.summary?currentRows.filter(r=>r.notes.length&&!summaries[r.key]?.trim()):[]
  const candidates=entries.map((e,i)=>({e,key:reportEntryKey(e,i)})).filter(({e})=>selectedProjects.some(p=>p.id===e.project_id)&&chosen.includes(e.team_member_id)&&e.date>=historyStart&&e.date<=through&&Number(e.hours)>0&&(scope==='period'||e.date>=mondayOf(through)))
  const valid=!!reports?.length&&chosen.length>0&&Object.values(sections).some(Boolean)
  const budgetBlocked=reports?.some(r=>r.budget?.percent===null) || false
  function chooseProjects(ids:string[],nextClient=clientId){
    const selected=projectOptions.filter(p=>p.clientId===nextClient&&ids.includes(p.id)).map(p=>p.id)
    generation.current++;setBusy(false);setClientId(nextClient);setProjectIds(selected)
    const nextResources=resources.filter(r=>entries.some(e=>selected.includes(e.project_id)&&e.team_member_id===r.id)||projectResources.some(a=>selected.includes(a.project_id)&&a.team_member_id===r.id))
    setResources(nextResources.filter(r=>nextClient!==clientId||selectedResources.includes(r.id)||!choices.some(c=>c.id===r.id)).map(r=>r.id))
    const retainedEntries=new Set(entries.flatMap((e,i)=>selected.includes(e.project_id)?[reportEntryKey(e,i)]:[]))
    setExcluded(prev=>nextClient===clientId?prev.filter(key=>retainedEntries.has(key)):[])
    setIncludeBudgets(prev=>nextClient===clientId?prev.filter(id=>selected.includes(id)):[]);setError('')
  }
  function choosePeriod(nextMode:'week'|'month',value:string){
    generation.current++;setBusy(false);setError('');setMode(nextMode)
    if(nextMode==='week')setWeek(value);else setMonth(value)
    const next=reportPeriod(nextMode,value);if(next&&!customHistory)setHistoryStart(next.start.slice(0,7)+'-01')
  }
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
    if(!valid||!reports?.length||missing.length||budgetBlocked)return
    setDownloading(true);setError('')
    try{
      const image=new Image();image.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(logo.replace('<svg ','<svg width="664" ').replace('height="24"','height="131"'))}`;await image.decode()
      const canvas=document.createElement('canvas');canvas.width=664;canvas.height=131;const context=canvas.getContext('2d');if(!context)throw new Error('Could not render the Mano logo.');context.drawImage(image,0,0,664,131)
      const [png,regular,bold]=await Promise.all([fetch(canvas.toDataURL('image/png')).then(r=>r.arrayBuffer()),fetch('/fonts/DejaVuSans.ttf').then(r=>{if(!r.ok)throw new Error('Report font unavailable. Reload and retry.');return r.arrayBuffer()}),fetch('/fonts/DejaVuSans-Bold.ttf').then(r=>{if(!r.ok)throw new Error('Report font unavailable. Reload and retry.');return r.arrayBuffer()})])
      const {createClientTimesheetPDF}=await import('@/lib/project-timesheet-pdf')
      const bytes=await createClientTimesheetPDF(reports,summaries,{logo:new Uint8Array(png),regular:new Uint8Array(regular),bold:new Uint8Array(bold)})
      const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/pdf'})),anchor=document.createElement('a')
      anchor.href=url;anchor.download=`Mano-timesheet-${client.replace(/[^a-zA-Z0-9_-]/g,'-')}-${historyStart}-to-${through}.pdf`;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)
    }catch(e){setError((e as Error).message)}finally{setDownloading(false)}
  }
  const mark=<img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(logo)}`} alt="Mano CG" className="w-36 max-w-[45%]" />
  const head=(report:ProjectTimesheetReport,label:string)=><div className="flex justify-between items-center gap-4 border-b-[3px] border-orange-500 pb-5 mb-6">{mark}<div className="text-right text-xs text-slate-500 uppercase tracking-wide">{client}<strong className="block text-slate-800 mt-1">{report.project}</strong><span className="block mt-1">{label}</span></div></div>
  const footer=(report:ProjectTimesheetReport)=><div className="mt-8 pt-3 border-t border-slate-200 flex justify-between gap-3 text-[11px] text-slate-500"><span>Mano CG LLC · {report.project}</span><span>Through {through&&reportDate(through)}</span></div>
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="project-timesheet-heading" className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none bg-slate-100 p-0 text-slate-900 backdrop:bg-slate-950/60">
    <div className="h-full flex flex-col"><header className="flex flex-wrap items-center justify-between gap-4 bg-[#182d43] text-white px-6 py-4"><div><p className="text-xs uppercase tracking-widest text-orange-200">Time tracking / Resource report</p><h1 id="project-timesheet-heading" className="text-xl font-semibold mt-1">Client timesheet report</h1></div><div className="flex gap-3 items-center"><button disabled={!valid||missing.length>0||busy||downloading||budgetBlocked} onClick={download} className="flex items-center gap-2 bg-white text-slate-900 px-4 py-2 rounded-lg font-semibold disabled:opacity-40"><Download size={16}/>{downloading?'Preparing PDF…':'Download PDF'}</button><button onClick={onClose} aria-label="Close resource report" className="p-2"><X size={22}/></button></div></header>
    <div className="flex-1 min-h-0 overflow-auto"><section className="bg-white p-5 sm:px-8 border-b border-slate-200"><fieldset disabled={busy||downloading} className="space-y-4 disabled:opacity-60">
      <div className="grid gap-4 sm:grid-cols-3"><label className="text-xs text-slate-500">Client<select aria-label="Report client" className={field} value={clientId} onChange={e=>chooseProjects(projectOptions.filter(p=>p.clientId===e.target.value).map(p=>p.id),e.target.value)}>{clientOptions.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label><label className="text-xs text-slate-500">Report period<select aria-label="Report period" className={field} value={mode} onChange={e=>choosePeriod(e.target.value as 'week'|'month',e.target.value==='week'?week:month)}><option value="week">Week</option><option value="month">Month</option></select></label>{mode==='week'?<label className="text-xs text-slate-500">Week containing<input type="date" aria-label="Report week" value={week} onChange={e=>choosePeriod('week',e.target.value)} className={field}/></label>:<label className="text-xs text-slate-500">Month<input type="month" aria-label="Report month" value={month} onChange={e=>choosePeriod('month',e.target.value)} className={field}/></label>}</div>
      <div aria-label="Client projects"><div className="flex justify-between gap-4 text-xs text-slate-500 mb-2"><span>Projects for {client}</span><div className="flex gap-3"><button onClick={()=>chooseProjects(clientProjects.map(p=>p.id))} className="text-blue-700">Select all projects</button><button onClick={()=>chooseProjects([])}>Clear projects</button></div></div><div className="flex gap-2 flex-wrap">{clientProjects.map(p=><label key={p.id} className={`flex items-center gap-2 px-3 py-2 border rounded-md text-sm ${projectIds.includes(p.id)?'border-blue-400 bg-blue-50':'border-slate-200'}`}><input type="checkbox" aria-label={`Include project ${p.label}`} checked={projectIds.includes(p.id)} onChange={e=>chooseProjects(e.target.checked?[...projectIds,p.id]:projectIds.filter(id=>id!==p.id))}/>{p.label}</label>)}</div></div>
      <div><div className="flex justify-between gap-4 text-xs text-slate-500 mb-2"><span>Contractors in selected projects</span><div className="flex gap-3"><button onClick={()=>setResources(choices.map(r=>r.id))} className="text-blue-700">Select all contractors</button><button onClick={()=>setResources([])}>Clear contractors</button></div></div><div className="flex gap-2 flex-wrap">{choices.map(r=><label key={r.id} className={`flex items-center gap-2 px-3 py-2 border rounded-md text-sm ${chosen.includes(r.id)?'border-blue-400 bg-blue-50':'border-slate-200'}`}><input type="checkbox" aria-label={`Include contractor ${r.label}`} checked={chosen.includes(r.id)} onChange={e=>setResources(e.target.checked?[...selectedResources,r.id]:selectedResources.filter(id=>id!==r.id))}/>{r.label}</label>)}{!choices.length&&<p className="text-sm text-slate-500">No contractors or submitted hours are linked to the selected projects.</p>}</div></div>
      <div className="flex gap-x-6 gap-y-2 flex-wrap text-sm">{([['hours','Weekly hours table'],['summary','Current-week summary'],['originals','Original descriptions']] as const).map(([key,label])=><label key={key} className="flex items-center gap-2"><input type="checkbox" checked={sections[key]} onChange={e=>setSections({...sections,[key]:e.target.checked})}/>{label}</label>)}{eligible.map(c=><label key={c.project.id} className="flex items-center gap-2"><input aria-label={selectedProjects.length===1?"Include Budget used (%)":`Include Budget used (%) for ${c.project.label}`} type="checkbox" checked={includeBudgets.includes(c.project.id)} onChange={e=>setIncludeBudgets(e.target.checked?[...includeBudgets,c.project.id]:includeBudgets.filter(id=>id!==c.project.id))}/>Budget used (%) {selectedProjects.length>1&&`· ${c.project.label}`}</label>)}</div>
      <div className="grid sm:grid-cols-3 gap-4"><label className="text-xs text-slate-500">Hours from<input type="date" aria-label="Hours from" value={historyStart} onChange={e=>{setCustomHistory(true);setHistoryStart(e.target.value)}} className={field}/></label><label className="text-xs text-slate-500">Original entries<select aria-label="Original entries" value={scope} onChange={e=>setScope(e.target.value as 'week'|'period')} className={field}><option value="week">Current report week</option><option value="period">Entire hours period</option></select></label><label className="text-xs text-slate-500">Report title<input aria-label="Report title" maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} className={field}/></label></div>
      <div className="flex flex-wrap gap-3 items-center justify-between pt-3 border-t border-slate-200"><p aria-live="polite" className="text-xs text-slate-500">{selectedProjects.length} projects · {chosen.length} contractors · {hoursLabel(reports?.reduce((total,report)=>total+report.hours.reduce((s,r)=>s+r.total,0),0)||0)} hours in period{reports&&` · ${reports.reduce((n,r)=>n+r.excludedCount,0)} entries excluded`}</p><div className="flex gap-4 text-xs"><button className="text-blue-700" onClick={()=>setReview(!review)}>{review?'Close entry selection':`Review ${candidates.length} entries`}</button><button className="text-slate-500" onClick={onAdvanced}>Program / role report</button></div></div>
      {includeBudgets.length>0&&<p className="text-xs text-slate-500">Budget used (%) is shown separately for each selected project and covers all its contractors. Entry exclusions do not change this whole-project percentage. No amounts are exported.</p>}
      {contexts.some(c=>c.budget&&!c.all)&&<p className="text-xs text-slate-500">Select all contractors associated with a project to make its Budget used (%) available.</p>}
      {budgetBlocked&&<p role="alert" className="text-sm text-amber-700">Budget used (%) is unavailable because billable entries have missing rates. Update project setup or deselect Budget before exporting.</p>}
      {!reports&&<p role="alert" className="text-sm text-amber-700">Choose valid dates with the hours start on or before the report cutoff, within one year.</p>}
      {review&&<div className="border-t border-slate-200 pt-3"><p className="text-xs text-slate-500 mb-3">Selections update the hours table, current-week summary and original entries together.</p><div className="space-y-3">{candidates.map(({e,key})=><label key={key} className={`grid grid-cols-[18px_minmax(0,1fr)] gap-3 rounded-md border p-3 ${excluded.includes(key)?'bg-slate-50 text-slate-500':'border-slate-200'}`}><input aria-label={`Include entry ${e.team_member_name} ${e.date} ${key}`} type="checkbox" checked={!excluded.includes(key)} onChange={ev=>setExcluded(ev.target.checked?excluded.filter(k=>k!==key):[...excluded,key])}/><div><p className="text-xs font-semibold">{e.project_name} · {e.team_member_name} · {reportDate(e.date)} · {hoursLabel(e.hours)} hours</p><p className="text-sm whitespace-pre-wrap break-words mt-1">{e.notes||'No description submitted.'}</p></div></label>)}</div></div>}
    </fieldset>{error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}</section>
    <main className="max-w-5xl mx-auto p-3 sm:p-8 space-y-6" aria-label="Project report preview">
      {!selectedProjects.length?<p className="text-center text-slate-500 p-12">Select at least one project for this client.</p>:!chosen.length?<p className="text-center text-slate-500 p-12">Select at least one contractor to preview the report.</p>:reports?.map((report,index)=><React.Fragment key={selectedProjects[index].id}>
      {(sections.hours||sections.summary||report.budget)&&<article className="bg-white border border-slate-200 shadow-sm p-5 sm:p-10">{head(report,'Project timesheet report')}<h2 className="text-2xl font-semibold tracking-tight text-[#182d43]">{report.title}</h2><div className="grid sm:grid-cols-2 gap-3 py-4 my-5 border-y border-slate-200 text-xs"><div><span className="block text-slate-500 uppercase tracking-wide mb-1">Hours coverage</span>{reportDate(report.from)} – {reportDate(report.through)}</div><div><span className="block text-slate-500 uppercase tracking-wide mb-1">Activity summary covers</span>{reportDate(report.currentWeek.start)} – {reportDate(report.currentWeek.end)}</div></div>
      {sections.hours&&<HoursTable report={report}/>}
      {report.budget&&<section aria-label="Budget used (%)" className="mt-6 py-4 border-y border-slate-200 flex gap-4 justify-between items-center"><div><h3 className="font-semibold">Budget used (%)</h3><p className="text-xs text-slate-500">Whole project · {reportDate(report.budget.from)} – {reportDate(report.budget.through)}</p></div><strong className="text-xl tabular-nums">{report.budget.percent===null?'Unavailable':`${hoursLabel(report.budget.percent)}%`}</strong></section>}
      {sections.summary&&<section className="mt-7" aria-label="Current-week activity"><div className="flex flex-wrap justify-between gap-3 mb-3"><div><h3 className="font-semibold">Current-week activity</h3><p className="text-xs text-slate-500">{reportDate(report.currentWeek.start)} – {reportDate(report.currentWeek.end)} only</p></div><button disabled={busy||downloading||!missing.length} onClick={generate} className="text-xs text-blue-700 disabled:text-slate-400 flex items-center gap-2"><RefreshCw size={13}/>{busy?'Drafting…':'Draft current-week summaries'}</button></div>{report.summaries.map(row=><div key={row.key} className="grid sm:grid-cols-[150px_minmax(0,1fr)] gap-3 py-4 border-b border-slate-200"><div className="text-sm font-semibold">{row.resource}<span className="block font-normal text-xs text-slate-500 mt-1">{hoursLabel(row.hours)} hours this week</span></div>{row.notes.length?<textarea aria-label={`Current-week summary for ${row.resource}`} data-project={report.project} value={summaries[row.key]||''} onChange={e=>setSummaries({...summaries,[row.key]:e.target.value})} rows={3} className="w-full resize-y border border-slate-200 rounded-md p-2 text-sm leading-relaxed" placeholder="Draft or write a reviewed summary for this week…"/>:<p className="text-sm text-slate-500">No description submitted.</p>}</div>)}{!report.summaries.length&&<p className="text-sm text-slate-500 py-4">No selected entries in this report week.</p>}{missing.length>0&&<p className="text-xs text-amber-700 mt-3">Draft or write {missing.length} current-week summaries before exporting, or deselect the summary section.</p>}</section>}{footer(report)}</article>}
      {sections.originals&&<article className="bg-white border border-slate-200 shadow-sm p-5 sm:p-10" aria-label="Original timesheet entries">{head(report,'Original timesheet entries')}<h2 className="text-2xl font-semibold tracking-tight text-[#182d43]">Original descriptions</h2><p className="text-xs text-slate-500 mt-2">{reportDate(scope==='week'?report.currentWeek.start:report.from)} – {reportDate(report.through)} · entries reproduced in full</p>{Array.from(new Set(report.originals.map(e=>e.resourceId))).map(id=><section key={id} className="mt-6"><h3 className="bg-slate-100 border-l-[3px] border-[#294e72] px-3 py-2 text-sm font-semibold">{report.originals.find(e=>e.resourceId===id)?.resource}</h3>{report.originals.filter(e=>e.resourceId===id).map(e=><div key={e.key} className="grid sm:grid-cols-[90px_45px_minmax(0,1fr)] gap-3 py-4 border-b border-slate-200 text-sm"><span className="text-xs text-slate-500">{reportDate(e.date)}</span><span className="font-semibold tabular-nums">{hoursLabel(e.hours)} h</span><p className="whitespace-pre-wrap break-words leading-relaxed">{e.description||'No description submitted.'}</p></div>)}</section>)}{!report.originals.length&&<p className="py-8 text-sm text-slate-500">No selected entries in this detail window.</p>}{footer(report)}</article>}
      </React.Fragment>)}
    </main></div></div>
  </dialog>
}
function HoursTable({report}:{report:ProjectTimesheetReport}) {
  const groups=[];for(let i=0;i<report.weeks.length;i+=5)groups.push({weeks:report.weeks.slice(i,i+5),offset:i})
  return <section aria-label="Weekly hours"><h3 className="font-semibold mb-3">Weekly hours</h3>{groups.map(({weeks,offset})=><div key={offset} className="overflow-x-auto mb-4"><table className="w-full text-xs tabular-nums"><thead className="bg-slate-100 text-slate-500"><tr><th className="text-left p-3 min-w-[120px]">Contractor</th>{weeks.map(w=><th key={w.key} className={`text-right p-2 min-w-[75px] font-normal ${w.end===report.through?'bg-blue-50 text-blue-900':''}`}>{short(w.start)}–{short(w.end)}<span className="block text-[10px] mt-1">{w.end===report.through?'Report week':'Week'}</span></th>)}<th className="text-right p-3">Period total</th></tr></thead><tbody>{report.hours.map(row=><tr key={row.id} className="border-b border-slate-200"><td className="p-3 font-medium">{row.resource}</td>{weeks.map((w,i)=><td key={w.key} className={`text-right p-3 ${w.end===report.through?'bg-blue-50':''}`}>{hoursLabel(row.weeks[offset+i])}</td>)}<td className="text-right p-3 font-semibold bg-slate-50">{hoursLabel(row.total)}</td></tr>)}</tbody><tfoot><tr className="font-semibold border-t border-slate-300"><td className="p-3">Total hours</td>{weeks.map((w,i)=><td key={w.key} className="text-right p-3">{hoursLabel(report.hours.reduce((s,r)=>s+r.weeks[offset+i],0))}</td>)}<td className="text-right p-3">{hoursLabel(report.hours.reduce((s,r)=>s+r.total,0))}</td></tr></tfoot></table></div>)}</section>
}

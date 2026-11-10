import { ResourceSubmission, ResourceReportRow, mondayOf, shiftDate, reportRows } from './resource-report'

export interface ReportEntry {
  key: string; date: string; hours: number; resourceId: string; resource: string;
  project: string; client: string; description: string | null;
}
export interface ReportWeek { start: string; end: string; key: string }
export interface HoursRow { id: string; resource: string; weeks: number[]; total: number }
export interface ReportBudget { percent: number | null; from: string; through: string; cadence: 'monthly' | 'overall' }
export interface ProjectTimesheetReport {
  title: string; project: string; client: string; from: string; through: string;
  currentWeek: { start: string; end: string }; weeks: ReportWeek[]; hours: HoursRow[];
  summaries: ResourceReportRow[]; originals: ReportEntry[];
  sections: { hours: boolean; summary: boolean; originals: boolean };
  excludedCount: number; detailStart: string; budget?: ReportBudget;
}
export interface BudgetReference {
  projectId: string; start: string; end: string | null; amount: number; cadence: 'monthly' | 'overall';
}
export interface BudgetSource {
  projectId: string; date: string; billable: boolean; hours: number; rate: number;
}
const revision = (value: unknown) => { let hash=2166136261; for(const char of JSON.stringify(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)} return (hash>>>0).toString(16) }
export const reportEntryKey = (entry: ResourceSubmission, index: number) => entry.id || JSON.stringify([entry.project_id,entry.team_member_id,entry.date,index])
export function reportPeriod(mode: 'week'|'month', value: string) {
  if (mode === 'month') {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null
    return { start: `${value}-01`, end: new Date(Date.UTC(Number(value.slice(0,4)),Number(value.slice(5,7)),0,12)).toISOString().slice(0,10) }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value+'T12:00:00Z')) || new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value) return null
  return { start: mondayOf(value), end: shiftDate(mondayOf(value),6) }
}
export function projectBudgetUsed(sources: BudgetSource[], references: BudgetReference[], projectId: string, through: string): ReportBudget | undefined {
  const ref=references.find(r=>r.projectId===projectId && r.start<=through && (!r.end || r.end>=through) && Number.isFinite(r.amount) && r.amount>0)
  if (!ref) return undefined
  const from=ref.cadence==='overall'?ref.start:[ref.start,through.slice(0,7)+'-01'].sort().pop()!
  let used=0,missing=false
  for(const e of sources) {
    if(e.projectId!==projectId || !e.billable || e.date<from || e.date>through || !Number.isFinite(e.hours) || e.hours<=0) continue
    if(!Number.isFinite(e.rate)||e.rate<=0)missing=true;else used+=e.hours*e.rate
  }
  // Only a percentage and its scope cross into the printable report.
  return {percent:missing?null:used/ref.amount*100,from,through,cadence:ref.cadence}
}
export function buildProjectTimesheetReport(options: {
  entries: ResourceSubmission[]; projectId: string; project: string; client: string;
  resources: {id:string;label:string}[]; selectedResources: string[]; excluded: string[];
  from: string; through: string; detailScope: 'week'|'period'; title: string;
  sections: ProjectTimesheetReport['sections']; budget?: ReportBudget;
}): ProjectTimesheetReport {
  const {entries,projectId,from,through}=options
  if(!reportPeriod('week',from)||!reportPeriod('week',through)||from>through||shiftDate(from,366)<through)throw new Error('Choose an hours period of up to one year, ending on or after its start.')
  const currentWeek={start:mondayOf(through)>from?mondayOf(through):from,end:through}
  const matching=entries.map((entry,index)=>({entry,key:reportEntryKey(entry,index)})).filter(({entry})=>entry.project_id===projectId && options.selectedResources.includes(entry.team_member_id) && entry.date>=from && entry.date<=through && Number.isFinite(Number(entry.hours)) && Number(entry.hours)>0)
  const included=matching.filter(({key})=>!options.excluded.includes(key))
  const weeks:ReportWeek[]=[]
  for(let week=mondayOf(from);week<=through;week=shiftDate(week,7))weeks.push({key:week,start:week<from?from:week,end:shiftDate(week,6)>through?through:shiftDate(week,6)})
  const hours=options.resources.filter(r=>options.selectedResources.includes(r.id)).map(r=>{
    const values=weeks.map(w=>included.reduce((sum,{entry:e})=>sum+(e.team_member_id===r.id&&e.date>=w.start&&e.date<=w.end?Number(e.hours):0),0))
    return {id:r.id,resource:r.label,weeks:values,total:values.reduce((a,b)=>a+b,0)}
  })
  const currentRows=reportRows(included.map(x=>x.entry),currentWeek.start,currentWeek.end,[projectId],options.selectedResources).map(row=>({...row,key:'current-'+revision([row.key,currentWeek.start,currentWeek.end,included.filter(x=>x.entry.team_member_name===row.resource&&x.entry.date>=currentWeek.start).map(x=>[x.key,x.entry.hours,x.entry.notes])])}))
  const originals=included.filter(({entry:e})=>options.detailScope==='period'||e.date>=currentWeek.start).map(({entry:e,key})=>({key,date:e.date,hours:Number(e.hours),resourceId:e.team_member_id,resource:e.team_member_name,project:e.project_name,client:e.client_name,description:e.notes})).sort((a,b)=>a.resource.localeCompare(b.resource)||a.date.localeCompare(b.date)||a.key.localeCompare(b.key))
  return {title:options.title,project:options.project,client:options.client,from,through,currentWeek,weeks,hours,summaries:currentRows,originals,sections:options.sections,excludedCount:matching.length-included.length,detailStart:options.detailScope==='period'?from:currentWeek.start,...(options.budget&&options.resources.length>0&&options.resources.every(r=>options.selectedResources.includes(r.id))?{budget:{...options.budget}}:{})}
}

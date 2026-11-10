import {PDFDocument,PDFFont,PDFPage,rgb} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import {ProjectTimesheetReport} from './project-timesheet-report'
import {hoursLabel,reportDate} from './resource-report'

// This exporter only accepts the hours/percentage projection. It never receives
// source rates, monetary budgets, billable values, or contractor payment data.
export async function createProjectTimesheetPDF(report:ProjectTimesheetReport,summaries:Record<string,string>,assets:{regular:Uint8Array;bold:Uint8Array;logo?:Uint8Array},numberPages=true) {
  const pdf=await PDFDocument.create();pdf.setTitle(report.title);pdf.setAuthor('Mano CG LLC');pdf.setCreator('VantageFP')
  pdf.registerFontkit(fontkit)
  const normal=await pdf.embedFont(assets.regular,{subset:true,features:{liga:false}}),bold=await pdf.embedFont(assets.bold,{subset:true,features:{liga:false}})
  const logo=assets.logo?await pdf.embedPng(assets.logo):null
  const width=595.28,height=841.89,left=42,right=width-42,usable=right-left,bottom=775
  const ink=rgb(.10,.18,.27),muted=rgb(.38,.45,.52),line=rgb(.85,.89,.92),pale=rgb(.95,.97,.98),blue=rgb(.92,.95,.99),orange=rgb(.88,.48,.16)
  let page:PDFPage,y=0
  const txt=(value:string,x:number,top:number,size=9,strong=false,color=ink)=>page.drawText(value.replace(/[\r\n\t]/g,' '),{x,y:height-top-size,size,font:strong?bold:normal,color})
  const rt=(value:string,x:number,top:number,size=9,strong=false,color=ink)=>txt(value,x-(strong?bold:normal).widthOfTextAtSize(value,size),top,size,strong,color)
  const rule=(top:number)=>page.drawLine({start:{x:left,y:height-top},end:{x:right,y:height-top},color:line,thickness:.6})
  const box=(top:number,h:number,color=pale,x=left,w=usable)=>page.drawRectangle({x,y:height-top-h,width:w,height:h,color})
  const wrap=(value:string,w:number,size=9,font:PDFFont=normal)=>{
    const result:string[]=[]
    // Preserve paragraph breaks and every original word. Long tokens wrap at
    // character boundaries; descriptions are never summarized or ellipsized.
    for(const paragraph of value.replace(/\r\n?/g,'\n').replace(/\t/g,'    ').split('\n')) {
      if(!paragraph){result.push('');continue}
      let current=''
      for(const word of paragraph.split(/( +)/)) {
        if(font.widthOfTextAtSize(current+word,size)<=w){current+=word;continue}
        if(current){result.push(current);current=''}
        if(font.widthOfTextAtSize(word,size)<=w){current=word;continue}
        for(const char of word){if(current&&font.widthOfTextAtSize(current+char,size)>w){result.push(current);current=''}current+=char}
      }
      if(current)result.push(current)
    }
    return result.length?result:['']
  }
  const newPage=(context:string)=>{
    page=pdf.addPage([width,height]);y=99
    if(logo)page.drawImage(logo,{x:left,y:height-65,width:122,height:24});else txt('MANO CG',left,40,19,true)
    const heading=wrap(`${report.client} / ${report.project}`,usable-150,8,bold)
    heading.slice(0,3).forEach((s,i)=>rt(s,right,40+i*11,8,true))
    rt(context.toUpperCase(),right,77,7,false,muted)
    page.drawLine({start:{x:left,y:height-88},end:{x:right,y:height-88},color:orange,thickness:2})
  }
  const ensure=(h:number,context:string)=>{if(y+h>bottom){newPage(context);return true}return false}
  const section=(title:string,detail:string)=>{ensure(58,title);txt(title,left,y,13,true);y+=22;for(const s of wrap(detail,usable,8)){txt(s,left,y,8,false,muted);y+=12}y+=10}
  const flowing=(value:string,context:string,size=9,leading=14)=>{
    const lines=wrap(value,usable,size)
    for(const s of lines){ensure(leading,context);txt(s,left,y,size);y+=leading}
  }
  newPage('Project timesheet report')
  for(const s of wrap(report.title,usable,22,bold)){txt(s,left,y,22,true);y+=29}
  y+=5;flowing(`${reportDate(report.from)} - ${reportDate(report.through)}`,'Report overview',9,14)
  flowing(`Activity summary: ${reportDate(report.currentWeek.start)} - ${reportDate(report.currentWeek.end)} only`,'Report overview',8,12)
  if(report.excludedCount)flowing(`Selected entries only; ${report.excludedCount} entry/entries excluded.`,'Report overview',8,12)
  y+=20
  if(report.sections.hours){
    for(let offset=0;offset<report.weeks.length;offset+=5){
      const weeks=report.weeks.slice(offset,offset+5),nameW=145,totalW=65,colW=(usable-nameW-totalW)/weeks.length
      section(offset?'Weekly hours (continued)':'Weekly hours',`${reportDate(weeks[0].start)} - ${reportDate(weeks[weeks.length-1].end)} | hours only`)
      const tableHead=()=>{box(y,35);txt('Contractor',left+8,y+10,8,true,muted);weeks.forEach((w,i)=>{const x=left+nameW+i*colW;if(w.end===report.through)box(y,35,blue,x,colW);rt(new Date(w.start+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'}),x+colW-7,y+5,7.5);rt('- '+new Date(w.end+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'}),x+colW-7,y+17,7.5)});rt('Period total',right-7,y+10,7.5,true,muted);y+=35}
      ensure(75,'Weekly hours');tableHead()
      const rows=[...report.hours,{id:'total',resource:'Total hours',weeks:report.weeks.map((_,i)=>report.hours.reduce((s,r)=>s+r.weeks[i],0)),total:report.hours.reduce((s,r)=>s+r.total,0)}]
      for(const row of rows){
        const names=wrap(row.resource,nameW-16,9,row.id==='total'?bold:normal),h=Math.max(30,names.length*13+16)
        if(ensure(h,'Weekly hours'))tableHead()
        if(row.id==='total')box(y,h,pale)
        weeks.forEach((w,i)=>{if(w.end===report.through)box(y,h,blue,left+nameW+i*colW,colW)})
        names.forEach((s,i)=>txt(s,left+8,y+8+i*13,9,row.id==='total'))
        weeks.forEach((w,i)=>rt(hoursLabel(row.weeks[offset+i]),left+nameW+(i+1)*colW-7,y+9,9,row.id==='total'))
        rt(hoursLabel(row.total),right-7,y+9,9,true);y+=h;rule(y)
      }
      y+=22
    }
  }
  if(report.budget){
    ensure(72,'Budget used (%)');box(y,62)
    txt('Budget used (%)',left+12,y+10,12,true)
    txt('Whole project / all contractors',left+12,y+30,8,false,muted)
    txt(`${reportDate(report.budget.from)} - ${reportDate(report.budget.through)}`,left+12,y+43,8,false,muted)
    rt(report.budget.percent===null?'Unavailable':`${hoursLabel(report.budget.percent)}%`,right-12,y+17,19,true)
    y+=81
  }
  if(report.sections.summary){
    section('Current-week activity',`${reportDate(report.currentWeek.start)} - ${reportDate(report.currentWeek.end)} only`)
    for(const row of report.summaries){
      const summary=summaries[row.key]?.trim()||(row.notes.length?'No reviewed summary provided.':'No description submitted.')
      const lines=wrap(summary,usable-155,9),names=wrap(row.resource,130,9,bold)
      let index=0,continued=false
      do{
        const fixed=Math.max(37,names.length*13+20)
        ensure(fixed+28,'Current-week activity')
        const count=Math.min(lines.length-index,Math.max(1,Math.floor((bottom-y-fixed)/14))),h=Math.max(fixed,count*14+16)
        names.forEach((s,i)=>txt(s,left,y+6+i*13,9,true))
        txt(continued?'Continued':`${hoursLabel(row.hours)} hours this week`,left,y+9+names.length*13,8,false,muted)
        lines.slice(index,index+count).forEach((s,i)=>txt(s,left+155,y+6+i*14,9))
        index+=count;y+=h;rule(y);y+=8;continued=true
      }while(index<lines.length)
    }
    if(!report.summaries.length)flowing('No selected entries in the report week.','Current-week activity')
  }
  if(report.sections.originals){
    if(report.sections.hours||report.sections.summary||report.budget)newPage('Original timesheet entries')
    section('Original descriptions',`${reportDate(report.detailStart)} - ${reportDate(report.through)} | entries reproduced in full`)
    let currentResource=''
    for(const entry of report.originals){
      const lines=wrap(entry.description||'No description submitted.',usable-125,9)
      const resourceHeader=(continued=false)=>{const names=wrap(entry.resource+(continued?' (continued)':''),usable-24,10,bold),h=names.length*14+14;box(y,h);names.forEach((s,i)=>txt(s,left+10,y+7+i*14,10,true));y+=h+8;currentResource=entry.resourceId}
      const continuation=()=>{newPage('Original descriptions - continued');resourceHeader(true)}
      if(currentResource!==entry.resourceId){ensure(105,'Original descriptions');resourceHeader()}
      let index=0,continued=false
      while(index<lines.length){
        if(y+45>bottom)continuation()
        const count=Math.min(lines.length-index,Math.max(1,Math.floor((bottom-y-14)/14)))
        txt(reportDate(entry.date),left,y+5,8,false,muted)
        txt(continued?'Continued':`${hoursLabel(entry.hours)} h`,left,y+19,9,!continued)
        lines.slice(index,index+count).forEach((s,i)=>txt(s,left+125,y+5+i*14,9))
        index+=count;y+=Math.max(42,count*14+16);rule(y);y+=8
        if(index<lines.length){continued=true;continuation()}
      }
    }
    if(!report.originals.length)flowing('No selected entries in this detail window.','Original descriptions')
  }
  const pages=pdf.getPages()
  pages.forEach((p,i)=>{p.drawLine({start:{x:left,y:43},end:{x:right,y:43},color:line,thickness:.6});p.drawText('Mano CG LLC | Generated by VantageFP',{x:left,y:27,size:7.5,font:normal,color:muted});if(numberPages){const label=`${i+1} / ${pages.length}`;p.drawText(label,{x:right-normal.widthOfTextAtSize(label,8),y:27,size:8,font:normal,color:muted})}})
  return pdf.save()
}

// Keep project-level scopes intact in a single client download. A fresh project
// always starts on a new page; only page numbering is shared across the file.
export async function createClientTimesheetPDF(reports:ProjectTimesheetReport[],summaries:Record<string,string>,assets:{regular:Uint8Array;bold:Uint8Array;logo?:Uint8Array}) {
  if(!reports.length)throw new Error('Select at least one project to export.')
  if(new Set(reports.map(report=>report.client)).size!==1)throw new Error('Choose projects belonging to one client.')
  if(reports.length===1)return createProjectTimesheetPDF(reports[0],summaries,assets)
  const pdf=await PDFDocument.create()
  pdf.setTitle(`${reports[0].client} - ${reports[0].title}`);pdf.setAuthor('Mano CG LLC');pdf.setCreator('VantageFP')
  for(const report of reports){
    const source=await PDFDocument.load(await createProjectTimesheetPDF(report,summaries,assets,false))
    const pages=await pdf.copyPages(source,source.getPageIndices());pages.forEach(page=>pdf.addPage(page))
  }
  pdf.registerFontkit(fontkit)
  const font=await pdf.embedFont(assets.regular,{subset:true}),pages=pdf.getPages()
  pages.forEach((page,index)=>{
    const right=page.getWidth()-42,label=`${index+1} / ${pages.length}`
    page.drawText(label,{x:right-font.widthOfTextAtSize(label,8),y:27,size:8,font,color:rgb(.38,.45,.52)})
  })
  return pdf.save()
}

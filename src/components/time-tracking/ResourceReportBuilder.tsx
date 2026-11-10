'use client'
import React, { useState } from 'react'
import AdvancedResourceReportBuilder from './AdvancedResourceReportBuilder'
import ProjectTimesheetReportBuilder from './ProjectTimesheetReportBuilder'
import type { BudgetReference, BudgetSource } from '@/lib/project-timesheet-report'

export type ResourceReportProps = React.ComponentProps<typeof AdvancedResourceReportBuilder> & {
  projectResources?: {project_id:string;team_member_id:string}[];
  budgetReferences?: BudgetReference[];
  budgetSources?: BudgetSource[];
}
export default function ResourceReportBuilder(props: ResourceReportProps) {
  const [advanced,setAdvanced]=useState(false)
  return advanced ? <AdvancedResourceReportBuilder {...props} /> : <ProjectTimesheetReportBuilder {...props} onAdvanced={()=>setAdvanced(true)} />
}

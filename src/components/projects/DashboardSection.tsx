'use client'

import React, { useMemo, useState } from 'react'
import {
  Briefcase, DollarSign, TrendingUp, TrendingDown, Users,
  AlertTriangle, Target, Activity, Clock, Building2, Zap,
  ChevronRight, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, ComposedChart, Line
} from 'recharts'
import {
  THEME, COLORS, PROJECT_STATUSES, getHealthConfig, calculateHealthScore,
  formatCurrency, formatCompactCurrency, formatPercent,
  KPICard, CustomTooltip, WaterfallItem, SlicerButton
} from './shared'

interface DashboardSectionProps {
  projects: any[]
  clients: any[]
  expenses: any[]
  invoices: any[]
  timesheets: any[]
  onDrillDown?: (type: string, id: string) => void
}

export default function DashboardSection({
  projects, clients, expenses, invoices, timesheets, onDrillDown
}: DashboardSectionProps) {
  // Slicers (PowerBI-style filters)
  const [selectedClient, setSelectedClient] = useState('all')
  const [selectedPeriod, setSelectedPeriod] = useState('ytd')

  // Filter projects by slicer
  const filteredProjects = useMemo(() => {
    let result = projects.filter(p => p.status !== 'archived')
    if (selectedClient !== 'all') {
      result = result.filter(p => p.client_id === selectedClient)
    }
    return result
  }, [projects, selectedClient])

  // Enrich with calculations
  const enrichedProjects = useMemo(() => {
    return filteredProjects.map(p => ({
      ...p,
      healthScore: calculateHealthScore(p),
      margin: p.budget > 0 ? ((p.budget - p.spent) / p.budget) * 100 : 0,
      burnRate: p.budget > 0 ? (p.spent / p.budget) * 100 : 0,
    }))
  }, [filteredProjects])

  // Portfolio Metrics
  const metrics = useMemo(() => {
    const active = enrichedProjects.filter(p => p.status === 'active')
    const prospects = enrichedProjects.filter(p => p.status === 'prospect')
    
    const totalContract = active.reduce((sum, p) => sum + (p.budget || 0), 0)
    const totalSpent = active.reduce((sum, p) => sum + (p.spent || 0), 0)
    const totalRemaining = totalContract - totalSpent
    
    // Weighted margin
    const weightedMargin = totalContract > 0
      ? active.reduce((sum, p) => sum + (p.margin * (p.budget / totalContract)), 0)
      : 0
    
    // Hours
    const totalHours = active.reduce((sum, p) => sum + (p.actual_hours || 0), 0)
    const totalBudgetedHours = active.reduce((sum, p) => sum + (p.budgeted_hours || 0), 0)
    const hoursUtilization = totalBudgetedHours > 0 ? (totalHours / totalBudgetedHours) * 100 : 0
    
    // Health
    const avgHealth = active.length > 0
      ? active.reduce((sum, p) => sum + p.healthScore, 0) / active.length
      : 0
    const atRisk = active.filter(p => p.healthScore < 60)
    const atRiskValue = atRisk.reduce((sum, p) => sum + p.budget, 0)
    
    // Pipeline
    const pipelineValue = prospects.reduce((sum, p) => sum + (p.budget || 0), 0)
    
    // By direct costs (from expenses)
    const projectExpenses = expenses.filter(e => 
      e.category === 'directCosts' && 
      enrichedProjects.some(p => p.id === e.project_id)
    )
    const totalDirectCosts = projectExpenses.reduce((sum, e) => sum + e.amount, 0)
    
    // Invoiced vs Contract
    const projectInvoices = invoices.filter(inv => 
      enrichedProjects.some(p => p.id === inv.project_id)
    )
    const totalInvoiced = projectInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)
    const totalCollected = projectInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.amount || 0), 0)
    
    return {
      activeCount: active.length,
      prospectCount: prospects.length,
      totalContract,
      totalSpent,
      totalRemaining,
      weightedMargin,
      totalHours,
      hoursUtilization,
      avgHealth,
      atRiskCount: atRisk.length,
      atRiskValue,
      pipelineValue,
      totalDirectCosts,
      totalInvoiced,
      totalCollected,
      realization: totalContract > 0 ? (totalInvoiced / totalContract) * 100 : 0,
    }
  }, [enrichedProjects, expenses, invoices])

  // Client options for slicer
  const clientOptions = useMemo(() => {
    const clientCounts = new Map<string, number>()
    projects.forEach(p => {
      if (p.client_id) {
        clientCounts.set(p.client_id, (clientCounts.get(p.client_id) || 0) + 1)
      }
    })
    return clients.map(c => ({
      id: c.id,
      label: c.name,
      count: clientCounts.get(c.id) || 0
    })).filter(c => c.count > 0)
  }, [projects, clients])

  // Revenue by Client chart
  const clientRevenueData = useMemo(() => {
    const clientTotals = new Map<string, { name: string; contract: number; spent: number; margin: number }>()
    
    enrichedProjects.filter(p => p.status === 'active').forEach(p => {
      const client = clients.find(c => c.id === p.client_id)
      const clientName = client?.name || 'No Client'
      const existing = clientTotals.get(clientName) || { name: clientName, contract: 0, spent: 0, margin: 0 }
      existing.contract += p.budget || 0
      existing.spent += p.spent || 0
      clientTotals.set(clientName, existing)
    })
    
    return Array.from(clientTotals.values())
      .map(c => ({ ...c, margin: c.contract > 0 ? ((c.contract - c.spent) / c.contract) * 100 : 0 }))
      .sort((a, b) => b.contract - a.contract)
      .slice(0, 6)
  }, [enrichedProjects, clients])

  // Health Distribution
  const healthDistribution = useMemo(() => {
    const active = enrichedProjects.filter(p => p.status === 'active')
    return [
      { name: 'Healthy', value: active.filter(p => p.healthScore >= 80).length, color: COLORS.emerald },
      { name: 'Warning', value: active.filter(p => p.healthScore >= 60 && p.healthScore < 80).length, color: COLORS.amber },
      { name: 'At Risk', value: active.filter(p => p.healthScore < 60).length, color: COLORS.rose },
    ].filter(d => d.value > 0)
  }, [enrichedProjects])

  // Monthly Trend (mock data for now - would come from actual historical data)
  const monthlyTrend = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    return months.map((month, i) => ({
      month,
      revenue: Math.random() * 100000 + 50000,
      costs: Math.random() * 60000 + 30000,
      margin: Math.random() * 30 + 10,
    }))
  }, [])

  // Top & Bottom Performers
  const { topPerformers, needsAttention } = useMemo(() => {
    const active = enrichedProjects.filter(p => p.status === 'active' && p.budget > 0)
    const sorted = [...active].sort((a, b) => b.margin - a.margin)
    return {
      topPerformers: sorted.slice(0, 3),
      needsAttention: sorted.slice(-3).reverse().filter(p => p.margin < 20)
    }
  }, [enrichedProjects])

  return (
    <div className="space-y-6">
      {/* Slicers Row (PowerBI-style) */}
      <div className="flex items-center gap-3 flex-wrap">
        <SlicerButton
          label="Client"
          value={selectedClient}
          options={clientOptions}
          onChange={setSelectedClient}
          allLabel="All Clients"
        />
        <SlicerButton
          label="Period"
          value={selectedPeriod}
          options={[
            { id: 'ytd', label: 'Year to Date' },
            { id: 'q1', label: 'Q1 2026' },
            { id: 'q4', label: 'Q4 2025' },
            { id: 'all', label: 'All Time' },
          ]}
          onChange={setSelectedPeriod}
        />
        {selectedClient !== 'all' && (
          <button
            onClick={() => setSelectedClient('all')}
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <KPICard
          label="Active Projects"
          value={metrics.activeCount}
          subtitle={`${formatCompactCurrency(metrics.totalContract)} total`}
          icon={Briefcase}
          color="emerald"
        />
        <KPICard
          label="Portfolio Margin"
          value={formatPercent(metrics.weightedMargin)}
          subtitle="Weighted average"
          icon={TrendingUp}
          color={metrics.weightedMargin >= 20 ? 'emerald' : metrics.weightedMargin >= 10 ? 'amber' : 'rose'}
        />
        <KPICard
          label="Remaining Budget"
          value={formatCompactCurrency(metrics.totalRemaining)}
          subtitle={`${formatPercent(100 - (metrics.totalSpent / metrics.totalContract * 100 || 0))} of contracts`}
          icon={DollarSign}
          color="blue"
        />
        <KPICard
          label="Realization"
          value={formatPercent(metrics.realization)}
          subtitle="Invoiced vs Contract"
          icon={Target}
          color={metrics.realization >= 80 ? 'emerald' : 'amber'}
        />
        <KPICard
          label="At Risk Value"
          value={formatCompactCurrency(metrics.atRiskValue)}
          subtitle={`${metrics.atRiskCount} projects`}
          icon={AlertTriangle}
          color={metrics.atRiskCount > 0 ? 'rose' : 'emerald'}
        />
        <KPICard
          label="Pipeline"
          value={formatCompactCurrency(metrics.pipelineValue)}
          subtitle={`${metrics.prospectCount} prospects`}
          icon={Zap}
          color="cyan"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-12 gap-6">
        {/* Revenue by Client */}
        <div className="col-span-12 lg:col-span-8">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6`}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Contract Value by Client</h3>
                <p className={`text-xs ${THEME.textDim} mt-0.5`}>Active projects only</p>
              </div>
            </div>
            <div className="h-64">
              {clientRevenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={clientRevenueData} layout="vertical" margin={{ left: 80 }}>
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompactCurrency(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                    <Bar dataKey="contract" name="Contract" fill={COLORS.emerald} radius={[0, 4, 4, 0]} barSize={20} />
                    <Bar dataKey="spent" name="Spent" fill={COLORS.rose} radius={[0, 4, 4, 0]} barSize={20} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className={`flex items-center justify-center h-full ${THEME.textMuted}`}>No project data</div>
              )}
            </div>
          </div>
        </div>

        {/* Health Distribution */}
        <div className="col-span-12 lg:col-span-4">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6 h-full`}>
            <h3 className={`text-sm font-semibold ${THEME.textPrimary} mb-4`}>Portfolio Health</h3>
            {healthDistribution.length > 0 ? (
              <>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={healthDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {healthDistribution.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-4">
                  {healthDistribution.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className={`text-sm ${THEME.textSecondary}`}>{item.name}</span>
                      </div>
                      <span className={`text-sm font-semibold ${THEME.textPrimary}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className={`flex items-center justify-center h-40 ${THEME.textMuted}`}>No active projects</div>
            )}
          </div>
        </div>
      </div>

      {/* Financial Breakdown & Performers */}
      <div className="grid grid-cols-12 gap-6">
        {/* Financial Waterfall */}
        <div className="col-span-12 lg:col-span-4">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6`}>
            <h3 className={`text-sm font-semibold ${THEME.textPrimary} mb-4`}>Financial Summary</h3>
            <div className="space-y-1">
              <WaterfallItem label="Contract Value" value={metrics.totalContract} type="start" showBar={false} />
              <WaterfallItem label="Direct Costs" value={metrics.totalDirectCosts} type="subtract" showBar={false} />
              <WaterfallItem label="Labor (Spent)" value={metrics.totalSpent - metrics.totalDirectCosts} type="subtract" showBar={false} />
              <div className={`border-t ${THEME.glassBorder} my-2`} />
              <WaterfallItem label="Gross Profit" value={metrics.totalRemaining} type="total" showBar={false} />
            </div>
            <div className={`mt-4 pt-4 border-t ${THEME.glassBorder}`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm ${THEME.textMuted}`}>Portfolio Margin</span>
                <span className={`text-lg font-bold ${metrics.weightedMargin >= 20 ? 'text-emerald-400' : metrics.weightedMargin >= 10 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {formatPercent(metrics.weightedMargin)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Performers */}
        <div className="col-span-12 lg:col-span-4">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6 h-full`}>
            <h3 className={`text-sm font-semibold ${THEME.textPrimary} mb-4`}>⭐ Top Performers</h3>
            {topPerformers.length > 0 ? (
              <div className="space-y-3">
                {topPerformers.map((p, i) => (
                  <div 
                    key={p.id} 
                    className="flex items-center justify-between p-3 bg-white/[0.03] rounded-lg hover:bg-white/[0.05] cursor-pointer transition-colors"
                    onClick={() => onDrillDown?.('project', p.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${
                        i === 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-white/[0.08] text-slate-400'
                      }`}>{i + 1}</span>
                      <div>
                        <p className={`text-sm font-medium ${THEME.textSecondary} truncate max-w-[140px]`}>{p.name}</p>
                        <p className={`text-xs ${THEME.textDim}`}>{clients.find(c => c.id === p.client_id)?.name}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-400">{formatPercent(p.margin)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-sm ${THEME.textMuted} text-center py-8`}>No active projects</p>
            )}
          </div>
        </div>

        {/* Needs Attention */}
        <div className="col-span-12 lg:col-span-4">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6 h-full`}>
            <h3 className={`text-sm font-semibold ${THEME.textPrimary} mb-4`}>⚠️ Needs Attention</h3>
            {needsAttention.length > 0 ? (
              <div className="space-y-3">
                {needsAttention.map((p, i) => (
                  <div 
                    key={p.id}
                    className="flex items-center justify-between p-3 bg-rose-500/5 border border-rose-500/20 rounded-lg hover:bg-rose-500/10 cursor-pointer transition-colors"
                    onClick={() => onDrillDown?.('project', p.id)}
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle size={16} className="text-rose-400" />
                      <div>
                        <p className={`text-sm font-medium ${THEME.textSecondary} truncate max-w-[140px]`}>{p.name}</p>
                        <p className={`text-xs ${THEME.textDim}`}>{clients.find(c => c.id === p.client_id)?.name}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-rose-400">{formatPercent(p.margin)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Activity size={20} className="text-emerald-400" />
                </div>
                <p className={`text-sm ${THEME.textMuted}`}>All projects healthy!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

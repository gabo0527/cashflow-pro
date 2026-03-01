'use client'

import React, { useState, useCallback } from 'react'
import {
  Upload, FileText, Check, X, AlertCircle, Download,
  ChevronRight, RefreshCw, Table, Briefcase, Users, DollarSign
} from 'lucide-react'
import { THEME, formatCurrency } from './shared'

interface ImportSectionProps {
  projects: any[]
  clients: any[]
  teamMembers: any[]
  onImportProjects: (projects: any[]) => Promise<void>
  onImportBudgets: (budgets: any[]) => Promise<void>
  onImportResources: (assignments: any[]) => Promise<void>
}

type ImportType = 'projects' | 'budgets' | 'resources' | null

export default function ImportSection({
  projects, clients, teamMembers, onImportProjects, onImportBudgets, onImportResources
}: ImportSectionProps) {
  const [selectedType, setSelectedType] = useState<ImportType>(null)
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<any[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null)
  const [step, setStep] = useState<'select' | 'upload' | 'map' | 'preview' | 'complete'>('select')

  // Import type configurations
  const importTypes = [
    {
      id: 'projects' as ImportType,
      label: 'Projects',
      description: 'Bulk import projects with budgets',
      icon: Briefcase,
      fields: ['name', 'client', 'budget', 'start_date', 'end_date', 'status'],
      required: ['name'],
      template: 'Project Name,Client Name,Budget,Start Date,End Date,Status\nNew Project,Client A,50000,2026-01-01,2026-06-30,active'
    },
    {
      id: 'budgets' as ImportType,
      label: 'Budget Updates',
      description: 'Update budgets for existing projects',
      icon: DollarSign,
      fields: ['project_name', 'budget', 'spent', 'budgeted_hours'],
      required: ['project_name', 'budget'],
      template: 'Project Name,Budget,Spent,Budgeted Hours\nExisting Project,75000,25000,500'
    },
    {
      id: 'resources' as ImportType,
      label: 'Resource Assignments',
      description: 'Assign team members to projects',
      icon: Users,
      fields: ['project_name', 'team_member', 'role', 'allocation'],
      required: ['project_name', 'team_member'],
      template: 'Project Name,Team Member,Role,Allocation %\nProject A,John Doe,Lead,100'
    },
  ]

  const currentType = importTypes.find(t => t.id === selectedType)

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFile(file)
    
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')))
      
      if (rows.length < 2) {
        alert('File must have at least a header row and one data row')
        return
      }

      const headers = rows[0]
      const data = rows.slice(1).filter(row => row.some(cell => cell)).map(row => {
        const obj: Record<string, string> = {}
        headers.forEach((header, i) => {
          obj[header] = row[i] || ''
        })
        return obj
      })

      setParsedData(data)
      
      // Auto-map columns
      const mapping: Record<string, string> = {}
      if (currentType) {
        currentType.fields.forEach(field => {
          const matchingHeader = headers.find(h => 
            h.toLowerCase().replace(/[_\s]/g, '') === field.toLowerCase().replace(/[_\s]/g, '') ||
            h.toLowerCase().includes(field.toLowerCase().split('_')[0])
          )
          if (matchingHeader) {
            mapping[field] = matchingHeader
          }
        })
      }
      setColumnMapping(mapping)
      setStep('map')
    }
    reader.readAsText(file)
  }, [currentType])

  // Download template
  const downloadTemplate = () => {
    if (!currentType) return
    const blob = new Blob([currentType.template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentType.id}-template.csv`
    a.click()
  }

  // Process import
  const handleImport = async () => {
    if (!currentType || parsedData.length === 0) return

    setIsProcessing(true)
    setImportResult(null)

    try {
      // Transform data based on mapping
      const transformedData = parsedData.map(row => {
        const transformed: Record<string, any> = {}
        Object.entries(columnMapping).forEach(([field, header]) => {
          transformed[field] = row[header]
        })
        return transformed
      })

      // Validate required fields
      const errors: string[] = []
      transformedData.forEach((row, i) => {
        currentType.required.forEach(field => {
          if (!row[field]) {
            errors.push(`Row ${i + 2}: Missing required field "${field}"`)
          }
        })
      })

      if (errors.length > 0) {
        setImportResult({ success: 0, errors: errors.slice(0, 10) })
        setIsProcessing(false)
        return
      }

      // Call appropriate import handler
      switch (selectedType) {
        case 'projects':
          await onImportProjects(transformedData)
          break
        case 'budgets':
          await onImportBudgets(transformedData)
          break
        case 'resources':
          await onImportResources(transformedData)
          break
      }

      setImportResult({ success: transformedData.length, errors: [] })
      setStep('complete')
    } catch (error: any) {
      setImportResult({ success: 0, errors: [error.message || 'Import failed'] })
    } finally {
      setIsProcessing(false)
    }
  }

  // Reset
  const handleReset = () => {
    setSelectedType(null)
    setFile(null)
    setParsedData([])
    setColumnMapping({})
    setImportResult(null)
    setStep('select')
  }

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2">
        {['select', 'upload', 'map', 'preview', 'complete'].map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
              step === s ? 'bg-emerald-100 text-emerald-600' :
              ['select', 'upload', 'map', 'preview', 'complete'].indexOf(step) > i ? 'text-emerald-600' : THEME.textDim
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s ? 'bg-emerald-500 text-white' :
                ['select', 'upload', 'map', 'preview', 'complete'].indexOf(step) > i ? 'bg-emerald-200' : 'bg-slate-100'
              }`}>{i + 1}</span>
              <span className="text-sm font-medium capitalize">{s}</span>
            </div>
            {i < 4 && <ChevronRight size={16} className={THEME.textDim} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6`}>
        {/* Step 1: Select Import Type */}
        {step === 'select' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className={`text-lg font-semibold ${THEME.textPrimary}`}>What would you like to import?</h2>
              <p className={`text-sm ${THEME.textDim} mt-1`}>Choose the type of data to import</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {importTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => { setSelectedType(type.id); setStep('upload'); }}
                  className={`p-6 rounded-xl border ${THEME.glassBorder} hover:bg-slate-100 hover:border-emerald-300 transition-all text-left group`}
                >
                  <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
                    <type.icon size={24} className="text-emerald-600" />
                  </div>
                  <h3 className={`font-semibold ${THEME.textPrimary}`}>{type.label}</h3>
                  <p className={`text-sm ${THEME.textDim} mt-1`}>{type.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Upload File */}
        {step === 'upload' && currentType && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className={`text-lg font-semibold ${THEME.textPrimary}`}>Upload {currentType.label} File</h2>
                <p className={`text-sm ${THEME.textDim} mt-1`}>Upload a CSV file with your data</p>
              </div>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-emerald-600 hover:text-emerald-300 transition-colors"
              >
                <Download size={14} /> Download Template
              </button>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center hover:border-emerald-300 transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <Upload size={28} className="text-emerald-600" />
                </div>
                <p className={`font-medium ${THEME.textSecondary}`}>Click to upload or drag and drop</p>
                <p className={`text-sm ${THEME.textDim} mt-1`}>CSV files only</p>
              </label>
            </div>

            <div className={`p-4 rounded-lg bg-blue-50 border border-blue-200`}>
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="text-blue-600 mt-0.5" />
                <div>
                  <p className={`text-sm font-medium text-blue-600`}>Expected columns:</p>
                  <p className={`text-sm ${THEME.textMuted} mt-1`}>
                    {currentType.fields.map(f => f.replace(/_/g, ' ')).join(', ')}
                  </p>
                  <p className={`text-xs ${THEME.textDim} mt-2`}>
                    Required: {currentType.required.map(f => f.replace(/_/g, ' ')).join(', ')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={handleReset}
                className={`px-4 py-2 text-sm ${THEME.textMuted} hover:text-slate-700 transition-colors`}
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Column Mapping */}
        {step === 'map' && currentType && (
          <div className="space-y-6">
            <div>
              <h2 className={`text-lg font-semibold ${THEME.textPrimary}`}>Map Columns</h2>
              <p className={`text-sm ${THEME.textDim} mt-1`}>Match your file columns to the expected fields</p>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <FileText size={16} className="text-emerald-600" />
              <span className={THEME.textSecondary}>{file?.name}</span>
              <span className={THEME.textDim}>• {parsedData.length} rows</span>
            </div>

            <div className="space-y-3">
              {currentType.fields.map(field => {
                const isRequired = currentType.required.includes(field)
                const headers = Object.keys(parsedData[0] || {})
                
                return (
                  <div key={field} className="flex items-center gap-4">
                    <div className="w-40">
                      <span className={`text-sm ${THEME.textSecondary}`}>
                        {field.replace(/_/g, ' ')}
                        {isRequired && <span className="text-rose-600 ml-1">*</span>}
                      </span>
                    </div>
                    <ChevronRight size={16} className={THEME.textDim} />
                    <select
                      value={columnMapping[field] || ''}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, [field]: e.target.value }))}
                      className="flex-1 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                    >
                      <option value="" className="">-- Select column --</option>
                      {headers.map(h => (
                        <option key={h} value={h} className="">{h}</option>
                      ))}
                    </select>
                    {columnMapping[field] && (
                      <Check size={16} className="text-emerald-600" />
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep('upload')}
                className={`px-4 py-2 text-sm ${THEME.textMuted} hover:text-slate-700 transition-colors`}
              >
                Back
              </button>
              <button
                onClick={() => setStep('preview')}
                disabled={!currentType.required.every(f => columnMapping[f])}
                className="px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Preview Data
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Preview */}
        {step === 'preview' && currentType && (
          <div className="space-y-6">
            <div>
              <h2 className={`text-lg font-semibold ${THEME.textPrimary}`}>Preview Import</h2>
              <p className={`text-sm ${THEME.textDim} mt-1`}>Review data before importing</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b ${THEME.glassBorder}`}>
                    <th className={`px-3 py-2 text-left ${THEME.textDim} font-medium`}>#</th>
                    {currentType.fields.map(field => (
                      <th key={field} className={`px-3 py-2 text-left ${THEME.textDim} font-medium`}>
                        {field.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 5).map((row, i) => (
                    <tr key={i} className={`border-b border-slate-100`}>
                      <td className={`px-3 py-2 ${THEME.textDim}`}>{i + 1}</td>
                      {currentType.fields.map(field => (
                        <td key={field} className={`px-3 py-2 ${THEME.textSecondary}`}>
                          {row[columnMapping[field]] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {parsedData.length > 5 && (
              <p className={`text-sm ${THEME.textDim} text-center`}>
                ... and {parsedData.length - 5} more rows
              </p>
            )}

            {importResult && importResult.errors.length > 0 && (
              <div className="p-4 rounded-lg bg-rose-50 border border-rose-200">
                <p className="text-sm font-medium text-rose-600 mb-2">Validation Errors:</p>
                <ul className="space-y-1">
                  {importResult.errors.map((err, i) => (
                    <li key={i} className={`text-sm ${THEME.textMuted}`}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setStep('map')}
                className={`px-4 py-2 text-sm ${THEME.textMuted} hover:text-slate-700 transition-colors`}
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors"
              >
                {isProcessing && <RefreshCw size={14} className="animate-spin" />}
                {isProcessing ? 'Importing...' : `Import ${parsedData.length} Records`}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === 'complete' && importResult && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-emerald-600" />
            </div>
            <h2 className={`text-lg font-semibold ${THEME.textPrimary}`}>Import Complete!</h2>
            <p className={`text-sm ${THEME.textMuted} mt-2`}>
              Successfully imported {importResult.success} records
            </p>
            <button
              onClick={handleReset}
              className="mt-6 px-6 py-2.5 text-sm font-medium bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              Import More
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

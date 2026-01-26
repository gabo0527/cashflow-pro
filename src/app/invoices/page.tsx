'use client'

import { Construction } from 'lucide-react'

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Invoices & AR</h1>
        <p className="text-sm mt-1 text-slate-400">Manage invoices and accounts receivable</p>
      </div>
      
      <div className="p-12 rounded-xl border text-center bg-slate-800 border-slate-700">
        <Construction size={48} className="mx-auto mb-4 text-slate-400" />
        <h2 className="text-lg font-semibold mb-2 text-slate-100">Coming Soon</h2>
        <p className="text-sm text-slate-400">
          This section is being built. Check back soon!
        </p>
      </div>
    </div>
  )
}

'use client'
// src/app/contractor-portal/OnboardingWizard.tsx
// Self-contained onboarding wizard. Rendered by the portal when a
// contractor's onboarding_status is not 'active'. Collects details +
// payment + tax form, captures typed e-signature, and POSTs to
// /api/onboarding/submit (saves as PENDING for admin review).

import { useState } from 'react'
import { Loader2, ArrowRight, ArrowLeft, Check, FileText } from 'lucide-react'

type Props = { member: any; onDone: () => void }

const FORMS: Record<string, [string, string]> = {
  'US': ['W-9', 'U.S. person / entity'],
  'Foreign-Individual': ['W-8BEN', 'Foreign individual'],
  'Foreign-Entity': ['W-8BEN-E', 'Foreign entity'],
}
const LABELS = ['Details', 'Payment', 'Tax Form', 'Done']

function Field({ label, value, onChange, type = 'text', hint, full }: { label: string; value: string; onChange: (v: string) => void; type?: string; hint?: string; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2 flex flex-col' : 'flex flex-col'}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-gray-400 mb-1.5">{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-2 text-[13px] bg-gray-50 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors" />
      {hint && <span className="text-[11px] text-gray-400 mt-1">{hint}</span>}
    </div>
  )
}
function Select({ label, value, onChange, options, hint, full }: { label: string; value: string; onChange: (v: string) => void; options: string[][]; hint?: string; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2 flex flex-col' : 'flex flex-col'}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-gray-400 mb-1.5">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-2 text-[13px] bg-gray-50 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors cursor-pointer">
        {options.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
      </select>
      {hint && <span className="text-[11px] text-gray-400 mt-1">{hint}</span>}
    </div>
  )
}

export default function OnboardingWizard({ member, onDone }: Props) {
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cert, setCert] = useState(false)
  const [f, setF] = useState<Record<string, string>>({
    name: member?.name || '',
    entity_name: member?.entity_name || '',
    entity_type: 'LLC',
    residency_status: 'US',
    address: member?.address || '',
    ap_contact_name: member?.name || '',
    ap_email: member?.email || '',
    ap_phone: '',
    payment_method: 'ACH',
    bank_name: '', account_type: 'Checking', routing_number: '', account_number: '',
    bank_id_type: 'SWIFT', bank_id: '', bank_address_1: '', bank_address_2: '', bank_address_3: '',
    recipient_name: '', recipient_account: '', recipient_address_1: '', recipient_address_2: '', recipient_address_3: '',
    tax_id: '', tax_id_type: 'EIN',
    signature_name: member?.name || '',
  })
  const set = (k: string, v: string) => setF(prev => ({ ...prev, [k]: v }))
  const form = FORMS[f.residency_status] || FORMS['US']

  const submit = async () => {
    setSubmitting(true); setError(null)
    try {
      const payload: any = { ...f, tax_form_type: form[0], signed_at: new Date().toISOString(), certified: 'true', __kind: 'onboarding' }
      const res = await fetch('/api/onboarding/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Submit failed') }
      setStep(4)
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#eef1f4' }}>
      <header style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg,#1b2431,#10151c)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 13px)' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(70% 240% at 0% 0%, rgba(59,130,246,0.18), transparent 60%)' }} />
        <div className="max-w-2xl mx-auto px-5 py-4 relative flex items-center gap-3" style={{ zIndex: 1 }}>
          <svg width={22} height={22} viewBox="0 0 48 48" fill="none"><path d="M13 12 L24 35" stroke="#3b82f6" strokeWidth="5.5" strokeLinecap="round" /><path d="M24 35 L35 12" stroke="#ea8a2f" strokeWidth="5.5" strokeLinecap="round" /></svg>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#93c5fd' }}>Onboarding · Mano CG</div>
            <div className="text-white font-extrabold text-[17px] leading-none" style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>Vantage<span style={{ color: '#ea8a2f' }}>FP</span></div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6">
        <div className="flex gap-1.5 mb-5">
          {LABELS.map((l, i) => {
            const active = (i + 1) <= step
            return (
              <div key={l} className="flex-1 text-center">
                <div className="h-1 rounded" style={{ background: active ? '#2563eb' : '#dbe2ea' }} />
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] mt-1.5" style={{ color: active ? '#2563eb' : '#94a3b8' }}>{l}</div>
              </div>
            )
          })}
        </div>

        <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid rgba(226,232,240,.8)', boxShadow: '0 20px 44px -24px rgba(15,23,42,.34), 0 2px 6px -3px rgba(15,23,42,.08)' }}>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-[13px]">{error}</div>}

          {step === 1 && (
            <>
              <div className="font-extrabold text-[18px] mb-0.5" style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>Your details</div>
              <div className="text-[12.5px] text-gray-500 mb-4">Tell us who you are. This goes to admin for review.</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Full Name" value={f.name} onChange={v => set('name', v)} />
                <Field label="Legal Entity" value={f.entity_name} onChange={v => set('entity_name', v)} />
                <Select label="Entity Type" value={f.entity_type} onChange={v => set('entity_type', v)} options={[['LLC', 'LLC'], ['Sole Proprietor', 'Sole Proprietor'], ['Individual', 'Individual'], ['Foreign Entity', 'Foreign Entity']]} />
                <Select label="Residency / Citizenship" value={f.residency_status} onChange={v => set('residency_status', v)} hint="Determines your tax form" options={[['US', 'U.S. person / entity'], ['Foreign-Individual', 'Foreign — individual'], ['Foreign-Entity', 'Foreign — entity']]} />
                <Field label="Address" value={f.address} onChange={v => set('address', v)} full />
                <Field label="AP Contact" value={f.ap_contact_name} onChange={v => set('ap_contact_name', v)} />
                <Field label="AP Email" value={f.ap_email} onChange={v => set('ap_email', v)} />
                <Field label="AP Phone" value={f.ap_phone} onChange={v => set('ap_phone', v)} />
              </div>
              <div className="flex justify-end mt-5">
                <button onClick={() => setStep(2)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[14px] font-bold" style={{ background: 'linear-gradient(135deg,#2563eb,#1e3a8a)' }}>Continue <ArrowRight size={15} /></button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="font-extrabold text-[18px] mb-0.5" style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>Payment info</div>
              <div className="text-[12.5px] text-gray-500 mb-4">Choose how you're paid. Sensitive fields are encrypted and masked after saving.</div>
              <div className="mb-4">
                <Select label="Payment Method" value={f.payment_method} onChange={v => set('payment_method', v)} options={[['ACH', 'ACH — Domestic (US)'], ['Wire', 'Wire — International']]} />
              </div>
              {f.payment_method === 'Wire' ? (
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Bank ID Type" value={f.bank_id_type} onChange={v => set('bank_id_type', v)} options={[['SWIFT', 'SWIFT'], ['IBAN', 'IBAN'], ['ABA', 'ABA'], ['CLABE', 'CLABE'], ['Sort Code', 'Sort Code'], ['Other', 'Other']]} />
                  <Field label="Bank ID" value={f.bank_id} onChange={v => set('bank_id', v)} />
                  <Field label="Bank Name" value={f.bank_name} onChange={v => set('bank_name', v)} full />
                  <Field label="Bank Address 1" value={f.bank_address_1} onChange={v => set('bank_address_1', v)} />
                  <Field label="Bank Address 2" value={f.bank_address_2} onChange={v => set('bank_address_2', v)} />
                  <Field label="Bank Address 3" value={f.bank_address_3} onChange={v => set('bank_address_3', v)} full />
                  <Field label="Recipient Account / IBAN" value={f.recipient_account} onChange={v => set('recipient_account', v)} full />
                  <Field label="Recipient Name" value={f.recipient_name} onChange={v => set('recipient_name', v)} />
                  <Field label="Recipient Address 1" value={f.recipient_address_1} onChange={v => set('recipient_address_1', v)} />
                  <Field label="Recipient Address 2" value={f.recipient_address_2} onChange={v => set('recipient_address_2', v)} />
                  <Field label="Recipient Address 3" value={f.recipient_address_3} onChange={v => set('recipient_address_3', v)} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Bank Name" value={f.bank_name} onChange={v => set('bank_name', v)} />
                  <Select label="Account Type" value={f.account_type} onChange={v => set('account_type', v)} options={[['Checking', 'Checking'], ['Savings', 'Savings']]} />
                  <Field label="Routing Number" value={f.routing_number} onChange={v => set('routing_number', v)} />
                  <Field label="Account Number" value={f.account_number} onChange={v => set('account_number', v)} />
                </div>
              )}
              <div className="flex justify-between mt-5">
                <button onClick={() => setStep(1)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-gray-500 text-[14px] font-bold bg-white border border-gray-200"><ArrowLeft size={15} /> Back</button>
                <button onClick={() => setStep(3)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[14px] font-bold" style={{ background: 'linear-gradient(135deg,#2563eb,#1e3a8a)' }}>Continue <ArrowRight size={15} /></button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="font-extrabold text-[18px] mb-0.5" style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>Tax form</div>
              <div className="text-[12.5px] text-gray-500 mb-4">Auto-selected from your residency. Review your tax ID and sign.</div>
              <div className="flex items-center gap-3 p-3.5 rounded-xl mb-4" style={{ border: '1px solid rgba(37,99,235,.25)', background: '#eff5ff' }}>
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-blue-600" style={{ border: '1px solid rgba(37,99,235,.2)' }}><FileText size={18} /></div>
                <div>
                  <div className="font-extrabold text-[15px]" style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>Form {form[0]}</div>
                  <div className="text-[11.5px] text-gray-500">{form[1]}</div>
                </div>
                <span className="ml-auto text-[9px] font-semibold uppercase tracking-[0.04em] rounded-md px-2 py-1 text-blue-600" style={{ background: 'rgba(37,99,235,.14)', border: '1px solid rgba(37,99,235,.3)', fontFamily: "'JetBrains Mono', monospace" }}>Official IRS</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Select label="Tax ID Type" value={f.tax_id_type} onChange={v => set('tax_id_type', v)} options={[['EIN', 'EIN'], ['SSN', 'SSN'], ['ITIN', 'ITIN'], ['VAT', 'VAT'], ['Foreign', 'Foreign']]} />
                <Field label="Tax ID" value={f.tax_id} onChange={v => set('tax_id', v)} hint="Encrypted after saving" />
              </div>
              <label className="flex gap-2.5 p-3 border border-gray-200 rounded-lg mb-3 cursor-pointer" onClick={() => setCert(!cert)}>
                <span className="w-[18px] h-[18px] rounded flex-shrink-0 mt-0.5 relative" style={{ background: cert ? '#2563eb' : '#fff', border: cert ? '2px solid #2563eb' : '2px solid #cbd5e1' }}>{cert && <Check size={12} color="#fff" style={{ position: 'absolute', top: 1, left: 1 }} />}</span>
                <span className="text-[12px] text-gray-700 leading-relaxed">Under penalties of perjury, I certify the information is true, correct, and complete, and I am the person named above.</span>
              </label>
              <div className="mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-gray-400">Signature (type your full name)</span>
                <input value={f.signature_name} onChange={e => set('signature_name', e.target.value)} className="w-full border-b-2 border-gray-900 py-1.5 text-[20px] font-bold bg-transparent focus:outline-none" style={{ fontFamily: "'Archivo', cursive" }} />
                <div className="text-[10px] text-gray-400 mt-1">Signed electronically · {new Date().toLocaleDateString()} · IP recorded for audit</div>
              </div>
              <div className="flex justify-between mt-5">
                <button onClick={() => setStep(2)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-gray-500 text-[14px] font-bold bg-white border border-gray-200"><ArrowLeft size={15} /> Back</button>
                <button onClick={submit} disabled={!cert || !f.signature_name || submitting} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[14px] font-bold disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#2563eb,#1e3a8a)' }}>
                  {submitting ? <><Loader2 size={15} className="animate-spin" /> Submitting...</> : <>Sign &amp; submit <Check size={15} /></>}
                </button>
              </div>
            </>
          )}

          {step === 4 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-700" style={{ background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.3)' }}><Check size={30} /></div>
              <div className="font-extrabold text-[20px] mb-2" style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>Submitted for review</div>
              <p className="text-[13.5px] text-gray-500 max-w-md mx-auto leading-relaxed">Your details and {form[0]} were sent to admin. You'll be notified once approved. You can log back in anytime with this email to submit time and view documents.</p>
              <button onClick={onDone} className="mt-6 px-5 py-2.5 rounded-xl text-white text-[14px] font-bold" style={{ background: 'linear-gradient(135deg,#2563eb,#1e3a8a)' }}>Go to portal</button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

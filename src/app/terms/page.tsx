// src/app/terms/page.tsx
'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950">
      {/* Noise texture */}
      <div 
        className="fixed inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-16">
        {/* Back link */}
        <Link 
          href="/login" 
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-400 transition-colors mb-10"
        >
          <ArrowLeft size={16} />
          Back to login
        </Link>

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
          <p className="text-slate-500">Last updated: February 1, 2026</p>
        </div>

        {/* Content */}
        <div className="bg-slate-900/70 backdrop-blur-xl rounded-2xl border border-white/[0.08] p-8 sm:p-10 space-y-8 text-slate-300 text-sm leading-relaxed">
          
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Vantage Financial Platform ("Vantage," "we," "our," or "the Service"), 
              operated by Vantage FP, you agree to be bound by these Terms of Service. If you do not agree 
              to these terms, do not use the Service. These terms apply to all users, including administrators, 
              team members, and any person granted access by an authorized account holder.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Description of Service</h2>
            <p>
              Vantage provides a web-based financial management platform designed for consulting and 
              project-based businesses. Features include cash flow tracking, project profitability analysis, 
              invoicing, expense management, time tracking, team management, and AI-assisted financial insights. 
              The Service is provided "as is" and may be updated, modified, or discontinued at our discretion.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Accounts & Access</h2>
            <p className="mb-3">
              Access to Vantage requires authentication via Google OAuth through your organization's 
              Google Workspace account. You are responsible for maintaining the security of your account 
              and all activity that occurs under it.
            </p>
            <p>
              Account administrators control team member access and permission levels within their organization. 
              Administrators are responsible for ensuring that only authorized personnel have access to 
              financial data within the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. User Responsibilities</h2>
            <p className="mb-3">You agree to:</p>
            <div className="space-y-2 pl-4 text-slate-400">
              <p>• Provide accurate and complete financial data when using the Service</p>
              <p>• Not use the Service for any unlawful purpose or in violation of any applicable regulations</p>
              <p>• Not attempt to reverse-engineer, decompile, or extract source code from the Service</p>
              <p>• Not share login credentials or grant unauthorized access to the platform</p>
              <p>• Comply with all applicable tax, financial reporting, and data protection laws</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Financial Data Disclaimer</h2>
            <p>
              Vantage is a financial tracking and analytics tool. It does not provide tax advice, legal counsel, 
              or certified accounting services. All financial data, projections, AI-generated insights, and 
              reports are for informational purposes only. You should consult with qualified professionals 
              for tax filing, legal compliance, and certified financial statements. We are not liable for 
              business decisions made based on data presented in the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Third-Party Integrations</h2>
            <p>
              Vantage may integrate with third-party services including QuickBooks, Google Workspace, and 
              other platforms. These integrations are governed by their respective terms of service. We are 
              not responsible for the availability, accuracy, or security of third-party services. You 
              authorize Vantage to access and synchronize data from connected third-party accounts as 
              necessary to provide the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Intellectual Property</h2>
            <p>
              All content, features, and functionality of the Service — including but not limited to design, 
              code, algorithms, text, graphics, and the Vantage brand — are owned by Vantage FP and 
              protected by intellectual property laws. Your financial data remains your property. We claim 
              no ownership over data you input into the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Service Availability & Limitations</h2>
            <p>
              We strive for high availability but do not guarantee uninterrupted access. The Service may 
              experience downtime for maintenance, updates, or unforeseen technical issues. We are not 
              liable for any losses resulting from service interruptions. We reserve the right to impose 
              usage limits, modify features, or restrict access at our discretion.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Vantage FP shall not be liable for any indirect, 
              incidental, special, consequential, or punitive damages, including loss of profits, data, 
              or business opportunities, arising from your use of the Service. Our total liability shall 
              not exceed the amount paid by you for the Service in the twelve months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Termination</h2>
            <p>
              We may suspend or terminate your access to the Service at any time for violation of these 
              terms or for any other reason at our discretion. Upon termination, you may request an export 
              of your financial data within 30 days. After this period, your data may be permanently deleted.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Changes to Terms</h2>
            <p>
              We may update these Terms of Service from time to time. Material changes will be communicated 
              via email or in-app notification. Continued use of the Service after changes constitutes 
              acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">12. Governing Law</h2>
            <p>
              These terms shall be governed by and construed in accordance with applicable laws. Any 
              disputes arising from the use of the Service shall be resolved through binding arbitration 
              or in the courts of competent jurisdiction.
            </p>
          </section>

          <section className="pt-4 border-t border-white/[0.08]">
            <p className="text-slate-500">
              Questions about these terms? Contact us at{' '}
              <a href="mailto:legal@vantagefp.co" className="text-emerald-400 hover:underline">
                legal@vantagefp.co
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

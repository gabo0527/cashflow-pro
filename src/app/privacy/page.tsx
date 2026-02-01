// src/app/privacy/page.tsx
'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-slate-500">Last updated: February 1, 2026</p>
        </div>

        {/* Content */}
        <div className="bg-slate-900/70 backdrop-blur-xl rounded-2xl border border-white/[0.08] p-8 sm:p-10 space-y-8 text-slate-300 text-sm leading-relaxed">
          
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Overview</h2>
            <p>
              Vantage Financial Platform ("Vantage," "we," "our") is committed to protecting your privacy 
              and the security of your financial data. This Privacy Policy explains what information we 
              collect, how we use it, and your rights regarding your data. This policy applies to all 
              users of the Vantage platform at vantagefp.co.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Information We Collect</h2>
            
            <h3 className="text-sm font-semibold text-slate-200 mb-2 mt-4">Account Information</h3>
            <p className="mb-3">
              When you sign in via Google OAuth, we receive your name, email address, and profile photo 
              from Google. We do not store your Google password. Authentication is handled entirely by 
              Google's secure OAuth 2.0 protocol.
            </p>

            <h3 className="text-sm font-semibold text-slate-200 mb-2">Financial Data</h3>
            <p className="mb-3">
              You may input or sync financial data including invoices, expenses, transactions, project 
              budgets, time entries, team member information, and client records. This data is stored 
              securely and is only accessible to authorized users within your organization.
            </p>

            <h3 className="text-sm font-semibold text-slate-200 mb-2">Third-Party Integration Data</h3>
            <p className="mb-3">
              If you connect QuickBooks or other third-party services, we access and store synchronized 
              data (transactions, invoices, accounts) as necessary to provide the Service. You can 
              disconnect integrations at any time through Settings.
            </p>

            <h3 className="text-sm font-semibold text-slate-200 mb-2">Usage & Technical Data</h3>
            <p>
              We collect basic usage analytics including pages visited, features used, browser type, 
              and device information. This data is used to improve the Service and is not sold to 
              third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. How We Use Your Data</h2>
            <div className="space-y-2 pl-4 text-slate-400">
              <p>• <span className="text-slate-300">Providing the Service:</span> Displaying dashboards, generating reports, running calculations, and powering AI insights</p>
              <p>• <span className="text-slate-300">Authentication:</span> Verifying your identity and managing access permissions</p>
              <p>• <span className="text-slate-300">Synchronization:</span> Keeping data consistent between Vantage and connected third-party services</p>
              <p>• <span className="text-slate-300">Improvements:</span> Analyzing usage patterns to improve features and user experience</p>
              <p>• <span className="text-slate-300">Communication:</span> Sending essential service notifications (security alerts, downtime, terms changes)</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Data Storage & Security</h2>
            <p className="mb-3">
              Your data is stored on Supabase (PostgreSQL) infrastructure with encryption at rest 
              and in transit (TLS 1.2+). We implement Row Level Security (RLS) policies to ensure 
              data isolation between organizations — your company's data is never accessible to 
              other Vantage users.
            </p>
            <p>
              Additional security measures include OAuth-based authentication (no password storage), 
              role-based access control within organizations, HTTPS-only connections, and regular 
              security reviews. While we implement industry-standard security practices, no method 
              of electronic storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Data Sharing</h2>
            <p className="mb-3">We do not sell, rent, or trade your personal or financial data. We may share data only in these circumstances:</p>
            <div className="space-y-2 pl-4 text-slate-400">
              <p>• <span className="text-slate-300">Infrastructure providers:</span> Supabase (database hosting), Vercel (application hosting) — bound by their own privacy policies and DPAs</p>
              <p>• <span className="text-slate-300">Connected integrations:</span> QuickBooks and other services you explicitly authorize</p>
              <p>• <span className="text-slate-300">Legal requirements:</span> If required by law, regulation, or valid legal process</p>
              <p>• <span className="text-slate-300">Business transfers:</span> In the event of a merger, acquisition, or sale of assets, with prior notice</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. AI & Automated Processing</h2>
            <p>
              Vantage includes an AI assistant ("Sage") that analyzes your financial data to provide 
              insights and recommendations. AI processing occurs on your organization's data only and 
              is not used to train models or shared with other users. AI-generated insights are for 
              informational purposes only and should not replace professional financial advice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. If your account is terminated, 
              you may request a data export within 30 days. After the retention period, data is 
              permanently deleted from our systems and backups within 90 days. Usage analytics may 
              be retained in anonymized, aggregated form indefinitely.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Your Rights</h2>
            <p className="mb-3">Depending on your jurisdiction, you may have the right to:</p>
            <div className="space-y-2 pl-4 text-slate-400">
              <p>• <span className="text-slate-300">Access:</span> Request a copy of the data we hold about you and your organization</p>
              <p>• <span className="text-slate-300">Correction:</span> Request correction of inaccurate data</p>
              <p>• <span className="text-slate-300">Deletion:</span> Request deletion of your data ("right to be forgotten")</p>
              <p>• <span className="text-slate-300">Export:</span> Request your data in a portable format (CSV/JSON)</p>
              <p>• <span className="text-slate-300">Restrict processing:</span> Request that we limit how we use your data</p>
              <p>• <span className="text-slate-300">Withdraw consent:</span> Disconnect integrations or close your account at any time</p>
            </div>
            <p className="mt-3">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:privacy@vantagefp.co" className="text-emerald-400 hover:underline">privacy@vantagefp.co</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Cookies & Local Storage</h2>
            <p>
              Vantage uses essential cookies and browser localStorage for authentication sessions, 
              user preferences (such as sidebar state and theme), and basic analytics. We do not use 
              third-party advertising cookies. You can clear local storage through your browser settings, 
              though this may require re-authentication.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Children's Privacy</h2>
            <p>
              Vantage is a business tool and is not directed at individuals under 18. We do not 
              knowingly collect data from minors. If you believe a minor has provided us with 
              personal information, please contact us for removal.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. International Data</h2>
            <p>
              Vantage operates with infrastructure in the United States. If you access the Service 
              from outside the US, your data may be transferred to and processed in the US. By using 
              the Service, you consent to this transfer. We take appropriate measures to ensure your 
              data is treated securely regardless of where it is processed.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be 
              communicated via email or in-app notification at least 30 days before taking effect. 
              The "Last updated" date at the top reflects the most recent revision.
            </p>
          </section>

          <section className="pt-4 border-t border-white/[0.08]">
            <p className="text-slate-500">
              Questions or concerns? Contact our privacy team at{' '}
              <a href="mailto:privacy@vantagefp.co" className="text-emerald-400 hover:underline">
                privacy@vantagefp.co
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

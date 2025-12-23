// Save as: src/app/privacy/page.tsx

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-8">
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        <p className="text-gray-500 mb-8">Last updated: December 2024</p>
        
        <div className="prose prose-gray max-w-none">
          <h2 className="text-xl font-semibold mt-6 mb-3">1. Information We Collect</h2>
          <p className="mb-4 text-gray-700">
            We collect information you provide directly, including account information (email, name), 
            financial data you upload or sync (transactions, invoices), and usage data to improve the Service.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3">2. QuickBooks Integration</h2>
          <p className="mb-4 text-gray-700">
            When you connect your QuickBooks Online account, we access transaction data, invoice data, 
            and customer/vendor information as authorized by you. We only access data necessary to 
            provide the Service's features. You can disconnect QuickBooks at any time through Settings.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3">3. How We Use Your Information</h2>
          <p className="mb-4 text-gray-700">
            We use your information to provide and improve the Service, display financial analytics 
            and reports, sync data between connected services, and communicate with you about the Service.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3">4. Data Storage and Security</h2>
          <p className="mb-4 text-gray-700">
            Your data is stored securely using industry-standard encryption. We use Supabase for 
            database services with row-level security policies. Access tokens for third-party services 
            are encrypted at rest.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3">5. Data Sharing</h2>
          <p className="mb-4 text-gray-700">
            We do not sell your personal or financial data. We may share data with service providers 
            who assist in operating the Service (hosting, analytics), and as required by law.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3">6. Your Rights</h2>
          <p className="mb-4 text-gray-700">
            You have the right to access, correct, or delete your data. You can export your data 
            at any time. You can disconnect third-party integrations and revoke access. 
            Contact us to exercise these rights.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3">7. Data Retention</h2>
          <p className="mb-4 text-gray-700">
            We retain your data as long as your account is active. Upon account deletion, 
            we will delete your data within 30 days, except as required by law.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3">8. Cookies</h2>
          <p className="mb-4 text-gray-700">
            We use essential cookies to maintain your session and preferences. 
            We do not use tracking cookies for advertising purposes.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3">9. Changes to This Policy</h2>
          <p className="mb-4 text-gray-700">
            We may update this Privacy Policy from time to time. We will notify you of significant 
            changes through the Service or by email.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3">10. Contact</h2>
          <p className="mb-4 text-gray-700">
            For questions about this Privacy Policy or your data, please contact us through the application.
          </p>
        </div>
        
        <div className="mt-8 pt-6 border-t">
          <a href="/" className="text-blue-600 hover:text-blue-800">← Back to Vantage</a>
        </div>
      </div>
    </div>
  )
}

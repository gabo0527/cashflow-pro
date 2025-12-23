// Save as: src/app/terms/page.tsx

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-8">
        <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
        <p className="text-gray-500 mb-8">Last updated: December 2024</p>
        
        <div className="prose prose-gray max-w-none">
          <h2 className="text-xl font-semibold mt-6 mb-3">1. Acceptance of Terms</h2>
          <p className="mb-4 text-gray-700">
            By accessing and using Vantage ("the Service"), you agree to be bound by these Terms of Service. 
            If you do not agree to these terms, please do not use the Service.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3">2. Description of Service</h2>
          <p className="mb-4 text-gray-700">
            Vantage is a financial analytics platform that helps businesses manage cash flow, 
            track project profitability, and analyze financial data. The Service may integrate 
            with third-party services such as QuickBooks Online.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3">3. User Accounts</h2>
          <p className="mb-4 text-gray-700">
            You are responsible for maintaining the confidentiality of your account credentials 
            and for all activities that occur under your account. You agree to notify us immediately 
            of any unauthorized use of your account.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3">4. Data and Privacy</h2>
          <p className="mb-4 text-gray-700">
            Your use of the Service is also governed by our Privacy Policy. By using the Service, 
            you consent to the collection and use of your data as described in the Privacy Policy.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3">5. Third-Party Integrations</h2>
          <p className="mb-4 text-gray-700">
            The Service may integrate with third-party services such as QuickBooks Online. 
            Your use of these integrations is subject to the terms and policies of those third parties. 
            We are not responsible for the practices of third-party services.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3">6. Limitation of Liability</h2>
          <p className="mb-4 text-gray-700">
            The Service is provided "as is" without warranties of any kind. We shall not be liable 
            for any indirect, incidental, special, consequential, or punitive damages resulting from 
            your use of the Service.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3">7. Changes to Terms</h2>
          <p className="mb-4 text-gray-700">
            We reserve the right to modify these terms at any time. Continued use of the Service 
            after changes constitutes acceptance of the modified terms.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3">8. Contact</h2>
          <p className="mb-4 text-gray-700">
            For questions about these Terms of Service, please contact us through the application.
          </p>
        </div>
        
        <div className="mt-8 pt-6 border-t">
          <a href="/" className="text-blue-600 hover:text-blue-800">← Back to Vantage</a>
        </div>
      </div>
    </div>
  )
}

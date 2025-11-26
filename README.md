# CashFlow Pro

A modern cash flow management tool for businesses. Built with Next.js 14 and deployable to Vercel.

![CashFlow Pro](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css)

## Features

- **CSV Data Import** - Import transactions from any accounting system
- **Assumptions Engine** - Add projected revenue/expenses when no historical data exists
- **1-3 Year Projections** - Flexible forecasting periods
- **Multiple Comparison Views** - MoM, YoY, QoQ, and by-project analysis
- **Actual vs Budget** - Track performance against budget targets
- **Actual vs Projected** - Clear distinction between historical and forecasted data
- **Beginning Balance** - Set starting cash position
- **API Integration Ready** - Prepared for QuickBooks, Xero, Plaid connections

## Categories

Simple 4-category structure:
- Revenue
- Operating Expenses (OpEx)
- Non-Operational Expenses
- Net Cash

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/cashflow-pro.git
cd cashflow-pro

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/cashflow-pro)

Or manually:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

## CSV Import Format

```csv
date,category,description,amount,type,project
2024-01-15,revenue,Consulting Fee,50000,actual,Project Alpha
2024-01-01,opex,Payroll,-35000,actual,
2024-01-15,revenue,Consulting Budget,55000,budget,Project Alpha
```

**Fields:**
- `date` - YYYY-MM-DD format
- `category` - revenue, opex, non_operational
- `type` - actual, budget
- `project` - optional project tag

## Project Structure

```
cashflow-app/
├── src/
│   └── app/
│       ├── globals.css    # Tailwind + custom styles
│       ├── layout.tsx     # Root layout
│       └── page.tsx       # Main application
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── next.config.js
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **CSV Parsing**: PapaParse
- **Icons**: Lucide React
- **Animations**: Framer Motion

## Roadmap

- [ ] QuickBooks API integration
- [ ] Xero API integration
- [ ] Plaid bank connections
- [ ] Multi-currency support
- [ ] PDF report exports
- [ ] Team collaboration features
- [ ] Mobile app

## License

MIT

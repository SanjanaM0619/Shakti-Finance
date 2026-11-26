# Shakti Finance

**An Integrated Financial Management, Intelligence, and Government Support Platform for Women Entrepreneurs**

Shakti Finance helps women running micro-enterprises, home-based businesses, small production units, and Self-Help Groups (SHGs) manage business finances cleanly, separate household money from business cash, record transactions via Kannada/English voice entry, forecast cash flows, plan surplus allocations, and discover verified government schemes.

---

## Core Modules

1. **Business Bookkeeping & Ledgers** — Sales, expenses (with receipt upload & recurring flags), customer credit receivables, supplier bills, partial payments, and CSV/PDF reports.
2. **Household–Business Financial Separation Engine** — Strictly separates business revenue and operating expenses from household withdrawals, personal capital contributions, loans, and internal cash/UPI/bank transfers.
3. **Voice-First Bilingual Transaction Entry (Kannada & English)** — Speech-to-text & structured extraction with clarification questions and mandatory user confirmation before modifying the ledger.
4. **Intelligent Financial Health Engine** — Computes all 13 financial indicators and classifies enterprise status (`Healthy`, `Needs attention`, `Financially stressed`) with transparent rule explanations.
5. **Predictive Cash-Flow Forecasting** — 7-day, 30-day, and 90-day forecasts combining SMA, WMA, and Exponential Smoothing with scheduled receivables, supplier deadlines, and walk-forward backtest metrics (MAE, RMSE, MAPE).
6. **Adaptive Surplus Allocation & Savings Planner** — Dynamic recommendations across obligations, emergency reserves, reinvestment, personal savings, and flexible cash.
7. **Explainable AI Financial Assistant** — Answers business queries grounded strictly in verified SQLite financial calculations.
8. **Government Scheme & Opportunity Finder** — Verified central and Karnataka schemes (PM MUDRA, PMEGP, PMFME, DAY-NRLM, Udyogini, KSFC, CGTMSE, Stand-Up India, RSETI) with three-outcome matching, document checklists, and status tracking.
9. **Business Financial Readiness Report** — Lender-ready summary with PDF & CSV export and clear non-credit-score disclaimers.
10. **Contextual Financial Literacy Centre (EN / ಕನ್ನಡ)** — 10 practical lessons personalized with the entrepreneur's real metrics and quizzes.
11. **Pricing Intelligence, Offline-First Sync Queue & Live Notifications**.

---

## Quick Start

```bash
npm install
npm run build
npm start
```

For local development (backend API on `:4000` + Vite client on `:5173`):

```bash
npm run dev
```

Run unit tests:

```bash
npm test
```

---

## Demo Mode & Optional External Integrations

- **Demo Account**: Click **Explore Live Demo** on the landing page (or sign in with Mobile `9845012345` / Password `shakti123`) to inspect **Kavya Gruha Udyog** with 90 days of realistic business transactions.
- **OTP Authentication**: Runs in clearly labelled Demo OTP mode when an SMS gateway is not connected.
- **Speech / LLM Integrations**: Works immediately via browser Web Speech API + deterministic Kannada/English extraction. Optionally configure `SARVAM_API_KEY` or `OPENAI_API_KEY` in `.env` (see `.env.example`).

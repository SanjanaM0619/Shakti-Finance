# Shakti Finance (MERN Stack)

**An Integrated Financial Management, Intelligence, and Government Support Platform for Women Entrepreneurs**

Built cleanly with the **MERN Stack** (**MongoDB + Mongoose**, **Express**, **React + TypeScript + Tailwind CSS**, **Node.js**) separated into dedicated `database/`, `backend/`, `frontend/`, and `tests/` directories.

---

## Project Structure

```text
Shakti-Finance/
├── database/                 # MongoDB connection manager, Mongoose schemas & seeds
│   ├── connection.js         # Connects to MONGODB_URI or embedded MongoDB fallback
│   ├── models/               # 14 Mongoose models (User, Transaction, Scheme, etc.)
│   └── seeds/                # 12 verified Central/Karnataka schemes & Kavya demo account
├── backend/                  # Express API server, auth middleware & financial engines
│   ├── index.js              # Express entry point & production SPA hosting
│   ├── middleware/           # JWT auth & bcrypt hashing
│   ├── engines/              # Accounting separation, health, forecasting, surplus, schemes, voice, AI
│   └── routes/               # authRoutes, financeRoutes, intelligenceRoutes
├── frontend/                 # React + TypeScript + Vite + Tailwind v4 SPA
│   ├── public/               # PWA manifest & offline service worker
│   └── src/                  # 21+ pages, bilingual EN/KN i18n, offline queue, PDF/CSV exports
└── tests/                    # Node test runner unit & full MERN API integration tests
```

---

## Quick Start

```bash
npm install
npm run build
npm start
```

For local development (Express API on `:4000` + Vite React client on `:5173`):

```bash
npm run dev
```

Run TypeScript check and MERN tests:

```bash
npm run typecheck
npm test
```

---

## MongoDB & Optional API Configuration

- **MongoDB**: Set `MONGODB_URI` in `.env` (or `backend/.env`) to connect to MongoDB Atlas or a local `mongod` server. When `MONGODB_URI` is unset, [database/connection.js](database/connection.js) automatically boots an embedded MongoDB instance so the application and tests work out of the box.
- **Demo Account**: Click **Explore Live Demo** (or sign in with Mobile `9845012345` / Password `shakti123`) to explore **Kavya Gruha Udyog** with 90 days of realistic operational history.
- **Speech / LLM Integrations**: Works out of the box via browser Web Speech API + deterministic Kannada/English extraction. Optionally configure `SARVAM_API_KEY`, `GEMINI_API_KEY`, or `OPENAI_API_KEY` in `.env`.

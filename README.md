# 🔑 KeyVault — Zero-Knowledge Password Manager

A production-grade, self-hosted password manager with:
- **Next.js** frontend (Vercel)
- **FastAPI** serverless backend (Vercel Functions)
- **Neon PostgreSQL** serverless database
- **Browser Extension** (Chrome/Firefox/Edge)
- **AES-256-GCM** client-side encryption — the server *never* sees your passwords

---

## Architecture

```
Browser / Extension
    │
    ├── Web Crypto API (PBKDF2 key derivation + AES-256-GCM)
    │       Master Password → 256-bit key (never leaves device)
    │
    ├── Next.js Frontend (Vercel)
    │       Encrypts data client-side before sending to API
    │
    └── FastAPI Backend (Vercel Serverless)
            Stores only ciphertext in Neon PostgreSQL
```

---

## 🚀 Quick Start

### 1. Clone & install

```bash
git clone https://github.com/yourname/keyvault
cd keyvault

# Install frontend deps
cd frontend && npm install && cd ..
```

### 2. Set up Neon database

1. Go to [neon.tech](https://neon.tech) → Create account → New project
2. Copy the **Connection string** (it looks like `postgresql://user:pass@ep-xxx.neon.tech/neondb`)
3. Tables are created automatically on first API call (`create_tables()`)

### 3. Configure environment

```bash
cp .env.example .env
# Fill in DATABASE_URL and JWT_SECRET
```

Generate a JWT secret:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 4. Run locally

**Backend:**
```bash
cd api
pip install -r requirements.txt
uvicorn index:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
cp ../.env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## ☁️ Deploy to Vercel

### One-click (recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### Manual

```bash
npm i -g vercel
vercel login

# From project root:
vercel

# Set environment variables in Vercel dashboard or via CLI:
vercel env add DATABASE_URL
vercel env add JWT_SECRET
vercel env add NEXT_PUBLIC_API_URL  # set to your vercel URL after first deploy
```

The `vercel.json` at root routes `/api/*` → FastAPI and everything else → Next.js.

---

## 🧩 Browser Extension

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder

### Configure

Edit `extension/popup.js` line 1:
```js
const API_URL = 'https://your-app.vercel.app'; // ← Your Vercel URL
```

### Package for distribution

```bash
cd extension
zip -r keyvault-extension.zip . -x "*.DS_Store"
# Upload to Chrome Web Store or Firefox Add-ons
```

---

## 🔐 Security Model

| Layer | What's protected | How |
|-------|-----------------|-----|
| Auth password | Stored hashed (bcrypt, cost 12) | Never stored in plain text |
| Master password | **Never sent to server** | PBKDF2-SHA256, 600k iterations, derives AES key client-side |
| Vault data | AES-256-GCM encrypted | Unique 12-byte IV per item |
| Transport | TLS 1.3 | Vercel enforced |
| Tokens | Short-lived JWTs (30min) + rotating refresh tokens | Refresh tokens stored hashed |

**The server stores only ciphertext. Even a complete database breach exposes no passwords.**

---

## 📁 Project Structure

```
keyvault/
├── api/                    # FastAPI serverless backend
│   ├── index.py            # Entry point (Mangum adapter)
│   ├── database.py         # SQLAlchemy models + Neon connection
│   ├── crypto.py           # JWT, bcrypt, token utilities
│   ├── schemas.py          # Pydantic request/response schemas
│   ├── deps.py             # Auth dependency injection
│   ├── routes/
│   │   ├── auth.py         # /api/auth/* (register, login, refresh, logout)
│   │   └── vault.py        # /api/vault/* (CRUD + export)
│   └── requirements.txt
│
├── frontend/               # Next.js app
│   ├── app/
│   │   ├── layout.tsx      # Root layout
│   │   ├── page.tsx        # Landing page
│   │   ├── auth/page.tsx   # Login / Register
│   │   └── dashboard/page.tsx  # Main vault UI
│   ├── lib/
│   │   ├── crypto.ts       # Web Crypto API (PBKDF2 + AES-256-GCM)
│   │   ├── api.ts          # Axios client + auto-refresh
│   │   └── store.ts        # Zustand state management
│   └── styles/globals.css
│
├── extension/              # Browser extension (MV3)
│   ├── manifest.json
│   ├── popup.html          # Extension popup UI
│   ├── popup.js            # Popup logic + crypto
│   ├── background.js       # Service worker (key storage)
│   └── content.js          # Autofill injection
│
├── vercel.json             # Routing config
└── .env.example            # Environment template
```

---

## 🛠 API Reference

**Auth:**
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Get tokens
- `POST /api/auth/refresh` — Rotate refresh token
- `POST /api/auth/logout` — Revoke refresh token
- `GET  /api/auth/me` — Current user

**Vault:**
- `GET    /api/vault` — List items (supports `?search=`, `?category=`, `?favourites_only=true`)
- `POST   /api/vault` — Create item
- `GET    /api/vault/:id` — Get item
- `PATCH  /api/vault/:id` — Update item
- `DELETE /api/vault/:id` — Delete item
- `GET    /api/vault/export/json` — Export encrypted vault

Interactive docs: `https://your-app.vercel.app/api/docs`

---

## 🗺 Roadmap

- [ ] TOTP two-factor authentication
- [ ] Passkey / WebAuthn support
- [ ] Secure sharing (public-key encrypted)
- [ ] iOS / Android app (React Native)
- [ ] Password health dashboard (breach detection via HIBP)
- [ ] Organizations / team vaults

---

## License

MIT

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Buzz Pilot — Content Marketing Lab 🚀

**Buzz Pilot** adalah platform Content Marketing berbasis AI yang membantu kreator dan marketer menyusun script video pendek (TikTok/Reels/Shorts) yang viral dengan 50+ framework pemasaran terbukti.

## ✨ Fitur Utama

- **🧠 AI Script Generator** — Generate script otomatis dengan Google Gemini AI
- **📚 50 Framework Pemasaran** — TOF, MOF, BOF frameworks lengkap dengan contoh
- **📊 Scoring Engine** — Analisis hook, readability, SEO, emotion, dan CTA secara deterministik
- **📅 Content Calendar** — Jadwalkan kampanye konten bulanan
- **📈 Progress Tracker** — Pantau perkembangan portofolio konten
- **💾 Supabase Integration** — Simpan script secara online di cloud
- **📤 Export PDF/CSV** — Ekspor portofolio untuk reporting
- **🌙 Dark Mode** — Tampilan nyaman di siang dan malam hari

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Gemini API Key ([dapatkan gratis](https://aistudio.google.com/apikey))

### Instalasi

```bash
# 1. Clone repository
git clone https://github.com/yourusername/buzz-pilot.git
cd buzz-pilot

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env.local
# Edit .env.local dan masukkan GEMINI_API_KEY Anda

# 4. Jalankan development server
npm run dev
```

Akses aplikasi di **http://localhost:3000**

## 🏗️ Project Structure

```
buzz-pilot/
├── src/
│   ├── components/       # React components
│   │   └── ErrorBoundary.tsx
│   ├── utils/
│   │   └── scoring.ts    # Deterministic scoring engine
│   ├── types.ts          # TypeScript type definitions
│   ├── frameworksData.ts # 50 marketing frameworks
│   ├── App.tsx           # Main application
│   ├── main.tsx          # Entry point
│   └── index.css         # Tailwind + custom styles
├── server.ts             # Express + Gemini API server
├── index.html            # HTML entry point
├── vite.config.ts        # Vite configuration
└── tsconfig.json         # TypeScript configuration
```

## 🔧 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Vite + Express) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run preview` | Preview production build |
| `npm run lint` | TypeScript type checking |
| `npm run clean` | Clean build artifacts |

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ Yes | Google Gemini API key |
| `VITE_SUPABASE_URL` | ❌ No | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ❌ No | Supabase anonymous key |

## 🛡️ Security

- API keys hanya diakses server-side
- Rate limiting pada semua endpoint AI
- Input validation dengan Zod
- Row Level Security (RLS) untuk Supabase

## 🧪 Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS 4, Framer Motion
- **Backend:** Express.js, Google Gemini AI
- **Database:** Supabase (PostgreSQL) / LocalStorage
- **Build:** Vite 6
- **Export:** jsPDF

## 📄 License

MIT

---

<div align="center">
  Dibuat dengan ❤️ untuk para kreator konten Indonesia
</div>

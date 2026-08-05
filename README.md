# Oringe Waswa & Associates — Full-Stack Legal Website

Built with **Next.js 14**, **Supabase**, and **Groq AI** (free tier), deployable to **Vercel**.

---

## 🚀 Quick Start

### 1. Install
```bash
npm install
```

### 2. Configure Supabase
1. Go to [supabase.com](https://supabase.com) → Your Project → SQL Editor
2. Run `supabase/migrations/001_initial_schema.sql`
3. Go to **Storage** → Create these buckets:

| Bucket | Public? |
|--------|---------|
| `avatars` | ✅ Yes |
| `gallery` | ✅ Yes |
| `blog-covers` | ✅ Yes |
| `legal-docs` | ❌ Private |
| `certificates` | ❌ Private |
| `insights` | ✅ Yes |

### 3. Set Up AI (FREE — Groq)
```bash
# Get a free API key at https://console.groq.com/keys
# Sign up, create a key, paste it in .env.local as AI_API_KEY
# Default model: llama-3.3-70b-versatile (fast, capable, free)
# Works with any OpenAI-compatible provider (Together, OpenRouter, Ollama)
```

### 4. Configure Environment
```bash
cp .env.local.example .env.local
# Edit .env.local with your values
```

### 5. Run
```bash
npm run dev
# → http://localhost:3000
```

---

## AI Architecture

Uses any **OpenAI-compatible** API via plain `fetch` (default: Groq free tier):

```typescript
// src/lib/openai.ts — provider-agnostic, zero SDK dependencies
const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
  headers: { Authorization: `Bearer ${AI_API_KEY}` },
  body: JSON.stringify({
    model: AI_MODEL,            // default: llama-3.3-70b-versatile
    messages: [{ role: "user", content: "..." }],
    max_tokens: 1000,
  }),
})
// Every consumer function has a graceful fallback when AI is down.
```

### AI Features
| Feature | Endpoint |
|---------|----------|
| Chatbot (floating widget) | `POST /api/ai/chat` |
| Smart form routing | `POST /api/ai/analyze-submission` |
| Blog moderation | Called in `POST /api/blog` |
| Certificate generation | Called in `POST /api/certificates` |
| Email campaign drafting | `POST /api/ai/draft-email` |
| Form AI suggestions | Called inline in forms |

### Smart Auto-Routing
When a user submits a form, AI analyzes the content and can automatically reassign it:
- "I want to apply for a job" submitted as Contact → routed to **Job** repository
- "I'd like to volunteer" submitted as Contact → routed to **Volunteer** repository  
- Confidence threshold: **70%** — below this, original type is kept

---

## 📁 Structure

```
src/
├── app/
│   ├── page.tsx              # Homepage
│   ├── blog/[slug]/page.tsx  # Blog post with Read Aloud
│   ├── contact/page.tsx      # Chat-style multi-form
│   ├── appointments/page.tsx # Chat-style booking
│   ├── services/page.tsx     # Practice areas
│   ├── team/page.tsx         # Team with profiles
│   ├── insights/page.tsx     # Video/audio/news/articles
│   ├── gallery/page.tsx      # Photo gallery
│   ├── track/page.tsx        # Submission tracker
│   ├── admin/                # Full admin portal
│   └── api/                  # All API routes
├── components/
│   ├── layout/               # Navbar (with translate), Footer, Layout
│   ├── chat/                 # AI chatbot widget
│   ├── blog/                 # ReadAloud component
│   ├── ui/                   # ImagePicker, TranslateWidget
│   └── home/                 # Homepage sections
├── lib/
│   ├── openai.ts             # AI client (Groq / any OpenAI-compatible)
│   ├── supabase.ts           # Database client
│   ├── email.ts              # Email templates
│   └── utils.ts              # Helpers
└── styles/globals.css        # All CSS variables (one file for theming)
```

---

## 🎨 Customizing for Another Organization

Edit just these files:
1. `src/styles/globals.css` — change `--color-accent` and fonts
2. `.env.local` — update firm name, email
3. Default settings in `supabase/migrations/001_initial_schema.sql`

---

## 🌍 Translation

Supports **29 languages** via Google Translate. The `TranslateWidget` component is in:
- Navbar (desktop + mobile)
- Footer

To add more languages, edit `SUPPORTED_LANGUAGES` in `src/components/ui/TranslateWidget.tsx`.

---

## 🔒 Security

- `legal-docs` bucket is **private** — only accessible via service role key
- Document access is **audit logged** in `document_access_log` table
- Attorney-client privileged documents are flagged separately
- Never commit `.env.local` — it's in `.gitignore`

---

*Built for Oringe Waswa & Associates — Justice. Integrity. Excellence.*

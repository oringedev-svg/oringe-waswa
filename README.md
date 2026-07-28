# Oringe Waswa & Associates — Full-Stack Legal Website

Built with **Next.js 14**, **Supabase**, and **GitHub Models AI** (free), deployable to **Vercel**.

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

### 3. Set Up GitHub Models AI (FREE)
```bash
# Get your free token at https://github.com/settings/tokens
# Classic token, no scopes needed
# Uses SDK: @azure-rest/ai-inference
# Endpoint: https://models.github.ai/inference
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

## 🤖 AI Architecture

Uses **GitHub Models** via `@azure-rest/ai-inference` SDK:

```typescript
import ModelClient, { isUnexpected } from "@azure-rest/ai-inference"
import { AzureKeyCredential } from "@azure/core-auth"

const client = ModelClient(
  "https://models.github.ai/inference",
  new AzureKeyCredential(process.env.GITHUB_TOKEN)
)

const response = await client.path("/chat/completions").post({
  body: {
    model: "openai/gpt-4.1-mini",
    messages: [{ role: "user", content: "..." }],
    max_tokens: 1000,
  }
})
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
│   ├── openai.ts             # GitHub Models AI (Azure REST SDK)
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

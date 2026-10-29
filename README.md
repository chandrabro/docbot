# Ask the Documents

Upload PDFs or text in an admin panel. Visitors ask questions and the AI answers **only** from your documents, or says "I don't know".

- Public chat: `/`
- Admin panel: `/admin` (password protected)

## How it works
1. Admin uploads a PDF/TXT/MD file or pastes text. The text is extracted and saved in Supabase.
2. A visitor asks a question. The server sends **all your document text + the question** to Gemini (about 50 pages fits easily).
3. Gemini must return `found`, `answer` and an exact `quote` from your documents.
4. The server checks that the quote really exists in your documents. If not, the user sees "I don't know". This blocks made-up answers.
5. Repeated questions are served from a cache (no API call). Each visitor is limited to 20 questions per day.

## Setup (about 20 minutes, all free)

### 1. Supabase (database)
1. Create a free project at https://supabase.com
2. SQL Editor -> New query -> paste `supabase/schema.sql` -> Run
3. Project Settings -> API: copy the **Project URL** and the **service_role** key

### 2. Gemini key
Get a free key at https://aistudio.google.com/apikey

(Optional) Get a free Mistral key at https://console.mistral.ai. It is used automatically if Gemini hits its limit.

### 3. GitHub
```
git init
git add .
git commit -m "Document Q&A app"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/YOUR-REPO.git
git push -u origin main
```

### 4. Vercel
1. https://vercel.com -> Add New Project -> import your GitHub repo
2. Before deploying, add the Environment Variables from `.env.example`
   (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `ADMIN_PASSWORD`, `SESSION_SECRET`)
3. Deploy. Open `your-site.vercel.app/admin`, log in, upload your documents.

### Run locally
```
cp .env.example .env.local   # fill in values
npm install
npm run dev                  # http://localhost:3000
```

## Limits and notes
- **File size:** up to 4 MB per upload (Vercel's request limit). For bigger PDFs, split them or paste the text.
- **Scanned PDFs** (pages that are only images) have no text to extract. Paste the text instead, or run OCR first.
- **Free limits:** Gemini's free tier has daily request caps that Google can change. Check your quota in AI Studio. If `GEMINI_MODEL` stops working, set another Flash model name there.
- **Strict mode:** the quote check can say "I don't know" when the AI paraphrased instead of quoting. Set `STRICT_QUOTE_CHECK=false` to loosen it (less safe against made-up answers).
- **Privacy:** the document text is sent to Google (and Mistral if used). Do not upload confidential material on free tiers, since free-tier data may be used to improve the providers' products.
- **Security:** the admin password is checked on the server, the session cookie is signed and expires after 8 hours, and database tables are locked so only the server can read them. Use a long `ADMIN_PASSWORD`.
- **Visitor limit:** it is tracked by IP address. People sharing one network share one allowance.
- If your content grows far beyond ~100 pages, the next step is splitting text into chunks and searching for relevant ones before asking the AI.

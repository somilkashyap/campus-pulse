# Campus Pulse 🎓
> **Never miss a notice again** &mdash; One central, responsive web app for students to track deadlines, notices, and campus events.

---

## 🌟 Overview
Campus Pulse is a lightweight, mobile-first student dashboard built with pure HTML, CSS, and Vanilla JavaScript with Tailwind CSS via CDN. It bridges the gap between chaotic college WhatsApp/Telegram groups, departmental boards, and official circulars by providing instant AI-assisted notice extraction, automatic urgency prioritization, calendar visualization, and an AI-generated weekly digest.

All user data is preserved completely locally on the student's browser (`localStorage`) with zero external database dependencies or tracker cookies.

---

## 🚀 Core Features

### 1. ⚡ Priority & Urgency Status
Every notice automatically computes its urgency relative to the current local date:
- **⚡ Today (Orange)**: Due or happening today.
- **🚨 Urgent (Red)**: Scheduled within the next 48 hours.
- **🗓️ Upcoming (Green)**: Scheduled beyond 48 hours.
- **⏳ Expired (Grey)**: Past events and deadlines.
- **Urgency-based Sorting**: Active notices are automatically prioritized so urgent deadlines stay at the top.
- **Needs Attention Today Banner**: Prominently highlights the daily count (e.g., *"3 things need your attention today"*).
- **Collapsed Past Section**: Expired circulars are tucked into an expandable drawer to keep your main workspace uncluttered.

### 2. 🤖 AI Notice Extraction
- Paste messy, unstructured messages from WhatsApp, Telegram, or email.
- The Vercel serverless function `/api/gemini.js` calls **Google Gemini 2.5 Flash** to extract:
  - Concise title
  - Normalized date (resolving *"kal"*, *"tomorrow"*, *"this Friday"*, etc., using the current date)
  - Time and venue
  - Category (`Academic`, `Event`, `Deadline`, `Club`, `Placement`, `Sports`, `Other`)
- **Editable Preview Card**: Review, modify, or fill missing fields before saving.
- **Duplicate Prevention**: Automatically blocks duplicate notices sharing the same title and date.

### 3. 📋 AI Weekly Digest ("What do I need to know this week?")
- Instant AI breakdown of upcoming deadlines and highlights for the current week.
- Cached automatically in `localStorage` until notices are added, edited, or deleted to prevent redundant API calls.

### 4. 📅 Interactive Month Calendar Grid
- Hand-built vanilla JavaScript month grid (zero third-party calendar libraries).
- Visual status dots on dates with notices (red for urgent, orange for today, green for upcoming, grey for expired).
- Clicking any date displays the notices scheduled for that specific day.
- Fully synchronized with search queries and category filters.

### 5. 🔍 Real-Time Search & Category Filters
- Instant client-side filtering across notice titles, venues, and descriptions.
- Quick category chips: *All, Academic, Event, Deadline, Club, Placement, Sports, Other*.

### 6. 🌙 Dark & Light Mode
- Google-inspired blue accents (`#1a73e8`), rounded-2xl cards, and soft shadows.
- Automatically respects system preference (`prefers-color-scheme`) and persists user preference in `localStorage`.

### 7. 🔒 Storage Cap & Auto-Cleanup
- Capped at **200 notices** in `localStorage`.
- Automatically purges expired notices older than **30 days** on application launch.
- Strict **Content Security Policy (CSP)** meta tag and **zero innerHTML** with user input.

---

## 🛠️ Tech Stack
- **Frontend**: Plain HTML5, CSS3, Vanilla JavaScript (ES6+).
- **Styling**: Tailwind CSS (via CDN) + Custom stylesheet (`style.css`).
- **AI Engine**: Google Gemini 2.5 Flash via Vercel Serverless Function (`/api/gemini.js`).
- **Data Storage**: Client-side `localStorage`.

---

## 💻 Setup & Local Development

### 1. Prerequisites
- A modern web browser (Chrome, Edge, Firefox, Safari).
- (Optional for running serverless functions locally) [Vercel CLI](https://vercel.com/docs/cli) and Node.js (v18+).

### 2. Clone / Open Project
```bash
cd "campus pulse"
```

### 3. Configure Gemini API Key
Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```
Add your Google Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Run Locally
To run the static frontend together with the `/api/gemini.js` serverless function:
```bash
# Using Vercel CLI
vercel dev
```
Open `http://localhost:3000` in your browser.

If you only want to test the frontend offline with preloaded realistic samples, simply open `index.html` directly in your browser.

---

## 🛡️ Security & Privacy
- **Content Security Policy (CSP)**: Configured in `index.html` to prevent cross-site scripting (XSS).
- **Prompt Injection Defense**: Text input to Gemini is isolated as raw passive data with strict system directives.
- **Rate Limiting**: Serverless endpoint enforces a limit of 10 requests/minute per IP.
- **Zero Secret Exposure**: `GEMINI_API_KEY` is strictly accessed within the serverless environment (`process.env.GEMINI_API_KEY`) and is never delivered to the client.
- **Strict DOM Manipulation**: All user and AI texts are rendered exclusively using `textContent` and safe DOM elements, never `innerHTML`.


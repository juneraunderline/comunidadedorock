# Testing Comunidade do Rock

## Architecture
- **Frontend**: React + Vite, deployed on Vercel
- **Backend**: Express.js + SQLite (better-sqlite3), deployed on Render
- **API Config**: `frontend/src/config/api.js` exports `API_URL` using `VITE_API_URL` env var with fallback

## Local Testing Setup

### 1. Start Backend
```bash
cd backend && npm install && node server.js
# Runs on http://localhost:3000
# Auto-creates SQLite tables on startup
# Auto-imports RSS feeds every 60 seconds
```

### 2. Seed Test Data
The backend has no POST /api/posts route for creating posts. Seed data directly via SQLite:
```bash
cd backend && node -e "
const Database = require('better-sqlite3');
const db = new Database('./database.db');
db.prepare('INSERT INTO posts (title, content, image, link, source) VALUES (?, ?, ?, ?, ?)').run('Test Post', 'Content', 'https://via.placeholder.com/300x200', 'https://example.com', 'Test');
db.prepare('INSERT INTO bands (name, genre, city, state, biography, image) VALUES (?, ?, ?, ?, ?, ?)').run('Test Band', 'Rock', 'São Paulo', 'SP', 'Bio', 'https://via.placeholder.com/300x200');
db.prepare('INSERT INTO events (title, artist, date, time, location, city, state) VALUES (?, ?, ?, ?, ?, ?, ?)').run('Test Event', 'Artist', '2026-06-15', '14:00', 'Venue', 'City', 'SP');
db.prepare('INSERT INTO interviews (title, artist, content, image, date) VALUES (?, ?, ?, ?, ?)').run('Test Interview', 'Artist', 'Content', 'https://via.placeholder.com/300x200', '2026-04-01');
"
```

Note: The backend auto-imports RSS feeds on startup, so posts from Rolling Stone Brasil and Rock in Rio News may appear automatically after ~60 seconds.

### 3. Start Frontend
```bash
cd frontend && npm install && VITE_API_URL=http://localhost:3000 npm run dev
# Runs on http://localhost:5173
```

### 4. Admin Login
- URL: http://localhost:5173/admin
- Email: `admin`
- Password: `1234`

## Known Backend Limitations
- **Missing GET /api/interviews route**: The backend `server.js` does not define a GET route for `/api/interviews`. The interviews table exists but there's no endpoint to read from it. This causes 404 errors on the frontend.
- **Render SQLite is ephemeral**: The Render free tier may lose SQLite data on redeploy. Content depends on RSS auto-import running after each deploy.
- **No POST /api/posts route**: Posts can only be created via RSS auto-import or direct SQLite insertion. The Admin panel's post creation might use a route not in the current server.js.

## Vercel Preview Access
- Vercel preview deployments may require SSO login (returns 401). If blocked, test locally instead.
- Production site: https://comunidadedorock.vercel.app/

## Key Pages to Test
| Page | Route | API Endpoint |
|------|-------|--------------|
| Home | `/` | `/api/posts`, `/api/bands`, `/api/interviews` |
| Notícias | `/noticias` | `/api/posts` |
| Bandas | `/bandas` | `/api/bands` |
| Entrevistas | `/entrevistas` | `/api/interviews` |
| Eventos | `/eventos` | `/api/events` |
| Admin | `/admin` | Multiple endpoints |
| Portal RSS | (via Home sidebar) | `/api/rss-feeds` |

## Lint & Build
```bash
cd frontend && npx eslint .  # Has pre-existing warnings/errors
cd frontend && npm run build  # Should succeed
```

## Devin Secrets Needed
No secrets required for local testing. Vercel credentials would be needed to access preview deployments.

# Run Steps

## Prereqs
- Node.js 18+
- npm

## Install dependencies
1) Open PowerShell
2) Run:
   npm --prefix "C:\Users\dell1\Downloads\interview-ai-coach-main\interview-ai-coach-main" install

## Start backend (API)
1) Open a new PowerShell window
2) Run:
   npm --prefix "C:\Users\dell1\Downloads\interview-ai-coach-main\interview-ai-coach-main" run start
3) Confirm:
   http://localhost:3000/api/health

## Start frontend (Vite)
1) Open another PowerShell window
2) Run:
   cd "C:\Users\dell1\Downloads\interview-ai-coach-main\interview-ai-coach-main"
   npx vite --port 5173
3) If 5173 is busy, Vite will pick the next free port (for example 5174)
4) Open the Local URL printed by Vite

## Resume upload flow
1) Open the app in the browser
2) Go to Resume Interview
3) Upload a PDF, DOCX, or TXT (max 8MB)
4) If extraction fails, try a text-based PDF (not image-only)

## Stop servers
- Press Ctrl+C in each terminal

# Interview AI Coach - Tech Stack Explained

This file explains the technologies used in this project, why each is needed, and its main use.

## 1) Core Language and Runtime

### TypeScript
- Need: Helps catch errors during development and improves code quality in a large app.
- Main use: Writing strongly-typed frontend and backend code.

### JavaScript (Node.js ecosystem)
- Need: Server-side logic and tooling around the app are built on Node.
- Main use: Running backend services, scripts, and build tools.

### Python (Transcription service)
- Need: Speech-to-text stack (Whisper ecosystem) is strongest in Python.
- Main use: Real-time audio transcription service.

## 2) Frontend Stack

### React
- Need: Component-based UI for complex interactive screens.
- Main use: Building interview dashboards, meeting UI, and transcript components.

### Vite
- Need: Fast local development and optimized frontend builds.
- Main use: Dev server and production bundling for the React app.

### Next.js (livekit-meeting app)
- Need: Framework features for the dedicated meeting module.
- Main use: Running the LiveKit meeting frontend with routing and optimized React setup.

### React Router
- Need: Multi-page navigation inside SPA sections.
- Main use: Route handling for pages like dashboard and interview views.

## 3) UI and Styling

### Tailwind CSS
- Need: Rapid, consistent styling across many UI screens.
- Main use: Utility-first CSS classes for layout, spacing, and responsive design.

### shadcn/ui + Radix UI
- Need: Accessible, reusable UI primitives without building everything from scratch.
- Main use: Dialogs, tabs, dropdowns, forms, and many base UI controls.

### Lucide React
- Need: Clean icon system for modern UI.
- Main use: Icons in navigation, actions, and status indicators.

### class-variance-authority + clsx + tailwind-merge
- Need: Manage conditional classes cleanly.
- Main use: Building reusable styled components with dynamic variants.

## 4) Forms, Validation, and Data Flow

### React Hook Form
- Need: Performant and scalable form handling.
- Main use: Input state, submission, and form validation flow.

### Zod + @hookform/resolvers
- Need: Reliable runtime schema validation.
- Main use: Validating form inputs and API payloads.

### @tanstack/react-query
- Need: Better async server-state management.
- Main use: Fetching, caching, and syncing API data in the UI.

## 5) Realtime, Video, and Communication

### LiveKit (client + components + server SDK)
- Need: Production-grade video/audio meeting infrastructure.
- Main use: Real-time interview calls and participant media handling.

### Socket.IO / Socket.IO Client
- Need: Event-based, low-latency, bi-directional communication.
- Main use: Signaling and streaming transcript updates.

### ws (WebSocket)
- Need: Direct WebSocket support where needed in backend bridge layers.
- Main use: Bridge communication for transcription pipeline.

### PeerJS
- Need: WebRTC peer connection abstraction in some flows.
- Main use: Browser peer communication support where direct peer logic is used.

## 6) Backend and API Layer

### Express
- Need: Lightweight HTTP server framework.
- Main use: API routes, signaling endpoints, and bridge services.

### CORS
- Need: Secure cross-origin communication between frontend and backend.
- Main use: Allowing browser clients to access backend APIs safely.

### dotenv / python-dotenv
- Need: Environment-based configuration management.
- Main use: Loading keys, endpoints, and runtime settings from .env files.

### multer
- Need: File upload handling.
- Main use: Uploading resumes and related files for parsing.

### uuid
- Need: Unique identifiers for sessions/events.
- Main use: Room/session/message identification.

## 7) AI and Document Processing

### faster-whisper
- Need: Fast and accurate speech-to-text without paid API lock-in.
- Main use: Converting meeting audio streams to transcript text.

### numpy
- Need: Efficient numeric/audio array processing.
- Main use: Audio buffer and signal-related processing in transcription server.

### pdf-parse + pdfjs-dist + pdfkit
- Need: PDF read/write capabilities for resume and report workflows.
- Main use: Extracting text from PDFs and generating PDF outputs.

### mammoth
- Need: DOCX extraction support.
- Main use: Reading resume text from Word documents.

## 8) Testing and Code Quality

### Vitest
- Need: Fast unit/integration testing in Vite ecosystem.
- Main use: Testing frontend logic and utilities.

### Testing Library (React + jest-dom)
- Need: User-centric component testing.
- Main use: Validating UI behavior and rendered output.

### ESLint + typescript-eslint
- Need: Maintain code quality and consistency.
- Main use: Linting TypeScript/JavaScript across the project.

## 9) Build Tooling and CSS Pipeline

### PostCSS + Autoprefixer
- Need: CSS processing and browser compatibility.
- Main use: Transforming CSS and adding vendor prefixes.

### TSX / ts-node / TypeScript compiler
- Need: Running TypeScript backend scripts during development and builds.
- Main use: Dev servers and compiled backend output.

## 10) Deployment and Infrastructure

### Vercel / Netlify / Render (project configs present)
- Need: Cloud deployment options for frontend and backend services.
- Main use: Hosting UI and server components depending on chosen platform.

### Docker (transcription-service and livekit configs)
- Need: Portable, reproducible service runtime.
- Main use: Containerizing transcription and related infrastructure.

### LiveKit server setup (separate configs)
- Need: Real-time media backend and room/session control.
- Main use: Powering multi-user audio/video interview sessions.

## 11) Summary (Simple)

- Frontend UI: React + Vite + Tailwind + shadcn/Radix
- Meeting engine: LiveKit + Socket.IO/WebSocket
- Backend APIs: Node.js + Express + TypeScript
- Transcription AI: Python + faster-whisper
- Resume/document handling: PDF and DOCX parsing libraries
- Testing and quality: Vitest + Testing Library + ESLint
- Deployment: Vercel/Netlify/Render + Docker

This combination is used to build a full interview platform with real-time meetings, live transcription, resume processing, AI-assisted workflows, and production-ready deployment.
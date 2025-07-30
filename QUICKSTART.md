# Audio Tab Capture - Quick Start Guide

## What's Been Implemented

A complete real-time audio tab capture streaming system with:

### ✅ **Backend Server** (`/backend`)
- Express.js server with WebSocket support
- Real-time audio chunk processing and reconstruction  
- File storage system with metadata
- REST API for downloads and session management
- Built with TypeScript and Vite

### ✅ **Chrome Extension** (`/extension`)
- Manifest V3 Chrome extension
- Background service worker for audio capture
- Content script for page interaction
- Popup UI for tab selection and controls
- WebSocket client for real-time streaming
- Audio capture using Web Audio API and MediaRecorder

### ✅ **Shared Types** (`/shared`)
- TypeScript interfaces for audio sessions
- WebSocket message protocols
- Common utilities and constants
- Shared between backend and extension

### ✅ **Development Environment**
- Monorepo workspace structure
- Unified build system with Vite
- Hot reload development
- TypeScript throughout

## How to Use

### 1. Install and Build
```bash
# Clone and install
npm install

# Build all packages
npm run build
```

### 2. Start Backend Server
```bash
# Start development server with hot reload
npm run dev:backend

# Or run production build
cd backend && npm start
```

Server runs on: http://localhost:3001
- Health check: http://localhost:3001/health
- WebSocket: ws://localhost:3001/ws

### 3. Load Chrome Extension
```bash
# Build extension
npm run build:extension
```

Then in Chrome:
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `extension/dist` folder

### 4. Capture Audio
1. Open a tab with audio (YouTube, Spotify, etc.)
2. Click the extension icon
3. Select the audible tab from the popup
4. Click "Record" to start capturing
5. Audio streams in real-time to the backend
6. Click "Stop" to end recording

### 5. Access Recordings
- View sessions: `GET /api/sessions`
- Download audio: `GET /api/sessions/:id/download`
- Session files saved in `backend/storage/`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/sessions` | List all sessions |
| GET | `/api/sessions/:id` | Get session details |
| GET | `/api/sessions/:id/download` | Get download info |
| GET | `/api/files/:filename` | Download audio file |
| DELETE | `/api/sessions/:id` | Delete session |

## Development Commands

```bash
# Development (both backend + extension)
npm run dev

# Build all packages
npm run build

# Individual builds
npm run build:backend
npm run build:extension
npm run build:shared

# Format code
npm run format
```

## Architecture Flow

1. **Extension captures** tab audio using `getDisplayMedia()`
2. **Audio processed** into 1-second chunks via MediaRecorder
3. **Chunks streamed** via WebSocket to backend server
4. **Backend reconstructs** complete audio file
5. **Files stored** with session metadata
6. **Real-time updates** sent back to extension

## File Structure

```
audio-tab-capture/
├── extension/              # Chrome Extension
│   ├── dist/              # Built extension files
│   ├── src/
│   │   ├── background.ts  # Audio capture service worker
│   │   ├── content.ts     # Page interaction script
│   │   └── popup/         # Extension popup UI
│   └── manifest.json     # Extension manifest
├── backend/               # Node.js server
│   ├── dist/             # Built server files
│   ├── src/
│   │   ├── server.ts     # Express server
│   │   ├── websocket.ts  # WebSocket handling
│   │   └── audio/        # Audio processing
│   └── storage/          # Saved audio files
├── shared/               # Shared TypeScript types
│   ├── dist/            # Built types
│   └── src/             # Type definitions
└── package.json         # Workspace root
```

## Features Implemented

✅ Real-time audio capture from any browser tab  
✅ WebSocket streaming of audio chunks  
✅ Session management (start/stop/pause/resume)  
✅ File storage and reconstruction  
✅ REST API for downloads and status  
✅ Chrome extension with intuitive popup UI  
✅ Tab detection and selection  
✅ Progress tracking with file size/duration  
✅ TypeScript throughout with shared types  
✅ Vite build system with hot reload  
✅ Monorepo workspace structure  
✅ Comprehensive documentation  

The project is **production-ready** and provides a complete foundation for audio tab capture applications.
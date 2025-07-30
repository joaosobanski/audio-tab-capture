# Quick Start Guide

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Chrome/Chromium browser

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd audio-tab-capture
```

2. Install dependencies:
```bash
npm install
```

3. Build all packages:
```bash
npm run build
```

## Running the System

### 1. Start the Backend Server

```bash
npm run backend:dev
```

The server will start on:
- HTTP: http://localhost:3000
- WebSocket: ws://localhost:8080

### 2. Access the Web Dashboard

Open your browser and navigate to: http://localhost:3000

### 3. Install the Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `packages/extension/dist` folder
5. The extension will appear in your toolbar

## Using the System

### Capturing Audio from a Tab

1. Open a webpage with audio content (YouTube, Spotify, etc.)
2. Click the Audio Tab Capture extension icon
3. Select the tab you want to capture from the popup
4. The audio stream will appear in the web dashboard
5. Control playback and volume from the dashboard

### Monitoring Sessions

The web dashboard shows:
- Active audio capture sessions
- Real-time connection status
- Server statistics and uptime
- Activity log with timestamps

## API Endpoints

- `GET /api/health` - Server health check
- `GET /api/sessions` - List active sessions
- `GET /api/stats` - Server statistics
- `WebSocket ws://localhost:8080` - Real-time audio streaming

## Development

### File Watching

For development with automatic rebuilds:

```bash
# Terminal 1: Backend with hot reload
npm run backend:dev

# Terminal 2: Web interface with hot reload
npm run web:dev

# Terminal 3: Extension build watch
npm run extension:dev
```

### Project Structure

```
packages/
├── shared/          # Common TypeScript types and utilities
├── backend/         # Node.js server with Express and WebSocket
├── extension/       # Chrome extension (Manifest V3)
└── web/            # React-like web dashboard
```

## Troubleshooting

### Extension Not Working
- Check Chrome developer console for errors
- Ensure the extension has tabCapture permissions
- Verify the backend server is running

### Audio Not Playing
- Check browser audio permissions
- Ensure WebSocket connection is established
- Verify the tab has active audio content

### Connection Issues
- Confirm backend server is running on port 3000
- Check WebSocket server is running on port 8080
- Verify no firewall is blocking the connections
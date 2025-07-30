# Audio Tab Capture

A real-time audio tab capture streaming system that allows you to capture and stream audio from browser tabs with a Chrome extension and Node.js backend.

## Features

- 🎵 **Real-time Audio Capture**: Capture audio from any browser tab
- 🔄 **Live Streaming**: Stream audio chunks to backend server via WebSocket
- 💾 **File Storage**: Automatically save captured audio files
- 🎛️ **Session Management**: Start, stop, pause, and resume recording sessions
- 📱 **Intuitive UI**: Easy-to-use popup interface for tab selection
- 🔍 **Tab Detection**: Automatically detect audible tabs
- 📊 **Progress Tracking**: Real-time file size and duration updates

## Architecture

### Monorepo Structure
```
audio-tab-capture/
├── extension/          # Chrome Extension (Manifest V3)
├── backend/           # Express + WebSocket server
├── shared/            # Shared TypeScript types and utilities
└── package.json       # Workspace root
```

### Technology Stack
- **Frontend**: Chrome Extension API, Web Audio API, WebSocket
- **Backend**: Express.js, WebSocket (ws), TypeScript
- **Build**: Vite, TypeScript, ESLint, Prettier
- **Development**: Concurrently, Hot reload

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm 9+
- Chrome browser

### Installation

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd audio-tab-capture
   npm install
   ```

2. **Build all packages**:
   ```bash
   npm run build
   ```

3. **Start development servers**:
   ```bash
   npm run dev
   ```
   This starts both the backend server (port 3001) and extension build in watch mode.

### Chrome Extension Setup

1. **Build the extension**:
   ```bash
   npm run build:extension
   ```

2. **Load in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension/dist` folder

3. **Grant permissions**:
   - Pin the extension to your toolbar
   - The extension will request tab access and desktop capture permissions

## Usage

### Starting Audio Capture

1. **Start the backend server**:
   ```bash
   npm run dev:backend
   ```

2. **Open the extension popup**:
   - Click the extension icon in Chrome toolbar
   - The popup will show all audible tabs

3. **Start recording**:
   - Click "Record" next to any audible tab
   - Grant screen capture permission when prompted
   - Audio will stream in real-time to the backend

4. **Monitor progress**:
   - View active sessions in the popup
   - See real-time duration and file size updates

5. **Stop recording**:
   - Click "Stop" to end the recording session
   - Audio file will be saved on the backend

### API Endpoints

The backend provides REST API endpoints for managing recordings:

- `GET /api/sessions` - List all sessions
- `GET /api/sessions/:id` - Get session details  
- `GET /api/sessions/:id/download` - Get download info
- `GET /api/files/:filename` - Download audio file
- `DELETE /api/sessions/:id` - Delete session

### WebSocket Protocol

Real-time communication uses WebSocket messages:

- `session_start` - Start new recording session
- `session_stop` - Stop recording session
- `audio_chunk` - Stream audio data chunk
- `status_update` - Session status updates
- `error` - Error notifications

## Development

### Workspace Commands

```bash
# Build all packages
npm run build

# Start development mode (backend + extension watch)
npm run dev

# Build individual packages
npm run build:backend
npm run build:extension  
npm run build:shared

# Code quality
npm run lint
npm run format
npm run format:check
```

### Development Workflow

1. **Backend development**:
   ```bash
   npm run dev:backend
   ```
   Server runs on http://localhost:3001 with hot reload

2. **Extension development**:
   ```bash
   npm run dev:extension
   ```
   Builds extension in watch mode, reload extension in Chrome after changes

3. **Shared types**:
   ```bash
   cd shared
   npm run dev
   ```
   TypeScript compilation in watch mode

### Project Structure

```
├── extension/
│   ├── src/
│   │   ├── background.ts      # Service worker for audio capture
│   │   ├── content.ts         # Content script for page interaction
│   │   └── popup/
│   │       ├── popup.html     # Extension popup UI
│   │       └── popup.ts       # Popup logic and tab management
│   ├── manifest.json          # Extension manifest (V3)
│   └── vite.config.ts
├── backend/
│   ├── src/
│   │   ├── server.ts          # Express server setup
│   │   ├── websocket.ts       # WebSocket message handling
│   │   └── audio/
│   │       └── processor.ts   # Audio chunk processing
│   └── vite.config.ts
├── shared/
│   └── src/
│       ├── types.ts           # TypeScript type definitions
│       ├── utils.ts           # Shared utilities
│       └── index.ts
└── package.json               # Workspace configuration
```

## Audio Processing Flow

1. **Capture**: Extension uses `getDisplayMedia()` to capture tab audio
2. **Chunking**: Audio split into 1-second chunks via MediaRecorder
3. **Streaming**: Chunks sent to backend via WebSocket in real-time
4. **Processing**: Backend reconstructs and saves complete audio file
5. **Storage**: Files saved with metadata for later download

## Configuration

### Environment Variables

Backend supports these environment variables:
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment mode (development/production)

### Extension Permissions

Required Chrome permissions:
- `tabs` - Access tab information
- `activeTab` - Access active tab details
- `desktopCapture` - Capture tab audio
- `storage` - Store extension data

## Troubleshooting

### Common Issues

1. **No audible tabs detected**:
   - Ensure tab is actually playing audio
   - Refresh the page if needed
   - Check browser audio settings

2. **Permission denied errors**:
   - Grant screen capture permission when prompted
   - Check Chrome extension permissions
   - Reload extension if needed

3. **WebSocket connection failed**:
   - Ensure backend server is running
   - Check firewall settings
   - Verify port 3001 is accessible

4. **Build errors**:
   - Run `npm install` to ensure dependencies
   - Clear node_modules and reinstall if needed
   - Check Node.js version (18+ required)

### Debug Mode

Enable debugging:
1. Open Chrome DevTools
2. Go to Extension popup and inspect
3. Check console for error messages
4. Monitor WebSocket traffic in Network tab

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

For development questions or issues, please open a GitHub issue.

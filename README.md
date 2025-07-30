# Audio Tab Capture

A complete streaming project for capturing audio from browser tabs and streaming it to a backend in real-time.

## Project Overview

This is a monorepo project that includes:
1. **Browser Extension** (TypeScript + Manifest V3) - Captures audio from browser tabs
2. **Backend API** (Express + WebSocket + TypeScript) - Processes and stores audio streams
3. **Shared Types** package - Common TypeScript interfaces and utilities

## Features

### Browser Extension
- 🎯 Manifest V3 configuration for Chrome/Edge compatibility
- 🎵 Web Audio API integration for tab audio capture
- 🔌 WebSocket client for real-time streaming to backend
- 🖥️ Popup UI with tab selection and recording controls
- ⚡ Audio chunking system (1-2 second chunks for optimal streaming)
- 🔄 Background script for managing audio capture sessions
- 💡 Content script for page interaction and visual feedback

### Backend Features
- 🚀 Express server with WebSocket support for real-time communication
- 🎬 Audio chunk processing and reconstruction into complete files
- 💾 File storage system for completed recordings with metadata
- 📡 Real-time status updates to extension clients
- 🔒 CORS configuration for extension communication
- 💪 Health monitoring and connection management
- 📥 Recording download endpoints

### Technical Capabilities
- Multiple audio format support (WebM, MP3, WAV)
- Quality settings (low, medium, high)
- Configurable chunk duration (1-2 seconds)
- Maximum recording duration limits
- Real-time progress tracking
- Session management and recovery

## Project Structure

```
audio-tab-capture/
├── package.json              # Workspace root with scripts
├── README.md                 # This file
├── extension/                # Browser Extension
│   ├── package.json
│   ├── manifest.json        # Manifest V3 configuration
│   ├── vite.*.config.ts     # Build configurations
│   ├── tsconfig.json
│   └── src/
│       ├── background.ts    # Service worker
│       ├── content.ts       # Content script
│       └── popup/
│           ├── popup.html   # UI interface
│           └── popup.ts     # Popup logic
├── backend/                 # Backend API
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts        # Express app
│       ├── websocket.ts     # WebSocket manager
│       └── audio/
│           └── processor.ts # Audio processing
└── shared/                  # Shared Types
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── types.ts         # TypeScript interfaces
        ├── utils.ts         # Shared utilities
        └── index.ts         # Exports
```

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Chrome/Edge browser for extension development

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd audio-tab-capture
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build all packages**
   ```bash
   npm run build
   ```

### Development

#### Start the backend server
```bash
npm run dev:backend
```
The backend will be available at `http://localhost:3001`

#### Build the extension for development
```bash
npm run dev:extension
```

#### Or run both simultaneously
```bash
npm run dev
```

### Load Extension in Browser

1. Open Chrome/Edge and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/dist` folder
5. The extension should now appear in your browser

## How to Use

### Setting up Audio Capture

1. **Start the Backend**
   ```bash
   npm run dev:backend
   ```

2. **Load the Extension** in your browser

3. **Open a tab with audio** (YouTube, Spotify, etc.)

4. **Click the extension icon** to open the popup

5. **Connect to Backend** by clicking the "Connect" button

6. **Select a tab** from the list (tabs with audio are highlighted)

7. **Choose recording settings** (format, quality)

8. **Start Recording** and the audio will be streamed to the backend

### API Endpoints

- `GET /health` - Health check endpoint
- `GET /api/sessions` - List recording sessions
- `GET /api/sessions/:sessionId/download` - Download recording
- `DELETE /api/sessions/:sessionId` - Delete recording
- `WebSocket /ws` - Real-time audio streaming

### WebSocket Protocol

The extension communicates with the backend using WebSocket messages:

- **Control Messages**: Start/stop/pause recording
- **Audio Chunks**: Binary audio data with metadata
- **Status Updates**: Recording progress and state changes
- **Error Handling**: Connection issues and recovery

## Development Scripts

### Root Package
- `npm run dev` - Start both backend and extension development
- `npm run build` - Build all packages
- `npm run build:backend` - Build backend only
- `npm run build:extension` - Build extension only
- `npm run build:shared` - Build shared package only
- `npm run lint` - Lint all packages
- `npm run clean` - Clean all build artifacts

### Backend Package
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server

### Extension Package
- `npm run build` - Build extension for production
- `npm run dev` - Build extension for development
- `npm run clean` - Clean dist folder

## Audio Streaming Flow

1. **Extension captures tab audio** using `getDisplayMedia()` API with audio enabled
2. **MediaRecorder processes audio** into timed chunks using Web Audio API
3. **Audio chunks are sent via WebSocket** to backend with sequence metadata
4. **Backend receives chunks**, buffers them, and reconstructs complete audio
5. **Completed recordings are saved** to disk with session metadata
6. **Real-time status updates** are sent back to extension

## Configuration

### Recording Settings
- **Format**: WebM (Opus/Vorbis), MP4 (AAC)
- **Quality**: Low (64kbps), Medium (128kbps), High (256kbps)
- **Chunk Duration**: 1-5 seconds (default: 1.5s)
- **Max Duration**: Up to 2 hours per session

### Backend Configuration
Environment variables:
- `PORT` - Server port (default: 3001)
- `RECORDINGS_DIR` - Directory for storing recordings (default: ./recordings)

## Security & Performance

- ✅ Manifest V3 security compliance
- ✅ CORS configuration for extension communication
- ✅ File size limits and validation
- ✅ Memory-efficient chunk processing
- ✅ WebSocket connection pooling
- ✅ Graceful error handling and recovery

## Browser Compatibility

- ✅ Chrome 88+
- ✅ Edge 88+
- ⚠️ Firefox (Manifest V2 compatibility would need to be added)
- ❌ Safari (WebExtensions API limitations)

## Troubleshooting

### Common Issues

1. **Extension not loading**
   - Make sure you've built the extension: `npm run build:extension`
   - Check that all files are in `extension/dist/`

2. **Backend connection failed**
   - Ensure backend is running on port 3001
   - Check CORS configuration for your domain

3. **Audio capture not working**
   - Make sure you've granted necessary permissions
   - Check that the tab actually has audio playing

4. **Build errors**
   - Run `npm install` to ensure all dependencies are installed
   - Try `npm run clean` followed by `npm run build`

### Development Tips

- Use browser developer tools to debug the extension
- Check the browser console for error messages
- Monitor WebSocket connections in Network tab
- Use the backend health endpoint to verify connectivity

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Architecture Decisions

### Why Manifest V3?
- Future-proof extension development
- Enhanced security model
- Required for Chrome Web Store

### Why WebSocket for Streaming?
- Real-time bidirectional communication
- Low latency for audio streaming
- Better than polling for status updates

### Why Monorepo Structure?
- Shared TypeScript types between packages
- Simplified dependency management
- Coordinated versioning and releases

### Why Vite for Building?
- Fast development builds
- Modern JavaScript/TypeScript support
- Easy configuration for multiple entry points

#!/bin/bash
# Build script for Chrome extension

# Build TypeScript files
npm run build

# Copy static files
cp manifest.json dist/
cp src/popup/popup.html dist/
cp src/popup/popup.css dist/

echo "Extension build complete!"
# Timesheet Chrome Extension

A Chrome extension that displays a React application for tracking one's work. Created with the help of Cursor.

## Installation

1. Install dependencies:

```bash
npm install
```

2. Add env vars with a `.env` file

3. Host the backend on Vercel and connect a MongoDB instance with the MONGODB_URI variable

4. Build the extension:

```bash
npm run build
```

5. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked"
   - Select the `timesheet-extension` folder

## Development

To run in development mode with auto-rebuild:

```bash
npm run dev
```

## Project Structure

```
timesheet-extension/
├── manifest.json          # Chrome extension manifest
├── popup.html            # Popup HTML file
├── popup.js              # Built React app (generated)
├── src/
│   ├── popup.js          # React entry point
│   ├── App.js            # Main React component
│   └── App.css           # Component styles
├── webpack.config.js     # Webpack configuration
└── package.json          # Dependencies and scripts
```

## Usage

After loading the extension:

1. Click the extension icon in your Chrome toolbar
2. A 500px x 500px popup will appear with the React app
3. Click the "Click me!" button to see an alert

## Building for Production

```bash
npm run build
```

This will create the `popup.js` file that contains the bundled React application.

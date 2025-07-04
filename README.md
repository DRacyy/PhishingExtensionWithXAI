# ShieldScan Extension

A browser extension for scanning and protecting against unsafe websites.

## Project Structure

```
├── assets/               # Static assets
│   ├── images/           # Image files
│   ├── icons/            # Icon files
│   └── fonts/            # Font files
├── src/                  # Source code
│   ├── popup/            # Popup UI files
│   ├── background/       # Background service files
│   ├── content/          # Content scripts
│   ├── pages/            # Main HTML pages
│   ├── components/       # Reusable UI components
│   ├── styles/           # CSS files
│   └── utils/            # Utility functions
├── dist/                 # Build output
├── docs/                 # Documentation
├── Schema/               # Database schema
├── back_end/             # Backend code
└── old versions/         # Archived code
```

## Development

To build the CSS:

```bash
npm run build:css
```

## Files

- `manifest.json`: Extension manifest
- `package.json`: Node.js dependencies
- `tailwind.config.js`: TailwindCSS configuration
- `postcss.config.js`: PostCSS configuration 
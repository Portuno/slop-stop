# Stop-Slop Chrome Extension

A community-driven curation layer that identifies and hides "Slop" content on Twitter, YouTube, LinkedIn, and the entire internet.

## Features

- **Community-Driven Reporting**: Users can report low-quality filler content
- **Platform Support**: Works on Twitter/X, YouTube, LinkedIn, and any website
- **Native UI**: Slop content is hidden with a native-looking overlay similar to Twitter's sensitive content warnings
- **Hotkey Support**:
  - `Alt + S`: Activate trash cursor mode to quickly report items
  - `Alt + U`: Report entire website as slop
- **Anonymous Reporting**: Uses deterministic reporter hash to prevent double-voting while maintaining privacy
- **Ghost Container Strategy**: Prevents layout collapse on YouTube and other grid-based platforms

## Setup

### Prerequisites

- Node.js 18+ and npm
- Chrome browser
- Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Slop-Stop
```

2. Install dependencies:
```bash
npm install
```

3. Set up Supabase:
   - Create a new Supabase project
   - Run the SQL migrations in the `supabase/` directory:
     - `01_create_slop_reports_table.sql`
     - `02_create_report_slop_rpc.sql`
     - `03_create_get_slop_status_rpc.sql`

4. Configure Supabase credentials:
   
   Create a `.env.local` file in the project root (optional, for convenience):
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

   Or set environment variables directly:
```bash
# Windows (PowerShell)
$env:SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_ANON_KEY="your-anon-key"

# Linux/Mac
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_ANON_KEY=your-anon-key
```

5. Build the extension:
```bash
npm run build
```

6. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` directory

7. Configure settings (optional):
   - Click the extension icon
   - Set your report limit threshold (default: 5)

## Deploy/Update Extension (Clear Cache)

When you update the extension or encounter issues with changes that don't reflect, follow these steps to completely clear the cache:

### Method 1: Reload with Complete Cleanup (Recommended)

1. **Open the extensions page:**
   - Navigate to `chrome://extensions/` (or `edge://extensions/` in Edge)
   - Make sure "Developer mode" is enabled

2. **Remove the old extension:**
   - Find "Stop-Slop" in the extensions list
   - Click the "Remove" button (🗑️)
   - Confirm the removal

3. **Clear browser cache (optional but recommended):**
   - Press `Ctrl + Shift + Delete` (or `Cmd + Shift + Delete` on Mac)
   - Select "Cached images and files"
   - Choose "Last hour" or "All time"
   - Click "Clear data"

4. **Rebuild the extension:**
   ```bash
   npm run build
   ```

5. **Reload the extension:**
   - In `chrome://extensions/`, click "Load unpacked"
   - Select the `dist/` folder

### Method 2: Quick Reload (For development)

If you only made minor changes and want to reload quickly:

1. **Rebuild the extension:**
   ```bash
   npm run build
   ```

2. **Reload the extension:**
   - Go to `chrome://extensions/`
   - Find "Stop-Slop"
   - Click the reload icon (🔄) next to the extension

3. **Reload active tabs:**
   - If you have tabs open for Twitter/X, YouTube, LinkedIn, etc.
   - Reload them manually (`F5` or `Ctrl + R`) for changes to take effect

### Method 3: Deep Cleanup (If problems persist)

If after the previous methods you still have problems:

1. **Remove the extension** (step 2 of Method 1)

2. **Clear extension storage:**
   - Open developer tools (`F12`)
   - Go to the "Application" tab
   - In the left panel, expand "Storage" → "Local Storage"
   - Find and delete any entries related to `chrome-extension://[your-extension-id]`
   - Do the same for "Session Storage"

3. **Clear chrome.storage (if necessary):**
   - Open the extension console (in `chrome://extensions/`, click "service worker" or "inspect views: service worker")
   - Run in the console:
     ```javascript
     chrome.storage.sync.clear();
     chrome.storage.local.clear();
     ```

4. **Rebuild and reload** (steps 4-5 of Method 1)

### Verify that changes were applied

After reloading:

1. **Check the version:**
   - In `chrome://extensions/`, verify that the extension shows the correct version
   - Check the "Last updated" date

2. **Test in a new tab:**
   - Open a new tab with Twitter/X, YouTube or LinkedIn
   - Verify that changes work correctly

3. **Check the console:**
   - Open developer tools (`F12`)
   - Go to the "Console" tab
   - Look for `[Slop-Stop]` messages to verify the extension loaded correctly

### Important Notes

- **Always rebuild** (`npm run build`) before reloading the extension
- Changes to `manifest.json` require removing and completely reloading the extension
- Changes to content scripts may require reloading the tabs where they run
- Changes to the service worker require completely reloading the extension

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run dev
```

### Type Check

```bash
npm run type-check
```

## Architecture

### Folder Structure

```
src/
├── background/          # Service worker (Manifest V3)
│   ├── service-worker.ts
│   ├── supabase-client.ts
│   ├── reporter-hash.ts
│   └── message-handler.ts
├── content/             # Content scripts
│   ├── content-main.ts
│   ├── slop-curtain.tsx
│   ├── confirmation-modal.tsx
│   ├── hotkeys.ts
│   └── content.css
├── adapters/            # Platform-specific adapters
│   ├── adapter-interface.ts
│   ├── twitter-adapter.ts
│   ├── youtube-adapter.ts
│   ├── linkedin-adapter.ts
│   └── website-adapter.ts
└── shared/              # Shared utilities
    ├── types.ts
    ├── constants.ts
    └── utils.ts
```

### Key Components

- **Service Worker**: Handles Supabase communication, reporter hash management, and message routing
- **Content Scripts**: Detect and hide slop content, handle user interactions
- **Platform Adapters**: Abstract platform-specific logic (selectors, ID extraction, ghost containers)
- **Slop Curtain**: Native-looking overlay UI for hidden content

## Usage

### Reporting Content

1. **Quick Report (Trash Icon)**: Hover over any post/video and click the trash icon
2. **Alt + S Mode**: Press `Alt + S` to activate trash cursor, then click any item to report
3. **Report Website**: Press `Alt + U` to report the entire website

### Viewing Hidden Content

Click the "Show" button on any slop curtain overlay to temporarily reveal the content (5 seconds).

## Configuration

### Build-Time Configuration

Supabase credentials are configured at build time via environment variables:
- `SUPABASE_URL`: Your Supabase project URL (required)
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key (required)

### Runtime Settings

Settings are stored in `chrome.storage.sync` and include:

- `reportLimitThreshold`: Number of reports needed to block a website (default: 5, configurable via popup)

## Database Schema

The extension uses a single `slop_reports` table:

- `id`: UUID primary key
- `item_id`: Platform-specific identifier
- `platform`: One of 'twitter', 'youtube', 'linkedin', 'website'
- `reporter_hash`: Anonymous reporter identifier
- `created_at`: Timestamp

## License

[Your License Here]

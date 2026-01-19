# Stop-Slop Chrome Extension

A community-driven curation layer that identifies and hides "Slop" content on Twitter, YouTube, LinkedIn, and the entire internet.

## Features

- **Community-Driven Reporting**: Users can report low-quality, AI-generated filler content
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

## Desplegar/Actualizar la Extensión (Limpiar Caché)

Cuando actualices la extensión o encuentres problemas con cambios que no se reflejan, sigue estos pasos para limpiar completamente la caché:

### Método 1: Recarga con Limpieza Completa (Recomendado)

1. **Abre la página de extensiones:**
   - Navega a `chrome://extensions/` (o `edge://extensions/` en Edge)
   - Asegúrate de que "Modo de desarrollador" esté activado

2. **Elimina la extensión antigua:**
   - Busca "Stop-Slop" en la lista de extensiones
   - Haz clic en el botón "Eliminar" (🗑️)
   - Confirma la eliminación

3. **Limpia la caché del navegador (opcional pero recomendado):**
   - Presiona `Ctrl + Shift + Delete` (o `Cmd + Shift + Delete` en Mac)
   - Selecciona "Caché de imágenes y archivos"
   - Elige "Última hora" o "Todo el tiempo"
   - Haz clic en "Borrar datos"

4. **Reconstruye la extensión:**
   ```bash
   npm run build
   ```

5. **Recarga la extensión:**
   - En `chrome://extensions/`, haz clic en "Cargar extensión sin empaquetar"
   - Selecciona la carpeta `dist/`

### Método 2: Recarga Rápida (Para desarrollo)

Si solo hiciste cambios menores y quieres recargar rápidamente:

1. **Reconstruye la extensión:**
   ```bash
   npm run build
   ```

2. **Recarga la extensión:**
   - Ve a `chrome://extensions/`
   - Encuentra "Stop-Slop"
   - Haz clic en el ícono de recarga (🔄) junto a la extensión

3. **Recarga las pestañas activas:**
   - Si tienes pestañas abiertas de Twitter/X, YouTube, LinkedIn, etc.
   - Recárgalas manualmente (`F5` o `Ctrl + R`) para que los cambios surtan efecto

### Método 3: Limpieza Profunda (Si persisten problemas)

Si después de los métodos anteriores aún hay problemas:

1. **Elimina la extensión** (paso 2 del Método 1)

2. **Limpia el almacenamiento de la extensión:**
   - Abre las herramientas de desarrollador (`F12`)
   - Ve a la pestaña "Application" (o "Aplicación")
   - En el panel izquierdo, expande "Storage" → "Local Storage"
   - Busca y elimina cualquier entrada relacionada con `chrome-extension://[ID-de-tu-extensión]`
   - Haz lo mismo para "Session Storage"

3. **Limpia chrome.storage (si es necesario):**
   - Abre la consola de la extensión (en `chrome://extensions/`, haz clic en "service worker" o "inspeccionar vistas: service worker")
   - Ejecuta en la consola:
     ```javascript
     chrome.storage.sync.clear();
     chrome.storage.local.clear();
     ```

4. **Reconstruye y recarga** (pasos 4-5 del Método 1)

### Verificar que los cambios se aplicaron

Después de recargar:

1. **Verifica la versión:**
   - En `chrome://extensions/`, verifica que la extensión muestra la versión correcta
   - Revisa la fecha de "Última actualización"

2. **Prueba en una pestaña nueva:**
   - Abre una nueva pestaña con Twitter/X, YouTube o LinkedIn
   - Verifica que los cambios funcionan correctamente

3. **Revisa la consola:**
   - Abre las herramientas de desarrollador (`F12`)
   - Ve a la pestaña "Console"
   - Busca mensajes de `[Slop-Stop]` para verificar que la extensión se cargó correctamente

### Notas Importantes

- **Siempre reconstruye** (`npm run build`) antes de recargar la extensión
- Los cambios en el `manifest.json` requieren eliminar y recargar completamente la extensión
- Los cambios en content scripts pueden requerir recargar las pestañas donde se ejecutan
- Los cambios en el service worker requieren recargar la extensión completamente

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

# MicrobeTrace Integration for MAAGE-Web

This document describes the integration of [MicrobeTrace](https://github.com/CDCgov/MicrobeTrace), the CDC's molecular epidemiology visualization tool, into the MAAGE-Web platform.

## Overview

MicrobeTrace is an open-source tool developed by the CDC for visualizing and analyzing molecular epidemiology data. It supports network visualization, phylogenetic trees, geographic mapping, and more. This integration allows MAAGE users to open workspace files directly in MicrobeTrace from the workspace browser.

## Supported File Types

The following file types can be opened in MicrobeTrace:

| Extension | Description |
|-----------|-------------|
| `.fasta`, `.fa`, `.fna`, `.faa` | FASTA sequence files |
| `.csv` | Comma-separated values (node/link data) |
| `.tsv` | Tab-separated values (node/link data) |
| `.nwk`, `.newick` | Newick phylogenetic tree files |
| `.microbetrace` | MicrobeTrace session files |

## How to Use

### Opening a File in MicrobeTrace

1. Navigate to a compatible file in the MAAGE workspace browser
2. Select the file
3. Click the **MicrobeTrace** action button (network icon) in the action panel
4. A landing page will appear showing file information
5. Click **"Open in MicrobeTrace"**
6. MicrobeTrace will open in a new browser tab with your file loaded

### What Happens Behind the Scenes

1. The file content is fetched from the workspace using authenticated API calls
2. The file type is automatically detected based on extension and content
3. A secure handoff is initiated using MicrobeTrace's partner handoff system
4. The file data is passed to MicrobeTrace via postMessage
5. MicrobeTrace validates and loads the data

## Architecture

### Components

```
MAGE-Web
├── public/js/p3/widget/viewer/MicrobeTrace.js    # Viewer widget
├── public/js/p3/widget/WorkspaceBrowser.js       # Action button
├── routes/microbetrace.js                         # Express route
├── public/microbetrace/                           # Built MicrobeTrace app
│   └── assets/embed/
│       ├── receiver.html                          # Handoff receiver
│       └── partner-allowlist.json                 # Allowed origins
└── microbetrace-src/                              # MicrobeTrace source (git submodule)
```

### Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Workspace      │     │  MicrobeTrace   │     │  MicrobeTrace   │
│  Browser        │────▶│  Viewer Widget  │────▶│  Receiver       │
│  (select file)  │     │  (landing page) │     │  (receiver.html)│
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │  MicrobeTrace   │
                                                │  Application    │
                                                │  (new tab)      │
                                                └─────────────────┘
```

### Security

The integration uses MicrobeTrace's official partner handoff system which includes:

- **Origin Validation**: Only approved origins can send data
- **Payload Validation**: File contents are sanitized and validated
- **Size Limits**: Maximum 10 files, 20MB per file, 50MB total
- **Expiration**: Handoffs expire after 15 minutes
- **Blocked Content**: HTML, SVG, and script payloads are rejected

## Configuration

### Partner Allowlist

MAGE origins are configured in `public/microbetrace/assets/embed/partner-allowlist.json`:

```json
{
  "partners": {
    "maage": {
      "origins": [
        "http://localhost:3000",
        "https://localhost:3000",
        "https://www.maage.org",
        "https://maage.org"
      ]
    }
  }
}
```

To add additional origins (e.g., for development or staging environments), add them to the `maage.origins` array in both:
- `public/microbetrace/assets/embed/partner-allowlist.json` (built assets)
- `microbetrace-src/src/assets/embed/partner-allowlist.json` (source)

### Building MicrobeTrace

MicrobeTrace is included as a git submodule. To rebuild:

```bash
npm run build:microbetrace
```

This will:
1. Install MicrobeTrace dependencies
2. Build the Angular application with `--base-href /microbetrace/`
3. Copy the built files to `public/microbetrace/`

## File Type Detection

The viewer automatically detects file types using:

1. **File Extension**: Primary method for known extensions
2. **Content Analysis**: Fallback for ambiguous files
   - FASTA: Starts with `>`
   - Newick: Starts with `(` and ends with `;`
   - Auspice JSON: Contains `meta` and `tree` properties
3. **Filename Hints**: Keywords like "matrix", "node", "link" help identify CSV/TSV purpose

## Troubleshooting

### "Object not found" Error

- Verify the file exists in the workspace
- Check that you have permission to access the file
- Ensure you are authenticated (valid token)

### "HTML, SVG, and script-like payloads are not allowed"

- The file content appears to be HTML, not the expected format
- This usually indicates an authentication issue where a login page was returned
- Try refreshing the page and re-authenticating

### "The calling origin is not approved"

- The current domain is not in the partner allowlist
- Add the origin to `partner-allowlist.json` (see Configuration above)

### MicrobeTrace Opens But Data Doesn't Load

- Check the browser console for errors
- Verify the handoff completed successfully (look for "stored" message)
- Try clearing browser storage and retrying

## Development

### Modifying the Viewer Widget

The viewer is located at `public/js/p3/widget/viewer/MicrobeTrace.js`. Key methods:

- `_setStateAttr`: Handles URL-based navigation
- `_loadFileInfo`: Fetches file content from workspace
- `_showLandingPage`: Renders the landing page UI
- `_openInMicrobeTrace`: Initiates the handoff to MicrobeTrace
- `_inferFileKind`: Detects file type for MicrobeTrace

### Adding New File Types

1. Add the file type to `validTypes` in `WorkspaceBrowser.js` action definition
2. Add the extension to `supportedTypes` in `MicrobeTrace.js`
3. Update `_inferFileKind` if special detection logic is needed
4. Update `_getFileTypeLabel` and `_getIconForFileType` for UI

## Design Decisions: Iframe vs New Tab

### Initial Approach: Embedded Iframe

The original implementation plan called for embedding MicrobeTrace in an iframe within the MAAGE workspace, similar to how other viewers work. This would have provided a seamless experience where users could view their data in MicrobeTrace without leaving the MAAGE interface.

#### Why Iframe Embedding Failed

Several attempts were made to embed MicrobeTrace in an iframe:

1. **Direct IndexedDB Access**: We tried storing handoff data in IndexedDB from the parent MAAGE page and having the iframe read it. The write operations appeared to succeed (transactions completed, verification reads worked), but the data was not visible to the iframe.

2. **localforage Compatibility**: MicrobeTrace uses `localforage` (an IndexedDB wrapper) for storage. We attempted to write directly to the same IndexedDB database (`localforage`) and object store (`keyvaluepairs`) that MicrobeTrace uses. Despite successful writes from the parent page, the iframe could not see the data.

3. **Cross-Context Storage Isolation**: The root cause appears to be browser storage isolation between different browsing contexts. Even though the parent page and iframe are on the same origin, IndexedDB operations from the parent page may not be immediately visible to a newly-loaded iframe, or there may be separate database connections that don't share uncommitted data.

4. **Timing Issues**: We tried adding delays, verification steps, and multiple write attempts. None resolved the fundamental isolation issue.

5. **AMD Module Conflicts**: MicrobeTrace's bundled `localforage` conflicted with Dojo's AMD module system, causing `localforage` to be loaded as an AMD module rather than using IndexedDB.

#### The Working Solution: New Tab with Partner Handoff

The successful approach uses MicrobeTrace's official **partner handoff system**:

1. Open MicrobeTrace's `receiver.html` in a new tab
2. The receiver signals readiness via `postMessage`
3. MAAGE sends the file data via `postMessage`
4. The receiver (running in its own context) stores the data in localforage
5. The receiver redirects to the main MicrobeTrace app with a handoff ID
6. MicrobeTrace loads the data from localforage (same context, no isolation issues)

This works because the storage write happens within MicrobeTrace's own browsing context, avoiding the cross-context isolation problem entirely.

### Future Possibilities: Embedded Iframe

Now that the new-tab approach is working, there are potential paths to re-enable iframe embedding:

#### Option 1: Modify MicrobeTrace to Accept postMessage Data

Add a message listener to MicrobeTrace that accepts file data directly:

```javascript
// In MicrobeTrace (maage-bridge.service.ts or similar)
window.addEventListener('message', (event) => {
  if (event.data?.source === 'maage' && event.data?.type === 'LOAD_DATA') {
    // Load the file data directly, bypassing localforage
    this.loadFilesDirectly(event.data.files);
  }
});
```

This would require:
- Modifications to MicrobeTrace source code
- A custom Angular service to handle MAAGE messages
- Rebuilding MicrobeTrace with the changes

#### Option 2: Use the Receiver as an Intermediary

Load `receiver.html` in a hidden iframe first, let it store the data, then load the main MicrobeTrace app:

```javascript
// 1. Create hidden iframe to receiver.html
// 2. Send data via postMessage
// 3. Wait for "stored" confirmation
// 4. Replace iframe src with main MicrobeTrace app + handoff param
```

This might work because:
- The receiver iframe stores data in its context
- When we load MicrobeTrace in the same iframe, it inherits the storage context
- The handoff data should be visible

#### Option 3: Shared Worker or BroadcastChannel

Use a SharedWorker or BroadcastChannel API for cross-context communication:

```javascript
// Parent page
const channel = new BroadcastChannel('maage-microbetrace');
channel.postMessage({ type: 'HANDOFF', data: handoffRecord });

// MicrobeTrace (would need modification)
const channel = new BroadcastChannel('maage-microbetrace');
channel.onmessage = (event) => {
  if (event.data.type === 'HANDOFF') {
    // Store and process
  }
};
```

#### Option 4: URL-Based Data Transfer

For smaller files, encode the data in the URL:

```javascript
// Compress and base64 encode
const compressed = pako.deflate(fileContent);
const encoded = btoa(String.fromCharCode(...compressed));
const url = `/microbetrace/?data=${encoded}&kind=newick`;
```

Limitations:
- URL length limits (~2KB safe, ~8KB maximum depending on browser)
- Only suitable for small files
- Would require MicrobeTrace modification to handle `data` parameter

### Recommendation

The current new-tab approach is robust and uses MicrobeTrace's official integration mechanism. For most use cases, this provides a good user experience.

If embedded iframe support becomes a priority, **Option 2** (receiver intermediary) is the most promising because:
- It doesn't require MicrobeTrace source modifications
- It uses the existing, tested handoff mechanism
- It should work within the same browsing context

However, this would need testing to confirm that iframe context switching preserves localforage data.

## References

- [MicrobeTrace GitHub Repository](https://github.com/CDCgov/MicrobeTrace)
- [MicrobeTrace Wiki - Partner Integration](https://github.com/CDCgov/MicrobeTrace/wiki/zForDevelopers-%E2%80%93-Assimilating-MicrobeTrace)
- [MicrobeTrace Embed API](https://github.com/CDCgov/MicrobeTrace/wiki/zForDevelopers-%E2%80%93-API)

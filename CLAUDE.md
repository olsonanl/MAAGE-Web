# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MAAGE-Web (Midwest Alliance for Applied Genomic Epidemiology) is a genomic surveillance platform web application built on the PATRIC/BV-BRC codebase. It's an Express.js server-rendered application using EJS templates with a Dojo-based frontend.

## Requirements

- Node.js v18.x or newer
- NPM v9.x or newer

## Common Commands

```bash
# Install dependencies
npm install

# Initialize git submodules (required for frontend JS libraries)
git submodule update --init

# Start development server (runs on http://localhost:3000)
npm start

# Build Tailwind CSS
npm run tw:build

# Build minified Tailwind CSS
npm run tw:build:min

# Watch Tailwind CSS for changes during development
npm run tw:watch
```

## Architecture

### Server-Side (Express.js)

- **Entry point**: `bin/p3-web` - starts the HTTP/HTTPS server
- **Main app**: `app.js` - Express application setup, middleware, and route mounting
- **Configuration**: `config.js` loads settings from `p3-web.conf` (copy from `p3-web.sample.conf`)
- **Routes**: `routes/` - Express routers for different endpoints (viewers, search, workspace, apps, etc.)
- **Views**: `views/` - EJS templates; uses partials like `navbar.ejs`, `footer.ejs`, `head.ejs`

### Client-Side (Dojo Framework)

- **Core application**: `public/js/p3/app/p3app.js` - main Dojo application
- **Widgets**: `public/js/p3/widget/` - Dojo widgets (~280+ widgets for different features)
- **Data stores**: `public/js/p3/store/` - data stores for API interaction
- **Resources**: `public/js/p3/resources/` - shared resources
- **Router**: `public/js/p3/router.js` - client-side routing

### Frontend Dependencies (Git Submodules)

The `public/js/` directory contains many git submodules including:
- Dojo framework (`dojo`, `dijit`, `dojox`)
- `dgrid` for data grids
- D3.js for visualizations
- Cytoscape (via npm) for network graphs
- MSA viewer, phyloview, archaeopteryx for bioinformatics visualizations

### MAAGE-Specific Assets

- `public/maage/` - MAAGE-specific CSS, fonts, images, and maps
- `public/maage/css/src/tailwind.css` - Tailwind source file with MAAGE component styles
- `tailwind.config.js` - Custom MAAGE color palette and typography configuration

### Styling

The project uses a hybrid approach:
- Dojo/Dijit built-in styles for legacy components
- Tailwind CSS for modern MAAGE-specific components
- Custom MAAGE color palette defined in `tailwind.config.js` with primary, secondary, tertiary, quaternary, and quinary color scales

## Configuration

Copy `p3-web.sample.conf` to `p3-web.conf` and configure:
- `http_port` - Server port (default: 3000)
- `dataServiceURL` - Backend API endpoint
- `appBaseURL`, `accountURL`, `userServiceURL` - Various service URLs
- `production` - Set to true for production mode
- `enableDevTools` - Enable development tools
- `maintenanceMode` - Enable 503 maintenance page

## Key Patterns

- Routes render EJS templates with `req.applicationModule = "p3/app/p3app"` to load the Dojo app
- Application options are passed to the client via `req.applicationOptions` middleware in `app.js`
- Proxying is configured for external services via `proxyConfig` in config
- Static assets are versioned using `packageJSON.version` for cache busting

## Security: XSS Prevention

This codebase has been audited for XSS vulnerabilities. Follow these patterns to prevent reintroducing them.

### 1. Never Use `innerHTML` with User-Controlled Data

**Bad:**
```javascript
this.queryNode.innerHTML = '<span>' + userInput + '</span>';
```

**Good - Use `textContent` for plain text:**
```javascript
this.totalCountNode.textContent = ' ( ' + count + ' Genomes ) ';
```

**Good - Use `domConstruct` for structured content:**
```javascript
var container = domConstruct.create('div');
domConstruct.create('span', { textContent: userInput }, container);
domConstruct.place(container, this.queryNode);
```

### 2. Escape HTML When Building Strings

Use the `escapeHtml()` function in `public/js/p3/util/QueryToEnglish.js`:

```javascript
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

Apply to any user-controlled value before inserting into HTML strings.

### 3. Encode URL Paths

Use `encodePath()` when constructing navigation URLs with user-controlled paths:

```javascript
function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

// Usage
Topic.publish('/navigate', { href: '/workspace' + encodePath(userPath) });
```

### 4. Common Vulnerable Patterns to Avoid

| Vulnerable Pattern | Safe Alternative |
|-------------------|------------------|
| `node.innerHTML = value` | `node.textContent = value` |
| `'<a href="' + url + '">'` | `domConstruct.create('a', {href: url})` |
| `/workspace` + path | `/workspace` + encodePath(path) |
| `decodeURIComponent()` on paths | Keep paths encoded |

### 5. Files with Security-Critical Code

- `public/js/p3/util/QueryToEnglish.js` - Query display with escapeHtml()
- `public/js/p3/widget/WorkspaceBrowser.js` - Workspace navigation URLs
- `public/js/p3/WorkspaceManager.js` - Workspace API calls
- `public/js/p3/widget/viewer/*.js` - Viewer widgets with DOM manipulation
- `lib/securityUtils.js` - Server-side sanitization utilities

### 6. Server-Side Security Utilities

The `lib/securityUtils.js` module provides:
- `sanitizeEmailHeader(str)` - Prevents email header injection (CRLF attacks)
- `sanitizeEmail(email)` - Validates and sanitizes email addresses
- `sanitizeUrlPath(path)` - Sanitizes URL paths
- `isValidHttpUrl(string)` - Validates HTTP/HTTPS URLs
- `sanitizeText(str, maxLength)` - General text sanitization
- `validateIntegerInRange(value, min, max)` - Numeric validation
- `validateAllowedValue(value, allowedValues)` - Whitelist validation

## MicrobeTrace Integration

### Overview

MicrobeTrace (CDC molecular epidemiology tool) is integrated via partner handoff. Fork at `BV-BRC-dependencies/MicrobeTrace` (dev branch), included as git submodule `microbetrace-src/`.

### Build & Deploy

```bash
# After checkout or submodule update:
git submodule update --init
cd microbetrace-src && git checkout -- package-lock.json src/environments/version.prod.ts && cd ..
npm run build:microbetrace
```

Requires Node.js >=22.12.0. Build output goes to `public/microbetrace/` (gitignored).

### Key Files

| File | Purpose |
|------|---------|
| `public/js/p3/util/microbeTraceHandoff.js` | Shared partner handoff utility (postMessage flow) |
| `public/js/p3/widget/viewer/MicrobeTrace.js` | Workspace browser viewer widget |
| `public/js/p3/widget/viewer/CoreGenomeMLSTResult.js` | cgMLST job result viewer |
| `public/js/p3/widget/viewer/WholeGenomeSNPResult.js` | wgSNP job result viewer (recursive folder listing) |
| `public/maage/config/microbetrace-default-style.json` | Default display style (colors, labels, threshold, default view) |
| `public/maage/img/microbetrace-icon.svg` | White icon for workspace sidebar |
| `public/maage/img/microbetrace-icon-dark.svg` | Dark icon for job result header |
| `routes/microbetrace.js` | Express route serving MicrobeTrace static assets |

### Style Configuration

All MicrobeTrace display settings are in `public/maage/config/microbetrace-default-style.json`. Key widget settings:

- `default-view` — startup view (e.g., "Phylogenetic Tree")
- `node-label-variable` — 2D network node labels
- `physics-tree-node-label-variable` — tree leaf labels
- `link-threshold` — link visibility threshold
- `default-distance-metric` — "snps" or "tn93"
- `node-color-variable` — color-by field (e.g., "cluster")

### Job Result Viewers

- **cgMLST**: Locates `.tre` tree, `cgMLST_distance.report`, `metadata.tsv`
- **wgSNP**: Dropdown for All/Majority/Core SNP sets. Each loads ML tree (matched by `.ml.tre` suffix + folder name), distance report, and metadata.tsv. Distance reports specify `field1: genome_id_1, field2: genome_id_2, field3: distance`

### Important Technical Constraints

- **Style timing**: Style applied via 5-second deferred `setTimeout` after `launchClick` to avoid being overwritten by `applyPatristicDistanceDefaults`
- **Default view DOM override**: Must set `$('#default-view').val()` directly before `launchClick` — widget value alone is ignored
- **No multi-view dashboard**: `pendingDashboardRestore` causes infinite loop in Golden Layout — cannot set up multiple views at startup
- **PapaParse dynamicTyping**: Set to `false` in fork to preserve genome ID precision (e.g., `28901.36220`)

### Fork Changes (BV-BRC-dependencies/MicrobeTrace)

- `dynamicTyping: false` in CSV parsing (files-plugin.component.ts)
- `.tre`/`.tree` extension recognition as Newick
- `applyStyleFileSettings` handles link-threshold, distance-metric
- `styleFileApplied$` subscriber calls full `applyStyleFileSettings`
- Tree component reads leaf label from style widgets at initialization
- Handoff metadata supports `style` and `defaultView`
- Receiver status message: "Transferring data to MicrobeTrace"

## Disease Outbreak Alerts

The genome landing page (`/view/Genome/<id>`) shows a "Disease Outbreak Alerts"
card that surfaces recent outbreak news for the genome's species.

### Key Files

| File | Purpose |
|------|---------|
| `routes/outbreaks.js` | `GET /outbreaks/alerts` — fetches, filters, and merges alerts from all sources |
| `public/js/p3/widget/GenomeOverview.js` | `createOutbreakAlertAssessment` and the card render/reset/loading methods |
| `public/js/p3/widget/templates/GenomeOverview.html` | Card markup (`outbreakAlert*` attach points) |
| `public/js/p3/resources/end.css` | Card styling (`.assessment*` classes, spinner keyframes) |

### Data Sources

Three sources, fetched in parallel via `Promise.allSettled` (each failure is
isolated so one down source doesn't blank the card):

- **WHO** — the Disease Outbreak News (DON) API
  (`https://www.who.int/api/news/diseaseoutbreaknews`, OData JSON). Returns
  dated, structured outbreak reports; article links built from `UrlName`. Do
  NOT use the general news RSS (`news-english.xml`) — it's press releases, not
  outbreaks, so species filtering almost never matches.
- **ProMED** — a `site:promedmail.org` Google News RSS query. The term must
  actually match (drops stale generic landing pages). ProMED has no working
  public feed and is often unreachable from the host.
- **Google News** — a plain Google News RSS search for the query terms.

**HealthMap was removed.** Its only reachable feed (`getAlerts.php`) exposes no
real per-article URLs (links are `javascript:` handlers), so it could never
link to actual articles. Don't re-add it without a source that provides real
article URLs (the authenticated `HMapi.php` would work if a key is obtained).

### Behavior Notes

- **Year filter**: only alerts from the current year and the prior year are
  shown. Enforced in `mergeAlertsByUniq` via `ALERT_MIN_YEAR` (computed once at
  module load); items without a parseable date are dropped.
- **Query terms**: the widget searches the species plus an optional alternate
  name (first two words of `genome_name`). Source link buttons must reproduce
  this SAME combined query — Google News uses an `"a" OR "b"` query, WHO uses
  its Google Custom Search Engine URL (`?q=` + `#gsc.q=`) — or the links
  under-return compared to what the card shows.
- **Card UI**: collapsible per-source `<details>` sections (count in the
  header, dated article links on expand); a CSS spinner shows while fetching
  with the summary hidden until results arrive.
- **XSS**: all card content is rendered with `domConstruct` + `textContent`;
  links are only rendered as `<a>` when the URL passes an `^https?://` check.

## Workspace Object Selector

`public/js/p3/widget/WorkspaceObjectSelector.js` — the "Choose or Upload a Workspace Object" dialog used by apps and viewers.

### Path prefix and UI behavior

The `path` property controls which workspace is shown. The leading path segment determines what UI controls are displayed:

- **`/public/...`** — hides the Upload, Create Folder, and Create Workspace buttons. Use this for read-only reference workspaces (e.g. the MAAGE Workshop shortcut).
- **`/<user@domain>/...`** (depth ≥ 3) — shows Upload and Create Folder. Use for user-writable locations.
- **`/<user@domain>`** (depth < 3) — shows Create Workspace only.

### MAAGE Workshop shortcut

The dropdown shortcut "MAAGE Workshop" targets `/public/maage@bvbrc/MAAGE Workshop`. The `/public` prefix is required — without it the selector shows Upload/Create Folder buttons even though the workspace service will reject writes from non-owners.

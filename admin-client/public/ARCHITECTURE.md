# Admin Dashboard Architecture

## Overview

The admin dashboard has been restructured from a monolithic single-page application into a modular, multi-page application following professional web development standards.

## Directory Structure

```
admin-client/public/
├── index.html                    # Redirect to globalstats.html
├── globalstats.html              # Global Statistics page
├── gamedata.html                 # Game Data Management page
├── players.html                  # Players List & Management page
├── login.html                    # Authentication page
│
├── css/
│   └── dashboard.css             # Shared styling for all pages
│
└── js/
    ├── layout.js                 # Shared layout & navigation utilities
    ├── globalstats.js            # Global stats page logic
    ├── gameData.js               # Game data editor logic
    └── dashboard.js              # Players management logic
```

## Page Structure

Each admin page follows this professional template structure:

```html
<!doctype html>
<html lang="en">
  <head>
    <!-- Meta tags, stylesheets, fonts -->
  </head>
  <body>
    <!-- Notification container -->
    <div id="notification" class="notification"></div>

    <!-- Shared Navigation Bar -->
    <nav class="navbar">
      <!-- Navigation links - consistent across all pages -->
    </nav>

    <!-- Page-specific content -->
    <div class="container">
      <section class="content">
        <!-- Page content -->
      </section>
    </div>

    <!-- Shared layout utilities -->
    <script type="module">
      import { logout } from "./js/layout.js";
      window.logout = logout;
    </script>

    <!-- Page-specific logic -->
    <script type="module" src="./js/[page-name].js"></script>
  </body>
</html>
```

## Shared Utilities (layout.js)

The `layout.js` module provides reusable functionality across all pages:

### Functions

- **`initializeNavigation()`** - Sets active nav link based on current page
- **`getCurrentPage()`** - Determines current page from URL
- **`updateActiveNavLink(page)`** - Highlights the active navigation item
- **`navigateTo(page)`** - Navigate between pages programmatically
- **`logout()`** - Clear auth token and redirect to login
- **`showNotification(message, type)`** - Display toast notifications
  - Types: `'info'`, `'success'`, `'warning'`, `'error'`
- **`checkAuth()`** - Verify user is authenticated
- **Auto-initialization** - Runs on page load automatically

### Usage

```javascript
import { logout, showNotification, navigateTo } from "./js/layout.js";

// Show notification
showNotification("Data saved successfully!", "success");

// Navigate to another admin page
navigateTo("gamedata");

// Logout
logout();
```

## Pages

### 1. Global Stats (`globalstats.html`)

- **Module**: `js/globalstats.js`
- **Features**:
  - Display aggregated player statistics
  - Show performance metrics across all levels
  - Export global stats to Excel
- **Key Functions**:
  - `loadGlobalStats()` - Fetch and render stats
  - `exportGlobalExcel()` - Export data to Excel file
  - `renderGlobalStats(container, data)` - Render stat cards and charts
  - `renderLevelStatsChart(container, levelStats)` - Chart.js visualization

### 2. Game Data (`gamedata.html`)

- **Module**: `js/gameData.js`
- **Features**:
  - Edit level configurations (hint, loupe link, badge)
  - Manage bonus info sections with text and images
  - Edit questions with support for:
    - Multiple correct answers
    - Feedback with images, titles, sources, descriptions
    - Per-image replacement (replace one at a time)
    - Add images to existing or replace all
    - Question media (images, audio, lyrics)
- **Key Functions**:
  - `loadGameData()` - Load level data for editing
  - `saveGameData()` - Save all changes
  - `renderQuestions()` - Render question accordion
  - `renderFeedbackImagePreview()` - Render feedback images with metadata
  - `handleReplaceSingleFeedbackImage()` - Replace individual image
  - Per-image controls with hover overlay UI

### 3. Players List (`players.html`)

- **Module**: `js/dashboard.js`
- **Features**:
  - Create new players
  - View player list with sort options
  - View detailed player statistics
  - Delete players with confirmation
  - Export player data to Excel
- **Key Functions**:
  - `createPlayer()` - Create new player
  - `loadPlayers()` - Fetch and render player list
  - `deletePlayer(id)` - Delete player with confirmation
  - Sort by score, success rate, or creation date

## Navigation

All pages share a consistent navigation bar with the following structure:

```
[Logo] Patho Quest Admin
├─ [Link] Global Stats      → globalstats.html
├─ [Link] Players List      → players.html
├─ [Link] Game Data         → gamedata.html
└─ [Button] Logout          → login.html
```

- Current page link is highlighted
- Navigation automatically updates on page load
- Links are actual `<a>` tags (not buttons) for better UX and SEO
- Logout is a button for its special functionality

## Styling

All pages share `css/dashboard.css` which includes:

- **Professional color scheme**
  - Primary: `#0ea5e9` (Sky Blue)
  - Success: `#10b981` (Emerald)
  - Danger: `#ef4444` (Red)
  - Dark: `#1e293b` (Slate)

- **Responsive Design** - Mobile-friendly with breakpoints at 768px and 1024px
- **Component-based CSS** - Organized by component (buttons, cards, forms, etc.)
- **Animations** - Smooth transitions and fade-in effects
- **Accessibility** - Proper contrast ratios and keyboard navigation

## Authentication Flow

1. User visits any admin page
2. `layout.js` calls `checkAuth()` on page load
3. If no auth token in localStorage:
   - User is redirected to `login.html`
4. If auth token exists:
   - Page loads normally
   - Token is sent in API requests

## API Integration

All pages communicate with the backend API using:

- **Base URL**: `/api/admin/`
- **Authentication**: Bearer token in Authorization header
- **Endpoints**:
  - `GET /api/admin/globalstats` - Global statistics
  - `GET /api/admin/gamedata/:level` - Get level data
  - `PUT /api/admin/gamedata/:level` - Save level data
  - `GET /api/admin/players` - Get all players
  - `POST /api/admin/players` - Create player
  - `DELETE /api/admin/players/:id` - Delete player

## Extensibility & Flexibility

This architecture is designed to be:

1. **Extensible**
   - Add new pages by creating `[page].html` + `js/[page].js`
   - Import and use shared utilities from `layout.js`
   - Share CSS via `dashboard.css`

2. **Flexible**
   - Each page manages its own state
   - Pages are independent modules
   - Easy to modify individual pages without affecting others

3. **Reusable**
   - `layout.js` provides common utilities
   - CSS classes can be used across pages
   - Components (cards, buttons, forms) are consistent

4. **Scalable**
   - Easy to add more admin functions
   - Clear separation of concerns
   - Modular JavaScript keeps code organized

## Migration from Old Structure

The old `dashboard.html` is now replaced with:

- `index.html` - Redirects to globalstats.html (backward compatibility)
- `globalstats.html` - Global stats (was tab in dashboard.html)
- `gamedata.html` - Game data (was tab in dashboard.html)
- `players.html` - Players list (was separate file, now updated)

All functionality is preserved and improved with better UI/UX.

## Development Guidelines

### Adding a New Admin Page

1. **Create HTML file** (`newpage.html`)

   ```html
   <!doctype html>
   <html lang="en">
     <head>
       <meta charset="UTF-8" />
       <meta name="viewport" content="width=device-width, initial-scale=1.0" />
       <title>New Page - Patho Quest Admin</title>
       <link rel="stylesheet" href="./css/dashboard.css" />
       <link
         href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
         rel="stylesheet"
       />
     </head>
     <body>
       <div id="notification" class="notification"></div>

       <nav class="navbar">
         <!-- Copy navbar structure from any page -->
       </nav>

       <div class="container">
         <section class="content">
           <!-- Your content here -->
         </section>
       </div>

       <script type="module">
         import { logout } from "./js/layout.js";
         window.logout = logout;
       </script>
       <script type="module" src="./js/newpage.js"></script>
     </body>
   </html>
   ```

2. **Create JavaScript module** (`js/newpage.js`)

   ```javascript
   import { showNotification } from "./layout.js";

   // Your page logic here
   export async function loadData() {
     try {
       const response = await fetch("/api/admin/newpage", {
         headers: {
           Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
         },
       });

       if (!response.ok) throw new Error("Failed to load data");

       const data = await response.json();
       renderPage(data);
       showNotification("Data loaded!", "success");
     } catch (error) {
       showNotification(error.message, "error");
     }
   }

   function renderPage(data) {
     // Render your content
   }

   // Auto-load on page load
   document.addEventListener("DOMContentLoaded", () => {
     loadData();
   });

   // Export for HTML onclick handlers
   window.loadData = loadData;
   ```

3. **Update navbar** in all pages to include the new link
   ```html
   <a id="nav-newpage" class="nav-link" href="newpage.html">New Page</a>
   ```

### Best Practices

- Always import `showNotification` from `layout.js` for toast messages
- Use `localStorage.getItem("adminToken")` for API authentication
- Export functions to `window` only if used by HTML onclick handlers
- Use debouncing for frequent re-renders (see gameData.js example)
- Keep CSS organized and use existing utility classes
- Test navigation highlighting works on your new page

## Backward Compatibility

- `index.html` redirects to `globalstats.html` - old dashboard links still work
- Old `dashboard.html` can be deprecated but is replaced by multi-page structure
- All functionality is preserved and improved

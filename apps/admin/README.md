# Chartvolt Admin App

Standalone admin dashboard that runs separately from the main user app.

## Why Separate?

- **Performance**: Admin doesn't slow down users
- **Security**: Isolated from user-facing code
- **Scalability**: Can be deployed to separate server if needed
- **Maintenance**: Admin-specific updates don't affect users

## Running Locally

```bash
# From admin directory
npm install
npm run dev  # Runs on port 3001

# Or from root
npm run dev:admin
```

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│   USER APP (3000)   │     │   ADMIN APP (3001)  │
│   chartvolt.com     │     │   admin.chartvolt   │
└─────────┬───────────┘     └─────────┬───────────┘
          │                           │
          └───────────┬───────────────┘
                      │
               ┌──────▼──────┐
               │   MongoDB   │
               │  (Shared)   │
               └─────────────┘
```

## API Communication

The admin app communicates with the main app's API:

```typescript
const API_BASE = process.env.MAIN_APP_URL || 'http://localhost:3000';

// Example: Verify admin auth
const response = await fetch(`${API_BASE}/api/admin/auth/verify`);
```

## Environment Variables

Create `.env.local` in this directory:

```env
# Main app URL (for API calls)
MAIN_APP_URL=http://localhost:3000
NEXT_PUBLIC_MAIN_APP_URL=http://localhost:3000

# MongoDB (same as main app)
MONGODB_URI=your_mongodb_connection_string
```

## Deployment

### Hostinger VPS

1. Both apps share the same MongoDB
2. NGINX routes traffic by subdomain:
   - `chartvolt.com` → User app (3000)
   - `admin.chartvolt.com` → Admin app (3001)

### PM2 Configuration

```bash
pm2 start ecosystem.config.js
```

This starts:
- `chartvolt-web` on port 3000
- `chartvolt-admin` on port 3001
- `chartvolt-worker` (no port, background)

## Migration Status

| Feature | Status |
|---------|--------|
| Login | ✅ Working |
| Dashboard Placeholder | ✅ Working |
| Full Dashboard | 🔄 Import from shared |
| Competitions | 🔄 In progress |
| Users Management | ⏳ Pending |
| Settings | ⏳ Pending |

## Full Migration

To complete the migration, import shared components:

```typescript
// Instead of local components
import AdminDashboard from '@components/admin/AdminDashboard';
import { Button } from '@components/ui/button';

// Or from packages
import { Competition, User } from '@packages/database';
import { notificationService } from '@packages/services';
```


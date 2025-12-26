# Chartvolt Background Worker

Background job processor that runs **independently** from the main Next.js app.

## Why a Separate Worker?

- **No Redis Required** - Uses your existing MongoDB as the job queue
- **Doesn't Block Main App** - Heavy tasks run in background
- **More Reliable** - Catches edge cases (user disconnects, etc.)
- **Auto-Restart** - PM2 keeps it running 24/7

## Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `margin-check` | Every 5 min | Backup margin monitoring & liquidation |
| `competition-end` | Every 1 min | Auto-end competitions at deadline |
| `challenge-finalize` | Every 1 min | Auto-finalize 1v1 challenges |

## Running Locally

```bash
# Development (with hot reload)
npm run worker

# Build for production
npm run worker:build

# Run production build
npm run worker:start
```

## Running on Server (Hostinger)

```bash
# Start everything with PM2
pm2 start ecosystem.config.js

# View logs
pm2 logs chartvolt-worker

# Monitor
pm2 monit

# Restart worker
pm2 restart chartvolt-worker
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   MAIN APP      │     │    WORKER       │
│   (Next.js)     │     │    (Node.js)    │
│                 │     │                 │
│  User Dashboard │     │  Margin Checks  │
│  Admin Panel    │     │  Competition    │
│  API Routes     │     │  Challenges     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │   MongoDB   │
              │  (Shared)   │
              └─────────────┘
```

## Adding New Jobs

1. Create job in `worker/jobs/my-job.job.ts`:

```typescript
export async function runMyJob(): Promise<MyJobResult> {
  // Your job logic here
  return result;
}
```

2. Register in `worker/index.ts`:

```typescript
import { runMyJob } from './jobs/my-job.job';

agenda.define('my-job', async () => {
  await runMyJob();
});

// Schedule it
await agenda.every('10 minutes', 'my-job');
```

## Troubleshooting

### Worker not starting?
```bash
# Check logs
pm2 logs chartvolt-worker

# Check if MongoDB is accessible
npm run test:db
```

### Jobs not running?
```bash
# Check MongoDB for jobs collection
# Look in "worker_jobs" collection
```

### High memory usage?
```bash
# Worker auto-restarts every 6 hours
# Or restart manually:
pm2 restart chartvolt-worker
```


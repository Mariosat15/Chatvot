# Chartvolt Operations & Risk Management System

## Executive Summary

Chartvolt includes a comprehensive **Operations & Risk Management System** designed to ensure fair, accurate, and transparent trading competition results. This document outlines the protections in place to safeguard both the platform and its users.

---

## The Problem We Solve

In trading competitions, **price accuracy is critical**. If the price feed has issues during competition finalization, users could receive unfair results. Our Operations system provides multiple layers of protection:

| Risk | Impact Without Protection | Our Solution |
|------|---------------------------|--------------|
| Price feed goes down | Winners/losers calculated on stale prices | Automatic snapshot fallback |
| Flash crash / data glitch | Fake price spike affects results | Anomaly detection + alerts |
| No backup available | Unfair results go unnoticed | Incident logging + compensation workflow |
| Manual errors | No audit trail | Complete logging of all actions |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        OPERATIONS & RISK MANAGEMENT                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│   │   MONITOR   │───▶│   DETECT    │───▶│   PROTECT   │───▶│   RESOLVE   │  │
│   │             │    │             │    │             │    │             │  │
│   │ Real-time   │    │ Health      │    │ Snapshots   │    │ Incident    │  │
│   │ Price Feed  │    │ Checks      │    │ & Fallback  │    │ Management  │  │
│   └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Real-Time Price Monitoring

### What It Does
- Monitors all forex price feeds via WebSocket connection
- Tracks last update time for each symbol
- Only monitors **enabled** symbols (configurable by admin)

### Health Status Levels

| Status | Meaning | Action |
|--------|---------|--------|
| 🟢 **Healthy** | Price updated within 30 seconds | Normal operation |
| 🟡 **Degraded** | Price is 30-60 seconds old OR anomaly detected | Warning generated |
| 🔴 **Critical** | Price is 60+ seconds old | Alert triggered, snapshot taken |

### Configuration
- Health check interval: Every **5 seconds**
- Stale threshold: **30 seconds**
- Critical threshold: **60 seconds**
- Anomaly detection: **>1% price change in <1 second**

---

## Layer 2: Alert System

### Alert Types

| Alert | Trigger | Severity |
|-------|---------|----------|
| `connection_lost` | WebSocket disconnects | 🔴 Error |
| `connection_restored` | WebSocket reconnects | 🟡 Warning |
| `price_stale` | Symbol not updated for 60s+ | 🔴 Error |
| `price_anomaly` | Sudden 1%+ price spike | 🟡 Warning |
| `max_reconnect_reached` | 10 reconnection attempts failed | 🔴 Critical |
| `critical_health` | Multiple symbols are stale | 🔴 Critical |

### Alert Management
- **60-second cooldown** prevents alert spam
- Alerts stored in database for **90 days** (audit trail)
- Last 100 alerts kept in memory for fast access
- Admin dashboard shows real-time alert status
- Admins can acknowledge alerts (logged for audit)

---

## Layer 3: Price Snapshots (Backup System)

### Automatic Snapshots
- Created every **60 seconds** during active competitions
- Captures all prices with full metadata
- Maximum **1,440 snapshots** per competition (24 hours)
- Auto-deleted after **7 days** (TTL index)

### What Each Snapshot Contains
```
┌─────────────────────────────────────────────┐
│ Price Snapshot                              │
├─────────────────────────────────────────────┤
│ • Timestamp                                 │
│ • Competition ID                            │
│ • All symbol prices (bid/ask/mid/spread)    │
│ • Price source (websocket/api/cache)        │
│ • Overall health status                     │
│ • Connection status                         │
│ • Healthy/degraded/critical counts          │
└─────────────────────────────────────────────┘
```

### Snapshot Types
- **auto** - Scheduled every 60 seconds
- **manual** - Admin-triggered for specific moments
- **alert** - Auto-created when critical alert fires

---

## Layer 4: Competition Finalization Protection

When a competition ends, the system validates prices **before** calculating results:

### The Finalization Flow

```
Competition Ends
       │
       ▼
┌──────────────────────┐
│ VALIDATE ALL PRICES  │
│                      │
│ Check each symbol:   │
│ • Staleness?         │
│ • Anomalies?         │
│ • Fallback data?     │
└──────────┬───────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
 ┌───────┐  ┌───────────┐
 │ SAFE  │  │ NOT SAFE  │
 │       │  │           │
 │ Use   │  │ Use last  │
 │ live  │  │ healthy   │
 │ prices│  │ snapshot  │
 └───┬───┘  └─────┬─────┘
     │            │
     │      ┌─────┴─────┐
     │      │           │
     │      ▼           ▼
     │  ┌───────┐  ┌─────────┐
     │  │Snapshot│  │   NO    │
     │  │ found  │  │SNAPSHOT │
     │  │        │  │         │
     │  │ Use it │  │  LOG    │
     │  │        │  │INCIDENT │
     │  └───┬────┘  └────┬────┘
     │      │            │
     └──────┼────────────┘
            │
            ▼
   ┌─────────────────┐
   │ FINALIZE        │
   │                 │
   │ • Calculate P&L │
   │ • Rank users    │
   │ • Distribute $$ │
   └─────────────────┘
```

### Key Protection
> **The system NEVER finalizes a competition with invalid prices without either using a backup snapshot or flagging it for admin review.**

---

## Layer 5: Incident Management

When a serious issue occurs (no healthy snapshot available), the system creates an **Incident** for admin resolution.

### Incident Workflow

```
┌──────────┐    ┌──────────────┐    ┌──────────┐    ┌────────┐
│   OPEN   │───▶│ INVESTIGATING│───▶│ RESOLVED │───▶│ CLOSED │
│          │    │              │    │          │    │        │
│ Auto-    │    │ Admin        │    │ Action   │    │ Fully  │
│ created  │    │ reviewing    │    │ taken    │    │ done   │
└──────────┘    └──────────────┘    └──────────┘    └────────┘
```

### Admin Resolution Process

1. **View Incident** - See in Operations → Incidents dashboard
2. **Review Evidence** - Check what went wrong and which users affected
3. **Decide Action** - Compensation, result adjustment, or no action needed
4. **Issue Compensation** - Credit affected users if needed
5. **Close with Notes** - Document decision for audit trail

### Compensation Options

| Option | When to Use |
|--------|-------------|
| No action | Prices slightly stale but results fair |
| Partial refund | Refund entry fees to affected users |
| Full refund | Void results, refund all participants |
| Result adjustment | Recalculate with corrected prices |

---

## Symbol Management

Admins control which forex pairs are available and monitored:

### Features
- Enable/disable individual symbols
- Bulk enable/disable by category (Major, Cross, Exotic)
- Only enabled symbols are monitored (prevents false alerts)
- Changes take effect immediately

### Symbol Categories

| Category | Examples | Count |
|----------|----------|-------|
| Major | EUR/USD, GBP/USD, USD/JPY | 7 |
| Cross | EUR/GBP, GBP/JPY, AUD/JPY | 21 |
| Exotic | USD/MXN, USD/TRY, USD/ZAR | 5 |
| Custom | Admin-added pairs | Variable |

---

## Data Retention & Compliance

| Data Type | Retention Period | Purpose |
|-----------|------------------|---------|
| Price Snapshots | 7 days | Competition backup |
| Health Alerts | 90 days | Audit trail |
| Incidents | Permanent | Compliance records |
| Audit Logs | Permanent | Admin action history |

---

## Admin Dashboard Features

### Operations → General Panel
- Real-time price health status
- Symbol-by-symbol health grid
- Recent alerts with acknowledge buttons
- Snapshot service status

### Key Metrics Displayed
- Healthy / Degraded / Critical symbol counts
- Connection status (Connected/Reconnecting/Disconnected)
- Reconnection attempt counter
- Last snapshot timestamp

---

## Summary: What This Protects Against

| Threat | Protection |
|--------|------------|
| 🔌 Price feed outage | Automatic snapshot fallback |
| 📉 Stale prices | Health monitoring + alerts |
| ⚡ Flash crashes | Anomaly detection |
| 🎯 Unfair results | Price validation before finalization |
| 📋 No accountability | Complete audit trail |
| 👥 User complaints | Incident management + compensation workflow |
| 🔍 Regulatory scrutiny | 90-day alert history + permanent incident logs |

---

## Technical Specifications

- **Health Check Interval**: 5 seconds
- **Snapshot Interval**: 60 seconds
- **Alert Cooldown**: 60 seconds
- **Max Reconnect Attempts**: 10
- **Stale Threshold**: 30 seconds
- **Critical Threshold**: 60 seconds
- **Anomaly Threshold**: 1% price change in <1 second
- **Snapshot Retention**: 7 days (TTL)
- **Alert Retention**: 90 days (TTL)

---

## Conclusion

Chartvolt's Operations & Risk Management System provides **enterprise-grade protection** for trading competition integrity. With multiple layers of monitoring, automatic fallbacks, and comprehensive incident management, the platform ensures:

✅ **Fair results** - Even when price feeds have issues  
✅ **Transparency** - Complete audit trail of all actions  
✅ **Accountability** - Incident tracking and resolution workflow  
✅ **Compliance** - Long-term data retention for regulatory needs  

---

*Document Version: 1.0*  
*Last Updated: January 2026*

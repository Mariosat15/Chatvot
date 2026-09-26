import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Server Model
 *
 * Tracks all VPS servers in the fleet. Each server registers itself
 * on startup and sends heartbeats every 30 seconds.
 * Used by the admin panel to monitor the server fleet.
 */

export interface IServerStats {
  cpuPercent: number;
  memoryPercent: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  diskPercent: number;
  diskUsedGB: number;
  diskTotalGB: number;
  pm2Processes: number;
  pm2Online: number;
  redisConnected: boolean;
  wsConnections: number;
  nodeVersion: string;
}

export interface IServer extends Document {
  serverId: string;
  hostname: string;
  ip: string;
  role: "primary" | "secondary";
  status: "online" | "offline" | "degraded";
  lastHeartbeat: Date;
  stats: IServerStats;
  version: string;
  startedAt: Date;
  domain: string;
  pm2Processes: Array<{
    name: string;
    status: string;
    cpu: number;
    memoryMB: number;
    uptime: number;
    restarts: number;
  }>;
}

const ServerSchema = new Schema<IServer>(
  {
    serverId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    hostname: {
      type: String,
      required: true,
    },
    ip: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["primary", "secondary"],
      default: "primary",
    },
    status: {
      type: String,
      enum: ["online", "offline", "degraded"],
      default: "online",
    },
    lastHeartbeat: {
      type: Date,
      default: Date.now,
      index: true,
    },
    stats: {
      cpuPercent: { type: Number, default: 0 },
      memoryPercent: { type: Number, default: 0 },
      memoryUsedMB: { type: Number, default: 0 },
      memoryTotalMB: { type: Number, default: 0 },
      diskPercent: { type: Number, default: 0 },
      diskUsedGB: { type: Number, default: 0 },
      diskTotalGB: { type: Number, default: 0 },
      pm2Processes: { type: Number, default: 0 },
      pm2Online: { type: Number, default: 0 },
      redisConnected: { type: Boolean, default: false },
      wsConnections: { type: Number, default: 0 },
      nodeVersion: { type: String, default: "" },
    },
    version: {
      type: String,
      default: "",
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    domain: {
      type: String,
      default: "",
    },
    pm2Processes: [
      {
        name: { type: String },
        status: { type: String },
        cpu: { type: Number },
        memoryMB: { type: Number },
        uptime: { type: Number },
        restarts: { type: Number },
      },
    ],
  },
  {
    timestamps: true,
    collection: "servers",
  },
);

export const Server: Model<IServer> =
  mongoose.models.Server || mongoose.model<IServer>("Server", ServerSchema);

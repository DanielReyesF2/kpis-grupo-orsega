"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbHealth = exports.health = void 0;
const health = (_, res) => res.json({
    status: "ok",
    version: "1.0.0",
    commit: process.env.GIT_COMMIT ?? "unknown",
    uptime: process.uptime()
});
exports.health = health;
const dbHealth = async (_, res) => {
    try {
        // Using existing database connection
        const { db } = await Promise.resolve().then(() => __importStar(require("./db")));
        // Simple health check query
        await db.execute("SELECT 1");
        res.json({ status: "ok", database: "connected" });
    }
    catch (e) {
        res.status(500).json({
            status: "error",
            message: e?.message ?? "db-fail",
            database: "disconnected"
        });
    }
};
exports.dbHealth = dbHealth;
//# sourceMappingURL=health.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const node_path_1 = __importDefault(require("node:path"));
const routes_catalog_1 = require("./routes.catalog");
const routes_logistics_1 = require("./routes.logistics");
const app = (0, express_1.default)();
const isProd = process.env.NODE_ENV === "production";
app.disable("x-powered-by");
app.use((0, cors_1.default)({ origin: true, credentials: true }));
app.use(express_1.default.json({ limit: "2mb" }));
// 1) API primero
app.use("/api", routes_catalog_1.catalogRouter);
app.use("/api", routes_logistics_1.logisticsRouter);
// 2) estáticos + SPA fallback (solo prod)
if (isProd) {
    const publicDir = node_path_1.default.resolve(__dirname, "../public");
    app.use(express_1.default.static(publicDir, { maxAge: "1h", index: "index.html" }));
    app.get("*", (_req, res) => res.sendFile(node_path_1.default.join(publicDir, "index.html")));
}
// error handler
app.use((err, _req, res, _next) => {
    console.error("[ERROR]", err?.stack || err?.message || err);
    res.status(500).json({ status: "error", message: "internal-error" });
});
const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`server up :${port} prod=${isProd}`));

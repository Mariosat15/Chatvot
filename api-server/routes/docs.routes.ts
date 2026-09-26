/**
 * OpenAPI spec + Swagger UI (read-only, no auth).
 */

import { Router, Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import swaggerUi from "swagger-ui-express";

const router = Router();

const isCompiledBuild = __dirname.split(path.sep).includes("dist");
const openApiJsonPath = path.join(
  __dirname,
  isCompiledBuild ? "../../docs/openapi.json" : "../docs/openapi.json",
);

function loadOpenApiSpec(): Record<string, unknown> {
  const raw = fs.readFileSync(openApiJsonPath, "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

let cachedSpec: Record<string, unknown> | null = null;
function getSpec(): Record<string, unknown> {
  if (!cachedSpec) {
    cachedSpec = loadOpenApiSpec();
  }
  return cachedSpec;
}

// Reason: Swagger UI uses inline scripts; default Helmet CSP blocks them.
router.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
    ].join("; "),
  );
  next();
});

router.get("/openapi.json", (_req: Request, res: Response) => {
  res.type("application/json").send(getSpec());
});

router.use("/", swaggerUi.serve, swaggerUi.setup(getSpec()));

export default router;

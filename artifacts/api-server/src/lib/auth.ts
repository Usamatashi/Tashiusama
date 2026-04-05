import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

const DEFAULT_SECRET = "tashi-secret-key-change-in-production";
const JWT_SECRET = process.env.JWT_SECRET ?? DEFAULT_SECRET;

if (!process.env.JWT_SECRET) {
  logger.warn("JWT_SECRET is not set — using insecure default. Set JWT_SECRET before deploying to production.");
}

export function validateConfig(): void {
  if (process.env.NODE_ENV === "production" && JWT_SECRET === DEFAULT_SECRET) {
    logger.error(
      "SECURITY WARNING: JWT_SECRET is using the default insecure value in production. " +
      "Set a strong JWT_SECRET environment variable in Railway Variables and redeploy.",
    );
  }
}

export interface JwtPayload {
  userId: number;
  role: string;
  phone: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    (req as any).user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user as JwtPayload;
  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user as JwtPayload;
  if (!user || user.role !== "super_admin") {
    res.status(403).json({ error: "Super admin access required" });
    return;
  }
  next();
}

export function requireSalesman(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user as JwtPayload;
  if (!user || (user.role !== "salesman" && user.role !== "admin" && user.role !== "super_admin")) {
    res.status(403).json({ error: "Salesman access required" });
    return;
  }
  next();
}

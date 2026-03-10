/**
 * Authentication: session middleware and auth helpers.
 * Passwords are hashed with bcrypt; never stored or logged in plain text.
 */
import session from "express-session";
import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import type { User } from "@shared/schema";

const SALT_ROUNDS = 10;

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

declare module "express-session" {
  interface SessionData {
    userId: string;
    username?: string;
  }
}

const sessionSecret = process.env.SESSION_SECRET || "change-me-in-production-use-env";

export const sessionMiddleware = session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  name: "stockpro.sid",
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
});

/** Require authenticated session for API routes. Call after sessionMiddleware. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.userId) {
    next();
    return;
  }
  res.status(401).json({ error: "Non authentifié" });
}

export type AuthUser = Pick<User, "id" | "username">;

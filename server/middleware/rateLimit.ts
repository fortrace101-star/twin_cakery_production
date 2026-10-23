import { Request, Response, NextFunction, RequestHandler } from "express";

interface Bucket { count: number; resetAt: number; }

export function rateLimit(opts: { max: number; windowMs: number }): RequestHandler {
  const buckets = new Map<string, Bucket>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const entry = buckets.get(ip);
    if (entry && now < entry.resetAt) {
      if (entry.count >= opts.max) {
        res.status(429).json({ error: "Too many attempts. Try again later." });
        return;
      }
      entry.count++;
    } else {
      buckets.set(ip, { count: 1, resetAt: now + opts.windowMs });
    }
    next();
  };
}
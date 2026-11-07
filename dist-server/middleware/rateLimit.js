export function rateLimit(opts) {
    const buckets = new Map();
    return (req, res, next) => {
        const ip = req.ip || req.socket?.remoteAddress || "unknown";
        const now = Date.now();
        const entry = buckets.get(ip);
        if (entry && now < entry.resetAt) {
            if (entry.count >= opts.max) {
                res.status(429).json({ error: "Too many attempts. Try again later." });
                return;
            }
            entry.count++;
        }
        else {
            buckets.set(ip, { count: 1, resetAt: now + opts.windowMs });
        }
        next();
    };
}

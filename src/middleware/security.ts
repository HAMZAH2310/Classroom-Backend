import type { NextFunction, Request, Response } from "express";
import aj from '../config/arcjet.js'
import { slidingWindow, type ArcjetNodeRequest } from "@arcjet/node";

const securityMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'test') return next();

    try {
        // NOTE: This middleware must be mounted AFTER authentication to identify user roles.
        // req.user logic depends on auth middleware.
        const role: RateLimitRole = req.user?.role ?? 'guest';

        let limit: number;
        let message: string;

        switch (role) {
            case 'admin':
                limit = 20;
                message = 'Admin request limit exceeded (20 per minute)';
                break;
            case 'teacher':
                limit = 15;
                message = 'Teacher request limit exceeded (15 per minute)';
                break;
            case 'student':
                limit = 10;
                message = 'Student request limit exceeded (10 per minute)';
                break;
            default:
                limit = 5;
                message = 'Guest request limit exceeded (5 per minute). Please Sign Up for higher limit.';
                break;
        }

        const client = aj.withRule(
            slidingWindow({
                mode: 'LIVE',
                interval: '1m',
                max: limit,
            })
        )

        const arcjetRequest: ArcjetNodeRequest = {
            headers: req.headers,
            method: req.method,
            url: req.originalUrl ?? req.url,
            socket: { remoteAddress: req.ip ?? req.socket.remoteAddress ?? '0.0.0.0' }
        }

        const decision = await client.protect(arcjetRequest);

        if (decision.isDenied() && decision.reason.isBot()) {
            return res.status(403).json({ error: 'Forbidden', message: 'Automated request are not allowed' });
        }

        if (decision.isDenied() && decision.reason.isShield()) {
            return res.status(403).json({ error: 'Forbidden', message: 'Request blocked by security policy' });
        }

        if (decision.isDenied() && decision.reason.isRateLimit()) {
            const reason = decision.reason as { resetTime?: Date };
            const resetTime = reason.resetTime;
            if (resetTime instanceof Date) {
                const resetSeconds = Math.ceil((resetTime.getTime() - Date.now()) / 1000);
                res.setHeader('Retry-After', Math.max(1, resetSeconds).toString());
            }
            return res.status(429).json({ error: 'Too many requests', message });
        }

        next();

    } catch (e) {
        console.error("security middleware error:", e);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export default securityMiddleware;
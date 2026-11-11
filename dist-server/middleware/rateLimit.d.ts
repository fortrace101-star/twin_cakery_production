import { RequestHandler } from "express";
export declare function rateLimit(opts: {
    max: number;
    windowMs: number;
}): RequestHandler;

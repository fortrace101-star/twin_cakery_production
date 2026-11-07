import { Request, Response, NextFunction, RequestHandler } from "express";
import { RbacService } from "../services/rbac.service.js";
declare module "express-serve-static-core" {
    interface Request {
        auth?: {
            token: string | null;
            session: unknown;
        };
        perms?: ReadonlySet<string>;
    }
}
declare const rbacService: RbacService;
export declare function attachAuth(req: Request, res: Response, next: NextFunction): void;
export declare function requireAuth(req: Request, res: Response, next: NextFunction): void;
/** Authenticated, returning a live Postgres session so routes stay on real data. */
export declare function requireSession(req: Request, res: Response, next: NextFunction): void;
/** Every listed permission is required. Use requireAny() for "one of". */
export declare function requirePermission(...needed: string[]): RequestHandler;
export declare function requireAny(...needed: string[]): RequestHandler;
/** The actor for audit/money rows. Never read an actor from req.body. */
export declare const actorOf: (req: Request) => string;
export declare function requireRole(roles: string[]): RequestHandler;
export { rbacService };

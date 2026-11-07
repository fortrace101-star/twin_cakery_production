import type { Response } from "express";
/** Resource keys a mutation on `url` affects ([] = nothing to announce). */
export declare function resourcesFor(method: string, url: string): string[];
/** Register an open SSE response; starts the heartbeat while anyone listens. */
export declare function addSseClient(res: Response): void;
export declare function removeSseClient(res: Response): void;
/** Broadcast one change event to every connected client. */
export declare function broadcastChange(method: string, url: string): void;

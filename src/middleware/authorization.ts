import { env } from "@webhook/config/environment.js";
import { ServerError } from "@webhook/error/server-error.js";
import type { NextFunction, Request, Response } from "express";


export function authorization(req: Request, _: Response, next: NextFunction) {
	const webhookId = req.params.webhookId;
	if (webhookId !== env.WEBHOOK_ID) throw ServerError.UnauthorizedError();

	next();
}

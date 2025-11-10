import type { NextFunction, Request, Response } from "express";

import { StatusCodes } from "http-status-codes";

export const routeNotFoundHandler = (req: Request, res: Response, _: NextFunction): void => {
	const statusCode = StatusCodes.NOT_FOUND;

	res.status(statusCode).json({
		message: `Route not found at ${req.method} ${req.originalUrl}`,
	});
};

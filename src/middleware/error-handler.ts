import type { NextFunction, Request, Response } from "express";

import { getReasonPhrase, StatusCodes } from "http-status-codes";
import z, { ZodError } from "zod";

import type { ErrorDetails } from "@webhook/type.js";

import { env } from "@webhook/config/environment.js";
import { ServerError } from "@webhook/error/server-error.js";
import logger from "@webhook/util/logger.js";

export const errorHandler = (err: Error, req: Request, res: Response, _: NextFunction): void => {
	logger.error({ err, reqPath: req.path, reqMethod: req.method }, "Error caught by error handler");

	let statusCode: StatusCodes = StatusCodes.INTERNAL_SERVER_ERROR;
	let message: string = getReasonPhrase(StatusCodes.INTERNAL_SERVER_ERROR);
	let errorDetails: ErrorDetails | undefined;

	if (err instanceof ServerError) {
		statusCode = err.statusCode;
		message = err.message;
		errorDetails = err.details;

		if (!err.isOperational) logger.fatal(err, "Fatal non-operational error encountered!");
	}

	if (err instanceof ZodError) {
		const zodValidationError = z.prettifyError(err);

		statusCode = StatusCodes.BAD_REQUEST;
		message = zodValidationError;
	}

	res.status(statusCode).json({
		message,
		details: errorDetails,
		stack: env.WEBHOOK_ENVIRONMENT === "development" ? err.stack : undefined,
	});
};

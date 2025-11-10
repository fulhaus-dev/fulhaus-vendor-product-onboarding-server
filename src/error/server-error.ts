import { ErrorDetails } from "@webhook/type.js";
import { StatusCodes } from "http-status-codes";

export class ServerError extends Error {
	public readonly statusCode: StatusCodes;
	public readonly isOperational: boolean;
	public readonly details?: ErrorDetails;

	constructor(
		statusCode: StatusCodes = StatusCodes.INTERNAL_SERVER_ERROR,
		message = "Unknown Error",
		details?: ErrorDetails,
		isOperational = true
	) {
		super(message);
		this.name = this.constructor.name;
		this.statusCode = statusCode;
		this.isOperational = isOperational;
		this.details = details;

		// Error.captureStackTrace is a V8-specific API.
		// It's good for Node.js environments, but might not be available in all JS runtimes.
		if (typeof Error.captureStackTrace === "function")
			Error.captureStackTrace(this, this.constructor);
	}

	static InternalServerError(message = "Server error.", details?: ErrorDetails) {
		return new ServerError(StatusCodes.INTERNAL_SERVER_ERROR, message, details);
	}

	static BadRequestError(message = "Bad request.", details?: ErrorDetails) {
		return new ServerError(StatusCodes.BAD_REQUEST, message, details);
	}

	static UnauthorizedError(message = "Unauthorized!", details?: ErrorDetails) {
		return new ServerError(StatusCodes.UNAUTHORIZED, message, details);
	}

	static CustomError(code: StatusCodes, message = "Unauthorized!", details?: ErrorDetails) {
		return new ServerError(code, message, details);
	}
}

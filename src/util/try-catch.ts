import { StatusCodes } from "http-status-codes";

import { exceptionErrorMessage } from "@webhook/error/index.js";

export function tryCatch<T>(fn: () => T) {
	try {
		const data = fn();
		return { data };
	} catch (unknownError) {
		const exceptionMessage = exceptionErrorMessage(unknownError);
		return {
			error: {
				message: exceptionMessage,
				code: StatusCodes.INTERNAL_SERVER_ERROR,
			},
		};
	}
}

export async function asyncTryCatch<T>(asyncFn: () => Promise<T>) {
	try {
		const data = await asyncFn();
		return { data };
	} catch (unknownError) {
		console.log("unknownError", unknownError);
		const exceptionMessage = exceptionErrorMessage(unknownError);
		return {
			error: {
				message: exceptionMessage,
				code: StatusCodes.INTERNAL_SERVER_ERROR,
			},
		};
	}
}

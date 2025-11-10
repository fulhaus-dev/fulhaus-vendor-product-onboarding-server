import { StatusCodes } from "http-status-codes";
import z from "zod";

export function getZodSafeParseData<T>(result: z.ZodSafeParseResult<T>) {
	const { data, error } = result;

	if (error)
		return {
			error: {
				message: z.prettifyError(result.error),
				code: StatusCodes.BAD_REQUEST,
			},
		};

	return {
		data,
	};
}

import type { ErrorDetails } from "@webhook/type.js";

import { api } from "@webhook/config/convex/convex.type.js";
import { convexHttpClient } from "@webhook/config/convex/index.js";
import { env } from "@webhook/config/environment.js";
import { asyncTryCatch } from "@webhook/util/try-catch.js";

export function exceptionErrorMessage(unKnownError: unknown) {
	let errorMessage = "An unknown error occurred";

	// Check if the error is an instance of Error
	if (unKnownError instanceof Error) errorMessage = unKnownError.message;

	return errorMessage;
}

export async function logProductError(args: { message: string; details?: ErrorDetails }) {
	await asyncTryCatch(() =>
		convexHttpClient.mutation(api.v1.product.error.mutation.logPoProductError, {
			poApiKey: env.CONVEX_PRODUCT_ONBOARDING_API_KEY,
			data: args,
		})
	);

	return;
}

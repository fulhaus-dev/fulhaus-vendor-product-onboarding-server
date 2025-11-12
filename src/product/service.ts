import type { CreateProduct } from "@webhook/product/type.js";

import { api } from "@webhook/config/convex/convex.type.js";
import { convexHttpClient } from "@webhook/config/convex/index.js";
import { env } from "@webhook/config/environment.js";
import { asyncTryCatch } from "@webhook/util/try-catch.js";

export async function createProductsService(data: CreateProduct[]) {
	return await asyncTryCatch(() =>
		convexHttpClient.mutation(api.v1.product.mutation.createPoProducts, {
			poApiKey: env.CONVEX_PRODUCT_ONBOARDING_API_KEY,
			data,
		})
	);
}

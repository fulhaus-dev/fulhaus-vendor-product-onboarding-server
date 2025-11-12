import type { CreateProduct, UpdateProduct } from "@webhook/product/type.js";

import { api } from "@webhook/config/convex/convex.type.js";
import { convexHttpClient } from "@webhook/config/convex/index.js";
import { env } from "@webhook/config/environment.js";
import { asyncTryCatch } from "@webhook/util/try-catch.js";

export async function getAllProductCategoryStatisticService() {
	return await asyncTryCatch(() =>
		convexHttpClient.query(api.v1.product.statistics.query.getPoAllProductCategoryStatistic, {
			poApiKey: env.CONVEX_PRODUCT_ONBOARDING_API_KEY,
		})
	);
}

export async function getProductBySkuService(sku: string) {
	return await asyncTryCatch(() =>
		convexHttpClient.query(api.v1.product.query.getPoProductBySku, {
			poApiKey: env.CONVEX_PRODUCT_ONBOARDING_API_KEY,
			sku,
		})
	);
}

export async function updateProductByIdService(data: UpdateProduct) {
	return await asyncTryCatch(() =>
		convexHttpClient.mutation(api.v1.product.mutation.updatePoProductById, {
			poApiKey: env.CONVEX_PRODUCT_ONBOARDING_API_KEY,
			data,
		})
	);
}

export async function createProductsService(data: CreateProduct[]) {
	return await asyncTryCatch(() =>
		convexHttpClient.mutation(api.v1.product.mutation.createPoProducts, {
			poApiKey: env.CONVEX_PRODUCT_ONBOARDING_API_KEY,
			data,
		})
	);
}

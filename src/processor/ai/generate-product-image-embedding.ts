import axios from "axios";

import { env } from "@webhook/config/environment.js";
import { asyncTryCatch } from "@webhook/util/try-catch.js";

export async function generateProductImageEmbedding(mainImageUrl: string) {
	const { data: response, error } = await asyncTryCatch(() =>
		axios.post(
			env.LUDWIG_VECTOR_GENERATION_ENDPOINT,
			{
				image_url: mainImageUrl,
			},
			{
				headers: {
					"Content-Type": "application/json",
				},
			}
		)
	);
	if (error) return { error };

	const embeddings = response.data.vector;

	return { data: Array.from(embeddings) as number[] };
}

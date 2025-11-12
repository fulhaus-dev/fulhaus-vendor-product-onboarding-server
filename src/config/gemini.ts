import { createGoogleGenerativeAI } from "@ai-sdk/google";

import { env } from "@webhook/config/environment.js";

const googleGemini = createGoogleGenerativeAI({
	apiKey: env.GOOGLE_GEMINI_API_KEY,
});

export const googleGemini2_5FlashLite = googleGemini("gemini-2.5-flash-lite");

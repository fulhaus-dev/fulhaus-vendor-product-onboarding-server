import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { z } from "zod";
import { getZodSafeParseData } from "@webhook/util/zod.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "..", "..");

dotenv.config({
	path: path.resolve(projectRoot, `.env.${process.env.NODE_ENV || "development"}`),
});
dotenv.config({ path: path.resolve(projectRoot, ".env"), override: false });

const envSchema = z.object({
	NODE_ENV: z.enum(["development", "production"]).default("development"),
	PORT: z.coerce.number().int().positive().default(8080),
	API_URL: z.string(),
	API_V1_PREFIX: z.string().startsWith("/").default("/api/v1"),
	LOG_LEVEL: z.enum(["error", "warn", "info", "http", "verbose", "debug", "silly"]).default("info"),
	CLOUDFLARE_R2_ENDPOINT: z.string(),
	CLOUDFLARE_R2_ACCESS_KEY_ID: z.string(),
	CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string(),
	CLOUDFLARE_R2_VENDOR_PRODUCT_DATA_BUCKET_NAME: z.string(),
});

const parsedEnv = envSchema.safeParse(process.env);
const { data: parsedEnvData, error: zodError } = getZodSafeParseData(parsedEnv);

if (!!zodError) {
	console.error("❌ Invalid environment variables:", zodError);
	process.exit(1);
}

export const env = parsedEnvData;

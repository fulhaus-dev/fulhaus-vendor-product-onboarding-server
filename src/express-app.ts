import express from "express";
import morgan from "morgan";

import webhookRouter from "@webhook/api/v1/webhook/route.js";
import { env } from "@webhook/config/environment.js";
import { errorHandler } from "@webhook/middleware/error-handler.js";
import { routeNotFoundHandler } from "@webhook/middleware/route-not-found-handler.js";

const app = express();

// --- Core Middlewares ---
app.set("trust proxy", 1);
app.disable("x-powered-by"); // Prevent revealing information about your server
app.use(morgan("combined")); // Logging
app.use(express.json());

// --- API Routes ---
app.get("/", (_, res) => {
	res.send("Ching!! This is Fülhaus Vendor Product Onboarding Webhook.");
});
app.get("/health", (_, res) => {
	res.send(
		`${new Date().toISOString()}: Woozaa!! Fülhaus Vendor Product Onboarding Webhook is been up and running. Has been up for ${Math.floor(
			process.uptime()
		)} seconds`
	);
});

app.use(`${env.API_V1_PREFIX}/v1/auth`, webhookRouter);

// --- Error Handling Middlewares ---
// Handle 404 Not Found for any routes not matched above
app.use(routeNotFoundHandler);

// Centralized error handler - must be the last middleware in the chain
app.use(errorHandler);

export default app;

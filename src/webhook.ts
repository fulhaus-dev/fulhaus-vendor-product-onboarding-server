import http from "node:http";

import { env } from "@webhook/config/environment.js";
import app from "@webhook/express-app.js";
import logger from "@webhook/util/logger.js";

const WEBHOOK_PORT = env.PORT;
const WEBHOOK_BASE_URL = env.WEBHOOK_BASE_URL;
const server = http.createServer(app);

// === Global cleanup registry ===
const cleanupTasks = new Set<() => Promise<void>>();

export function registerCleanup(task: () => Promise<void>) {
	cleanupTasks.add(task);
}

async function runAllCleanups(signal: string) {
	logger.info(`Running ${cleanupTasks.size} cleanup tasks for ${signal}...`);
	const results = await Promise.allSettled(Array.from(cleanupTasks).map((t) => t()));
	for (const r of results) {
		if (r.status === "rejected") logger.error(r.reason, "Cleanup failed");
	}
	cleanupTasks.clear();
}

// === Start Server ===
function startServer() {
	server.listen(WEBHOOK_PORT, () => {
		logger.info(`Server running in ${env.WEBHOOK_ENVIRONMENT} mode on port ${WEBHOOK_PORT}`);
		logger.info(`WEBHOOK BASE URL: ${WEBHOOK_BASE_URL}`);
		logger.info(`HEALTH CHECK: ${WEBHOOK_BASE_URL}/health`);
	});

	server.on("error", (err: NodeJS.ErrnoException) => {
		logger.fatal({ code: err.code, syscall: err.syscall }, "Server error");
		if (err.syscall !== "listen") throw err;
		if (err.code === "EACCES") logger.fatal(`Port ${WEBHOOK_PORT} requires elevated privileges.`);
		else if (err.code === "EADDRINUSE") logger.fatal(`Port ${WEBHOOK_PORT} is already in use.`);
		else throw err;
		process.exit(1);
	});
}

// === Graceful Shutdown ===
async function gracefulShutdown(signal: string) {
	logger.info(`Received ${signal}. Shutting down...`);

	const shutdown = Promise.all([
		runAllCleanups(signal),
		new Promise<void>((resolve) => {
			server.close((err?) => {
				if (err) logger.error(err, "Server close error");
				else logger.info("HTTP server closed.");
				resolve();
			});
		}),
	]);

	const timeout = setTimeout(() => {
		logger.error("Shutdown timed out. Forcing exit.");
		process.exit(1);
	}, 10_000);

	await shutdown.finally(() => clearTimeout(timeout));
	logger.info("Shutdown complete.");
	process.exit(0);
}

// === Signal Handlers (Single Source) ===
["SIGTERM", "SIGINT"].forEach((sig) => {
	process.on(sig, () => gracefulShutdown(sig));
});

process.on("unhandledRejection", (reason) => {
	logger.fatal({ reason }, "Unhandled Rejection");
	gracefulShutdown("UNHANDLED_REJECTION");
});

process.on("uncaughtException", (err) => {
	logger.fatal(err, "Uncaught Exception");
	gracefulShutdown("UNCAUGHT_EXCEPTION");
});

// === Start ===
try {
	startServer();
} catch (err) {
	logger.fatal(err, "Failed to start server");
	process.exit(1);
}

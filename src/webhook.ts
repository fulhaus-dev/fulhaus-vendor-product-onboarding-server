// import http from "node:http";

// import { env } from "@webhook/config/environment.js";
// import app from "@webhook/express-app.js";
// import logger from "@webhook/util/logger.js";

// const WEBHOOK_PORT = env.PORT;
// const WEBHOOK_BASE_URL = env.WEBHOOK_BASE_URL;

// const server = http.createServer(app);

// function startServer() {
// 	server.listen(WEBHOOK_PORT, () => {
// 		logger.info(`🚀 Server running in ${env.WEBHOOK_ENVIRONMENT} mode on port ${WEBHOOK_PORT}`);
// 		logger.info(`🔗 WEBHOOK BASE URL: ${WEBHOOK_BASE_URL}`);
// 		logger.info(`🔗 WEBHOOK HEALTH CHECK URL: ${WEBHOOK_BASE_URL}/health`);
// 	});

// 	server.on("error", (error: NodeJS.ErrnoException) => {
// 		logger.fatal(
// 			{ code: error.code, syscall: error.syscall },
// 			"Server failed to start or encountered a fatal error"
// 		);
// 		if (error.syscall !== "listen") throw error;

// 		switch (error.code) {
// 			case "EACCES":
// 				logger.fatal(`Port ${WEBHOOK_PORT} requires elevated privileges.`);
// 				process.exit(1);
// 				break;
// 			case "EADDRINUSE":
// 				logger.fatal(`Port ${WEBHOOK_PORT} is already in use.`);
// 				process.exit(1);
// 				break;
// 			default:
// 				throw error; // Unknown listen error, rethrow
// 		}
// 	});
// }

// function gracefulShutdown(signal: string) {
// 	logger.info(`Received ${signal}. Initiating graceful shutdown...`);
// 	server.close((err?: Error) => {
// 		if (err) {
// 			logger.error(err, "Error during server close");
// 			process.exit(1);
// 		}
// 		logger.info("✅ HTTP server closed successfully.");
// 		// Perform other cleanup activities here (e.g., close database connections)
// 		logger.info("All resources cleaned up. Exiting.");
// 		process.exit(0);
// 	});

// 	setTimeout(() => {
// 		logger.error("Graceful shutdown timed out. Forcefully shutting down.");
// 		process.exit(1);
// 	}, 10000); // 10 seconds timeout
// }

// process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
// process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <It is better than breaking it up>
// process.on("unhandledRejection", (reason: Error, promise: Promise<unknown>) => {
// 	const logPayload: {
// 		promiseName?: string;
// 		errorType: string;
// 		message?: string;
// 		name?: string;
// 		stack?: string;
// 		details?: unknown;
// 	} = {
// 		promiseName: promise?.constructor?.name || "Promise",
// 		errorType: "UnhandledRejection",
// 	};

// 	if (reason instanceof Error) {
// 		logPayload.message = reason.message;
// 		logPayload.name = reason.name; // Pino will often pick this up from Error objects
// 		logPayload.stack = reason.stack;
// 		// For custom error properties, you might need to serialize them carefully
// 		// For example: if (reason.customData) logPayload.customData = reason.customData;
// 	} else {
// 		// Handle non-Error reasons more safely
// 		logPayload.errorType = `UnhandledRejection (non-Error type: ${typeof reason})`;
// 		if (
// 			typeof reason === "string" ||
// 			typeof reason === "number" ||
// 			typeof reason === "boolean" ||
// 			reason === null ||
// 			reason === undefined
// 		) {
// 			logPayload.details = reason;
// 		} else {
// 			try {
// 				// Attempt a safe serialization for objects, limit depth or size if necessary
// 				const serializedReason = JSON.stringify(reason, Object.getOwnPropertyNames(reason), 2);
// 				logPayload.details =
// 					serializedReason.length > 2000
// 						? `${serializedReason.substring(0, 2000)}...·(truncated)`
// 						: serializedReason;
// 			} catch (_e) {
// 				logPayload.details = "Reason object could not be serialized.";
// 			}
// 		}
// 	}

// 	if (logPayload.name === "AbortError") {
// 		logger.error(logPayload, "Abort Error");
// 		return;
// 	}

// 	logger.fatal(logPayload, "Unhandled Rejection. Application will terminate.");

// 	if (server.listening) {
// 		gracefulShutdown("UNHANDLED_REJECTION");
// 	} else {
// 		process.exit(1);
// 	}
// });

// process.on("uncaughtException", (error: Error /* origin: NodeJS.UncaughtExceptionOrigin */) => {
// 	// The 'error' argument here is guaranteed to be an Error object.
// 	// Pino handles Error objects well, serializing message, stack, type, etc.
// 	logger.fatal(error, "Uncaught Exception. Application will terminate.");

// 	if (server.listening) {
// 		gracefulShutdown("UNCAUGHT_EXCEPTION");
// 	} else {
// 		process.exit(1);
// 	}
// });

// try {
// 	startServer();
// } catch (error) {
// 	logger.fatal(error, "Failed to start server during initial setup.");
// 	process.exit(1);
// }

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

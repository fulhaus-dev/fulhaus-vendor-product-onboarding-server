import pino, { type LoggerOptions } from "pino";

import { env } from "@webhook/config/environment.js";

// Define pino options with type checking
const pinoOptions: LoggerOptions = {
	level: env.LOG_LEVEL,
	name: "app-logger",
};

if (env.WEBHOOK_ENVIRONMENT === "development") {
	pinoOptions.transport = {
		target: "pino-pretty",
		options: {
			colorize: true,
			translateTime: "SYS:standard", // More readable timestamp format
			ignore: "pid,hostname,name", // Hide pid, hostname, and the logger name in pretty print
			// Example: levelFirst: true,
			// messageFormat: '{levelLabel} - {pid} - {hostname} - {name} - {msg}',
		},
	};
}

// Explicitly type the logger instance
const logger = pino(pinoOptions);

export default logger;

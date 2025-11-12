// import { execFile } from "node:child_process";
// import { createReadStream, createWriteStream, readdir } from "node:fs";
// import { unlink } from "node:fs/promises";
// import os from "node:os";
// import path from "node:path";
// import { pipeline } from "node:stream/promises";
// import { promisify } from "node:util";

// import processFlatFileProductDataStream from "@webhook/api/v1/webhook/file.stream/flat-file.js";
// import processSpreadsheetFileProductDataStream from "@webhook/api/v1/webhook/file.stream/spreadsheet-file.js";
// import { logProductError } from "@webhook/error/index.js";
// import logger from "@webhook/util/logger.js";

// const execFileAsync = promisify(execFile);
// const readdirAsync = promisify(readdir);

// export default async function processZipFileProductDataStream(args: {
// 	zipFileStream: NodeJS.ReadableStream;
// 	vendorProductDataR2FolderName: string;
// 	fileName: string;
// 	ownerId: string;
// }) {
// 	const { zipFileStream, vendorProductDataR2FolderName, fileName, ownerId } = args;

// 	const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
// 	const tmpZipPath = path.join(os.tmpdir(), `zip-${jobId}.zip`);
// 	const extractDir = path.join(os.tmpdir(), `extract-${jobId}`);

// 	try {
// 		// 1. Download file stream → temp file
// 		logger.info(`Downloading ${fileName} → ${tmpZipPath}`);
// 		await pipeline(zipFileStream, createWriteStream(tmpZipPath));

// 		// 2. Extract with 7z
// 		logger.info(`Extracting with 7z → ${extractDir}`);
// 		await execFileAsync("7z", [
// 			"x", // extract with full paths
// 			tmpZipPath,
// 			`-o${extractDir}`, // output directory
// 			"-y", // assume Yes on all queries
// 			"-mmt=on", // multi-threaded
// 		]);

// 		// 3. Process each extracted file
// 		const files = await readdirAsync(extractDir);
// 		for (const file of files) {
// 			const filePath = path.join(extractDir, file);
// 			const ext = path.extname(file).toLowerCase().slice(1);

// 			const stream = createReadStream(filePath);

// 			try {
// 				if (["csv", "txt", "tsv"].includes(ext)) {
// 					await processFlatFileProductDataStream({
// 						flatFileStream: stream,
// 						vendorProductDataR2FolderName,
// 						fileName: `${fileName}:${file}`,
// 						ownerId
// 					});
// 				} else if (["xlsx", "xls"].includes(ext)) {
// 					await processSpreadsheetFileProductDataStream({
// 						spreadsheetFileStream: stream,
// 						vendorProductDataR2FolderName,
// 						fileName: `${fileName}:${file}`,
// 						ownerId
// 					});
// 				}
// 				// else → skip
// 			} catch (unknownError) {
// 				await logProductError({
// 					message: `Failed to process ${file}`,
// 					details: [
// 						{
// 							error: unknownError,
// 						},
// 					],
// 				});
// 			}
// 		}
// 	} catch (unknownError) {
// 		await logProductError({
// 			message: `ZIP processing failed. FileName: ${fileName}`,
// 			details: [
// 				{
// 					error: unknownError,
// 				},
// 			],
// 		});
// 	} finally {
// 		await Promise.allSettled([
// 			unlink(tmpZipPath).catch(() => {}),
// 			execFileAsync("rm", ["-rf", extractDir]).catch(() => {}),
// 		]);
// 	}
// }

import { execFile } from "node:child_process";
import { createReadStream, createWriteStream, readdir } from "node:fs";
import { unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";

import processFlatFileProductDataStream from "@webhook/api/v1/webhook/file.stream/flat-file.js";
import processSpreadsheetFileProductDataStream from "@webhook/api/v1/webhook/file.stream/spreadsheet-file.js";
import { logProductError } from "@webhook/error/index.js";
import logger from "@webhook/util/logger.js";
import { registerCleanup } from "@webhook/webhook.js";

const execFileAsync = promisify(execFile);
const readdirAsync = promisify(readdir);

const ZIP_CLEANUP_REGISTERED = Symbol("zip-cleanup-registered");
const tempPaths = new Set<string>();

async function safeCleanup(zipPath: string, dirPath: string) {
	await Promise.allSettled([
		unlink(zipPath).catch(() => {}),
		execFileAsync("rm", ["-rf", dirPath]).catch(() => {}),
	]);
}

export default async function processZipFileProductDataStream(args: {
	zipFileStream: NodeJS.ReadableStream;
	vendorProductDataR2FolderName: string;
	fileName: string;
	ownerId: string;
}) {
	const { zipFileStream, vendorProductDataR2FolderName, fileName, ownerId } = args;
	const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	const tmpZipPath = path.join(os.tmpdir(), `zip-${jobId}.zip`);
	const extractDir = path.join(os.tmpdir(), `extract-${jobId}`);

	tempPaths.add(tmpZipPath);
	tempPaths.add(extractDir);

	// Register global cleanup (once)
	if (!(globalThis as any)[ZIP_CLEANUP_REGISTERED]) {
		(globalThis as any)[ZIP_CLEANUP_REGISTERED] = true;
		registerCleanup(async () => {
			logger.info("Cleaning ZIP temp files...");
			await Promise.allSettled(
				Array.from(tempPaths).map(async (p) => {
					try {
						const { stat } = await import("node:fs/promises");
						const s = await stat(p).catch(() => null);
						if (!s) return;
						if (s.isDirectory()) await execFileAsync("rm", ["-rf", p]).catch(() => {});
						else await unlink(p).catch(() => {});
					} catch {}
				})
			);
		});
	}

	try {
		logger.info(`Downloading ${fileName} → ${tmpZipPath}`);
		await pipeline(zipFileStream, createWriteStream(tmpZipPath));

		logger.info(`Extracting → ${extractDir}`);
		await execFileAsync("7z", ["x", tmpZipPath, `-o${extractDir}`, "-y", "-mmt=on"]);

		const files = await readdirAsync(extractDir);
		for (const file of files) {
			const filePath = path.join(extractDir, file);
			const ext = path.extname(file).toLowerCase().slice(1);
			const stream = createReadStream(filePath);

			try {
				if (["csv", "txt", "tsv"].includes(ext)) {
					await processFlatFileProductDataStream({
						flatFileStream: stream,
						vendorProductDataR2FolderName,
						fileName: `${fileName}:${file}`,
						ownerId,
					});
				} else if (["xlsx", "xls"].includes(ext)) {
					await processSpreadsheetFileProductDataStream({
						spreadsheetFileStream: stream,
						vendorProductDataR2FolderName,
						fileName: `${fileName}:${file}`,
						ownerId,
					});
				}
			} catch (err) {
				await logProductError({
					message: `Failed to process ${file}`,
					details: [{ error: err }],
				});
			}
		}
	} catch (err) {
		await logProductError({
			message: `ZIP processing failed. File: ${fileName}`,
			details: [{ error: err }],
		});
	} finally {
		await safeCleanup(tmpZipPath, extractDir);
		tempPaths.delete(tmpZipPath);
		tempPaths.delete(extractDir);
	}
}

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

const execFileAsync = promisify(execFile);
const readdirAsync = promisify(readdir);

export default async function processZipFileProductDataStream(args: {
	zipFileStream: NodeJS.ReadableStream;
	vendorProductDataR2FolderName: string;
	fileName: string;
}) {
	const { zipFileStream, vendorProductDataR2FolderName, fileName } = args;

	const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	const tmpZipPath = path.join(os.tmpdir(), `zip-${jobId}.zip`);
	const extractDir = path.join(os.tmpdir(), `extract-${jobId}`);

	try {
		// 1. Download file stream → temp file
		logger.info(`Downloading ${fileName} → ${tmpZipPath}`);
		await pipeline(zipFileStream, createWriteStream(tmpZipPath));

		// 2. Extract with 7z
		logger.info(`Extracting with 7z → ${extractDir}`);
		await execFileAsync("7z", [
			"x", // extract with full paths
			tmpZipPath,
			`-o${extractDir}`, // output directory
			"-y", // assume Yes on all queries
			"-mmt=on", // multi-threaded
		]);

		// 3. Process each extracted file
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
					});
				} else if (["xlsx", "xls"].includes(ext)) {
					await processSpreadsheetFileProductDataStream({
						spreadsheetFileStream: stream,
						vendorProductDataR2FolderName,
						fileName: `${fileName}:${file}`,
					});
				}
				// else → skip
			} catch (unknownError) {
				await logProductError({
					message: `Failed to process ${file}`,
					details: [
						{
							error: unknownError,
						},
					],
				});
			}
		}
	} catch (unknownError) {
		await logProductError({
			message: `ZIP processing failed. FileName: ${fileName}`,
			details: [
				{
					error: unknownError,
				},
			],
		});
	} finally {
		await Promise.allSettled([
			unlink(tmpZipPath).catch(() => {}),
			execFileAsync("rm", ["-rf", extractDir]).catch(() => {}),
		]);
	}
}

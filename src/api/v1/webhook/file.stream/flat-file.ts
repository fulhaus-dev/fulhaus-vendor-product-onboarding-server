import type { Readable } from "node:stream";

import type { BaseProductDataMap } from "@webhook/product/type.js";

import getProductFileConfig from "@webhook/api/v1/webhook/file.stream/util/get-product-file-config.js";
import { env } from "@webhook/config/environment.js";
import { logProductError } from "@webhook/error/index.js";
import { processProductLine } from "@webhook/processor/index.js";
import { createProductsService } from "@webhook/product/service.js";
import { chunkArray } from "@webhook/util/array.js";
import logger from "@webhook/util/logger.js";

const FILE_STREAM_MAX_FILE_LINE_BATCH_SIZE = env.FILE_STREAM_MAX_FILE_LINE_BATCH_SIZE;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <Okay>
export default async function processFlatFileProductDataStream(args: {
	flatFileStream: Readable;
	vendorProductDataR2FolderName: string;
	fileName: string;
}) {
	const { flatFileStream, vendorProductDataR2FolderName, fileName } = args;

	logger.info(
		`✅ Started processing lines from ${fileName} for vendor ${vendorProductDataR2FolderName}`
	);

	let buffer = "";
	let fileFieldMapLines: string[] = [];
	let fileHeaderMap: BaseProductDataMap | undefined;
	let fileDelimiter: string | undefined;
	let fileHeaderLine: string | undefined;
	const fileLinesBatch: string[] = [];

	for await (const chunk of flatFileStream) {
		buffer += chunk.toString("utf8");

		// Split by newlines and process
		const lines = buffer.split(/\r\n|\n|\r/);
		buffer = lines.pop() || "";

		if (!fileHeaderMap) fileFieldMapLines.push(...lines);

		if (fileFieldMapLines.length > 1 && !fileHeaderMap) {
			const headerMapLines = fileFieldMapLines.splice(0, 1);

			const { data, error } = await getProductFileConfig(headerMapLines);

			if (error) {
				await logProductError({
					message: error.message,
					details: [
						{
							function: "getProductFileConfig",
							extract: headerMapLines,
						},
					],
				});

				return;
			}

			fileHeaderMap = data.map;
			fileDelimiter = data.delimiter;
			fileHeaderLine = data.headerLine;

			fileLinesBatch.push(...fileFieldMapLines);

			fileFieldMapLines = [];
		}

		if (!fileHeaderMap) continue;

		fileLinesBatch.push(...lines);

		if (fileLinesBatch.length >= FILE_STREAM_MAX_FILE_LINE_BATCH_SIZE) {
			flatFileStream.pause();

			await processFileLinesBatch({
				baseProductDataMap: fileHeaderMap,
				fileLinesBatch: fileLinesBatch.splice(0),
				headerLine: fileHeaderLine!,
				delimiter: fileDelimiter!,
				vendorR2BucketFolderName: vendorProductDataR2FolderName,
			});

			flatFileStream.resume();
		}
	}

	if (buffer.trim() && fileHeaderMap) {
		const lastFileLinesBatch = [...fileLinesBatch, buffer];

		await processFileLinesBatch({
			baseProductDataMap: fileHeaderMap,
			fileLinesBatch: lastFileLinesBatch,
			headerLine: fileHeaderLine!,
			delimiter: fileDelimiter!,
			vendorR2BucketFolderName: vendorProductDataR2FolderName,
		});
	}

	logger.info(
		`✅ Completed processing lines from ${fileName} for vendor ${vendorProductDataR2FolderName}`
	);
}

async function processFileLinesBatch(args: {
	baseProductDataMap: BaseProductDataMap;
	fileLinesBatch: string[];
	headerLine: string;
	delimiter: string;
	vendorR2BucketFolderName: string;
}) {
	const { baseProductDataMap, fileLinesBatch, headerLine, delimiter, vendorR2BucketFolderName } =
		args;

	const fileLinesBatchChunks = chunkArray(fileLinesBatch, FILE_STREAM_MAX_FILE_LINE_BATCH_SIZE);

	for (const fileLinesBatchChunk of fileLinesBatchChunks) {
		const responses = await Promise.all(
			fileLinesBatchChunk.map((fileLine) =>
				processProductLine({
					baseProductDataMap,
					productLine: fileLine,
					headerLine,
					delimiter,
					vendorR2BucketFolderName,
				})
			)
		);

		const productsToCreate = responses
			.filter((response) => response !== undefined)
			.map((response) => response.data);

		if (productsToCreate.length > 0) {
			const { error } = await createProductsService(productsToCreate);
			if (error)
				logProductError({
					message: error.message,
					details: [
						{
							function: "createProductsService",
							productsToCreate,
						},
					],
				});
		}
	}
}

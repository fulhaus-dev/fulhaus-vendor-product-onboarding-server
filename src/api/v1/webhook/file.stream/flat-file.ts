import type {
	BaseProductDataMap,
	ProductCategory,
	ProductCategoryCount,
	ProductCategoryCountCurrency,
	ProductCurrencyCode,
} from "@webhook/product/type.js";

import getProductFileConfig from "@webhook/api/v1/webhook/file.stream/util/get-product-file-config.js";
import { env } from "@webhook/config/environment.js";
import { logProductError } from "@webhook/error/index.js";
import { processProductLine } from "@webhook/processor/index.js";
import {
	createProductsService,
	getAllProductCategoryStatisticService,
} from "@webhook/product/service.js";
import { chunkArray } from "@webhook/util/array.js";
import logger from "@webhook/util/logger.js";

const FILE_STREAM_MAX_FILE_LINE_BATCH_SIZE = env.FILE_STREAM_MAX_FILE_LINE_BATCH_SIZE;

let hasFetchedCategoryCount = false;
let categoryCount = {} as ProductCategoryCount;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <Okay>
export default async function processFlatFileProductDataStream(args: {
	flatFileStream: NodeJS.ReadableStream;
	vendorProductDataR2FolderName: string;
	fileName: string;
	ownerId: string;
}) {
	const { flatFileStream, vendorProductDataR2FolderName, fileName, ownerId } = args;

	logger.info(
		`✅ Started processing lines from ${fileName} for vendor ${vendorProductDataR2FolderName}`
	);

	if (!hasFetchedCategoryCount) {
		const { data: categoryCountResponse } = await getAllProductCategoryStatisticService();

		if (categoryCountResponse) {
			categoryCount = categoryCountResponse.stats.reduce((acc, count) => {
				acc[count.category] = {
					countUSD: count.countUSD,
					countCAD: count.countCAD,
				} as ProductCategoryCountCurrency;

				return acc;
			}, {} as ProductCategoryCount);
		}

		hasFetchedCategoryCount = true;
	}

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

			const { data, error } = await getProductFileConfig([...headerMapLines, fileFieldMapLines[0]]);

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
				ownerId,
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
			ownerId,
		});
	}

	logger.info(
		`✅ Completed processing lines from ${fileName} for vendor ${vendorProductDataR2FolderName}`
	);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <Okay>
async function processFileLinesBatch(args: {
	baseProductDataMap: BaseProductDataMap;
	fileLinesBatch: string[];
	headerLine: string;
	delimiter: string;
	vendorR2BucketFolderName: string;
	ownerId: string;
}) {
	const {
		baseProductDataMap,
		fileLinesBatch,
		headerLine,
		delimiter,
		vendorR2BucketFolderName,
		ownerId,
	} = args;

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
					productCategoryCount: categoryCount,
					ownerId,
				})
			)
		);

		const productsUpdateCategoryData = responses
			.filter((response) => response?.productUpdateCategoryData !== undefined)
			.map((response) => response.productUpdateCategoryData);

		if (productsUpdateCategoryData.length > 0) {
			for (const productUpdateCategoryData of productsUpdateCategoryData) {
				const category = productUpdateCategoryData.category;
				const currencyCode = productUpdateCategoryData.currencyCode;

				updateCategoryCount({
					category,
					currencyCode,
				});
			}

			return;
		}

		const productsData = responses
			.filter((response) => response?.data !== undefined)
			.map((response) => response.data);

		if (productsData.length > 0) {
			const productsToCreate = productsData.map((productData) => productData.productToAdd);

			const { data, error } = await createProductsService(productsToCreate);
			if (error)
				logProductError({
					message: error.message,
					details: [
						{
							function: "createProductsService",
							productsToCreate: productsToCreate.map((p) => p.productData),
						},
					],
				});

			if (data) {
				for (const productData of productsData) {
					const category = productData.productToAdd.productData.category;
					const currencyCode = productData.currencyCode;

					updateCategoryCount({
						category,
						currencyCode,
					});
				}
			}
		}
	}
}

function updateCategoryCount(args: {
	category: ProductCategory;
	currencyCode: ProductCurrencyCode;
}) {
	const { category, currencyCode } = args;
	const currentCategoryCount = categoryCount?.[category];

	if (!currentCategoryCount)
		categoryCount[category] = {
			[`count${currencyCode}`]: 1,
		} as ProductCategoryCountCurrency;
	else
		categoryCount[category][`count${currencyCode}`] =
			(currentCategoryCount?.[`count${currencyCode}`] ?? 0) + 1;
}

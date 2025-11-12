import {
	FLAT_FILE_EXTS_TO_PROCESS,
	SPREADSHEET_FILE_EXTS_TO_PROCESS,
	ZIP_FILE_EXTS_TO_PROCESS,
} from "@webhook/api/v1/webhook/constant.js";
import processFlatFileProductDataStream from "@webhook/api/v1/webhook/file.stream/flat-file.js";
import processSpreadsheetFileProductDataStream from "@webhook/api/v1/webhook/file.stream/spreadsheet-file.js";
import processZipFileProductDataStream from "@webhook/api/v1/webhook/file.stream/zip-file.js";
import {
	getAllFileKeysInVendorProductDataR2BucketFolder,
	getProductDataR2FileStream,
} from "@webhook/api/v1/webhook/util/r2.js";

export async function vendorProductWebhookService(args: {
	vendorProductDataR2FolderName: string;
	fileNameToProcess: string;
	ownerId: string;
}) {
	const { vendorProductDataR2FolderName, fileNameToProcess, ownerId } = args;

	const allProductFileKeys = await getAllFileKeysInVendorProductDataR2BucketFolder(
		vendorProductDataR2FolderName
	);

	const { flatFileKeys, spreadsheetFileKeys, zipFileKeys } =
		getVendorProductDataFileKeysThatCanBeProcessed(allProductFileKeys);

	for (const flatFileKey of flatFileKeys) {
		if (flatFileKey !== fileNameToProcess) continue;

		const { data: flatFileStream } = await getProductDataR2FileStream(flatFileKey);
		if (!flatFileStream) continue;

		await processFlatFileProductDataStream({
			flatFileStream,
			vendorProductDataR2FolderName,
			fileName: flatFileKey,
			ownerId,
		});
	}

	for (const spreadsheetFileKey of spreadsheetFileKeys) {
		if (spreadsheetFileKey !== fileNameToProcess) continue;

		const { data: spreadsheetFileStream } = await getProductDataR2FileStream(spreadsheetFileKey);
		if (!spreadsheetFileStream) continue;

		await processSpreadsheetFileProductDataStream({
			spreadsheetFileStream,
			vendorProductDataR2FolderName,
			fileName: spreadsheetFileKey,
			ownerId,
		});
	}

	for (const zipFileKey of zipFileKeys) {
		if (zipFileKey !== fileNameToProcess) continue;

		const { data: zipFileStream } = await getProductDataR2FileStream(zipFileKey);
		if (!zipFileStream) continue;

		await processZipFileProductDataStream({
			zipFileStream,
			vendorProductDataR2FolderName,
			fileName: zipFileKey,
			ownerId,
		});
	}
}

function getVendorProductDataFileKeysThatCanBeProcessed(keys: string[]) {
	const flatFileKeys = keys.filter((key) =>
		FLAT_FILE_EXTS_TO_PROCESS.some((ext) => key.endsWith(ext))
	);

	const spreadsheetFileKeys = keys.filter((key) =>
		SPREADSHEET_FILE_EXTS_TO_PROCESS.some((ext) => key.endsWith(ext))
	);

	const zipFileKeys = keys.filter((key) =>
		ZIP_FILE_EXTS_TO_PROCESS.some((ext) => key.endsWith(ext))
	);

	return {
		flatFileKeys,
		spreadsheetFileKeys,
		zipFileKeys,
	};
}

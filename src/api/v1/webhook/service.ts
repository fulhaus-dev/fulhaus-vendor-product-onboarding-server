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

const allowedFileKeys = ["wayfair/Fulhaus_BL.txt.zip"];

export async function vendorProductWebhookService(vendorProductDataR2FolderName: string) {
	const allProductFileKeys = await getAllFileKeysInVendorProductDataR2BucketFolder(
		vendorProductDataR2FolderName
	);

	const { flatFileKeys, spreadsheetFileKeys, zipFileKeys } =
		getVendorProductDataFileKeysThatCanBeProcessed(allProductFileKeys);

	for (const flatFileKey of flatFileKeys) {
		const { data: flatFileStream } = await getProductDataR2FileStream(flatFileKey);
		if (!flatFileStream) continue;

		await processFlatFileProductDataStream({
			flatFileStream,
			vendorProductDataR2FolderName,
			fileName: flatFileKey,
		});
	}

	for (const spreadsheetFileKey of spreadsheetFileKeys) {
		const { data: spreadsheetFileStream } = await getProductDataR2FileStream(spreadsheetFileKey);
		if (!spreadsheetFileStream) continue;

		await processSpreadsheetFileProductDataStream({
			spreadsheetFileStream,
			vendorProductDataR2FolderName,
			fileName: spreadsheetFileKey,
		});
	}

	for (const zipFileKey of zipFileKeys) {
		if (!allowedFileKeys.includes(zipFileKey)) continue;

		const { data: zipFileStream } = await getProductDataR2FileStream(zipFileKey);
		if (!zipFileStream) continue;

		await processZipFileProductDataStream({
			zipFileStream,
			vendorProductDataR2FolderName,
			fileName: zipFileKey,
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

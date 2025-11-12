import type { Readable } from "node:stream";

import {
	GetObjectCommand,
	ListObjectsV2Command,
	type _Object as S3Object,
} from "@aws-sdk/client-s3";
import { StatusCodes } from "http-status-codes";

import { r2Client } from "@webhook/config/cloudflare.js";
import { env } from "@webhook/config/environment.js";
import { asyncTryCatch } from "@webhook/util/try-catch.js";

export async function getFileKeysInVendorProductDataR2BucketFolder(
	folderName: string,
	continuationToken?: string
) {
	const folderNameWithPrefix = folderName.endsWith("/") ? folderName : `${folderName}/`;

	const { data: listObjectsV2CommandOutput, error } = await asyncTryCatch(() =>
		r2Client.send(
			new ListObjectsV2Command({
				Bucket: env.CLOUDFLARE_R2_VENDOR_PRODUCT_DATA_BUCKET_NAME,
				Prefix: folderNameWithPrefix,
				MaxKeys: 1000,
				ContinuationToken: continuationToken,
			})
		)
	);
	if (error) return { error };

	const keys = (listObjectsV2CommandOutput.Contents || [])
		.filter((obj): obj is S3Object => obj.Key !== undefined)
		.map((obj) => obj.Key!);

	return {
		data: {
			keys,
			isTruncated: listObjectsV2CommandOutput.IsTruncated || false,
			nextContinuationToken: listObjectsV2CommandOutput.NextContinuationToken,
			totalCount: listObjectsV2CommandOutput.KeyCount || 0,
		},
	};
}

export async function getAllFileKeysInVendorProductDataR2BucketFolder(folderName: string) {
	const fileKeys: string[] = [];
	let continuationToken: string | undefined;

	do {
		const { data: response, error } = await getFileKeysInVendorProductDataR2BucketFolder(
			folderName,
			continuationToken
		);
		if (error) continue;

		fileKeys.push(...response.keys);
		continuationToken = response.nextContinuationToken;
	} while (continuationToken);

	return fileKeys;
}

export async function getProductDataR2FileStream(fileKey: string) {
	const { data: response, error: getProductDataFileStreamError } = await asyncTryCatch(() =>
		r2Client.send(
			new GetObjectCommand({
				Bucket: env.CLOUDFLARE_R2_VENDOR_PRODUCT_DATA_BUCKET_NAME,
				Key: fileKey,
			})
		)
	);

	if (getProductDataFileStreamError)
		return {
			error: getProductDataFileStreamError,
		};

	if (!getProductDataFileStreamError && !response.Body)
		return {
			message: "Response Body not found.",
			code: StatusCodes.INTERNAL_SERVER_ERROR,
		};

	if (!response) {
		return {
			error: {
				message: "Response not found.",
				code: StatusCodes.INTERNAL_SERVER_ERROR,
			},
		};
	}

	return { data: response.Body as Readable };
}

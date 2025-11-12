import type { GenericId as Id } from "convex/values";
import { v7 as uuidv7 } from "uuid";

import type {
	BaseProductData,
	BaseProductDataMap,
	CreateProduct,
	ProductCategoryCount,
} from "@webhook/product/type.js";

import { env } from "@webhook/config/environment.js";
import { logProductError } from "@webhook/error/index.js";
import { extractSanitizedProductData } from "@webhook/processor/ai/extract-sanitized-product-data.js";
import { generateProductImageEmbedding } from "@webhook/processor/ai/generate-product-image-embedding.js";
import {
	extractProductImageUrls,
	getBaseProductData,
	getStandardizedProductDimension,
	getStandardizedProductWeight,
} from "@webhook/processor/util.js";

const VENDOR_IDS = env.VENDORS.split(",").reduce(
	(map, vendor) => {
		const [vendorProductDataR2FolderName, vendorId] = vendor.split("|");
		map[vendorProductDataR2FolderName] = vendorId as Id<"productVendors">;

		return map;
	},
	{} as Record<string, Id<"productVendors">>
);

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <Okay>
export async function processProductLine(args: {
	baseProductDataMap: BaseProductDataMap;
	productLine: string;
	headerLine: string;
	delimiter: string;
	vendorR2BucketFolderName: string;
	productCategoryCount: ProductCategoryCount;
	ownerId: string;
}) {
	const {
		baseProductDataMap,
		productLine,
		headerLine,
		delimiter,
		vendorR2BucketFolderName,
		productCategoryCount,
		ownerId,
	} = args;

	if (Object.keys(baseProductDataMap).length < 1)
		return await logProductError({
			message: "Base Product Data Map is empty",
			details: [
				{
					function: "parseBaseProductDataMapError",
					args,
				},
			],
		});

	const baseProductData = getBaseProductData({
		productLine,
		productDataMap: baseProductDataMap,
		delimiter,
		headerLine,
	});
	if (!baseProductData) return;

	const otherProductDataResponse = await getOtherProductData({
		productLine: baseProductData.line,
		headerLine,
		delimiter,
		baseProductData,
		productCategoryCount,
	});

	if (otherProductDataResponse?.errorData)
		return await logProductError(otherProductDataResponse.errorData);

	const productDataResponse = otherProductDataResponse?.data;
	if (!productDataResponse) return;

	if (!productDataResponse.mainImageImageIndex) return;
	if (!productDataResponse.category) return;
	if (!productDataResponse.dimension) return;

	const retailPrice =
		productDataResponse.msrp ?? productDataResponse.map ?? productDataResponse.tradePrice * 2;

	const price = {
		currencyCode: productDataResponse.currencyCode,
		retailPrice,
		msrp: productDataResponse.msrp,
		map: productDataResponse.map,
		tradePrice: productDataResponse.tradePrice,
	};

	const hasCAD = price.currencyCode === "CAD";
	const hasUSD = price.currencyCode === "USD";
	const retailPriceCAD = price.currencyCode === "CAD" ? price.retailPrice : undefined;
	const retailPriceUSD = price.currencyCode === "USD" ? price.retailPrice : undefined;

	const stockQtyUSD = price.currencyCode === "USD" ? productDataResponse.stockQty : 0;
	const stockQtyCAD = price.currencyCode === "CAD" ? productDataResponse.stockQty : 0;
	const restockDateUSD = price.currencyCode === "USD" ? productDataResponse.restockDate : undefined;
	const restockDateCAD = price.currencyCode === "CAD" ? productDataResponse.restockDate : undefined;

	const productData = {
		prices: [price],
		hasCAD,
		hasUSD,
		retailPriceCAD,
		retailPriceUSD,
		stockQtyUSD,
		stockQtyCAD,
		restockDateUSD,
		restockDateCAD,
		brand: productDataResponse.brand,
		name: productDataResponse.name,
		description: productDataResponse.description,
		pdpLink: productDataResponse.pdpLink,
		category: productDataResponse.category,
		imageUrls: productDataResponse.imageUrls,
		mainImageUrl: productDataResponse.imageUrls[Number(productDataResponse.mainImageImageIndex)],
		vendorR2BucketFolderName,
		colorNames: productDataResponse.colorNames,
		materials: productDataResponse.materials,
		styles: productDataResponse.styles,
		dimension: productDataResponse.dimension,
		depth: productDataResponse.depth ?? undefined,
		height: productDataResponse.height ?? undefined,
		width: productDataResponse.width ?? undefined,
		dimensionUnit: productDataResponse.dimensionUnit,
		weight: productDataResponse.weight ?? undefined,
		weightUnit: productDataResponse.weightUnit,
		sku: productDataResponse.sku,
		gtin: productDataResponse.gtin,
		mpn: productDataResponse.mpn,
		hexColors: productDataResponse.hexColors,
		fhSku: uuidv7(),
		vendorId: VENDOR_IDS[vendorR2BucketFolderName],
		unitPerBox: productDataResponse.unitPerBox,
		ownerId,
		location: productDataResponse.location ?? undefined,
	};

	const productToAdd: CreateProduct = {
		imageEmbedding: productDataResponse.productImageEmbedding,
		productData,
	};

	return {
		data: productToAdd,
	};
}

async function getOtherProductData(args: {
	productLine: string;
	headerLine: string;
	delimiter: string;
	baseProductData: BaseProductData;
	productCategoryCount: ProductCategoryCount;
}) {
	const { productLine, headerLine, delimiter, baseProductData, productCategoryCount } = args;

	const imageUrls = extractProductImageUrls(productLine).slice(0, 5);
	const productLineArray = productLine.split(delimiter);
	const headerLineArray = headerLine.split(delimiter);

	const productInfoArray = headerLineArray.map(
		(header, index) => `
        *${header}*:
        ${productLineArray[index]}
      `
	);

	const productInfo = productInfoArray.join("\n");

	const { data: sanitizedData, error: extractSanitizedProductDataError } =
		await extractSanitizedProductData({
			imageUrls,
			productInfo,
		});
	if (extractSanitizedProductDataError)
		return {
			errorData: {
				message: extractSanitizedProductDataError.message,
				details: [
					{
						function: "extractSanitizedProductData",
						args,
					},
				],
			},
		};

	if (!sanitizedData.category) return;

	if (
		(productCategoryCount[sanitizedData.category]?.[`count${sanitizedData.currencyCode}`] ?? 0) <=
		env.MAX_PRODUCT_PER_CATEGORY
	)
		return;

	const mainImageUrl = imageUrls[Number(sanitizedData.mainImageImageIndex)];

	const { data: productImageEmbedding, error: generateProductImageEmbeddingError } =
		await generateProductImageEmbedding(mainImageUrl);
	if (generateProductImageEmbeddingError)
		return {
			errorData: {
				message: generateProductImageEmbeddingError.message,
				details: [
					{
						function: "extractSanitizedProductData",
						args,
					},
				],
			},
		};

	const standardizedDimension = getStandardizedProductDimension({
		width: sanitizedData.width ?? undefined,
		height: sanitizedData.height ?? undefined,
		depth: sanitizedData.depth ?? undefined,
		dimensionUnit: sanitizedData.dimensionUnit,
	});

	const standardizedProductWeight = getStandardizedProductWeight({
		weight: sanitizedData.weight ?? undefined,
		weightUnit: sanitizedData.weightUnit,
	});

	return {
		data: {
			...baseProductData,
			...sanitizedData,
			...standardizedDimension,
			...standardizedProductWeight,

			productImageEmbedding,
		},
	};
}

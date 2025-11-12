import type {
	BaseProductDataMap,
	ProductDimensionInfo,
	ProductWeightInfo,
} from "@webhook/product/type.js";

import { convertDimensionsToInches, convertWeightToLbs } from "@webhook/util/conversion.js";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <Okay>
export function getBaseProductData(args: {
	productLine: string;
	productDataMap: BaseProductDataMap;
	delimiter: string;
	headerLine: string;
}) {
	const { productLine, productDataMap, delimiter, headerLine } = args;

	const values = productLine.split(delimiter);
	const headers = headerLine.split(delimiter);
	const dataObj = Object.fromEntries(headers.map((h, i) => [h, values[i]]));

	const map = productDataMap.map ? parseFloat(dataObj[productDataMap.map]) : NaN;

	const msrp = productDataMap.msrp ? parseFloat(dataObj[productDataMap.msrp]) : NaN;

	const unitPerBox = parseInt(dataObj[productDataMap.unitPerBox ?? "1"], 10);

	const imageUrls = extractProductImageUrls(productLine);

	const stockQty = parseInt(dataObj[productDataMap.stockQty ?? "0"], 10);
	const restockDate = productDataMap.restockDate
		? new Date(dataObj[productDataMap.restockDate]).getTime()
		: undefined;
	if (!restockDate && stockQty < 1) return undefined;

	const tradePrice = parseFloat(dataObj[productDataMap.tradePrice]);
	if (!tradePrice) return undefined;

	const sku = dataObj[productDataMap.sku];
	if (!sku) return undefined;

	const baseProductData = {
		line: productLine,
		sku,
		itemId: dataObj[productDataMap.itemId ?? "NA"],
		gtin: dataObj[productDataMap.gtin ?? "NA"],
		mpn: dataObj[productDataMap.mpn ?? "NA"],
		brand: dataObj[productDataMap.brand ?? "NA"],
		pdpLink: dataObj[productDataMap.pdpLink ?? "NA"],
		tradePrice,
		map: Number.isNaN(map) ? undefined : map <= 0 ? undefined : map,
		msrp: Number.isNaN(msrp) ? undefined : msrp <= 0 ? undefined : msrp,
		unitPerBox: Number.isNaN(unitPerBox) ? 1 : unitPerBox < 1 ? 1 : unitPerBox,
		stockQty,
		restockDate,
		imageUrls,
	};

	return baseProductData;
}

export function extractProductImageUrls(productLine: string) {
	const urlPattern = /https?:\/\/[^\s,]+/g;
	const imagePattern = /\.(jpg|jpeg|png|gif|svg|webp|bmp|tiff|ico)($|\?|#)/i;
	const cdnPattern = /(images?|img|cdn|static|media|assets|photos|gallery|resize|thumb)/i;

	const matches = productLine.match(urlPattern) || [];
	const urls = matches
		.filter((url) => imagePattern.test(url) || cdnPattern.test(url))
		.map((url) => url.trim());

	return [...new Set(urls)];
}

export function getStandardizedProductDimension(dimensionInfo?: ProductDimensionInfo) {
	if (!dimensionInfo)
		return {
			dimensionUnit: "in" as const,
		};

	const mainDimensionValuesInInches = convertDimensionsToInches(
		{
			width: dimensionInfo.width,
			height: dimensionInfo.height,
			depth: dimensionInfo.depth,
		},
		dimensionInfo.dimensionUnit
	);

	const mainDimensionValuesInInchesArray: {
		value: number;
		label: "W" | "H" | "D";
	}[] = [];
	if (dimensionInfo.width)
		mainDimensionValuesInInchesArray.push({
			value: mainDimensionValuesInInches.width,
			label: "W",
		});
	if (dimensionInfo.depth)
		mainDimensionValuesInInchesArray.push({
			value: mainDimensionValuesInInches.depth,
			label: "D",
		});
	if (dimensionInfo.height)
		mainDimensionValuesInInchesArray.push({
			value: mainDimensionValuesInInches.height,
			label: "H",
		});

	const mainDimensionStringFormat =
		mainDimensionValuesInInchesArray.length > 0
			? mainDimensionValuesInInchesArray
					.map((dimension) => `${dimension.value}"${dimension.label}`)
					.join(" x ")
			: null;

	return {
		dimension: mainDimensionStringFormat ?? undefined,
		width: mainDimensionValuesInInches.width,
		height: mainDimensionValuesInInches.height,
		depth: mainDimensionValuesInInches.depth,
		dimensionUnit: "in" as const,
	};
}

export function getStandardizedProductWeight(weightInfo?: ProductWeightInfo) {
	if (!weightInfo)
		return {
			weightUnit: "lb" as const,
		};

	// Main Weight
	const mainWeightValuesInLbs = convertWeightToLbs(weightInfo.weight, weightInfo.weightUnit);

	return {
		weight: mainWeightValuesInLbs.weight,
		weightUnit: "lb" as const,
	};
}

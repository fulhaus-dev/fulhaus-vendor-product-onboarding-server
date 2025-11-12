import type z from "zod";

import type { zProductFieldMapGeneratorSchema } from "@webhook/api/v1/webhook/file.stream/util/get-product-file-config.js";
import type { PublicApiType } from "@webhook/config/convex/convex.type.js";
import type {
	productCategories,
	productCurrencyCodes,
	productDataDimensionUnits,
	productDataWeightUnits,
} from "@webhook/product/constant.js";

export type ProductCategory = (typeof productCategories)[number];
export type ProductCurrencyCode = (typeof productCurrencyCodes)[number];

export type ProductCategoryCountCurrency = Record<`count${ProductCurrencyCode}`, number>;
export type ProductCategoryCount = Record<ProductCategory, ProductCategoryCountCurrency>;

export type BaseProductDataMap = z.infer<typeof zProductFieldMapGeneratorSchema>["map"];

export type BaseProductData = {
	line: string;
	sku: string;
	itemId: string;
	gtin: string;
	mpn: string;
	brand: string;
	pdpLink: string;
	tradePrice: number;
	map?: number;
	msrp?: number;
	unitPerBox: number;
	stockQty: number;
	restockDate?: number;
	imageUrls: string[];
};

export type ProductDataDimensionUnit = (typeof productDataDimensionUnits)[number];

export type ProductDimensionInfo = {
	width?: number;
	height?: number;
	depth?: number;
	dimensionUnit: ProductDataDimensionUnit;
};

export type ProductDataWeightUnit = (typeof productDataWeightUnits)[number];

export type ProductWeightInfo = {
	weight?: number;
	shippingWeight?: number;
	weightUnit: ProductDataWeightUnit;
};

export type CreateProduct =
	PublicApiType["v1"]["product"]["mutation"]["createPoProducts"]["_args"]["data"][0];

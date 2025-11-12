import { generateObject } from "ai";
import z, { type ZodNullable, type ZodString } from "zod";

import { googleGemini2_5FlashLite } from "@webhook/config/gemini.js";
import { asyncTryCatch } from "@webhook/util/try-catch.js";

export const AI_PRODUCT_DATA_MAP_GENERATOR_FIELD_NAMES = [
	{
		value: "sku",
		required: true,
		description: "The vendor field that represents the unique product identifier",
	},
	{
		value: "itemId",
		required: false,
		description: "The vendor field that represents a variant or specific item identifier",
	},
	{
		value: "gtin",
		required: false,
		description:
			"The vendor field that contains a global trade item number, UPC, EAN, or similar barcode",
	},
	{
		value: "mpn",
		required: false,
		description: "The vendor field that contains the manufacturer part number or model identifier",
	},
	{
		value: "brand",
		required: false,
		description: "The vendor field that identifies the brand or manufacturer name",
	},
	{
		value: "name",
		required: true,
		description: "The vendor field that contains the product name or title",
	},
	{
		value: "description",
		required: true,
		description: "The vendor field that contains the product description or detailed information",
	},
	{
		value: "pdpLink",
		required: false,
		description: "The vendor field that contains a URL or link to the product detail page",
	},
	{
		value: "tradePrice",
		required: true,
		description:
			"The vendor field that represents the wholesale or cost price (what you pay to purchase the product)",
	},
	{
		value: "map",
		required: false,
		description:
			"The vendor field that represents the minimum advertised price or lowest allowed selling price",
	},
	{
		value: "msrp",
		required: false,
		description:
			"The vendor field that represents the manufacturer suggested retail price or list price",
	},
	{
		value: "unitPerBox",
		required: false,
		description:
			"The vendor field that indicates quantity per package, case pack, or units per container",
	},
	{
		value: "stockQty",
		required: true,
		description: "The vendor field that represents current inventory quantity or stock level",
	},
	{
		value: "restockDate",
		required: false,
		description: "The vendor field that indicates when the product will be restocked or available",
	},
] as const;

type ZProductFieldMapSchemaFieldValue<T extends { required: boolean }> = T["required"] extends true
	? ZodString
	: ZodNullable<ZodString>;

type ZProductFieldMapSchemaFields = {
	[K in (typeof AI_PRODUCT_DATA_MAP_GENERATOR_FIELD_NAMES)[number] as K["value"]]: ZProductFieldMapSchemaFieldValue<
		Extract<(typeof AI_PRODUCT_DATA_MAP_GENERATOR_FIELD_NAMES)[number], { value: K["value"] }>
	>;
};

const zProductFieldMapSchemaFields = AI_PRODUCT_DATA_MAP_GENERATOR_FIELD_NAMES.reduce(
	(acc, fieldName) => {
		if (fieldName.required) acc[fieldName.value] = z.string().describe(fieldName.description);

		if (!fieldName.required)
			acc[fieldName.value] = z.string().nullable().describe(fieldName.description);

		return acc;
	},
	{} as ZProductFieldMapSchemaFields
);

export const zProductFieldMapGeneratorSchema = z
	.object({
		map: z
			.object(zProductFieldMapSchemaFields)
			.describe("The header field name mapping for the vendor product data file.")
			.strip(),
		delimiter: z.string().describe("The delimiter used in the vendor product data file."),
		headerLine: z.string().describe("The extracted header line from the vendor product data file."),
	})
	.strip();

const systemPrompt = `
You are a product data field mapping expert. Your task is to analyze vendor product data extract containing the header line and map their header fields to the standardized schema. 

You must:
1. Identify the delimiter used in the data file (tab, comma, pipe, etc.)
2. Extract the complete header line from the data
3. Map each vendor field to the closest equivalent in the target schema
4. Use exact field names from the vendor data - do not modify or transform them
5. If no equivalent field exists in the vendor data, return null for that mapping
6. Be precise with field matching - consider semantic meaning, not just name similarity

The target schema fields are: ${Object.keys(AI_PRODUCT_DATA_MAP_GENERATOR_FIELD_NAMES).join(", ")}.
`;

export default async function productFileSimpleHeaderMapGeneratorAi(
	productDataLinesExtract: string[]
) {
	const { data, error } = await asyncTryCatch(() =>
		generateObject({
			model: googleGemini2_5FlashLite,
			system: systemPrompt,
			schema: zProductFieldMapGeneratorSchema,
			prompt: `Analyze the provided vendor product data and create a field mapping. The data contains product information with various fields that need to be mapped to our standardized schema.
      
      Examine the header structure, identify the delimiter, and map each vendor field name to the most appropriate target schema field. Return the exact vendor field names as they appear in the data.
      
      Vendor product data extract with header:
      ${productDataLinesExtract.join("\n")}`,
		})
	);

	if (error)
		return {
			error,
		};

	return {
		data: data.object,
	};
}

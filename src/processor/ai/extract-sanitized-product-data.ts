import { generateObject, type ImagePart } from "ai";
import z from "zod";

import { googleGemini2_5FlashLite } from "@webhook/config/gemini.js";
import {
	productCategories,
	productCurrencyCodes,
	productDataDimensionUnits,
	productDataWeightUnits,
	productStyles,
} from "@webhook/product/constant.js";
import { asyncTryCatch } from "@webhook/util/try-catch.js";

const SYSTEM_PROMPT = `
You are a furniture product data extractor. Analyze the product info and product images provided by the user and
return ONLY valid JSON matching the schema.

**DETECT PRODUCT MAIN IMAGE**:
    Things to check, is it the only image? does it have a clear solid background? it does not contain any other items or elements apart from the image? If all of this is true, then it is the main image. If not check the next image and repeat the process until you find the main image. If you cant find a main image that fits this criteria then return null for the mainImageImageIndex.

    *MAIN PRODUCT IMAGE CRITERIA*:
    - Clean, white solid background
    - Shows the ENTIRE product with no parts cut off, not top, bottom, sides, etc. Most be a professional product photography style
    - Product is centered and clearly visible
    - No lifestyle context (people, scenes, environments)
    - Straight-on or standard product photography angle
    - No props, decorations, or additional items
    - Professional product photography style
    - For products like curtains, blinds, rugs it must be the image showing the entire product, no other elements or lifestyle features
    - For an artwork product, it must be the image showing the entire artwork ONLY (with or without the frame)
    - For lamps, pendants, sconce, floor lamp, ceiling lamps, chandelier or clocks, it must be the image showing the entire product, no other elements or lifestyle features

    *MAIN PRODUCT REJECT CRITERIA*:
    - Top, side, or bottom view
    - Lifestyle images (product in use, with people, in real environments)
    - Partial views or close-ups of product details
    - Top views or overhead shots
    - Angled or artistic shots
    - Image with busy/textured backgrounds
    - Image with multiple products unless they're a set
    - Image with text overlays or graphics
    - Packaging-only images (unless that IS the product)
    - Image with dimension values or metrics
    - Product not centered
    - Image with non-professional photography style
    - Image with props, decorations, or additional items
    - Image with lifestyle context (people, scenes, environments)
    - Artwork frame image
    - Part of an image
    - Artwork in space or lifestyle context
    - Stone walls, Fireplace and Fire pit

**GENERATE PRODUCT STYLES BASED ON THE DETECTED MAIN IMAGE**:
    - Color Names: Generate an array of all the color names based on the detected main image.
    - Color Hexes: Generate an array of all the color hexes based on the detected main image.
    - Material: Generate an array of all materials the product is made of based on the detected main image and information in the product info.
    - Styles: Assign the applicable styles from the provided style list based on the detected main image.
    *Style list*:
    ${productStyles.join("\n")}.

**DETECT AND ASSIGN STANDARDIZED DIMENSION AND METRIC UNIT**:
    - Width: The product width value in the product info.
    - Height: The product height value in the product info.
    - Depth: The product depth value in the product info.
    - Dimension Unit: Assign the equivalent dimension unit from the product info from the provided dimension unit list.
    *Dimension unit list*:
    ${productDataDimensionUnits.join("\n")}.

**DETECT AND ASSIGN STANDARDIZED WEIGHT AND METRIC UNIT**:
    - Weight: The product weight value in the product info.
    - Weight Unit: Assign the equivalent weight unit from the product info from the provided weight unit list.
    *Weight unit list*:
    ${productDataWeightUnits.join("\n")}.

**DETECT AND ASSIGN STANDARDIZED CURRENCY CODE**:
    - Currency Code: The equivalent currency ISO currency code, must be the equivalent of one of the provided currency codes.
     *Currency code list*:
    ${productCurrencyCodes.join("\n")}.

**NAME, DESCRIPTION AND CATEGORY**:
    - Product name: Generate a new descriptive name for the product based on the detected main image.
    - Product Description: Generate a new 2+ sentence description for the product based on the detected main image.
    - Category: Assign the applicable category from the provided category list based on the detected main image and product info.
    Category list:
    ${productCategories.join("\n")}.

**PRODUCT LOCATION**:
    - Generate the warehouse address location for the product based on the product info if available.
	- The location in the product info can be a country code, zip code, state code, city, address, etc. Generate a fitting address location based on any limited info in the product info that can be used to get the latitude and longitude of the product location later.
`;

export async function extractSanitizedProductData(args: {
	imageUrls: string[];
	productInfo: string;
}) {
	const { imageUrls, productInfo } = args;

	const outputSchema = z.object({
		// 1. Main Image
		mainImageImageIndex: z
			.enum(imageUrls.map((_, index) => `${index}`))
			.nullable()
			.describe("The detected main image index (0-indexed)"),

		// 2. Style (Colors, Materials, Style)
		colorNames: z
			.array(z.string())
			.describe("The applicable color names for the product based on the detected main image"),
		hexColors: z
			.array(z.string())
			.describe("The applicable hex colors for the product based on the detected main image"),
		materials: z
			.array(z.string())
			.describe("The applicable materials for the product based on the detected main image"),
		styles: z
			.array(z.enum(productStyles))
			.describe("The applicable styles for the product based on the detected main image"),

		// 3. Dimension
		width: z.optional(z.number()).describe("The width of the product if available"),
		height: z.optional(z.number()).describe("The height of the product if available"),
		depth: z.optional(z.number()).describe("The depth of the product if available"),
		dimensionUnit: z.enum(productDataDimensionUnits),

		// 4. Weight
		weight: z.optional(z.number()).describe("The weight of the product if available"),
		weightUnit: z.enum(productDataWeightUnits),

		// 5. Currency Code
		currencyCode: z
			.enum(productCurrencyCodes)
			.describe(
				"The equivalent currency ISO currency code, must be the equivalent of one of the provided currency codes."
			),

		// 6. Name, Desc, Category
		name: z
			.string()
			.describe(
				"A new generated descriptive name for the product based on the detected main image."
			),
		description: z
			.string()
			.describe(
				"A new generated detailed description of at least 2 sentences that is a complete product information based on the detected main image and product info."
			),
		category: z
			.optional(z.enum(productCategories))
			.describe(
				"The category that best matches the product from the provided category list if there is a match."
			),

		// 7. Product Location
		location: z
			.optional(z.string())
			.describe(
				"A generated address location for the product based on the product info if available."
			),
	});

	const userPromptImagePart: ImagePart[] = imageUrls.map((imageUrl) => ({
		type: "image",
		image: imageUrl,
	}));

	const { data, error } = await asyncTryCatch(() =>
		generateObject({
			model: googleGemini2_5FlashLite,
			system: SYSTEM_PROMPT,
			messages: [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: `
              Product Info:

              ${productInfo}`,
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: `
            ${imageUrls.length} Product images to get main image from following the criteria:

            Things to check, is it the only image? does it have a clear solid background? it does not contain any other items or elements apart from the image? If all of this is true, then it is the main image. If not check the next image and repeat the process until you find the main image. If you cant find a main image that fits this criteria then return null for the mainImageImageIndex.
              
              *MAIN PRODUCT IMAGE CRITERIA*:
                - Clean, white solid background
                - Shows the ENTIRE product with no parts cut off, not top, bottom, sides, etc. Most be a professional product photography style
                - Product is centered and clearly visible
                - No lifestyle context (people, scenes, environments)
                - Straight-on or standard product photography angle
                - No props, decorations, or additional items
                - Professional product photography style
                - For products like curtains, blinds, rugs it must be the image showing the entire product, no other elements or lifestyle features
                - For an artwork product, it must be the image showing the entire artwork ONLY (with or without the frame)
                - For lamps, pendants, sconce, floor lamp, ceiling lamps, chandelier or clocks, it must be the image showing the entire product, no other elements or lifestyle features

              *MAIN PRODUCT REJECT CRITERIA*:
                - Top, side, or bottom view
                - Lifestyle images (product in use, with people, in real environments)
                - Partial views or close-ups of product details
                - Top views or overhead shots
                - Angled or artistic shots
                - Image with busy/textured backgrounds
                - Image with multiple products unless they're a set
                - Image with text overlays or graphics
                - Packaging-only images (unless that IS the product)
                - Image with dimension values or metrics
                - Product not centered
                - Image with non-professional photography style
                - Image with props, decorations, or additional items
                - Image with lifestyle context (people, scenes, environments)
                - Artwork frame image
                - Part of an image
                - Artwork in space or lifestyle context
                - Stone walls, Fireplace and Fire pit
              `,
						},
						...userPromptImagePart,
					],
				},
			],
			temperature: 0,
			schema: outputSchema,
		})
	);

	if (error) return { error };

	return {
		data: data.object,
	};
}

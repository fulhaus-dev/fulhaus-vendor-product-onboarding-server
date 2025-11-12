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
You are a very thorough furniture product data expert that can extract or generate a standard product data from the product info and product images provided by the user without any errors.

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

**GENERATE COLORS**:
	- Color Names: Generate an array of all the color names based on the detected main image.
    - Color Hexes: Generate an array of all the color hexes based on the detected main image.

**GENERATE MATERIALS**:
	- Materials: Generate an array of all materials the product is made of based on the detected main image and information in the product info.

**ASSIGN PRODUCT STYLES (ONLY FROM THE PROVIDED LIST) BASED ON THE DETECTED MAIN IMAGE**:
	**IMPORTANT!**: Ensure the style assigned is in the list of styles provided.
    - Styles: Assign the applicable styles from the provided style list based on the detected main image. Do not make up styles or return any styles that are not in the list and must be exactly as spelled, no correction.

**DIMENSION INFORMATION**:
	- Extract the part of the product info that contains the dimension information as is.

**DIMENSION VALUES**:
    - Width: Extract the product width value in the product info.
    - Height: Extract the product height value in the product info.
    - Depth: Extract the product depth value in the product info.
	**IMPORTANT!**: Ensure the correct values for width, height, and depth are extracted from the product info. Do not mix up width and depth values.

**ASSIGN DIMENSION METRIC UNIT (ONLY FROM THE PROVIDED LIST)**
	**IMPORTANT!**: Ensure the dimension unit assigned is in the list of dimension units provided.
    - Dimension Unit: Assign the equivalent dimension unit from the product info from the provided dimension unit list. Do not make up dimension units or return any dimension units that are not in the list and must be exactly as spelled, no correction.

**WEIGHT VALUE**:
    - Weight: The product weight value in the product info.

**ASSIGN WEIGHT METRIC UNIT (ONLY FROM THE PROVIDED LIST)**
	**IMPORTANT!**: Ensure the weight unit assigned is in the list of weight units provided.
    - Weight Unit: Assign the equivalent weight unit from the product info from the provided weight unit list.  Do not make up weight units or return any weight units that are not in the list and must be exactly as spelled, no correction.

**ASSIGN CURRENCY CODE (ONLY FROM THE PROVIDED LIST)**:
	**IMPORTANT!**: Ensure the currency code assigned is in the list of currency codes provided.
    - Currency Code: The equivalent currency ISO currency code, must be the equivalent of one of the provided currency codes. Do not make up currency codes or return any currency codes that are not in the list and must be exactly as spelled, no correction.

**NAME, DESCRIPTION**:
    - Product name: Generate a new descriptive name for the product based on the detected main image.
    - Product Description: Generate a new 2+ sentence description for the product based on the detected main image.

**ASSIGN CATEGORY**:
	**IMPORTANT!**: Ensure the category assigned is in the list of categories provided.
    - Category: Assign the applicable category from the provided category list based on the detected main image and product info.  Do not make up categories or return any categories that are not in the list and must be exactly as spelled, no correction.

**PRODUCT LOCATION**:
    - Generate the warehouse address location for the product based on the product info if available.
	- The location in the product info can be a country code, zip code, state code, city, address, etc. Generate a fitting address location based on any limited info in the product info that can be used to get the latitude and longitude of the product location later.
	- The generated address location should not be a code, for example instead of returning US, return United States, instead of CA, return Canada, if its a state code like CA, return California, United State. It must be an address not a code.
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
			.describe("The detected main image index (0-indexed) as string"),

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
		styles: z.array(z.enum(productStyles)).describe(
			`The applicable styles from this list for the product based on the detected main image

				 ${productStyles.join("\n")}.
				
				Do not make up styles or return any styles that are not in the list and must be exactly as spelled, no correction`
		),

		// 3. Dimension
		dimensionExtract: z
			.string()
			.nullable()
			.describe(
				"The part of the product info that contains the dimension information extracted if available"
			),
		width: z
			.optional(z.number())
			.nullable()
			.describe("The extracted width of the product if available"),
		height: z
			.optional(z.number())
			.nullable()
			.describe("The extracted height of the product if available"),
		depth: z
			.optional(z.number())
			.nullable()
			.describe("The extracted depth of the product if available"),
		dimensionUnit: z
			.optional(z.enum(productDataDimensionUnits))
			.nullable()
			.describe(
				`The equivalent dimension unit from this list:

				 ${productDataDimensionUnits.join("\n")}.
				
				Do not make up dimension units or return any dimension units that are not in the list and must be exactly as spelled, no correction`
			),

		// 4. Weight
		weight: z.optional(z.number()).nullable().describe("The weight of the product if available"),
		weightUnit: z
			.optional(z.enum(productDataWeightUnits))
			.nullable()
			.describe(
				`The equivalent weight unit from this list:

				${productDataWeightUnits.join("\n")}.

				 Do not make up weight units or return any weight units that are not in the list and must be exactly as spelled, no correction`
			),

		// 5. Currency Code
		currencyCode: z.enum(productCurrencyCodes).describe(
			`The equivalent currency ISO currency code from this list. 

				${productCurrencyCodes.join("\n")}.
				
				Do not make up currency codes or return any currency codes that are not in the list and must be exactly as spelled, no correction.`
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
			.nullable()
			.describe(
				`The category that best matches the product from this list if there is a match. 

				${productCategories.join("\n")}
				
				Do not make up categories or return any categories that are not in the list and must be exactly as spelled, no correction.`
			),

		// 7. Product Location
		location: z
			.optional(z.string())
			.nullable()
			.describe(
				"A generated address location for the product based on the product info if available.  The generated address location should not be a code, for example instead of returning US, return United States, instead of CA, return Canada, if its a state code like CA, return California, United State. It must be an address not a code."
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
			schema: outputSchema,
			temperature: 0,
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
		})
	);

	if (error) return { error };

	return {
		data: data.object,
	};
}

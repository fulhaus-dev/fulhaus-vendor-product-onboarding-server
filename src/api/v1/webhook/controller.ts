import type { Request, Response } from "express";

import { vendorProductWebhookService } from "@webhook/api/v1/webhook/service.js";

export async function vendorProductWebhookController(req: Request, res: Response) {
	const { r2FolderName, fileNameToProcess, ownerId } = req.body;

	vendorProductWebhookService({
		vendorProductDataR2FolderName: r2FolderName,
		fileNameToProcess,
		ownerId,
	});

	res.json({ message: "Webhook Received!" });
}

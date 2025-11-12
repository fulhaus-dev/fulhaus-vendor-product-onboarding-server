import type { Request, Response } from "express";

import { vendorProductWebhookService } from "@webhook/api/v1/webhook/service.js";

export async function vendorProductWebhookController(req: Request, res: Response) {
	const { r2FolderName } = req.body;

	vendorProductWebhookService(r2FolderName);

	res.json({ message: "Webhook Received!" });
}

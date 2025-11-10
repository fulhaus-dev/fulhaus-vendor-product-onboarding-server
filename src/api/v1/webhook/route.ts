import { Router } from "express";

import { vendorProductWebhookReceiver } from "@webhook/api/v1/webhook/controller.js";

const webhookRouter = Router();

/**  Base Route path - /api/v1/webhook */

// Route - POST: /api/v1/webhook/:webhookId
webhookRouter.post("/:webhookId", vendorProductWebhookReceiver);

export default webhookRouter;

import { Router } from "express";

import { vendorProductWebhookController } from "@webhook/api/v1/webhook/controller.js";
import { authorization } from "@webhook/middleware/authorization.js";

const webhookRouter = Router();

/**  Base Route path - /api/v1/webhook */

// Route - POST: /api/v1/webhook/:webhookId
webhookRouter.post("/:webhookId", authorization, vendorProductWebhookController);

export default webhookRouter;

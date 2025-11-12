import { ConvexHttpClient } from "convex/browser";

import { env } from "@webhook/config/environment.js";

export const convexHttpClient = new ConvexHttpClient(env.CONVEX_URL);

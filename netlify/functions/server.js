import { createRequestHandler } from "@remix-run/node";
import * as remixBuild from "../../build/server/nodejs-eyJydW50aW1lIjoibm9kZWpzIn0/index.js";

const handler = createRequestHandler({
  build: remixBuild,
  mode: process.env.NODE_ENV || "production",
});

export { handler };

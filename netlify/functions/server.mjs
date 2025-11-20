import { createRequestHandler } from "@netlify/remix-adapter";

export default createRequestHandler({
  build: () => import("../../build/server/nodejs-eyJydW50aW1lIjoibm9kZWpzIn0/index.js"),
});

import { createRequestHandler } from "@remix-run/node";

const handler = async (event, context) => {
  const build = await import("../../build/server/nodejs-eyJydW50aW1lIjoibm9kZWpzIn0/index.js");
  const requestHandler = createRequestHandler({
    build,
    mode: process.env.NODE_ENV,
  });
  return requestHandler(event, context);
};

export { handler };

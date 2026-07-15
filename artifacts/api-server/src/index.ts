import app from "./app";
import { logger } from "./lib/logger";
import { runStartupValidation } from "./services/knowledge-indexing-service";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Non-blocking: validate knowledge index and auto-index on first run
  runStartupValidation().catch((startupErr) => {
    logger.error({ err: startupErr }, "Knowledge index startup validation failed");
  });
});

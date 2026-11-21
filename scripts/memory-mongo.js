import { MongoMemoryServer } from "mongodb-memory-server";

(async () => {
  const mongod = await MongoMemoryServer.create({ instance: { port: 27017, ip: "127.0.0.1" } });
  console.log(`[memory-mongo] ready at ${mongod.getUri()}`);
  const shutdown = async () => {
    await mongod.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})().catch((err) => {
  console.error("[memory-mongo] failed:", err);
  process.exit(1);
});

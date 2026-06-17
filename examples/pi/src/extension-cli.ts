import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { config } from "dotenv";

config();

async function startCollector(): Promise<{
  baseUrl: string;
  payloads: unknown[];
  close: () => Promise<void>;
}> {
  const payloads: unknown[] = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }

    payloads.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not start local collector");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    payloads,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

async function runPiWithExtension(baseUrl: string): Promise<number | null> {
  const prompt =
    process.argv.slice(2).join(" ") || "Say hello in one short sentence.";

  const child = spawn("./node_modules/.bin/pi", ["--no-tools", "-p", prompt], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TCC_API_KEY: "test-key",
      TCC_BASE_URL: baseUrl,
      TCC_DEBUG: "true",
    },
    stdio: "inherit",
  });

  return new Promise((resolve) => {
    child.on("close", resolve);
  });
}

async function main(): Promise<void> {
  const collector = await startCollector();

  try {
    const code = await runPiWithExtension(collector.baseUrl);
    if (code !== 0) {
      throw new Error(`Pi exited with code ${code}`);
    }

    console.log("\n[TCC collector] payload summary:");
    console.log(
      JSON.stringify(
        collector.payloads.map((payload: any) => ({
          runId: payload.runId,
          messages: payload.messages?.length ?? 0,
          toolExecutions: payload.toolExecutions?.length ?? 0,
          conversational: payload.conversational,
          metadata: payload.metadata,
        })),
        null,
        2
      )
    );

    if (collector.payloads.length !== 1) {
      throw new Error(`Expected 1 payload, got ${collector.payloads.length}`);
    }
  } finally {
    await collector.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

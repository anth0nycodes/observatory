import { registerOTel } from "@vercel/otel";
import { startWebSocketServer } from "./ws";
import { tccLocalSpanProcessor } from "./runtime";

startWebSocketServer();
registerOTel({
  spanProcessors: [tccLocalSpanProcessor()],
});

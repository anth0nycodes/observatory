// deprecated, use the ws server instead

import { tccLocalExporter } from "./runtime";

export const dynamic = "force-dynamic";

// TODO: strict types for events
const constructEvent = (type: string, data: any) => {
  const encoder = new TextEncoder();
  const dataToEncode = JSON.stringify({ type, data });
  return encoder.encode(`data: ${dataToEncode}\n\n`);
};

export async function streamRuns(): Promise<Response> {
  // TODO: should we just delete this file
  console.warn("TCC: streamRuns is deprecated, use the ws server instead");

  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const initialStore = tccLocalExporter.getDataStore();

      // todo: maybe only send the most recent x items?
      controller.enqueue(constructEvent("initialStore", initialStore));

      unsubscribe = tccLocalExporter.subscribe((newItems) => {
        controller.enqueue(constructEvent("newItems", newItems));
      });
    },
    cancel() {
      if (unsubscribe) {
        unsubscribe();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

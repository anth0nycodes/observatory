import { registerOTelTCC } from "@contextcompany/otel/nextjs";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs")
    registerOTelTCC({
      local: true,
      debug: true,
    });
}

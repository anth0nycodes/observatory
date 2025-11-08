export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("http://localhost:3002/nextjs/local/auto.global.js");
  }
}

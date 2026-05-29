/**
 * Next.js instrumentation hook — runs once on server startup (Node.js runtime only).
 * Used to apply lightweight database schema migrations before the first request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runMigrations } = await import("./lib/migrations")
    await runMigrations()
  }
}

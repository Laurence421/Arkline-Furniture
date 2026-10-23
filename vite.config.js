import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";

const page = p => fileURLToPath(new URL(p, import.meta.url));

// Dev only: serve /api/quote from api/quote.js so `npm run dev:static` works without `vercel dev`.
// With no Supabase keys in .env.local it answers in demo mode (logs the request, saves nothing).
const devApi = () => ({
  name: "dev-api",
  configureServer(server) {
    Object.assign(process.env, loadEnv("development", process.cwd(), ""));
    server.middlewares.use("/api/quote", async (req, res) => {
      if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
      const request = new Request("http://localhost/api/quote", {
        method: "POST", headers: req.headers, body: Readable.toWeb(req), duplex: "half"
      });
      let response;
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const fd = await request.formData();
        console.log("\n[demo] quotation request (not saved):", Object.fromEntries([...fd].map(([k, v]) => [k, typeof v === "string" ? v : `${v.name} (${v.size} B)`])));
        response = Response.json({ ok: true, demo: true });
      } else {
        const { POST } = await server.ssrLoadModule("/api/quote.js");
        response = await POST(request);
      }
      res.statusCode = response.status;
      response.headers.forEach((v, k) => res.setHeader(k, v));
      res.end(Buffer.from(await response.arrayBuffer()));
    });
  }
});

export default defineConfig({
  plugins: [devApi()],
  server: { port: 5173, host: true },
  build: {
    rollupOptions: {
      input: { main: page("index.html"), admin: page("admin.html") }
    }
  }
});

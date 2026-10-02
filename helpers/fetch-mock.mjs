// Test helpers: a programmable fetch mock and a tiny local HTTP server.
// Kept outside test/ so the Node test runner's discovery never treats them as tests.

/** Create a fetch mock. `handler(url, init, call#)` returns a Response (or throws). */
export function mockFetch(handler) {
  const calls = [];
  const fn = async (url, init = {}) => {
    const record = { url: String(url), init, method: (init.method ?? "GET").toUpperCase() };
    calls.push(record);
    const res = await handler(record.url, init, calls.length);
    return res;
  };
  fn.calls = calls;
  fn.reset = () => {
    calls.length = 0;
  };
  return fn;
}

/** JSON Response helper. */
export function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

/** Audio Response helper. */
export function audio(bytes = [1, 2, 3, 4], contentType = "audio/wav", headers = {}) {
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { "content-type": contentType, ...headers },
  });
}

/** PatientDesk-shaped error Response. */
export function errorResponse({ status = 400, message = "bad", code, details, retryAfter } = {}) {
  const headers = { "content-type": "application/json" };
  if (retryAfter !== undefined) headers["retry-after"] = String(retryAfter);
  return new Response(
    JSON.stringify({ error: { message, code, ...(details ? { details } : {}) } }),
    { status, headers },
  );
}

/** Always-rejecting fetch, to exercise the network-failure path. */
export function failingFetch(cause = new Error("ECONNREFUSED")) {
  return mockFetch(async () => {
    throw cause;
  });
}

/** Start an http.Server that returns a fixed response shape; returns { url, close }. */
export async function startServer(handler) {
  const { createServer } = await import("node:http");
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      let parsed;
      try {
        parsed = raw ? JSON.parse(raw) : undefined;
      } catch {
        parsed = raw;
      }
      Promise.resolve(handler({ method: req.method, url: req.url, body: parsed, headers: req.headers }))
        .then((result) => {
          const status = result?.status ?? 200;
          const body = result?.body ?? {};
          res.writeHead(status, { "content-type": "application/json", ...(result?.headers ?? {}) });
          res.end(typeof body === "string" ? body : JSON.stringify(body));
        })
        .catch((err) => {
          res.writeHead(500, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: { message: String(err) } }));
        });
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve) => {
        // Keep-alive sockets would otherwise hold the server (and the test
        // runner) open; drop them before closing.
        server.closeAllConnections?.();
        server.close(resolve);
      }),
  };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

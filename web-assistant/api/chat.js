export const config = {
  maxDuration: 180,
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: { message: "Only POST is supported." } });
    return;
  }

  const baseUrl = process.env.UPSTREAM_BASE_URL;
  const apiKey = process.env.UPSTREAM_API_KEY;
  if (!baseUrl) {
    response.status(500).json({
      error: { message: "Server is missing UPSTREAM_BASE_URL." },
    });
    return;
  }

  let payload = request.body;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch (_error) {
      response.status(400).json({ error: { message: "Invalid JSON body." } });
      return;
    }
  }
  if (!payload || typeof payload !== "object") {
    response.status(400).json({ error: { message: "Missing request body." } });
    return;
  }

  const protocol = Array.isArray(payload.input) ? "responses" : "chat";
  const upstreamUrl =
    baseUrl.replace(/\/+$/, "") +
    (protocol === "responses" ? "/responses" : "/chat/completions");
  const headers = {
    "Content-Type": "application/json",
    Accept: request.headers.accept || "text/event-stream, application/json",
  };
  if (apiKey) {
    headers.Authorization = "Bearer " + apiKey;
  }
  if (process.env.UPSTREAM_ORGANIZATION) {
    headers["OpenAI-Organization"] = process.env.UPSTREAM_ORGANIZATION;
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
    });

    response.statusCode = upstream.status;
    response.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "application/json"
    );
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");

    if (!upstream.body) {
      response.end();
      return;
    }

    const reader = upstream.body.getReader();
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) {
          break;
        }
        response.write(Buffer.from(chunk.value));
      }
    } finally {
      reader.releaseLock();
    }
    response.end();
  } catch (error) {
    response.status(502).json({
      error: {
        message: error && error.message ? error.message : "Upstream request failed.",
      },
    });
  }
}

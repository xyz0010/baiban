const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8080);
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, "public");
const UPLOAD_DIR =
  process.env.OFFICE_PREVIEW_UPLOAD_DIR ||
  path.join(os.tmpdir(), "office-preview");
const MAX_UPLOAD_BYTES = Number(
  process.env.OFFICE_PREVIEW_MAX_UPLOAD_BYTES || 20 * 1024 * 1024,
);
const TTL_MS = Number(process.env.OFFICE_PREVIEW_TTL_MS || 60 * 60 * 1000);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/** @type {Map<string, { filename: string, mimeType: string, created: number }>} */
const uploads = new Map();

const getBaseUrl = (req) => {
  const proto = (req.headers["x-forwarded-proto"] || "http")
    .toString()
    .split(",")[0]
    .trim();
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "")
    .toString()
    .split(",")[0]
    .trim();
  return `${proto}://${host}`;
};

const send = (res, statusCode, headers, body) => {
  res.writeHead(statusCode, headers);
  res.end(body);
};

const sendJson = (res, statusCode, obj) => {
  send(res, statusCode, { "content-type": "application/json" }, JSON.stringify(obj));
};

const safeDecodeURIComponent = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const cleanupExpired = () => {
  const now = Date.now();
  for (const [id, meta] of uploads.entries()) {
    if (now - meta.created > TTL_MS) {
      uploads.delete(id);
      const filePath = path.join(UPLOAD_DIR, id);
      fs.rm(filePath, { force: true }, () => {});
    }
  }
};

setInterval(cleanupExpired, Math.max(30_000, Math.floor(TTL_MS / 2))).unref?.();

const serveStatic = (req, res) => {
  const url = new URL(req.url, getBaseUrl(req));
  const pathname = decodeURIComponent(url.pathname);

  let filePath = path.join(PUBLIC_DIR, pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    send(res, 403, { "content-type": "text/plain" }, "Forbidden");
    return;
  }

  const hasExt = path.extname(filePath).length > 1;
  if (!hasExt) {
    filePath = path.join(PUBLIC_DIR, "index.html");
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      send(res, 404, { "content-type": "text/plain" }, "Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      ext === ".html"
        ? "text/html; charset=utf-8"
        : ext === ".js"
          ? "text/javascript; charset=utf-8"
          : ext === ".css"
            ? "text/css; charset=utf-8"
            : ext === ".svg"
              ? "image/svg+xml"
              : ext === ".png"
                ? "image/png"
                : ext === ".json"
                  ? "application/json"
                  : ext === ".woff2"
                    ? "font/woff2"
                    : "application/octet-stream";

    res.writeHead(200, { "content-type": contentType });
    fs.createReadStream(filePath).pipe(res);
  });
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, getBaseUrl(req));

  if (req.method === "POST" && url.pathname === "/api/office-preview") {
    const filenameHeader = req.headers["x-file-name"];
    const filename = safeDecodeURIComponent(
      Array.isArray(filenameHeader) ? filenameHeader[0] : filenameHeader || "document",
    );
    const mimeType =
      (req.headers["content-type"] || "application/octet-stream").toString();

    let receivedBytes = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      receivedBytes += chunk.length;
      if (receivedBytes > MAX_UPLOAD_BYTES) {
        sendJson(res, 413, { error: "File too large" });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      const id = crypto.randomUUID();
      const filePath = path.join(UPLOAD_DIR, id);
      const buffer = Buffer.concat(chunks);
      fs.writeFile(filePath, buffer, (err) => {
        if (err) {
          sendJson(res, 500, { error: "Failed to persist file" });
          return;
        }
        uploads.set(id, { filename, mimeType, created: Date.now() });
        sendJson(res, 200, {
          url: `${getBaseUrl(req)}/api/office-preview/${id}/${encodeURIComponent(filename)}`,
        });
      });
    });

    req.on("error", () => {
      sendJson(res, 400, { error: "Bad request" });
    });
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/office-preview/")) {
    const parts = url.pathname.split("/");
    const id = parts[3];
    const meta = id ? uploads.get(id) : undefined;
    if (!id || !meta) {
      send(res, 404, { "content-type": "text/plain" }, "Not found");
      return;
    }

    const filePath = path.join(UPLOAD_DIR, id);
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        send(res, 404, { "content-type": "text/plain" }, "Not found");
        return;
      }

      res.writeHead(200, {
        "content-type": meta.mimeType || "application/octet-stream",
        "content-length": stat.size,
        "cache-control": "public, max-age=3600",
        "access-control-allow-origin": "*",
        "content-disposition": `inline; filename="${encodeURIComponent(meta.filename)}"`,
      });

      fs.createReadStream(filePath).pipe(res);
    });
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, "0.0.0.0");

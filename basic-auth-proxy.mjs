import http from "node:http";
import { request as httpRequest } from "node:http";

const USER = process.env.BASIC_AUTH_USER || "oliver";
const PASS = process.env.BASIC_AUTH_PASS || "herpderp";
const PUBLIC_PORT = Number(process.env.PUBLIC_PORT || 10080);
const TARGET_HOST = process.env.TARGET_HOST || "127.0.0.1";
const TARGET_PORT = Number(process.env.TARGET_PORT || 3005);

function unauthorized(res) {
  res.statusCode = 401;
  res.setHeader("WWW-Authenticate", 'Basic realm="excaliflow"');
  res.end("Unauthorized\n");
}

function checkAuth(req) {
  const hdr = req.headers["authorization"];
  if (!hdr || !hdr.startsWith("Basic ")) return false;
  const raw = Buffer.from(hdr.slice(6), "base64").toString("utf8");
  const [u, p] = raw.split(":");
  return u === USER && p === PASS;
}

const server = http.createServer((req, res) => {
  if (!checkAuth(req)) return unauthorized(res);

  const opts = {
    host: TARGET_HOST,
    port: TARGET_PORT,
    method: req.method,
    path: req.url,
    headers: {
      ...req.headers,
      host: `${TARGET_HOST}:${TARGET_PORT}`,
    },
  };

  const upstream = httpRequest(opts, (up) => {
    res.writeHead(up.statusCode || 502, up.headers);
    up.pipe(res);
  });

  upstream.on("error", (err) => {
    res.statusCode = 502;
    res.end(`Bad gateway: ${err.message}\n`);
  });

  req.pipe(upstream);
});

server.listen(PUBLIC_PORT, "0.0.0.0", () => {
  console.log(
    `Basic-auth proxy listening on :${PUBLIC_PORT} -> http://${TARGET_HOST}:${TARGET_PORT} (user=${USER})`,
  );
});

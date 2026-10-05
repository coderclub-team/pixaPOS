/**
 * Minimal local HTTPS demo for https://local.pixapos.store:3000.
 *
 * Uses the OpenSSL files in ../certificates (pixa.key / pixa.crt, SAN from
 * server.ext). Plain node:https — no dependencies, so it runs anywhere.
 * The real app is served by `next dev` with the same files; this script is
 * the standalone proof that the cert + hostname + port work.
 *
 * Run:  node scripts/local-https-demo.js [PORT]
 * Open: https://local.pixapos.store:3000/  (accept the self-signed warning)
 */
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.argv[2] || process.env.PORT || 3000);

const dir = path.join(__dirname, "..", "certificates");
const options = {
  key: fs.readFileSync(path.join(dir, "pixa.key")),
  cert: fs.readFileSync(path.join(dir, "pixa.crt")),
};

https
  .createServer(options, (req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        host: req.headers.host,
        message: "pixaPOS local HTTPS is working (self-signed pixa.crt)",
      }),
    );
  })
  .listen(PORT, "0.0.0.0", () => {
    console.log(`HTTPS demo on https://local.pixapos.store:${PORT}/`);
  });

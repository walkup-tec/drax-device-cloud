const http = require("http");
const name = process.env.SERVICE_NAME || "stub";
const port = Number(process.env.PORT || 4099);
http
  .createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: name, role: "mvp-stub" }));
  })
  .listen(port, () => {
    process.stdout.write(`${name} stub on ${port}\n`);
  });

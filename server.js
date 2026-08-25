/* Мінімальний статичний сервер для Railway. Без залежностей. */
var http = require("http");
var fs = require("fs");
var path = require("path");

var PORT = process.env.PORT || 3000;
var SYNC_KEY = process.env.SYNC_KEY || "";
var DATA_FILE = path.join(process.env.DATA_DIR || __dirname, "data.json");
var JSONH = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
var sseClients = [];
function broadcast(payload) {
  var msg = "data: " + JSON.stringify(payload) + "\n\n";
  for (var i = sseClients.length - 1; i >= 0; i--) {
    try { sseClients[i].write(msg); } catch (e) { sseClients.splice(i, 1); }
  }
}
/* heartbeat, щоб проксі Railway не рвав з'єднання */
setInterval(function () {
  for (var i = sseClients.length - 1; i >= 0; i--) {
    try { sseClients[i].write(": ping\n\n"); } catch (e) { sseClients.splice(i, 1); }
  }
}, 25000);
var TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

http.createServer(function (req, res) {
  var p = decodeURIComponent(req.url.split("?")[0]);

  /* ---- живий канал оновлень (SSE) ---- */
  if (p === "/api/events") {
    var qm = req.url.match(/[?&]key=([^&]*)/);
    var qkey = qm ? decodeURIComponent(qm[1]) : "";
    if (!SYNC_KEY || qkey !== SYNC_KEY) {
      res.writeHead(403, JSONH);
      res.end(JSON.stringify({ error: "bad key" }));
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });
    res.write("retry: 3000\n\n");
    sseClients.push(res);
    req.on("close", function () {
      var i = sseClients.indexOf(res);
      if (i !== -1) sseClients.splice(i, 1);
    });
    return;
  }

  /* ---- API синхронізації ---- */
  if (p === "/api/data") {
    if (!SYNC_KEY) {
      res.writeHead(500, JSONH);
      res.end(JSON.stringify({ error: "SYNC_KEY is not set on server" }));
      return;
    }
    if ((req.headers["x-sync-key"] || "") !== SYNC_KEY) {
      res.writeHead(403, JSONH);
      res.end(JSON.stringify({ error: "bad key" }));
      return;
    }
    if (req.method === "GET") {
      fs.readFile(DATA_FILE, "utf8", function (err, txt) {
        if (err) { res.writeHead(404, JSONH); res.end(JSON.stringify({ error: "no data yet" })); return; }
        res.writeHead(200, JSONH);
        res.end(txt);
      });
      return;
    }
    if (req.method === "POST") {
      var body = "", size = 0, dropped = false;
      req.on("data", function (ch) {
        size += ch.length;
        if (size > 5 * 1024 * 1024) { dropped = true; req.destroy(); return; }
        body += ch;
      });
      req.on("end", function () {
        if (dropped) return;
        var parsed;
        try {
          parsed = JSON.parse(body);
          if (!parsed || !parsed.data || !parsed.data.classes) throw new Error("bad");
        } catch (e) {
          res.writeHead(400, JSONH); res.end(JSON.stringify({ error: "bad json" })); return;
        }
        fs.writeFile(DATA_FILE, body, function (err) {
          if (err) { res.writeHead(500, JSONH); res.end(JSON.stringify({ error: "write failed" })); return; }
          res.writeHead(200, JSONH); res.end(JSON.stringify({ ok: true }));
          broadcast({ updatedAt: (parsed.data && parsed.data.updatedAt) || Date.now() });
        });
      });
      return;
    }
    res.writeHead(405, JSONH); res.end(JSON.stringify({ error: "method not allowed" }));
    return;
  }

  /* ---- статика ---- */
  if (p === "/") p = "/index.html";
  var f = path.normalize(path.join(__dirname, p));
  if (f.indexOf(__dirname) !== 0) { res.writeHead(403); res.end("Forbidden"); return; }
  fs.readFile(f, function (err, data) {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); res.end("Not found"); return; }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(f).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(data);
  });
}).listen(PORT, function () {
  console.log("Teacher app listening on " + PORT);
});

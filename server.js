/* Мінімальний статичний сервер для Railway. Без залежностей. */
var http = require("http");
var fs = require("fs");
var path = require("path");

var PORT = process.env.PORT || 3000;
var TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

http.createServer(function (req, res) {
  var p = decodeURIComponent(req.url.split("?")[0]);
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

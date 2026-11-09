import http from "node:http";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {roomApi} from "./backend/api.mjs";
import {profileApi,resolveGuestProfile} from './backend/profiles.mjs';
import {localProfileStore} from './backend/local-profile-store.mjs';
import {socialApi} from './backend/social.mjs';

const root = fileURLToPath(new URL("./dist/", import.meta.url));
const savedProfiles=await localProfileStore(),roomStore=savedProfiles.rooms;
const api = roomApi(roomStore,Date.now,request=>resolveGuestProfile(savedProfiles.store,request));
const profiles=profileApi(savedProfiles.store,Date.now,roomStore);
const social=socialApi(savedProfiles.social,savedProfiles.store);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".mp3": "audio/mpeg",
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://" + req.headers.host);
    if (["/api/rooms","/api/profile","/api/social"].includes(url.pathname)) {
      const chunks = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 24576) {
          res.writeHead(413).end();
          return;
        }
        chunks.push(chunk);
      }
      const input = new Request(url, {
        method: req.method,
        headers: req.headers,
        ...(["GET", "HEAD"].includes(req.method)
          ? {}
          : { body: Buffer.concat(chunks) }),
      });
      const reply = await (url.pathname==='/api/profile'?profiles:url.pathname==='/api/social'?social:api)(input);
      res.writeHead(reply.status, Object.fromEntries(reply.headers)).end(
        Buffer.from(await reply.arrayBuffer()),
      );
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405).end();
      return;
    }
    const file = decodeURIComponent(url.pathname).slice(1) || "index.html";
    const full = path.resolve(root, file);
    if (
      !full.startsWith(root) ||
      file.split("/").some((segment) =>
        segment.startsWith(".") || segment === "server" || segment === "client"
      )
    ) {
      res.writeHead(404).end();
      return;
    }
    const data = await readFile(full);
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    }).end(req.method === "HEAD" ? undefined : data);
  } catch (err) {
    res.writeHead(err.code === "ENOENT" || err.code === "EISDIR" ? 404 : 400)
      .end();
  }
});
const port = Number(process.env.PORT || 4173);
server.listen(
  port,
  process.env.HOST || "0.0.0.0",
  () =>
    console.log(
      "Sniper Rush listening on http://" + (process.env.HOST || "127.0.0.1") +
        ":" + server.address().port,
    ),
);

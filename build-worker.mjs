// Produce one portable ESM entrypoint, including the game's static files. The
// Worker starter supports this layout without an external asset-server binding.
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { extname } from "node:path";
const root = new URL("./", import.meta.url), dist = new URL("dist/", root);
const modules = [
  "dist/wardrobe.js",
  "dist/weapons.js",
  "dist/arms-race.js",
  "dist/equipment.js",
  "dist/maps.js",
  "dist/movement.js",
  "dist/input-queue.js",
  "dist/snapshot-wire.js",
  "dist/progression.js",
  "dist/economy.js",
  "dist/rifle-skins.js",
  "dist/catalog.js",
  "backend/profiles.mjs",
  "backend/social.mjs",
  "backend/ctf.mjs",
  "backend/rooms.mjs",
  "backend/api.mjs",
];
const rules = (await Promise.all(
  modules.map(async (file) =>
    (await readFile(new URL(file, root), "utf8")).replace(
      /^import\s[\s\S]*?from\s+["'][^"']+["'];\r?\n/gm,
      "",
    ).replace(/^export /gm, "")
  ),
)).join("\n");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".png": "image/png",
  ".txt": "text/plain",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
};
const assets = {};
async function collect(prefix = "") {
  const entries = await readdir(new URL(prefix, dist), { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith(".") || ["client", "server"].includes(e.name)) {
      continue;
    }
    const name = prefix + e.name;
    if (e.isDirectory()) {
      await collect(name + "/");
      continue;
    }
    if (!e.isFile()) throw Error("Unexpected asset: " + name);
    const data = await readFile(new URL(name, dist));
    const compressed = gzipSync(data);
    const useZip = compressed.length < data.length * .90;
    assets["/" + name] = [
      mime[extname(name)] || "application/octet-stream",
      useZip,
      (useZip ? compressed : data).toString("base64"),
    ];
  }
}
await collect();
const worker = rules + "\nconst assets=" + JSON.stringify(assets) + ";\n" + `
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/api/social'){
      if(!env.DB)return Response.json({error:'Friends storage is unavailable.'},{status:503});
      return socialApi(new SocialStore(env.DB),new ProfileStore(env.DB))(request);
    }
    if(url.pathname==='/api/profile'){
      if(!env.DB)return Response.json({error:'Profile storage is unavailable.'},{status:503});
      return profileApi(new ProfileStore(env.DB),Date.now,new D1Store(env.DB))(request);
    }
    if(url.pathname==='/api/rooms'){
      if(!env.DB)return Response.json({error:'Multiplayer storage is unavailable.'},{status:503});
      return roomApi(new D1Store(env.DB),Date.now,request=>resolveGuestProfile(new ProfileStore(env.DB),request))(request);
    }
    if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
    const file=assets[url.pathname==='/'?'/index.html':url.pathname];
    if(!file)return new Response('Not found',{status:404});
    const headers={'Content-Type':file[0],'X-Content-Type-Options':'nosniff','Cache-Control':url.pathname.startsWith('/assets/')?'public, max-age=3600':'no-cache'};
    if(request.method==='HEAD')return new Response(null,{headers});
    const bytes=Uint8Array.from(atob(file[2]),c=>c.charCodeAt(0));
    const body=file[1]?new Response(bytes).body.pipeThrough(new DecompressionStream('gzip')):bytes;
    return new Response(body,{headers});
  }
};
`;
await mkdir(new URL("server/", dist), { recursive: true });
await mkdir(new URL(".openai/", dist), { recursive: true });
await copyFile(
  new URL(".openai/hosting.json", root),
  new URL(".openai/hosting.json", dist),
);
await writeFile(new URL("server/index.js", dist), worker);
console.log(
  "Bundled " + Object.keys(assets).length +
    " game assets and authoritative room API (" +
    (gzipSync(worker).length / 1048576).toFixed(2) + " MiB gzip).",
);

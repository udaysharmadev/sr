# Sniper Rush

Browser based multiplayer sniper game. The Node server serves the game in `dist/` and runs the room, profile, and friends APIs. Profiles and rooms are stored in SQLite under `.local/`.

## Requirements

- Node.js 22.13 or newer (`node:sqlite` is used by the server).
- cPanel Node.js Application Manager / Passenger, or a Node.js host that supplies `PORT`.
- Persistent writable storage for the application `.local/` directory.

## Deploy to cPanel

1. In cPanel, open **Software → Application Manager** (or **Websites → Create Website → Node.js App**, depending on the cPanel version).
2. Create a production Node.js application with Node.js **22.13+**, startup file `app.js`, and the domain or subdomain you want to use. Set the application root to a private directory outside `public_html` when the interface permits it.
3. Clone `https://github.com/udaysharmadev/sr.git` into that application root, or upload the repository files there. Do not expose `.local/` through a public document root.
4. Run `npm install` in the application root if cPanel asks for dependencies. This project has no external npm runtime dependencies.
5. Start or deploy the application from cPanel. Passenger supplies the port; the server listens on `PORT` and serves the complete game from `dist/`.
6. Open the assigned domain and confirm the landing screen loads. Keep the application root writable so SQLite can create `.local/profiles.sqlite`; back up that directory separately because it contains player profiles, rooms, and social data.

If the account only offers Node.js 20 or older, ask the host to enable Node.js 22.13+ and Passenger/Application Manager. Static-only hosting will not run the multiplayer APIs. Public rooms currently share one local SQLite-backed process; use a supported persistent database and coordinated multi-process storage before scaling this app across multiple server processes.

## Local development

```sh
npm run build
npm start
```

Open `http://127.0.0.1:4173`. To run the test suite, use `npm test`.

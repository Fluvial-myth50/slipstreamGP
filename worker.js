// Slipstream GP game server: serves the game and runs one Durable Object per room.
// Each player's browser still drives its own car; the room relays messages between players and
// keeps a "host" (who runs the lobby and the AI cars). If the host leaves, the next player takes over.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_PLAYERS = 12;
const MAX_MSG = 32 * 1024;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      if (req.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
      const create = url.searchParams.has("create");
      let code = (url.searchParams.get("code") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (create) { code = ""; for (let i = 0; i < 5; i++) code += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]; }
      if (!/^[A-Z0-9]{4,6}$/.test(code)) return new Response("Bad room code", { status: 400 });
      const room = env.ROOMS.get(env.ROOMS.idFromName(code));
      const fwd = new URL(req.url); fwd.search = `?code=${code}${create ? "&create=1" : ""}`;
      return room.fetch(new Request(fwd, req));
    }
    return env.ASSETS.fetch(req);
  },
};

export class Room {
  constructor(ctx) { this.ctx = ctx; }

  /** Players still connected (each socket carries {id, n, host} as its attachment). */
  live(except) {
    return this.ctx.getWebSockets().filter((w) => { if (w === except) return false; const a = w.deserializeAttachment(); return a && !a.gone; });
  }
  hostSock(except) { return this.live(except).find((w) => w.deserializeAttachment().host); }

  async fetch(req) {
    const url = new URL(req.url), code = url.searchParams.get("code"), create = url.searchParams.has("create");
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    const others = this.live(server);
    const fail = (e, msg) => { server.send(JSON.stringify({ _: "err", e, msg })); server.close(1000, e); };
    if (create && others.length) fail("taken", "Room code already in use.");
    else if (!create && !others.length) fail("notfound", `Room ${code} not found. Check the code, or ask the host for a new one.`);
    else if (others.length >= MAX_PLAYERS) fail("full", "That room is full (12 drivers max).");
    else {
      const id = crypto.randomUUID().slice(0, 8);
      const n = ((await this.ctx.storage.get("n")) || 0) + 1;
      await this.ctx.storage.put("n", n);
      const host = !others.length;
      server.serializeAttachment({ id, n, host });
      const hostId = host ? id : this.hostSock(server)?.deserializeAttachment().id;
      server.send(JSON.stringify({ _: "welcome", id, code, host, hostId }));
      if (!host) this.hostSock(server)?.send(JSON.stringify({ _: "join", id }));
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, msg) {
    const a = ws.deserializeAttachment();
    if (!a || a.gone || typeof msg !== "string" || msg.length > MAX_MSG) return;
    let o; try { o = JSON.parse(msg); } catch { return; }
    if (!o || o.d === undefined) return;
    const out = JSON.stringify({ f: a.id, d: o.d });
    if (o.to === "host") { this.hostSock()?.send(out); return; }
    for (const w of this.live(ws)) {
      const b = w.deserializeAttachment();
      if (o.to === "all" ? b.id !== o.x : b.id === o.to) { try { w.send(out); } catch {} }
    }
  }

  async leave(ws) {
    const a = ws.deserializeAttachment();
    if (!a || a.gone) return;
    ws.serializeAttachment({ ...a, gone: true, host: false });
    const rest = this.live(ws);
    if (!rest.length) { await this.ctx.storage.deleteAll(); return; }
    if (a.host) {
      // Hand hosting to whoever has been in the room longest.
      const next = rest.reduce((p, w) => (w.deserializeAttachment().n < p.deserializeAttachment().n ? w : p));
      const na = next.deserializeAttachment(); next.serializeAttachment({ ...na, host: true });
      const m = JSON.stringify({ _: "host", id: na.id, old: a.id });
      for (const w of rest) { try { w.send(m); } catch {} }
    } else {
      try { this.hostSock(ws)?.send(JSON.stringify({ _: "leave", id: a.id })); } catch {}
    }
  }
  async webSocketClose(ws) { await this.leave(ws); try { ws.close(); } catch {} }
  async webSocketError(ws) { await this.leave(ws); }
}

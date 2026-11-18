# Slipstream GP

Multiplayer F1 racing in the browser.

## How online play works

The game runs on Cloudflare Workers. `worker.js` serves the game and runs one Durable Object per room: players connect to it with a WebSocket, it relays race data between them and keeps a host (who runs the lobby and the AI cars). If the host leaves, the player who has been in the room longest takes over and the race carries on.

## Deploying

Connect this repo to a Cloudflare Worker (Workers & Pages > Create > Import a repository). Build command: leave empty. Deploy command: `npx wrangler deploy`. Every push redeploys.

Local test: `npm install` then `npx wrangler dev`, and open http://localhost:8787.

## Credits

Car model: "Formula 1 car - RS19" by oliwerandersson01 (https://sketchfab.com/oliwerandersson01), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Converted, reduced in detail and recoloured per team for the game.

Circuit layouts for Monza, Silverstone and Monaco: derived from [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits), MIT License, Copyright (c) 2019-2025 Tomislav Bacinger. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

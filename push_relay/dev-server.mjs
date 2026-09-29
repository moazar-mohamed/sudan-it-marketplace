// Runs the relay on this computer (for tests against the Firebase emulators).
//   SERVICE_ACCOUNT_FILE=path/to/key.json FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
//   AUTH_EMULATOR_HOST=127.0.0.1:9099 node dev-server.mjs
// Pushes still go through the real FCM service to real devices.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRelay } from './src/relay.js';

const port = Number(process.env.PORT ?? 8787);
const relay = createRelay(
  {
    PROJECT_ID: process.env.PROJECT_ID ?? 'sudan-it-marketplace',
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY ?? 'AIzaSyAfI2D3QwE6ULN6Vq6aiMJIet9z4pHIaAY',
    SERVICE_ACCOUNT_JSON: readFileSync(process.env.SERVICE_ACCOUNT_FILE, 'utf8'),
    FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
    AUTH_EMULATOR_HOST: process.env.AUTH_EMULATOR_HOST,
  },
  { log: (line) => console.log(new Date().toISOString(), line) },
);

createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const request = new Request(`http://localhost:${port}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
  });
  const response = await relay(request);
  const text = await response.text();
  console.log(new Date().toISOString(), req.method, req.url, response.status, text);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(text);
}).listen(port, '0.0.0.0', () => console.log(`push relay on http://localhost:${port}`));

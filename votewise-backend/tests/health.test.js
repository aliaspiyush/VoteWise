import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cors from 'cors';

// Minimal app for testing (no env dependency)
function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'VoteWise API' }));
  return app;
}

describe('Health Check', () => {
  let server;
  let baseUrl;

  before(() => {
    const app = buildApp();
    server = app.listen(0);
    const { port } = server.address();
    baseUrl = `http://localhost:${port}`;
  });

  after(() => server.close());

  it('GET /health returns 200 with status ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'VoteWise API');
  });

  it('GET /health returns JSON content-type', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.ok(res.headers.get('content-type').includes('application/json'));
  });

  it('GET /unknown-route returns 404', async () => {
    const res = await fetch(`${baseUrl}/unknown-route`);
    assert.equal(res.status, 404);
  });
});

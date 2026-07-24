// Prevent incur's optional MCP dependency from crashing CJS require
// @modelcontextprotocol/server is ESM-only but incur tries to require() it
const Module = require('module');
const orig = Module._load;
Module._load = function (id, parent, isMain) {
  if (id === '@modelcontextprotocol/server') {
    return { Server: class {}, StdioServerTransport: class {} };
  }
  return orig.call(this, id, parent, isMain);
};

// Load .env so TEST_TOKEN is available
require('dotenv/config');

// Set FORMO_API_KEY synchronously — must happen before any test module loads
// so createClient() always picks up the correct key.
//
// Without TEST_TOKEN the deterministic unit tests (body builders, sql,
// parseApiError, json) still run; a dummy key is set so the liveApi probe
// fails auth and every live-API integration test skips itself. This keeps
// `pnpm test` green locally and on fork PRs where secrets are unavailable.
const token = process.env.TEST_TOKEN;
if (!token) {
  process.stderr.write(
    '\n  ⚠ TEST_TOKEN is not set — live-API integration tests will be skipped.\n' +
    '  Add TEST_TOKEN=formo_your_key to your .env file to run the full suite.\n\n',
  );
}
process.env.FORMO_API_KEY = token || 'formo_dummy_key_live_tests_will_skip';

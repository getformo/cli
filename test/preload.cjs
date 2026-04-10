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
// so createClient() always picks up the correct key
const token = process.env.TEST_TOKEN;
if (!token) {
  process.stderr.write(
    '\n  ERROR: TEST_TOKEN is not set.\n' +
    '  Add TEST_TOKEN=formo_your_key to your .env file before running tests.\n\n',
  );
  process.exit(1);
}
process.env.FORMO_API_KEY = token;

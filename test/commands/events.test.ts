import { expect } from 'chai';
import { buildIngestEventsBody, ingestEventsRun } from '../../src/commands/events';

describe('commands/events', function () {
  describe('buildIngestEventsBody()', function () {
    it('wraps a single --event object in an array', function () {
      const body = buildIngestEventsBody({
        event: '{"type":"track","event":"CLI Test"}',
      });
      expect(body).to.deep.equal([{ type: 'track', event: 'CLI Test' }]);
    });

    it('accepts a non-empty --events array', function () {
      const body = buildIngestEventsBody({
        events: '[{"type":"track","event":"A"},{"type":"track","event":"B"}]',
      });
      expect(body).to.have.length(2);
    });

    it('throws on invalid event JSON', function () {
      expect(() => buildIngestEventsBody({ event: 'not-json' })).to.throw(/event/);
    });
  });

  describe('ingestEventsRun() — local validation', function () {
    it('throws when no write key is configured', function () {
      const saved = process.env.FORMO_WRITE_KEY;
      delete process.env.FORMO_WRITE_KEY;
      try {
        expect(() =>
          ingestEventsRun({ event: '{"type":"track","event":"CLI Test"}' }),
        ).to.throw(/write key/i);
      } finally {
        if (saved !== undefined) process.env.FORMO_WRITE_KEY = saved;
      }
    });
  });
});

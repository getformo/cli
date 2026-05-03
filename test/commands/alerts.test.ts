import { expect } from 'chai';
import { listAlertsRun, getAlertRun, createAlertRun } from '../../src/commands/alerts';

// Response shape: Alert[] for list, Alert for get (bare resource — no envelope).

describe('commands/alerts', function () {
  let firstAlertId: string | undefined;

  describe('listAlertsRun()', function () {
    it('returns an array of alerts', async function () {
      const res = await listAlertsRun() as { id: string }[];
      expect(res).to.be.an('array');
      if (res.length > 0) firstAlertId = res[0].id;
    });
  });

  describe('getAlertRun()', function () {
    it('returns an alert by ID', async function () {
      if (!firstAlertId) return this.skip();
      const res = await getAlertRun(firstAlertId) as { id: string };
      expect(res).to.have.property('id', firstAlertId);
    });
  });

  describe('createAlertRun() — local validation', function () {
    it('throws on invalid triggerFilters JSON', function () {
      expect(() => createAlertRun({ name: 'x', triggerType: 'event', triggerFilters: 'not-json' })).to.throw(/triggerFilters/);
    });

    it('throws on invalid recipient JSON', function () {
      expect(() => createAlertRun({ name: 'x', triggerType: 'event', recipient: '{bad}' })).to.throw(/recipient/);
    });
  });
});

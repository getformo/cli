import { expect } from 'chai';
import { listAlertsRun, getAlertRun, createAlertRun } from '../../src/commands/alerts';

// Response shape: { isSuccess: true, data: Alert[] } for list
//                 { isSuccess: true, data: Alert }   for get

describe('commands/alerts', function () {
  let firstAlertId: string | undefined;

  describe('listAlertsRun()', function () {
    it('returns an array of alerts', async function () {
      const res = await listAlertsRun() as { isSuccess: boolean; data: { id: string }[] };
      expect(res.isSuccess).to.equal(true);
      expect(res.data).to.be.an('array');
      if (res.data.length > 0) firstAlertId = res.data[0].id;
    });
  });

  describe('getAlertRun()', function () {
    it('returns an alert by ID', async function () {
      if (!firstAlertId) return this.skip();
      const res = await getAlertRun(firstAlertId) as { isSuccess: boolean; data: { id: string } };
      expect(res.isSuccess).to.equal(true);
      expect(res.data).to.have.property('id', firstAlertId);
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

import { expect } from 'chai';
import { listAlertsRun, getAlertRun, createAlertRun } from '../../src/commands/alerts';

// Response shape: PaginatedResponse<Alert> { data, total, page, size, has_more } for list,
//                 Alert for get (bare resource — no envelope).

describe('commands/alerts', function () {
  let firstAlertId: string | undefined;

  describe('listAlertsRun()', function () {
    it('returns a paginated list of alerts', async function () {
      const res = await listAlertsRun() as { data: { id: string }[]; total: number; has_more: boolean };
      expect(res.data).to.be.an('array');
      expect(res).to.have.property('total');
      expect(res).to.have.property('has_more');
      if (res.data.length > 0) firstAlertId = res.data[0].id;
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

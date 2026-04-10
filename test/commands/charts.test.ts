import { expect } from 'chai';
import { listBoardsRun } from '../../src/commands/boards';
import { listChartsRun, getChartRun, createChartRun, updateChartRun } from '../../src/commands/charts';

// Response shape: { isSuccess: true, data: { charts: Chart[], board: ... } } for list
//                 { isSuccess: true, data: Chart }                           for get

describe('commands/charts', function () {
  let boardId: string | undefined;
  let firstChartId: string | undefined;

  before(async function () {
    const res = await listBoardsRun() as { isSuccess: boolean; data: { id: string }[] };
    if (res.data.length > 0) boardId = res.data[0].id;
  });

  describe('listChartsRun()', function () {
    it('returns charts for a board', async function () {
      if (!boardId) return this.skip();
      const res = await listChartsRun(boardId) as { isSuccess: boolean; data: { charts: { id: string }[] } };
      expect(res.isSuccess).to.equal(true);
      expect(res.data.charts).to.be.an('array');
      if (res.data.charts.length > 0) firstChartId = res.data.charts[0].id;
    });
  });

  describe('getChartRun()', function () {
    it('returns a chart by ID', async function () {
      if (!boardId || !firstChartId) return this.skip();
      const res = await getChartRun(boardId, firstChartId) as { isSuccess: boolean; data: { id: string } };
      expect(res.isSuccess).to.equal(true);
      expect(res.data).to.have.property('id', firstChartId);
    });
  });

  describe('local validation', function () {
    it('createChartRun throws on invalid JSON body', function () {
      expect(() => createChartRun('board_x', 'not-json')).to.throw(/JSON/);
    });

    it('updateChartRun throws on invalid JSON body', function () {
      expect(() => updateChartRun('board_x', 'chart_x', 'not-json')).to.throw(/JSON/);
    });
  });
});

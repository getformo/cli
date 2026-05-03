import { expect } from 'chai';
import { listBoardsRun } from '../../src/commands/boards';
import { listChartsRun, getChartRun, createChartRun, updateChartRun } from '../../src/commands/charts';

// Response shape: { charts: Chart[], board: Board } for list, Chart for get
// (bare resource — no envelope).

describe('commands/charts', function () {
  let boardId: string | undefined;
  let firstChartId: string | undefined;

  before(async function () {
    const res = await listBoardsRun() as { id: string }[];
    if (res.length > 0) boardId = res[0].id;
  });

  describe('listChartsRun()', function () {
    it('returns charts for a board', async function () {
      if (!boardId) return this.skip();
      const res = await listChartsRun(boardId) as { charts: { id: string }[] };
      expect(res.charts).to.be.an('array');
      if (res.charts.length > 0) firstChartId = res.charts[0].id;
    });
  });

  describe('getChartRun()', function () {
    it('returns a chart by ID', async function () {
      if (!boardId || !firstChartId) return this.skip();
      const res = await getChartRun(boardId, firstChartId) as { id: string };
      expect(res).to.have.property('id', firstChartId);
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

import { expect } from 'chai';
import { listBoardsRun } from '../../src/commands/boards';
import { listChartsRun, getChartRun, createChartRun, updateChartRun } from '../../src/commands/charts';

// Response shape: PaginatedResponse<Chart> + { board, warnings? } for list,
//                 Chart for get (bare resource — no envelope).

describe('commands/charts', function () {
  let boardId: string | undefined;
  let firstChartId: string | undefined;

  before(async function () {
    const res = await listBoardsRun() as { data: { id: string }[] };
    if (res.data.length > 0) boardId = res.data[0].id;
  });

  describe('listChartsRun()', function () {
    it('returns paginated charts for a board with the parent board', async function () {
      if (!boardId) return this.skip();
      const res = await listChartsRun(boardId) as {
        data: { id: string }[];
        board: { id: string };
        total: number;
        has_more: boolean;
      };
      expect(res.data).to.be.an('array');
      expect(res.board).to.have.property('id');
      expect(res).to.have.property('total');
      expect(res).to.have.property('has_more');
      if (res.data.length > 0) firstChartId = res.data[0].id;
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

import { expect } from 'chai';
import { listBoardsRun } from '../../src/commands/boards';
import { listChartsRun, getChartRun, createChartRun, updateChartRun } from '../../src/commands/charts';
import { requiresLiveApi } from '../helpers/liveApi';

// Response shape: PaginatedResponse<ChartSummary> for list (summaries default;
//                 with results=true: PaginatedResponse<Chart> + { board, warnings? }),
//                 Chart for get (bare resource — no envelope).

describe('commands/charts', function () {
  // Live tests are gated inside their own describe so the offline
  // "local validation" tests below always run.
  describe('live API', function () {
    let boardId: string | undefined;
    let firstChartId: string | undefined;

    before(async function () {
      await requiresLiveApi(this);
      const res = await listBoardsRun() as { data: { id: string }[] };
      if (res.data.length > 0) boardId = res.data[0].id;
    });

    describe('listChartsRun()', function () {
      it('returns paginated chart summaries by default (no board, no results)', async function () {
        if (!boardId) return this.skip();
        const res = await listChartsRun(boardId) as {
          data: Record<string, unknown>[];
          total: number;
          has_more: boolean;
        };
        expect(res.data).to.be.an('array');
        // Summaries: the parent board and per-chart query/results only ship
        // with results=true — listing must never silently execute charts.
        expect(res).to.not.have.property('board');
        expect(res).to.have.property('total');
        expect(res).to.have.property('has_more');
        for (const row of res.data) {
          expect(row).to.not.have.property('query');
          expect(row).to.not.have.property('results');
        }
        if (res.data.length > 0) firstChartId = res.data[0].id as string;
      });

      it('returns executed charts with the parent board when results=true', async function () {
        if (!boardId) return this.skip();
        this.timeout(30000); // executes every chart query on the board
        const res = await listChartsRun(boardId, { size: 2 }, true) as {
          data: { id: string }[];
          board: { id: string };
        };
        expect(res.data).to.be.an('array');
        expect(res.board).to.have.property('id');
      });
    });

    describe('getChartRun()', function () {
      it('returns a chart by ID', async function () {
        if (!boardId || !firstChartId) return this.skip();
        const res = await getChartRun(boardId, firstChartId) as { id: string };
        expect(res).to.have.property('id', firstChartId);
      });
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

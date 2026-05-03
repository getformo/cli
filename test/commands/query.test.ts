import { expect } from 'chai';
import { queryRunRun } from '../../src/commands/query';
import { requiresLiveApi } from '../helpers/liveApi';

describe('commands/query', function () {
  describe('queryRunRun()', function () {
    it('executes a SQL query and returns a result', async function () {
      await requiresLiveApi(this);
      // Use a simple introspection query that should always succeed
      const result = await queryRunRun('SELECT 1 AS value') as unknown;
      expect(result).to.exist;
    });

    it('passes arbitrary SQL to the API', async function () {
      await requiresLiveApi(this);
      const result = await queryRunRun(
        'SELECT count(*) AS total FROM events LIMIT 1',
      ) as unknown;
      expect(result).to.exist;
    });
  });
});

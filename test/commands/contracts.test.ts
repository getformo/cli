import { expect } from 'chai';
import { listContractsRun, createContractRun, updateContractRun } from '../../src/commands/contracts';
import { requiresLiveApi } from '../helpers/liveApi';

// Response shape: PaginatedResponse<Contract> + { deploy: { last_deployed_at, diff } } for list
// (bare resource — no envelope).

const TEST_ABI = JSON.stringify([{ type: 'event', name: 'Transfer', inputs: [] }]);
const TEST_EVENTS = JSON.stringify({ Transfer: true });

describe('commands/contracts', function () {
  describe('listContractsRun()', function () {
    it('returns paginated contracts with deploy status', async function () {
      await requiresLiveApi(this);
      const res = await listContractsRun() as {
        data: unknown[];
        deploy: { last_deployed_at: string | null; diff: unknown[] };
        total: number;
        has_more: boolean;
      };
      expect(res.data).to.be.an('array');
      expect(res.deploy).to.have.property('diff');
      expect(res).to.have.property('total');
      expect(res).to.have.property('has_more');
    });
  });

  describe('createContractRun() — local validation', function () {
    it('throws on invalid ABI JSON', function () {
      expect(() => createContractRun({ address: '0x1', chain: 1, name: 'x', abi: 'not-json', events: TEST_EVENTS })).to.throw(/abi/i);
    });

    it('throws on invalid events JSON', function () {
      expect(() => createContractRun({ address: '0x1', chain: 1, name: 'x', abi: TEST_ABI, events: 'not-json' })).to.throw(/events/i);
    });
  });

  describe('updateContractRun() — local validation', function () {
    it('throws on invalid ABI JSON', function () {
      expect(() => updateContractRun('1', '0x1', { name: 'x', abi: 'not-json', events: TEST_EVENTS })).to.throw(/abi/i);
    });
  });
});

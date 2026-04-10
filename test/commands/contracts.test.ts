import { expect } from 'chai';
import { listContractsRun, createContractRun, updateContractRun } from '../../src/commands/contracts';

// Response shape: { isSuccess: true, data: { contracts: Contract[], deployAt, deployDiff } }

const TEST_ABI = JSON.stringify([{ type: 'event', name: 'Transfer', inputs: [] }]);
const TEST_EVENTS = JSON.stringify({ Transfer: true });

describe('commands/contracts', function () {
  describe('listContractsRun()', function () {
    it('returns an array of contracts', async function () {
      const res = await listContractsRun() as { isSuccess: boolean; data: { contracts: unknown[] } };
      expect(res.isSuccess).to.equal(true);
      expect(res.data.contracts).to.be.an('array');
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

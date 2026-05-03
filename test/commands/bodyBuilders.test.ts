import { expect } from 'chai';
import { buildAlertBody } from '../../src/commands/alerts';
import {
  buildCreateContractBody,
  buildUpdateContractBody,
} from '../../src/commands/contracts';
import { buildImportBody } from '../../src/commands/import';
import {
  buildCreateLabelBody,
  buildDeleteLabelBody,
  buildUpdateProfileBody,
} from '../../src/commands/profiles';
import { buildCreateSegmentBody } from '../../src/commands/segments';

describe('commands / body builders', function () {
  // ── Alerts ──

  describe('buildAlertBody()', function () {
    it('translates camelCase options to snake_case body keys', function () {
      const body = buildAlertBody({ name: 'My alert', triggerType: 'event' });
      expect(body).to.deep.equal({ name: 'My alert', trigger_type: 'event' });
    });

    it('parses triggerFilters JSON into trigger_filters', function () {
      const body = buildAlertBody({
        name: 'x',
        triggerType: 'event',
        triggerFilters: '[{"name":"event","operator":"equals","value":"transaction"}]',
      });
      expect(body.trigger_filters).to.deep.equal([
        { name: 'event', operator: 'equals', value: 'transaction' },
      ]);
    });

    it('parses recipient JSON into the body', function () {
      const body = buildAlertBody({
        name: 'x',
        triggerType: 'event',
        recipient: '[{"type":"email","value":["a@b.com"]}]',
      });
      expect(body.recipient).to.deep.equal([
        { type: 'email', value: ['a@b.com'] },
      ]);
    });

    it('includes secret only when provided', function () {
      const without = buildAlertBody({ name: 'x', triggerType: 'event' });
      expect(without).to.not.have.property('secret');
      const withSecret = buildAlertBody({
        name: 'x',
        triggerType: 'event',
        secret: 'whsec_123',
      });
      expect(withSecret.secret).to.equal('whsec_123');
    });

    it('includes empty-string secret when explicitly set (allows clearing the value)', function () {
      const body = buildAlertBody({
        name: 'x',
        triggerType: 'event',
        secret: '',
      });
      expect(body).to.have.property('secret', '');
    });
  });

  // ── Contracts ──

  describe('buildCreateContractBody()', function () {
    it('parses abi + events JSON and assembles the body verbatim', function () {
      const body = buildCreateContractBody({
        address: '0xabc',
        chain: 1,
        name: 'My Token',
        abi: '[{"type":"event","name":"Transfer"}]',
        events: '{"Transfer":true}',
      });
      expect(body).to.deep.equal({
        address: '0xabc',
        chain: 1,
        name: 'My Token',
        abi: [{ type: 'event', name: 'Transfer' }],
        events: { Transfer: true },
      });
    });
  });

  describe('buildUpdateContractBody()', function () {
    it('does NOT include address/chain (those are path params, not body)', function () {
      const body = buildUpdateContractBody({
        name: 'New Name',
        abi: '[]',
        events: '{}',
      });
      expect(body).to.deep.equal({ name: 'New Name', abi: [], events: {} });
      expect(body).to.not.have.property('address');
      expect(body).to.not.have.property('chain');
    });
  });

  // ── Segments ──

  describe('buildCreateSegmentBody()', function () {
    it('parses filterSets JSON into the body', function () {
      const body = buildCreateSegmentBody({
        title: 'Whales',
        filterSets: '["net_worth_usd > 100000"]',
      });
      expect(body).to.deep.equal({
        title: 'Whales',
        filterSets: ['net_worth_usd > 100000'],
      });
    });
  });

  // ── Import ──

  describe('buildImportBody()', function () {
    it('passes parsed addresses array + writeKey through', function () {
      const body = buildImportBody({
        addresses: '["0xabc","0xdef"]',
        writeKey: 'write_key_xyz',
      });
      expect(body).to.deep.equal({
        addresses: ['0xabc', '0xdef'],
        writeKey: 'write_key_xyz',
      });
    });
  });

  // ── Profiles update ──

  describe('buildUpdateProfileBody()', function () {
    it('returns the parsed properties object verbatim', function () {
      const body = buildUpdateProfileBody({
        properties: '{"display_name":"Vitalik","twitter":"VitalikButerin"}',
      });
      expect(body).to.deep.equal({
        display_name: 'Vitalik',
        twitter: 'VitalikButerin',
      });
    });
  });

  // ── Profiles labels create ──

  describe('buildCreateLabelBody()', function () {
    it('produces a single-label object body when --tagId is given', function () {
      const body = buildCreateLabelBody({ tagId: 'vip' });
      expect(body).to.deep.equal({ tag_id: 'vip' });
    });

    it('translates value/chainId to snake_case in single-label mode', function () {
      const body = buildCreateLabelBody({
        tagId: 'tier',
        value: 'gold',
        chainId: '1',
      });
      expect(body).to.deep.equal({
        tag_id: 'tier',
        value: 'gold',
        chain_id: '1',
      });
    });

    it('produces an array body when --labels is given', function () {
      const body = buildCreateLabelBody({
        labels: '[{"tag_id":"vip"},{"tag_id":"airdrop_eligible","chain_id":"1"}]',
      });
      expect(body).to.deep.equal([
        { tag_id: 'vip' },
        { tag_id: 'airdrop_eligible', chain_id: '1' },
      ]);
    });

    it('--labels takes precedence over --tagId when both are provided', function () {
      const body = buildCreateLabelBody({
        tagId: 'should-be-ignored',
        labels: '[{"tag_id":"vip"}]',
      });
      expect(body).to.deep.equal([{ tag_id: 'vip' }]);
    });
  });

  // ── Profiles labels delete ──

  describe('buildDeleteLabelBody()', function () {
    it('builds a body with just tag_id', function () {
      const body = buildDeleteLabelBody({ tagId: 'vip' });
      expect(body).to.deep.equal({ tag_id: 'vip' });
    });

    it('includes chain_id when provided', function () {
      const body = buildDeleteLabelBody({ tagId: 'tier', chainId: '1' });
      expect(body).to.deep.equal({ tag_id: 'tier', chain_id: '1' });
    });
  });
});

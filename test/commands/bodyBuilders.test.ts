import { expect } from 'chai';
import { buildAlertBody, buildTestAlertBody } from '../../src/commands/alerts';
import { buildBoardBody } from '../../src/commands/boards';
import {
  buildChartBody,
  normalizeDuplicateChartResponse,
} from '../../src/commands/charts';
import {
  buildCreateContractBody,
  buildUpdateContractPipelineBody,
  buildUpdateContractBody,
} from '../../src/commands/contracts';
import { buildImportBody } from '../../src/commands/import';
import {
  buildBatchCreateLabelsBody,
  buildBatchUpdateProfilesBody,
  buildCreateLabelBody,
  buildDeleteLabelBody,
  buildUpdateProfileBody,
  parseSearchConditions,
} from '../../src/commands/profiles';
import { buildCreateSegmentBody } from '../../src/commands/segments';

describe('commands / body builders', function () {
  // ── Alerts ──

  describe('buildAlertBody()', function () {
    it('translates camelCase options to snake_case body keys', function () {
      const body = buildAlertBody({ name: 'My alert', triggerType: 'event' });
      expect(body).to.deep.equal({
        name: 'My alert',
        trigger_type: 'event',
        trigger_filters: [],
      });
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

    it('parses slack property keys JSON into slack_property_keys', function () {
      const body = buildAlertBody({
        name: 'x',
        triggerType: 'event',
        slackPropertyKeys: '["revenue","chain_id"]',
      });
      expect(body.slack_property_keys).to.deep.equal(['revenue', 'chain_id']);
    });
  });

  describe('buildTestAlertBody()', function () {
    it('parses sample objects and recipient overrides', function () {
      const body = buildTestAlertBody({
        sampleEvent: '{"event":"transaction"}',
        sampleUser: '{"address":"0xabc"}',
        recipientOverrides: '[{"type":"email","value":["a@b.com"]}]',
      });
      expect(body).to.deep.equal({
        sampleEvent: { event: 'transaction' },
        sampleUser: { address: '0xabc' },
        recipientOverrides: [{ type: 'email', value: ['a@b.com'] }],
      });
    });
  });

  // ── Boards ──

  describe('buildBoardBody()', function () {
    it('uses title/isPublic for the current API contract', function () {
      const body = buildBoardBody({
        title: 'Weekly KPIs',
        description: 'Ops board',
        isPublic: true,
      });
      expect(body).to.deep.equal({
        title: 'Weekly KPIs',
        description: 'Ops board',
        isPublic: true,
      });
    });

    it('keeps --name as a backwards-compatible alias for --title', function () {
      expect(buildBoardBody({ name: 'Legacy name' })).to.deep.equal({
        title: 'Legacy name',
      });
    });
  });

  // ── Charts ──

  describe('buildChartBody()', function () {
    it('maps typed chart flags to snake_case body fields', function () {
      const body = buildChartBody({
        title: 'Daily users',
        chartType: 'line',
        query: 'SELECT 1 FORMAT JSON',
        xAxis: 'date',
        yAxis: 'users,revenue',
        groupBy: 'chain',
        settings: '{"breakdown":"device"}',
      });
      expect(body).to.deep.equal({
        title: 'Daily users',
        chart_type: 'line',
        query: 'SELECT 1',
        x_axis: 'date',
        y_axis: ['users', 'revenue'],
        group_by: 'chain',
        settings: { breakdown: 'device' },
      });
    });

    it('merges raw --body with typed flags taking precedence', function () {
      const body = buildChartBody({
        body: '{"title":"Old","chart_type":"bar"}',
        title: 'New',
      });
      expect(body).to.deep.equal({ title: 'New', chart_type: 'bar' });
    });
  });

  describe('normalizeDuplicateChartResponse()', function () {
    it('wraps a bare duplicated chart ID', function () {
      expect(normalizeDuplicateChartResponse('chart_new')).to.deep.equal({
        id: 'chart_new',
      });
    });

    it('leaves object responses intact', function () {
      const response = { id: 'chart_new', title: 'Copied chart' };
      expect(normalizeDuplicateChartResponse(response)).to.equal(response);
    });
  });

  // ── Contracts ──

  describe('buildCreateContractBody()', function () {
    it('parses abi + events JSON and assembles the body verbatim', function () {
      const body = buildCreateContractBody({
        address: '0xabc',
        chain: 1,
        name: 'My Token',
        abi: '[{"type":"event","name":"Transfer","anonymous":false,"inputs":[]}]',
        events: '[{"type":"event","name":"Transfer","anonymous":false,"inputs":[]}]',
        includeInPipeline: false,
      });
      expect(body).to.deep.equal({
        address: '0xabc',
        chain: 1,
        name: 'My Token',
        abi: '[{"type":"event","name":"Transfer","anonymous":false,"inputs":[]}]',
        events: [{ type: 'event', name: 'Transfer', anonymous: false, inputs: [] }],
        include_in_pipeline: false,
      });
    });
  });

  describe('buildUpdateContractBody()', function () {
    it('includes address/chain because the current API validates a full contract body', function () {
      const body = buildUpdateContractBody('1', '0xabc', {
        name: 'New Name',
        abi: '[]',
        events: '[]',
      });
      expect(body).to.deep.equal({
        address: '0xabc',
        chain: 1,
        name: 'New Name',
        abi: '[]',
        events: [],
      });
    });

    it('includes include_in_pipeline when provided', function () {
      const body = buildUpdateContractBody('1', '0xabc', {
        name: 'New Name',
        abi: '[]',
        events: '[]',
        includeInPipeline: true,
      });
      expect(body).to.include({ include_in_pipeline: true });
    });
  });

  describe('buildUpdateContractPipelineBody()', function () {
    it('maps includeInPipeline to include_in_pipeline', function () {
      expect(buildUpdateContractPipelineBody(false)).to.deep.equal({
        include_in_pipeline: false,
      });
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
    it('passes parsed addresses array without a writeKey', function () {
      const body = buildImportBody({
        addresses: '["0xabc","0xdef"]',
      });
      expect(body).to.deep.equal({
        addresses: ['0xabc', '0xdef'],
      });
    });

    it('derives addresses from richer import rows', function () {
      const body = buildImportBody({
        rows: '[{"address":"0xabc","properties":{"display_name":"Alice"}}]',
      });
      expect(body).to.deep.equal({
        addresses: ['0xabc'],
        rows: [{ address: '0xabc', properties: { display_name: 'Alice' } }],
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
    it('produces a single-label object body when --tag-id is given', function () {
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

    it('includes historical timestamp and tombstone flags', function () {
      const body = buildCreateLabelBody({
        tagId: 'tier',
        timestamp: '2024-03-15T00:00:00.000Z',
        isDeleted: true,
      });
      expect(body).to.deep.equal({
        tag_id: 'tier',
        timestamp: '2024-03-15T00:00:00.000Z',
        _is_deleted: 1,
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

    it('--labels takes precedence over --tag-id when both are provided', function () {
      const body = buildCreateLabelBody({
        tagId: 'should-be-ignored',
        labels: '[{"tag_id":"vip"}]',
      });
      expect(body).to.deep.equal([{ tag_id: 'vip' }]);
    });
  });

  describe('buildBatchUpdateProfilesBody()', function () {
    it('accepts profile rows with address and properties', function () {
      const body = buildBatchUpdateProfilesBody({
        rows: '[{"address":"0xabc","display_name":"Alice"}]',
      });
      expect(body).to.deep.equal([{ address: '0xabc', display_name: 'Alice' }]);
    });
  });

  describe('buildBatchCreateLabelsBody()', function () {
    it('accepts label rows with address and tag_id', function () {
      const body = buildBatchCreateLabelsBody({
        labels: '[{"address":"0xabc","tag_id":"vip","value":"gold"}]',
      });
      expect(body).to.deep.equal([
        { address: '0xabc', tag_id: 'vip', value: 'gold' },
      ]);
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

  // ── Profiles search conditions ──

  describe('parseSearchConditions()', function () {
    it('accepts conditions with typed field prefixes', function () {
      const conds = parseSearchConditions(
        '[{"field":"users.net_worth_usd","op":"gt","value":10000},{"field":"chains.1.balance","op":"gte","value":1000}]',
      );
      expect(conds).to.have.length(2);
      expect((conds[0] as { field: string }).field).to.equal('users.net_worth_usd');
    });

    it('accepts apps., tokens., and labels. prefixes', function () {
      expect(() =>
        parseSearchConditions(
          '[{"field":"apps.uniswap-v3.balance","op":"gt","value":0},{"field":"tokens.0xabc.balance","op":"gt","value":1},{"field":"labels.coinbase.verified_account","op":"eq","value":"true"}]',
        ),
      ).to.not.throw();
    });

    it('rejects a bare (untyped) field — the silent-failure footgun', function () {
      expect(() =>
        parseSearchConditions('[{"field":"net_worth_usd","op":"gt","value":10000}]'),
      ).to.throw(/must be a typed path/);
    });

    it('rejects a known field name without its prefix', function () {
      expect(() =>
        parseSearchConditions('[{"field":"tx_count","op":"gt","value":5}]'),
      ).to.throw(/must be a typed path/);
    });

    it('throws on invalid JSON', function () {
      expect(() => parseSearchConditions('not-json')).to.throw(
        /valid JSON array of FilterCondition/,
      );
    });

    it('throws when not an array', function () {
      expect(() => parseSearchConditions('{"field":"users.net_worth_usd"}')).to.throw(
        /valid JSON array of FilterCondition/,
      );
    });

    it('throws when an entry is missing a string field', function () {
      expect(() => parseSearchConditions('[{"op":"gt","value":1}]')).to.throw(
        /must have a non-empty string "field"/,
      );
    });
  });
});

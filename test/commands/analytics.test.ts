import { expect } from 'chai';
import { buildAnalyticsParams, runAnalytics } from '../../src/commands/analytics';
import { requiresLiveApi } from '../helpers/liveApi';

describe('commands/analytics', function () {
  describe('buildAnalyticsParams()', function () {
    it('returns an empty object when no options are given', function () {
      expect(buildAnalyticsParams({})).to.deep.equal({});
    });

    it('maps dateFrom/dateTo to snake_case date_from/date_to', function () {
      const params = buildAnalyticsParams({
        dateFrom: '2026-04-01',
        dateTo: '2026-04-30',
      });
      expect(params).to.deep.equal({
        date_from: '2026-04-01',
        date_to: '2026-04-30',
      });
    });

    it('re-serializes a valid filters JSON array as a string', function () {
      const params = buildAnalyticsParams({
        filters: '[{"field":"location","op":"eq","value":"US"}]',
      });
      expect(params.filters).to.equal(
        '[{"field":"location","op":"eq","value":"US"}]',
      );
    });

    it('throws when filters is not valid JSON', function () {
      expect(() => buildAnalyticsParams({ filters: 'not json' })).to.throw(
        /--filters must be a valid JSON array/,
      );
    });

    it('throws when filters is valid JSON but not an array', function () {
      expect(() => buildAnalyticsParams({ filters: '{"field":"x"}' })).to.throw(
        /--filters must be a valid JSON array/,
      );
    });

    it('validates every canonical filter entry', function () {
      expect(() =>
        buildAnalyticsParams({
          filters: '[{"operand":"location","operator":"eq","value":"US"}]',
        }),
      ).to.throw(/field, op, value/);
      expect(() =>
        buildAnalyticsParams({
          filters: '[{"field":"location","op":"equals","value":"US"}]',
        }),
      ).to.throw(/canonical "op"/);
      expect(() =>
        buildAnalyticsParams({
          filters: '[{"field":"location","op":"contains"}]',
        }),
      ).to.throw(/"value" is required/);
    });

    it('accepts value-less and one-level nested canonical filters', function () {
      const filters = [
        { field: 'referrer', op: 'notEmpty' },
        {
          field: 'event',
          op: 'eq',
          value: 'purchase',
          filters: [{ field: 'amount', op: 'gte', value: 100 }],
        },
      ];
      expect(
        buildAnalyticsParams({ filters: JSON.stringify(filters) }).filters,
      ).to.equal(JSON.stringify(filters));
    });

    it('preserves resource qualifiers for lifecycle and frequency filters', function () {
      const filters = [
        { field: 'chains.balance', op: 'gt', value: 100, chain_id: '1' },
        { field: 'apps.balance', op: 'gte', value: 10, app_id: 'aave-v3' },
        { field: 'tokens.balance', op: 'gt', value: 0, token_address: '0xabc', scope: 'protocol', app_id: 'aave-v3' },
        { field: 'labels.value', op: 'eq', value: 'gold', tag_id: 'tier' },
      ];
      expect(buildAnalyticsParams({ filters: JSON.stringify(filters) }).filters)
        .to.equal(JSON.stringify(filters));
    });

    it('rejects invalid qualifiers and keeps nested event filters as leaves', function () {
      for (const filter of [
        { field: 'chains.balance', op: 'gt', value: 100, chain_id: 1 },
        { field: 'tokens.balance', op: 'gt', value: 0, scope: 'wallet' },
        { field: 'labels.value', op: 'eq', value: 'gold', tag_id: '' },
        { field: 'event', op: 'eq', value: 'purchase', filters: [
          { field: 'amount', op: 'gt', value: 10, chain_id: '1' },
        ] },
      ]) {
        expect(() => buildAnalyticsParams({ filters: JSON.stringify([filter]) })).to.throw();
      }
    });

    it('passes funnel OR members and their filters through intact', function () {
      const steps = [
        { type: 'track', event: 'Swap', name: 'trade', events: [
          { type: 'track', event: 'Limit Order', filters: [{ field: 'amount', op: 'gte', value: 100 }] },
        ] },
        { type: 'track', event: 'Complete', name: 'complete' },
      ];
      expect(buildAnalyticsParams({ params: JSON.stringify({ steps }) }).steps)
        .to.equal(JSON.stringify(steps));
    });

    it('supports either-touch attribution pairs and rejects malformed pairs', function () {
      const filters = [{ fields: ['first_utm_source', 'last_utm_source'], op: 'eq', value: 'twitter' }];
      expect(buildAnalyticsParams({ filters: JSON.stringify(filters) }).filters)
        .to.equal(JSON.stringify(filters));
      for (const fields of [[], ['first_utm_source'], ['first_utm_source', 1]]) {
        expect(() => buildAnalyticsParams({ filters: JSON.stringify([{ fields, op: 'eq', value: 'twitter' }]) }))
          .to.throw(/exactly two non-empty columns/);
      }
    });

    it('rejects recursive nested filters', function () {
      expect(() =>
        buildAnalyticsParams({
          filters: JSON.stringify([
            {
              field: 'event',
              op: 'eq',
              value: 'purchase',
              filters: [
                {
                  field: 'amount',
                  op: 'gte',
                  value: 100,
                  filters: [{ field: 'currency', op: 'eq', value: 'USD' }],
                },
              ],
            },
          ]),
        }),
      ).to.throw(/one-level array of leaf filters/);
    });

    it('rejects literal pipes in membership array members', function () {
      expect(() =>
        buildAnalyticsParams({
          filters: JSON.stringify([
            { field: 'browser', op: 'in', value: ['Chrome|Mobile', 'Safari'] },
          ]),
        }),
      ).to.throw(/cannot contain "\|"/);
      expect(() =>
        buildAnalyticsParams({
          filters: JSON.stringify([
            {
              field: 'event',
              op: 'eq',
              value: 'purchase',
              filters: [
                { field: 'sku', op: 'in', value: ['alpha|beta', 'gamma'] },
              ],
            },
          ]),
        }),
      ).to.throw(/cannot contain "\|"/);
    });

    it('rejects empty membership arrays, including nested filters', function () {
      expect(() =>
        buildAnalyticsParams({
          filters: JSON.stringify([
            { field: 'browser', op: 'in', value: [] },
          ]),
        }),
      ).to.throw(/membership arrays cannot be empty/);
      expect(() =>
        buildAnalyticsParams({
          filters: JSON.stringify([
            {
              field: 'event',
              op: 'eq',
              value: 'purchase',
              filters: [{ field: 'sku', op: 'nin', value: [] }],
            },
          ]),
        }),
      ).to.throw(/membership arrays cannot be empty/);
    });

    it('merges primitive params through unchanged', function () {
      const params = buildAnalyticsParams({
        params: '{"limit":10,"group_by":"device"}',
      });
      expect(params).to.deep.equal({ limit: 10, group_by: 'device' });
    });

    it('JSON-encodes object/array param values (e.g. funnel steps)', function () {
      const params = buildAnalyticsParams({
        params:
          '{"steps":[{"type":"event","event":"page","name":"page::0","filters":[]}]}',
      });
      expect(params.steps).to.equal(
        '[{"type":"event","event":"page","name":"page::0","filters":[]}]',
      );
    });

    it('skips null/undefined param values', function () {
      const params = buildAnalyticsParams({ params: '{"limit":null}' });
      expect(params).to.not.have.property('limit');
    });

    it('throws when params is not a JSON object', function () {
      expect(() => buildAnalyticsParams({ params: '[1,2,3]' })).to.throw(
        /--params must be a valid JSON object/,
      );
      expect(() => buildAnalyticsParams({ params: 'nope' })).to.throw(
        /--params must be valid JSON/,
      );
    });

    it('rejects reserved keys in --params (no validation bypass)', function () {
      for (const key of ['date_from', 'date_to', 'dateFrom', 'dateTo', 'filters']) {
        expect(() =>
          buildAnalyticsParams({ params: JSON.stringify({ [key]: 'x' }) }),
        ).to.throw(new RegExp(`--params may not set "${key}"`));
      }
    });

    it('lets the validated flags take precedence over --params', function () {
      // params is applied first; the dedicated flags override afterwards.
      const params = buildAnalyticsParams({
        dateFrom: '2026-04-01',
        params: '{"group_by":"device"}',
      });
      expect(params).to.deep.equal({
        group_by: 'device',
        date_from: '2026-04-01',
      });
    });
  });

  describe('runAnalytics()', function () {
    it('returns data from the kpis pipe', async function () {
      await requiresLiveApi(this);
      const result = (await runAnalytics('kpis', {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      })) as unknown;
      expect(result).to.exist;
    });

    it('accepts qualified resource filters on user-aggregate pipes', async function () {
      await requiresLiveApi(this);
      const filters = JSON.stringify([
        { field: 'chains.balance', op: 'gt', value: 0, chain_id: '1' },
        { field: 'apps.balance', op: 'gt', value: 0, app_id: 'aave-v3' },
        { field: 'tokens.balance', op: 'gt', value: 0, token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', scope: 'any' },
        { field: 'labels.value', op: 'eq', value: 'gold', tag_id: 'tier' },
      ]);
      for (const pipe of ['lifecycle', 'frequency']) {
        const result = await runAnalytics(pipe, {
          dateFrom: '2026-09-01', dateTo: '2026-09-07', filters,
        }) as Record<string, unknown>;
        expect(result).to.have.property('data').that.is.an('array');
      }
    });

    it('accepts either-touch attribution filters on lifecycle', async function () {
      await requiresLiveApi(this);
      const result = await runAnalytics('lifecycle', {
        dateFrom: '2026-09-01', dateTo: '2026-09-07',
        filters: JSON.stringify([
          { fields: ['first_utm_source', 'last_utm_source'], op: 'eq', value: 'twitter' },
        ]),
      }) as Record<string, unknown>;
      expect(result).to.have.property('data').that.is.an('array');
    });

    it('accepts funnel OR groups with member-scoped predicates', async function () {
      await requiresLiveApi(this);
      const result = await runAnalytics('funnel', {
        dateFrom: '2026-09-01', dateTo: '2026-09-07',
        params: JSON.stringify({ steps: [
          { type: 'track', event: 'Swap', name: 'trade', events: [
            { type: 'track', event: 'Limit Order', filters: [{ field: 'amount', op: 'gte', value: 100 }] },
          ] },
          { type: 'track', event: 'Complete', name: 'complete' },
        ] }),
      }) as Record<string, unknown>;
      expect(result).to.have.property('data').that.is.an('array');
    });

    // /v0/funnel and /v0/flow accept snake_case date_from/date_to — the pipes
    // that once required camelCase were unified API-side, verified live. These
    // two guard that: a regression to camelCase-only would 400 here.
    it('returns data from the funnel pipe (snake_case dates + JSON steps)', async function () {
      await requiresLiveApi(this);
      const result = (await runAnalytics('funnel', {
        dateFrom: '2026-03-01',
        dateTo: '2026-04-30',
        params:
          '{"steps":[{"type":"event","event":"page","name":"page::0","filters":[]},{"type":"track","event":"connect","name":"connect::1","filters":[]}]}',
      })) as Record<string, unknown>;
      expect(result).to.have.property('data');
    });

    it('returns data from the flow pipe (snake_case dates + JSON start_step)', async function () {
      await requiresLiveApi(this);
      const result = (await runAnalytics('flow', {
        dateFrom: '2026-03-01',
        dateTo: '2026-04-30',
        params:
          '{"start_step":{"type":"event","event":"page","resolved_event":"__ALL_PAGE_VIEWS__","filters":[]}}',
      })) as Record<string, unknown>;
      expect(result).to.have.property('data');
    });
  });
});

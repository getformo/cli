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

    // SKIPPED until the API-side fix unifying /v0/funnel and /v0/flow to
    // snake_case date_from/date_to is deployed. The CLI now sends snake_case
    // (see buildAnalyticsParams); production still only accepts camelCase
    // dateFrom/dateTo for these two pipes, so a live call returns HTTP 400.
    // Re-enable (.skip -> it) once the API change ships. The deterministic
    // snake_case unit test above keeps the CLI behavior locked meanwhile.
    it.skip('returns data from the funnel pipe (snake_case dates + JSON steps)', async function () {
      await requiresLiveApi(this);
      const result = (await runAnalytics('funnel', {
        dateFrom: '2026-03-01',
        dateTo: '2026-04-30',
        params:
          '{"steps":[{"type":"event","event":"page","name":"page::0","filters":[]},{"type":"track","event":"connect","name":"connect::1","filters":[]}]}',
      })) as Record<string, unknown>;
      expect(result).to.have.property('data');
    });

    it.skip('returns data from the flow pipe (snake_case dates + JSON start_step)', async function () {
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

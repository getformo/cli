import { expect } from 'chai';
import { stripTrailingFormatClause } from '../../src/lib/sql';

/**
 * Mirror what the API does to a submitted query: wrap it in a paginating
 * subquery with a single outer FORMAT JSON. Used to assert the stripped query
 * produces a statement with no FORMAT inside the parentheses.
 */
function wrap(inner: string): string {
  return `SELECT * FROM (${inner}) LIMIT 100 FORMAT JSON`;
}

/** Count real `FORMAT <name>` clauses (ignores formatDateTime, etc.). */
function countFormatClauses(sql: string): number {
  const matches = sql.match(/\bformat\s+[A-Za-z_][A-Za-z0-9_]*/gi);
  return matches ? matches.length : 0;
}

describe('lib/sql / stripTrailingFormatClause', function () {
  describe('strips a trailing top-level FORMAT clause', function () {
    it('removes FORMAT CSV', function () {
      expect(stripTrailingFormatClause('SELECT * FROM events FORMAT CSV')).to.equal(
        'SELECT * FROM events',
      );
    });

    it('removes FORMAT CSVWithNames', function () {
      expect(
        stripTrailingFormatClause('SELECT a, b FROM t FORMAT CSVWithNames'),
      ).to.equal('SELECT a, b FROM t');
    });

    it('removes FORMAT JSON', function () {
      expect(stripTrailingFormatClause('SELECT 1 FORMAT JSON')).to.equal('SELECT 1');
    });

    it('is case-insensitive on the keyword and name', function () {
      expect(stripTrailingFormatClause('SELECT 1 format json')).to.equal('SELECT 1');
      expect(stripTrailingFormatClause('SELECT 1 Format JSONEachRow')).to.equal(
        'SELECT 1',
      );
    });

    it('handles newlines and extra whitespace before FORMAT', function () {
      expect(
        stripTrailingFormatClause('SELECT 1\n  FROM t\nFORMAT   TabSeparated'),
      ).to.equal('SELECT 1\n  FROM t');
    });
  });

  describe('handles trailing semicolons', function () {
    it('removes a bare trailing semicolon', function () {
      expect(stripTrailingFormatClause('SELECT 1;')).to.equal('SELECT 1');
    });

    it('removes a semicolon after a FORMAT clause', function () {
      expect(stripTrailingFormatClause('SELECT 1 FORMAT CSV;')).to.equal('SELECT 1');
    });

    it('removes a FORMAT clause that follows a semicolon', function () {
      expect(
        stripTrailingFormatClause('SELECT x FROM t ORDER BY x; FORMAT CSV'),
      ).to.equal('SELECT x FROM t ORDER BY x');
    });

    it('removes whitespace and multiple trailing semicolons around FORMAT', function () {
      expect(stripTrailingFormatClause('SELECT 1 FORMAT CSV ; ')).to.equal('SELECT 1');
    });
  });

  describe('does not truncate FORMAT-like identifiers (no false positives)', function () {
    it('keeps a formatDateTime(...) call with no trailing clause', function () {
      const sql = 'SELECT formatDateTime(ts, \'%Y-%m-%d\') AS day FROM events';
      expect(stripTrailingFormatClause(sql)).to.equal(sql);
    });

    it('strips only the real clause, keeping formatDateTime(...) intact', function () {
      expect(
        stripTrailingFormatClause(
          'SELECT formatDateTime(ts) AS day, count() FROM events GROUP BY day FORMAT CSV',
        ),
      ).to.equal('SELECT formatDateTime(ts) AS day, count() FROM events GROUP BY day');
    });

    it('keeps a column/alias literally named format', function () {
      const sql = 'SELECT id AS format FROM t';
      expect(stripTrailingFormatClause(sql)).to.equal(sql);
    });

    it('keeps a real FORMAT clause even when a column is named format', function () {
      expect(
        stripTrailingFormatClause('SELECT format FROM t FORMAT JSON'),
      ).to.equal('SELECT format FROM t');
    });
  });

  describe('is aware of quotes, comments, and parentheses', function () {
    it('ignores FORMAT inside a string literal', function () {
      const sql = "SELECT 'FORMAT CSV' AS note FROM t";
      expect(stripTrailingFormatClause(sql)).to.equal(sql);
    });

    it('ignores FORMAT inside a line comment', function () {
      const sql = 'SELECT 1 -- FORMAT CSV';
      expect(stripTrailingFormatClause(sql)).to.equal(sql);
    });

    it('ignores FORMAT inside a block comment', function () {
      const sql = 'SELECT 1 /* FORMAT CSV */';
      expect(stripTrailingFormatClause(sql)).to.equal(sql);
    });

    it('ignores a FORMAT nested inside a subquery (not trailing)', function () {
      const sql = 'SELECT * FROM (SELECT 1 FORMAT CSV) AS x';
      expect(stripTrailingFormatClause(sql)).to.equal(sql);
    });
  });

  describe('no-ops', function () {
    it('leaves a plain query untouched', function () {
      const sql = 'SELECT count(*) FROM events';
      expect(stripTrailingFormatClause(sql)).to.equal(sql);
    });

    it('returns empty input unchanged', function () {
      expect(stripTrailingFormatClause('')).to.equal('');
    });

    it('does not manufacture an empty query from a bare FORMAT clause', function () {
      expect(stripTrailingFormatClause('FORMAT JSON')).to.equal('FORMAT JSON');
    });
  });

  describe('produces a query that wraps cleanly (the bug being fixed)', function () {
    const cases = [
      'SELECT * FROM events FORMAT CSV',
      'SELECT a, b FROM t FORMAT CSVWithNames;',
      'SELECT x FROM t ORDER BY x; FORMAT JSON',
      'SELECT formatDateTime(ts) AS day FROM events FORMAT CSV',
    ];

    cases.forEach(function (sql) {
      it(`leaves no FORMAT inside the parens for: ${sql}`, function () {
        const wrapped = wrap(stripTrailingFormatClause(sql));
        // Exactly one FORMAT clause survives — the outer one the API adds.
        expect(countFormatClauses(wrapped)).to.equal(1);
        // ...and it sits at the very end, outside the subquery parentheses.
        expect(wrapped).to.match(/\)\s+LIMIT\s+100\s+FORMAT\s+JSON$/);
        const innerParens = wrapped.slice(
          wrapped.indexOf('(') + 1,
          wrapped.lastIndexOf(')'),
        );
        expect(countFormatClauses(innerParens)).to.equal(0);
      });
    });
  });
});

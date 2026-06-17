/**
 * SQL helpers for the query command.
 *
 * The Formo query API wraps the SQL you submit so it can paginate the result
 * set and force a machine-readable response:
 *
 *     SELECT * FROM (<your query>) LIMIT <n> FORMAT JSON
 *
 * ClickHouse does not allow a `FORMAT` clause inside a subquery, so if your
 * query ends in its own `FORMAT` clause the wrapped statement becomes:
 *
 *     SELECT * FROM (SELECT ... FORMAT CSV) LIMIT 100 FORMAT JSON
 *
 * which ClickHouse rejects with a 400. A trailing `FORMAT` (or a trailing
 * semicolon) can never take effect through this endpoint anyway — the outer
 * `FORMAT JSON` always wins, and output shaping is the CLI's `--format` job —
 * so we remove it before sending and let the server wrap a clean query.
 */

/**
 * Strip a trailing, top-level `FORMAT <name>` clause and any trailing
 * semicolons from a SQL statement.
 *
 * The scan is aware of string literals, quoted identifiers, and comments, so
 * `FORMAT`-looking text inside them is never mistaken for a real clause. The
 * match is anchored to the end of the statement, so a `FORMAT` nested inside
 * parentheses (a subquery) or part of an identifier/function such as
 * `formatDateTime(...)` — or a column aliased `format` — is left untouched.
 *
 * Returns the original input unchanged when there is nothing to strip.
 */
export function stripTrailingFormatClause(sql: string): string {
  if (!sql) return sql

  const masked = maskLiterals(sql)
  // A genuine trailing FORMAT clause: the keyword `format` preceded by a word
  // boundary (so `formatDateTime` or a column aliased `format` is safe),
  // followed by exactly one identifier (the format name) and nothing else.
  const formatClause = /(^|[^A-Za-z0-9_])format\s+[A-Za-z_][A-Za-z0-9_]*\s*$/i

  let end = sql.length
  let didStrip = false
  // Peel top-level semicolons and a trailing FORMAT clause repeatedly so any
  // ordering collapses to the bare query, e.g. `... FORMAT CSV;`,
  // `...; FORMAT CSV`, or `... FORMAT CSV ;`. Trailing whitespace and comments
  // are only ever skipped to *look* past them — never removed on their own.
  for (;;) {
    let e = end
    while (e > 0 && /\s/.test(masked[e - 1])) e--
    if (e === 0) break

    if (masked[e - 1] === ';') {
      end = e - 1
      didStrip = true
      continue
    }

    const match = formatClause.exec(masked.slice(0, e))
    if (match) {
      // Cut at the `format` keyword, after the leading word-boundary char.
      end = match.index + match[1].length
      didStrip = true
      continue
    }

    break
  }

  if (!didStrip) return sql

  // Tidy the real whitespace now left dangling where the clause used to be.
  // Comments are not whitespace, so any genuine comment is preserved.
  const stripped = sql.slice(0, end).replace(/\s+$/, '')
  // Never manufacture an empty query from non-empty input (degenerate inputs
  // such as a bare `FORMAT JSON`): let the original surface its own error.
  return stripped === '' ? sql : stripped
}

/**
 * Return a copy of `sql` with the *contents* of string literals, quoted
 * identifiers, and comments replaced by spaces, preserving the original length
 * so indices stay aligned with the source. Quote delimiters are kept; comments
 * are blanked entirely. This lets the clause scanner reason about real SQL code
 * without tripping over keywords that merely appear inside literals or comments.
 */
function maskLiterals(sql: string): string {
  const out: string[] = []
  const n = sql.length
  let i = 0

  while (i < n) {
    const c = sql[i]
    const next = i + 1 < n ? sql[i + 1] : ''

    // Line comment: -- ... or # ... to end of line. ClickHouse accepts `#`
    // and `#!` line comments for MySQL compatibility.
    if ((c === '-' && next === '-') || c === '#') {
      while (i < n && sql[i] !== '\n') {
        out.push(' ')
        i++
      }
      continue
    }

    // Block comment: /* ... */
    if (c === '/' && next === '*') {
      out.push(' ', ' ')
      i += 2
      while (i < n && !(sql[i] === '*' && sql[i + 1] === '/')) {
        out.push(' ')
        i++
      }
      if (i < n) {
        out.push(' ', ' ')
        i += 2
      }
      continue
    }

    // String literal or quoted identifier: '...', "...", `...`
    if (c === "'" || c === '"' || c === '`') {
      const quote = c
      out.push(quote)
      i++
      while (i < n) {
        const d = sql[i]
        // Backslash escapes are honored inside single-quoted strings.
        if (d === '\\' && quote === "'") {
          out.push(' ')
          i++
          if (i < n) {
            out.push(' ')
            i++
          }
          continue
        }
        if (d === quote) {
          // A doubled delimiter is an escaped quote, not the terminator.
          if (i + 1 < n && sql[i + 1] === quote) {
            out.push(' ', ' ')
            i += 2
            continue
          }
          out.push(quote)
          i++
          break
        }
        out.push(' ')
        i++
      }
      continue
    }

    out.push(c)
    i++
  }

  return out.join('')
}

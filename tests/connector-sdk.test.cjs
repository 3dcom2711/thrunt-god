/**
 * Connector SDK tests
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const runtime = require('../thrunt-god/bin/lib/runtime.cjs');

describe('connector SDK primitives', () => {
  test('createAuthProfile accepts local-first auth references', () => {
    const profile = runtime.createAuthProfile({
      name: 'default',
      connector_id: 'splunk',
      auth_type: 'api_key',
      base_url: 'https://splunk.example.com',
      tenant: 'prod',
      secret_refs: {
        api_key: { type: 'env', value: 'SPLUNK_TOKEN' },
      },
    });

    assert.strictEqual(profile.connector_id, 'splunk');
    assert.strictEqual(profile.auth_type, 'api_key');
    assert.strictEqual(profile.secret_refs.api_key.type, 'env');
  });

  test('resolveConnectorProfile reads canonical connector profile config', () => {
    const profile = runtime.resolveConnectorProfile({
      connector_profiles: {
        sentinel: {
          prod: {
            auth_type: 'oauth_client_credentials',
            tenant: 'contoso',
            secret_refs: {
              client_id: { type: 'env', value: 'AZURE_CLIENT_ID' },
              client_secret: { type: 'env', value: 'AZURE_CLIENT_SECRET' },
            },
          },
        },
      },
    }, 'sentinel', 'prod');

    assert.strictEqual(profile.name, 'prod');
    assert.strictEqual(profile.connector_id, 'sentinel');
    assert.strictEqual(profile.auth_type, 'oauth_client_credentials');
  });

  test('pagination and backoff helpers are shared SDK surfaces', () => {
    const state = runtime.createPaginationState({ mode: 'cursor', limit: 200, max_pages: 3 });
    const page1 = runtime.advancePaginationState(state, { cursor: 'next-1' });
    const page2 = runtime.advancePaginationState(page1, { cursor: 'next-2' });
    const delay = runtime.computeBackoffDelayMs(2, 500, 10_000);

    assert.strictEqual(page1.pages_fetched, 1);
    assert.strictEqual(page1.cursor, 'next-1');
    assert.strictEqual(page2.pages_fetched, 2);
    assert.strictEqual(delay, 2000);
  });

  test('connector registry exposes capability discovery through one surface', () => {
    const registry = runtime.createConnectorRegistry([
      {
        capabilities: runtime.createConnectorCapabilities({
          id: 'okta',
          auth_types: ['oauth_client_credentials'],
          dataset_kinds: ['identity'],
          languages: ['api'],
          pagination_modes: ['page'],
        }),
        prepareQuery() {},
        executeRequest() {},
        normalizeResponse() {},
      },
    ]);

    assert.strictEqual(registry.has('okta'), true);
    assert.strictEqual(registry.get('okta').capabilities.id, 'okta');
    assert.deepStrictEqual(registry.list().map(item => item.id), ['okta']);
  });
});

describe('dataset-aware defaults', () => {
  const baseInput = (kind) => ({
    connector: { id: 'test' },
    dataset: { kind },
    query: { statement: 'x' },
    time_window: { lookback_minutes: 60 },
  });

  test('DATASET_DEFAULTS has an entry for every kind in DATASET_KINDS', () => {
    for (const kind of runtime.DATASET_KINDS) {
      assert.ok(
        runtime.DATASET_DEFAULTS[kind],
        `DATASET_DEFAULTS missing entry for kind '${kind}'`
      );
      assert.ok(runtime.DATASET_DEFAULTS[kind].pagination, `Missing pagination for '${kind}'`);
      assert.ok(runtime.DATASET_DEFAULTS[kind].execution, `Missing execution for '${kind}'`);
    }
  });

  test('identity kind gets limit=200, max_pages=10, timeout_ms=30000', () => {
    const spec = runtime.createQuerySpec(baseInput('identity'));
    assert.strictEqual(spec.pagination.limit, 200);
    assert.strictEqual(spec.pagination.max_pages, 10);
    assert.strictEqual(spec.execution.timeout_ms, 30000);
  });

  test('endpoint kind gets limit=1000, max_pages=5, timeout_ms=60000', () => {
    const spec = runtime.createQuerySpec(baseInput('endpoint'));
    assert.strictEqual(spec.pagination.limit, 1000);
    assert.strictEqual(spec.pagination.max_pages, 5);
    assert.strictEqual(spec.execution.timeout_ms, 60000);
  });

  test('alerts kind gets limit=100, max_pages=10, timeout_ms=30000', () => {
    const spec = runtime.createQuerySpec(baseInput('alerts'));
    assert.strictEqual(spec.pagination.limit, 100);
    assert.strictEqual(spec.pagination.max_pages, 10);
    assert.strictEqual(spec.execution.timeout_ms, 30000);
  });

  test('cloud kind gets limit=500, max_pages=10, timeout_ms=45000', () => {
    const spec = runtime.createQuerySpec(baseInput('cloud'));
    assert.strictEqual(spec.pagination.limit, 500);
    assert.strictEqual(spec.pagination.max_pages, 10);
    assert.strictEqual(spec.execution.timeout_ms, 45000);
  });

  test('email kind gets limit=200, max_pages=10, timeout_ms=30000', () => {
    const spec = runtime.createQuerySpec(baseInput('email'));
    assert.strictEqual(spec.pagination.limit, 200);
    assert.strictEqual(spec.pagination.max_pages, 10);
    assert.strictEqual(spec.execution.timeout_ms, 30000);
  });

  test('entities kind gets limit=100, max_pages=5, timeout_ms=20000', () => {
    const spec = runtime.createQuerySpec(baseInput('entities'));
    assert.strictEqual(spec.pagination.limit, 100);
    assert.strictEqual(spec.pagination.max_pages, 5);
    assert.strictEqual(spec.execution.timeout_ms, 20000);
  });

  test('events kind matches old hardcoded defaults (limit=500, max_pages=10, timeout_ms=30000)', () => {
    const spec = runtime.createQuerySpec(baseInput('events'));
    assert.strictEqual(spec.pagination.limit, 500);
    assert.strictEqual(spec.pagination.max_pages, 10);
    assert.strictEqual(spec.execution.timeout_ms, 30000);
  });

  test('other kind matches old hardcoded defaults (limit=500, max_pages=10, timeout_ms=30000)', () => {
    const spec = runtime.createQuerySpec(baseInput('other'));
    assert.strictEqual(spec.pagination.limit, 500);
    assert.strictEqual(spec.pagination.max_pages, 10);
    assert.strictEqual(spec.execution.timeout_ms, 30000);
  });

  test('explicit pagination.limit=42 overrides identity defaults', () => {
    const spec = runtime.createQuerySpec({
      ...baseInput('identity'),
      pagination: { limit: 42 },
    });
    assert.strictEqual(spec.pagination.limit, 42);
  });

  test('explicit execution.timeout_ms=15000 overrides endpoint defaults', () => {
    const spec = runtime.createQuerySpec({
      ...baseInput('endpoint'),
      execution: { timeout_ms: 15000 },
    });
    assert.strictEqual(spec.execution.timeout_ms, 15000);
  });

  test('explicit pagination.limit=42 and max_pages=3 both override identity defaults', () => {
    const spec = runtime.createQuerySpec({
      ...baseInput('identity'),
      pagination: { limit: 42, max_pages: 3 },
    });
    assert.strictEqual(spec.pagination.limit, 42);
    assert.strictEqual(spec.pagination.max_pages, 3);
  });
});

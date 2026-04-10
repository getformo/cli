// test/setup.ts — sanity check that auth is wired up correctly
// FORMO_API_KEY is set synchronously by test/preload.cjs before this runs
import { expect } from 'chai';

describe('test environment', function () {
  it('FORMO_API_KEY is set from TEST_TOKEN', function () {
    expect(process.env.FORMO_API_KEY).to.be.a('string').and.match(/^formo_/);
  });
});

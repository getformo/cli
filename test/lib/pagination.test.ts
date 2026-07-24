import { expect } from 'chai';
import { buildPaginationParams } from '../../src/lib/pagination';

describe('lib/pagination', function () {
  describe('buildPaginationParams()', function () {
    it('returns an empty object when no options given', function () {
      expect(buildPaginationParams()).to.deep.equal({});
      expect(buildPaginationParams({})).to.deep.equal({});
    });

    it('includes only the provided values', function () {
      expect(buildPaginationParams({ page: 2 })).to.deep.equal({ page: 2 });
      expect(buildPaginationParams({ size: 50 })).to.deep.equal({ size: 50 });
      expect(buildPaginationParams({ page: 3, size: 25 })).to.deep.equal({
        page: 3,
        size: 25,
      });
    });
  });
});

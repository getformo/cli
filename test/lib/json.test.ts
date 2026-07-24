import { expect } from 'chai';
import {
  parseJson,
  parseJsonArray,
  parseJsonArrayOfObjects,
  parseJsonObject,
  parseStringArray,
} from '../../src/lib/json';

describe('lib/json', function () {
  describe('parseJson()', function () {
    it('parses valid JSON of any type', function () {
      expect(parseJson('{"a":1}', '--x')).to.deep.equal({ a: 1 });
      expect(parseJson('[1,2]', '--x')).to.deep.equal([1, 2]);
      expect(parseJson('"str"', '--x')).to.equal('str');
    });

    it('throws with the flag name on invalid JSON', function () {
      expect(() => parseJson('nope', '--my-flag')).to.throw(
        /--my-flag must be valid JSON/,
      );
    });
  });

  describe('parseJsonObject()', function () {
    it('accepts a plain object', function () {
      expect(parseJsonObject('{"a":1}', '--x')).to.deep.equal({ a: 1 });
    });

    it('rejects null, arrays, and primitives', function () {
      for (const raw of ['null', '[1]', '"s"', '5']) {
        expect(() => parseJsonObject(raw, '--x'), `raw: ${raw}`).to.throw(
          /--x must be a valid JSON object/,
        );
      }
    });
  });

  describe('parseJsonArray()', function () {
    it('accepts an array', function () {
      expect(parseJsonArray('[1,"a"]', '--x')).to.deep.equal([1, 'a']);
    });

    it('rejects non-arrays', function () {
      expect(() => parseJsonArray('{"a":1}', '--x')).to.throw(
        /--x must be a valid JSON array/,
      );
    });
  });

  describe('parseJsonArrayOfObjects()', function () {
    it('accepts an array of objects', function () {
      expect(parseJsonArrayOfObjects('[{"a":1}]', '--x')).to.deep.equal([
        { a: 1 },
      ]);
    });

    it('rejects entries that are not plain objects', function () {
      for (const raw of ['[1]', '["a"]', '[null]', '[[1]]']) {
        expect(
          () => parseJsonArrayOfObjects(raw, '--x'),
          `raw: ${raw}`,
        ).to.throw(/--x must be a valid JSON array of objects/);
      }
    });
  });

  describe('parseStringArray()', function () {
    it('parses a JSON array of strings', function () {
      expect(parseStringArray('["a","b"]', '--x')).to.deep.equal(['a', 'b']);
    });

    it('rejects a JSON array with non-string entries', function () {
      expect(() => parseStringArray('["a",1]', '--x')).to.throw(
        /--x must be a JSON array of strings/,
      );
    });

    it('splits comma-separated values and trims whitespace', function () {
      expect(parseStringArray(' a, b ,c ', '--x')).to.deep.equal([
        'a',
        'b',
        'c',
      ]);
    });

    it('drops empty comma segments', function () {
      expect(parseStringArray('a,,b,', '--x')).to.deep.equal(['a', 'b']);
    });

    it('throws when only empty segments remain', function () {
      expect(() => parseStringArray(' , ,', '--x')).to.throw(
        /--x must contain at least one value/,
      );
    });
  });
});

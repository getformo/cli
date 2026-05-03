import { expect } from 'chai';
import type { AxiosError } from 'axios';
import { parseApiError } from '../../src/lib/client';

function makeAxiosError(args: {
  status?: number;
  data?: unknown;
  message?: string;
  code?: string;
}): AxiosError {
  return {
    isAxiosError: true,
    name: 'AxiosError',
    message: args.message ?? 'Request failed',
    code: args.code,
    config: {} as never,
    response:
      args.status !== undefined
        ? {
            status: args.status,
            statusText: '',
            headers: {},
            config: {} as never,
            data: args.data,
          }
        : undefined,
    toJSON: () => ({}),
  } as AxiosError;
}

describe('lib/client / parseApiError', function () {
  it('decodes the canonical { error: { code, message, doc_url } } envelope', function () {
    const err = parseApiError(
      makeAxiosError({
        status: 404,
        data: {
          error: {
            code: 'NOT_FOUND',
            message: 'Alert not found',
            doc_url: 'https://docs.formo.so/api/errors#not_found',
          },
        },
      }),
    );

    expect(err.code).to.equal('NOT_FOUND');
    expect(err.docUrl).to.equal('https://docs.formo.so/api/errors#not_found');
    expect(err.status).to.equal(404);
    expect(err.message).to.include('[NOT_FOUND] Alert not found');
    expect(err.message).to.include('https://docs.formo.so/api/errors#not_found');
  });

  it('surfaces param when present', function () {
    const err = parseApiError(
      makeAxiosError({
        status: 400,
        data: {
          error: {
            code: 'BAD_REQUEST',
            message: 'Chain ID 999999 not supported',
            doc_url: 'https://docs.formo.so/api/errors#bad_request',
            param: 'chainId',
          },
        },
      }),
    );

    expect(err.param).to.equal('chainId');
    expect(err.message).to.include('Param: chainId');
  });

  it('preserves details on validation errors', function () {
    const details = {
      'body.name': 'Required',
      'body.conditions.0.operator': 'Expected one of: gt, lt, eq',
    };
    const err = parseApiError(
      makeAxiosError({
        status: 400,
        data: {
          error: {
            code: 'INVALID_VALIDATION_REQUEST',
            message: 'Request validation failed',
            doc_url: 'https://docs.formo.so/api/errors#invalid_validation_request',
            details,
          },
        },
      }),
    );

    expect(err.code).to.equal('INVALID_VALIDATION_REQUEST');
    expect(err.details).to.deep.equal(details);
  });

  it('falls back to axios message when the body has no error envelope', function () {
    const err = parseApiError(
      makeAxiosError({
        status: 401,
        data: undefined,
        message: 'Request failed with status code 401',
      }),
    );

    expect(err.code).to.be.undefined;
    expect(err.docUrl).to.be.undefined;
    expect(err.message).to.equal('Request failed with status code 401');
  });

  it('handles transport errors with no response', function () {
    const err = parseApiError(
      makeAxiosError({
        message: 'getaddrinfo ENOTFOUND api.formo.so',
        code: 'ENOTFOUND',
      }),
    );

    expect(err.code).to.be.undefined;
    expect(err.status).to.be.undefined;
    expect(err.transportCode).to.equal('ENOTFOUND');
    expect(err.message).to.equal('getaddrinfo ENOTFOUND api.formo.so');
  });

  it('omits Param/Docs lines when absent', function () {
    const err = parseApiError(
      makeAxiosError({
        status: 500,
        data: {
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Something went wrong',
          },
        },
      }),
    );

    expect(err.message).to.equal('[INTERNAL_SERVER_ERROR] Something went wrong');
    expect(err.message).to.not.include('Param:');
    expect(err.message).to.not.include('Docs:');
  });
});

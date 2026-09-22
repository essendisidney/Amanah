import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import {
  isBankRailConfigured,
  resolveBankRail,
} from '../payments/adapters/bank-rails.ts';

describe('resolveBankRail', () => {
  it('maps coop / kcb provider ids', () => {
    assert.equal(resolveBankRail('coop'), 'coop');
    assert.equal(resolveBankRail('kcb'), 'kcb');
    assert.equal(resolveBankRail('bank'), 'generic');
  });
});

describe('isBankRailConfigured', () => {
  const keys = [
    'BANK_API_URL',
    'BANK_API_KEY',
    'COOP_BANK_API_URL',
    'COOP_BANK_API_KEY',
    'KCB_BANK_API_URL',
    'KCB_BANK_API_KEY',
  ] as const;
  const saved: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const k of keys) {
      if (k in saved) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
        delete saved[k];
      }
    }
  });

  function clearBankEnv() {
    for (const k of keys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  }

  it('is false without credentials', () => {
    clearBankEnv();
    assert.equal(isBankRailConfigured('coop'), false);
    assert.equal(isBankRailConfigured('kcb'), false);
    assert.equal(isBankRailConfigured('generic'), false);
  });

  it('uses rail-specific overrides', () => {
    clearBankEnv();
    process.env.COOP_BANK_API_URL = 'https://coop.example/api';
    process.env.COOP_BANK_API_KEY = 'coop-key';
    assert.equal(isBankRailConfigured('coop'), true);
    assert.equal(isBankRailConfigured('kcb'), false);
  });
});

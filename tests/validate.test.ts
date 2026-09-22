import { describe, expect, it } from 'vitest';
import {
  backends,
  databases,
  defaults,
  emails,
  frontends,
  isBetaSelection,
  storages,
} from '../src/core/types.js';
import { validateConfig } from '../src/core/validate.js';
describe('configuration validation', () => {
  it('accepts the complete vertical slice', () => expect(validateConfig(defaults)).toEqual([]));
  it('rejects unsafe project names', () =>
    expect(validateConfig({ ...defaults, projectName: '../oops' }).join()).toContain('kebab-case'));
  it('allows skeleton combinations without runtime credentials', () =>
    expect(validateConfig({ ...defaults, frontend: 'react-native', docker: true }).join()).toBe(
      '',
    ));
  it('labels only live-unverified provider options as beta', () => {
    expect(isBetaSelection('storage', 'aws-s3')).toBe(true);
    expect(isBetaSelection('email', 'sendgrid')).toBe(true);
    expect(isBetaSelection('database', 'firestore')).toBe(false);
    expect(isBetaSelection('email', 'twilio')).toBe(false);
  });
  it('accepts every advertised skeleton selection', () => {
    for (const backend of backends)
      for (const frontend of frontends)
        for (const database of databases)
          for (const storage of storages)
            for (const email of emails)
              expect(
                validateConfig({
                  ...defaults,
                  backend,
                  frontend,
                  database,
                  storage,
                  email,
                  billing: true,
                  organizations: true,
                }),
              ).toEqual([]);
  });
});

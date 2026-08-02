import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAccountURL } from '../react/features/account/api.ts';

test('account API paths have exactly one separator', () => {
    assert.equal(buildAccountURL('/account/api/', '/me'), '/account/api/me');
    assert.equal(buildAccountURL('https://meet.example/account/api', 'profile'),
        'https://meet.example/account/api/profile');
});

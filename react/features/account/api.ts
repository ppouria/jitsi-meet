export class AccountAPIError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'AccountAPIError';
        this.status = status;
    }
}

interface IRequestOptions {
    body?: unknown;
    keepalive?: boolean;
    method?: string;
}

export function buildAccountURL(serviceURL: string, path: string) {
    return serviceURL.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
}

export async function accountAPI<T>(serviceURL: string, path: string, options: IRequestOptions = {}): Promise<T> {
    const hasBody = typeof options.body !== 'undefined';
    const response = await fetch(buildAccountURL(serviceURL, path), {
        body: hasBody ? JSON.stringify(options.body) : undefined,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
            'X-Requested-With': 'XMLHttpRequest'
        },
        keepalive: options.keepalive,
        method: options.method ?? 'GET'
    });
    const payload = await response.json().catch(() => undefined);

    if (!response.ok) {
        const message = payload && typeof payload.message === 'string'
            ? payload.message
            : 'Account request failed (' + response.status + ').';

        throw new AccountAPIError(response.status, message);
    }

    return payload as T;
}

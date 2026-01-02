import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
// Nest controllers are prefixed with api/v1; adjust if you have an upstream prefix
const AUTH_PATH = __ENV.AUTH_PATH || '/api/v1/auth/login';
const BATTLE_CREATE_PATH = __ENV.BATTLE_CREATE_PATH || '/api/v1/battles';
const RECORD_LIST_PATH = __ENV.RECORD_LIST_PATH || '/api/v1/records';
// board controller has no root GET; use templates or mine
const BOARD_LIST_PATH = __ENV.BOARD_LIST_PATH || '/api/v1/boards/templates';
const COMMUNITY_LIST_PATH = __ENV.COMMUNITY_LIST_PATH || '/api/v1/community/posts';

const loginLatency = new Trend('auth_latency');
const battleLatency = new Trend('battle_create_latency');
const listLatency = new Trend('list_latency');
const httpErrors = new Counter('http_errors');

export const options = {
    scenarios: {
        ramp_http: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '30s', target: 20 },
                { duration: '1m', target: 50 },
                { duration: '1m', target: 50 },
                { duration: '30s', target: 0 },
            ],
            gracefulRampDown: '30s',
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<200', 'p(99)<400'],
        http_errors: ['count==0'],
    },
};

function login() {
    const body = JSON.stringify({
        // API expects phone + password
        phone: __ENV.PHONE || __ENV.USERNAME || '13000000000',
        password: __ENV.PASSWORD || 'pass1',
    });
    const res = http.post(`${BASE_URL}${AUTH_PATH}`, body, {
        headers: { 'Content-Type': 'application/json' },
    });
    loginLatency.add(res.timings.duration);
    const ok = check(res, {
        'auth status 200/201': (r) => r.status === 200 || r.status === 201,
    });
    if (!ok) {
        httpErrors.add(1);
        throw new Error(`auth failed status=${res.status}`);
    }
    const json = res.json();
    // backend returns { code, message, data: { accessToken } }
    const token = json?.data?.accessToken || json?.accessToken;
    if (!token) {
        throw new Error('auth token missing in response');
    }
    return token;
}

export function setup() {
    const token = login();
    return { token };
}

export default function (data) {
    const token = data.token;
    const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };

    const battleRes = http.post(`${BASE_URL}${BATTLE_CREATE_PATH}`, JSON.stringify({
        // adjust to actual DTO fields; keep payload light for create flow
        name: 'k6-battle',
    }), { headers });
    battleLatency.add(battleRes.timings.duration);
    if (!check(battleRes, { 'battle create 200/201': (r) => r.status === 200 || r.status === 201 })) {
        httpErrors.add(1);
    }

    const listPaths = [BOARD_LIST_PATH, RECORD_LIST_PATH, COMMUNITY_LIST_PATH];
    listPaths.forEach((path) => {
        const res = http.get(`${BASE_URL}${path}`, { headers });
        listLatency.add(res.timings.duration);
        if (!check(res, { 'list 200/304/206': (r) => r.status === 200 || r.status === 206 || r.status === 304 })) {
            httpErrors.add(1);
        }
    });

    sleep(1);
}

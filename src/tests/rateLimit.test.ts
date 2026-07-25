import { describe, expect, it, vi } from 'vitest';
import { createRateLimiter } from '../../server/middleware/rateLimit';

function mockReq(uid?: string) {
  return { user: uid ? { uid } : undefined, ip: '127.0.0.1' } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.setHeader = vi.fn();
  return res;
}

describe('createRateLimiter', () => {
  it('allows requests under the limit and blocks once it is exceeded', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    const req = mockReq('user-1');

    for (let i = 0; i < 3; i++) {
      const res = mockRes();
      const next = vi.fn();
      limiter(req, res, next);
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    }

    const res = mockRes();
    const next = vi.fn();
    limiter(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('tracks each user independently', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });

    const resA1 = mockRes();
    limiter(mockReq('user-a'), resA1, vi.fn());
    expect(resA1.status).not.toHaveBeenCalled();

    // user-a is now at its limit — a second request from user-a should be blocked...
    const resA2 = mockRes();
    const nextA2 = vi.fn();
    limiter(mockReq('user-a'), resA2, nextA2);
    expect(nextA2).not.toHaveBeenCalled();
    expect(resA2.status).toHaveBeenCalledWith(429);

    // ...but user-b has never been seen, so it gets its own fresh window.
    const resB1 = mockRes();
    const nextB1 = vi.fn();
    limiter(mockReq('user-b'), resB1, nextB1);
    expect(nextB1).toHaveBeenCalledOnce();
    expect(resB1.status).not.toHaveBeenCalled();
  });

  it('resets the count once the window has elapsed', () => {
    vi.useFakeTimers();
    try {
      const limiter = createRateLimiter({ windowMs: 1000, max: 1 });
      const req = mockReq('user-1');

      limiter(req, mockRes(), vi.fn());

      const blocked = mockRes();
      limiter(req, blocked, vi.fn());
      expect(blocked.status).toHaveBeenCalledWith(429);

      vi.advanceTimersByTime(1001);

      const afterReset = mockRes();
      const next = vi.fn();
      limiter(req, afterReset, next);
      expect(next).toHaveBeenCalledOnce();
      expect(afterReset.status).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

import { RequestContext } from '../../src/context/RequestContext';

describe('RequestContext', () => {
  describe('run', () => {
    it('should provide context within callback', () => {
      const result = RequestContext.run({ requestId: 'req-123' }, () => {
        return RequestContext.get('requestId');
      });
      expect(result).toBe('req-123');
    });

    it('should isolate context between runs', () => {
      const results: (string | undefined)[] = [];

      RequestContext.run({ requestId: 'req-1' }, () => {
        results.push(RequestContext.get('requestId'));
      });

      RequestContext.run({ requestId: 'req-2' }, () => {
        results.push(RequestContext.get('requestId'));
      });

      expect(results).toEqual(['req-1', 'req-2']);
    });

    it('should support nested contexts', () => {
      const results: (string | undefined)[] = [];

      RequestContext.run({ requestId: 'outer' }, () => {
        results.push(RequestContext.get('requestId'));

        RequestContext.run({ requestId: 'inner' }, () => {
          results.push(RequestContext.get('requestId'));
        });

        results.push(RequestContext.get('requestId'));
      });

      expect(results).toEqual(['outer', 'inner', 'outer']);
    });

    it('should return callback result', () => {
      const result = RequestContext.run({ userId: 'u-123' }, () => {
        return { computed: `user:${RequestContext.get('userId')}` };
      });
      expect(result).toEqual({ computed: 'user:u-123' });
    });
  });

  describe('runAsync', () => {
    it('should maintain context across async operations', async () => {
      const result = await RequestContext.runAsync(
        { requestId: 'async-req-123' },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return RequestContext.get('requestId');
        }
      );
      expect(result).toBe('async-req-123');
    });

    it('should isolate async contexts', async () => {
      const results = await Promise.all([
        RequestContext.runAsync({ requestId: 'async-1' }, async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return RequestContext.get('requestId');
        }),
        RequestContext.runAsync({ requestId: 'async-2' }, async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return RequestContext.get('requestId');
        }),
      ]);

      expect(results).toEqual(['async-1', 'async-2']);
    });
  });

  describe('getAll', () => {
    it('should return all context values', () => {
      RequestContext.run(
        { requestId: 'req-123', userId: 'user-456', tenantId: 'tenant-789' },
        () => {
          const all = RequestContext.getAll();
          expect(all).toEqual({
            requestId: 'req-123',
            userId: 'user-456',
            tenantId: 'tenant-789',
          });
        }
      );
    });

    it('should return empty object when no context', () => {
      const all = RequestContext.getAll();
      expect(all).toEqual({});
    });
  });

  describe('set', () => {
    it('should add values to existing context', () => {
      RequestContext.run({ requestId: 'req-123' }, () => {
        RequestContext.set('newField', 'newValue');
        expect(RequestContext.get('newField' as any)).toBe('newValue');
        expect(RequestContext.get('requestId')).toBe('req-123');
      });
    });

    it('should do nothing when no context active', () => {
      RequestContext.set('field', 'value');
      expect(RequestContext.get('field' as any)).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for existing keys', () => {
      RequestContext.run({ requestId: 'req-123' }, () => {
        expect(RequestContext.has('requestId')).toBe(true);
        expect(RequestContext.has('nonexistent')).toBe(false);
      });
    });

    it('should return false when no context', () => {
      expect(RequestContext.has('any')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove key from context', () => {
      RequestContext.run({ requestId: 'req-123', userId: 'user-456' }, () => {
        expect(RequestContext.has('userId')).toBe(true);
        const deleted = RequestContext.delete('userId');
        expect(deleted).toBe(true);
        expect(RequestContext.has('userId')).toBe(false);
        expect(RequestContext.get('requestId')).toBe('req-123');
      });
    });

    it('should return false when no context', () => {
      expect(RequestContext.delete('any')).toBe(false);
    });
  });

  describe('isActive', () => {
    it('should return true inside context', () => {
      RequestContext.run({ requestId: 'req' }, () => {
        expect(RequestContext.isActive()).toBe(true);
      });
    });

    it('should return false outside context', () => {
      expect(RequestContext.isActive()).toBe(false);
    });
  });
});

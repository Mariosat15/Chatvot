/**
 * Database mock utilities for Vitest tests.
 * Provides in-memory Mongoose connection using mongodb-memory-server,
 * or simple stubs when full DB isn't needed.
 */
import { vi } from "vitest";

/**
 * Creates a mock for connectToDatabase that does nothing.
 * Use when testing pure logic that doesn't need real DB.
 */
export function mockConnectToDatabase() {
  vi.mock("@/database/mongoose", () => ({
    connectToDatabase: vi.fn().mockResolvedValue(undefined),
  }));
}

/**
 * Creates a mock Mongoose model with common query methods.
 * Returns chainable stubs for find/findOne/findOneAndUpdate/create/etc.
 */
export function createMockModel(defaultData: Record<string, unknown> = {}) {
  const leanFn = vi.fn().mockResolvedValue(defaultData);
  const selectFn = vi.fn().mockReturnValue({ lean: leanFn });
  const sortFn = vi.fn().mockReturnValue({ lean: leanFn, select: selectFn });
  const limitFn = vi.fn().mockReturnValue({ sort: sortFn, lean: leanFn });

  return {
    findOne: vi.fn().mockReturnValue({ lean: leanFn, select: selectFn }),
    find: vi.fn().mockReturnValue({
      lean: leanFn,
      select: selectFn,
      sort: sortFn,
      limit: limitFn,
    }),
    findOneAndUpdate: vi.fn().mockResolvedValue(defaultData),
    findByIdAndUpdate: vi.fn().mockResolvedValue(defaultData),
    create: vi.fn().mockResolvedValue(defaultData),
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
    countDocuments: vi.fn().mockResolvedValue(0),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    aggregate: vi.fn().mockResolvedValue([]),
    _leanFn: leanFn,
    _selectFn: selectFn,
  };
}

/**
 * Creates a mock auth session object.
 */
export function createMockSession(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: "test-user-id-123",
      name: "Test User",
      email: "test@example.com",
      ...overrides,
    },
    session: {
      id: "test-session-id",
      expiresAt: new Date(Date.now() + 86400000),
    },
  };
}

/**
 * Mocks Next.js headers() function.
 */
export function mockNextHeaders(
  headerMap: Record<string, string> = {},
) {
  const headersObj = new Map(Object.entries(headerMap));
  vi.mock("next/headers", () => ({
    headers: vi.fn().mockResolvedValue(headersObj),
  }));
  return headersObj;
}

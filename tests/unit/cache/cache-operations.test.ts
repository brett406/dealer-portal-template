import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getCached,
  setCached,
  invalidateCache,
  invalidateAll,
  cached,
} from "@/lib/cache";

describe("getCached / setCached", () => {
  beforeEach(() => invalidateAll());

  it("returns null for missing key", () => {
    expect(getCached("nonexistent")).toBeNull();
  });

  it("returns data for valid key within TTL", () => {
    setCached("test-key", { foo: "bar" }, 60);
    expect(getCached("test-key")).toEqual({ foo: "bar" });
  });

  it("returns null after TTL expires", async () => {
    // Set with very short TTL
    setCached("expire-key", "value", 0);

    // Wait 2ms so Date.now() > expiresAt
    await new Promise((r) => setTimeout(r, 2));

    const result = getCached("expire-key");
    expect(result).toBeNull();
  });

  it("stores data correctly", () => {
    setCached("num", 42, 60);
    setCached("str", "hello", 60);
    setCached("obj", { nested: { deep: true } }, 60);
    setCached("arr", [1, 2, 3], 60);

    expect(getCached("num")).toBe(42);
    expect(getCached("str")).toBe("hello");
    expect(getCached("obj")).toEqual({ nested: { deep: true } });
    expect(getCached("arr")).toEqual([1, 2, 3]);
  });
});

describe("invalidateCache", () => {
  beforeEach(() => invalidateAll());

  it("removes matching keys", () => {
    setCached("products:list:cat1", "data1", 60);
    setCached("products:list:cat2", "data2", 60);
    setCached("pricing:p1:pl1", "price1", 60);

    invalidateCache("products:");

    expect(getCached("products:list:cat1")).toBeNull();
    expect(getCached("products:list:cat2")).toBeNull();
    expect(getCached("pricing:p1:pl1")).toBe("price1"); // Not affected
  });

  it("does nothing when no keys match", () => {
    setCached("keep-me", "data", 60);
    invalidateCache("nonexistent:");
    expect(getCached("keep-me")).toBe("data");
  });
});

describe("invalidateAll", () => {
  it("clears everything", () => {
    setCached("a", 1, 60);
    setCached("b", 2, 60);
    setCached("c", 3, 60);

    invalidateAll();

    expect(getCached("a")).toBeNull();
    expect(getCached("b")).toBeNull();
    expect(getCached("c")).toBeNull();
  });
});

describe("cached() helper", () => {
  beforeEach(() => invalidateAll());

  it("returns cached value on second call", async () => {
    const factory = vi.fn().mockResolvedValue("expensive-result");

    const first = await cached("key1", 60, factory);
    const second = await cached("key1", 60, factory);

    expect(first).toBe("expensive-result");
    expect(second).toBe("expensive-result");
  });

  it("calls factory only once within TTL", async () => {
    const factory = vi.fn().mockResolvedValue("result");

    await cached("key2", 60, factory);
    await cached("key2", 60, factory);
    await cached("key2", 60, factory);

    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("calls factory again after invalidation", async () => {
    const factory = vi.fn().mockResolvedValue("result");

    await cached("key3", 60, factory);
    expect(factory).toHaveBeenCalledTimes(1);

    invalidateCache("key3");
    await cached("key3", 60, factory);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("calls factory again after TTL expires", async () => {
    const factory = vi.fn().mockResolvedValue("result");

    // TTL of 0 + small delay = expired
    await cached("key4", 0, factory);
    await new Promise((r) => setTimeout(r, 2));
    await cached("key4", 0, factory);

    expect(factory).toHaveBeenCalledTimes(2);
  });
});

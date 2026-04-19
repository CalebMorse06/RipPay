import { NextResponse } from "next/server";

export async function GET() {
  const hasRedisUrl = !!process.env.UPSTASH_REDIS_REST_URL;
  const hasRedisToken = !!process.env.UPSTASH_REDIS_REST_TOKEN;
  const usingRedis = hasRedisUrl && hasRedisToken;

  let redisOk = false;
  let redisError: string | null = null;

  if (usingRedis) {
    try {
      const { Redis } = await import("@upstash/redis");
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
      await redis.set("health_check", "ok", { ex: 10 });
      const val = await redis.get("health_check");
      redisOk = val === "ok";
    } catch (e: any) {
      redisError = e?.message ?? "unknown error";
    }
  }

  return NextResponse.json({
    store: usingRedis ? "redis" : "in-memory",
    redis: {
      configured: usingRedis,
      ok: redisOk,
      error: redisError,
    },
    env: {
      UPSTASH_REDIS_REST_URL: hasRedisUrl ? "set" : "missing",
      UPSTASH_REDIS_REST_TOKEN: hasRedisToken ? "set" : "missing",
    },
  });
}

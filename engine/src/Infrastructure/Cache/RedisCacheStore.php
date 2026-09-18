<?php

declare(strict_types=1);

namespace Zone\Engine\Infrastructure\Cache;

use Redis;
use RuntimeException;
use Zone\Engine\Core\Contracts\CacheStore;

final readonly class RedisCacheStore implements CacheStore
{
    private Redis $redis;

    public function __construct(string $url)
    {
        if (!class_exists(Redis::class)) {
            throw new RuntimeException('The Redis PHP extension is required for ZONE_REDIS_URL.');
        }
        $parts = parse_url($url);
        if ($parts === false || !isset($parts['host'])) {
            throw new RuntimeException('Invalid ZONE_REDIS_URL.');
        }
        $redis = new Redis();
        $redis->connect($parts['host'], $parts['port'] ?? 6379, 2.5);
        if (isset($parts['pass'])) {
            $redis->auth(urldecode($parts['pass']));
        }
        if (isset($parts['path']) && trim($parts['path'], '/') !== '') {
            $redis->select((int) trim($parts['path'], '/'));
        }
        $this->redis = $redis;
    }

    public function adapterName(): string
    {
        return 'redis';
    }

    public function get(string $key): ?string
    {
        $value = $this->redis->get($key);
        return $value === false ? null : (string) $value;
    }

    public function set(string $key, string $value, int $ttlSeconds = 300): void
    {
        $this->redis->setex($key, max(1, $ttlSeconds), $value);
    }

    public function delete(string $key): void
    {
        $this->redis->del($key);
    }
}

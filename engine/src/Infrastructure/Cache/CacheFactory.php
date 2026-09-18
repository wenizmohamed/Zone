<?php

declare(strict_types=1);

namespace Zone\Engine\Infrastructure\Cache;

use Zone\Engine\Core\Contracts\CacheStore;

final class CacheFactory
{
    public static function fromEnvironment(): CacheStore
    {
        $redisUrl = getenv('ZONE_REDIS_URL') ?: '';
        return $redisUrl === '' ? new ArrayCacheStore() : new RedisCacheStore($redisUrl);
    }
}

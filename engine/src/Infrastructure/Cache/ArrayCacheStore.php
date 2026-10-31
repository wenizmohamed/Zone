<?php

declare(strict_types=1);

namespace Zone\Engine\Infrastructure\Cache;

use Zone\Engine\Core\Contracts\CacheStore;

final class ArrayCacheStore implements CacheStore
{
    /** @var array<string, array{value: string, expires: int}> */
    private array $values = [];

    public function adapterName(): string
    {
        return 'memory';
    }

    public function get(string $key): ?string
    {
        $entry = $this->values[$key] ?? null;
        if ($entry === null || $entry['expires'] < time()) {
            unset($this->values[$key]);
            return null;
        }
        return $entry['value'];
    }

    public function set(string $key, string $value, int $ttlSeconds = 300): void
    {
        $this->values[$key] = ['value' => $value, 'expires' => time() + max(1, $ttlSeconds)];
    }

    public function delete(string $key): void
    {
        unset($this->values[$key]);
    }

    public function count(): int
    {
        $now = time();
        foreach ($this->values as $key => $entry) {
            if ($entry['expires'] < $now) {
                unset($this->values[$key]);
            }
        }
        return count($this->values);
    }
}

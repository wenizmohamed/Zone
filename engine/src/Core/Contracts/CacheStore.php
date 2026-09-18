<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Contracts;

interface CacheStore
{
    public function adapterName(): string;

    public function get(string $key): ?string;

    public function set(string $key, string $value, int $ttlSeconds = 300): void;

    public function delete(string $key): void;
}

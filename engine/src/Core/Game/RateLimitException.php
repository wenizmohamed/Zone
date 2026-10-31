<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use RuntimeException;

/**
 * Thrown when a player exceeds the allowed number of state-changing actions
 * inside the rolling rate-limit window. The router maps this to HTTP 429.
 */
final class RateLimitException extends RuntimeException
{
    public function __construct(public readonly int $retryAfter)
    {
        parent::__construct("Too many actions. Retry in {$retryAfter}s.");
    }

    public function toArray(): array
    {
        return [
            'error' => 'rate_limit',
            'retryAfter' => $this->retryAfter,
            'message' => $this->getMessage(),
        ];
    }
}

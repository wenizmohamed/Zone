<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use RuntimeException;

/**
 * Thrown when a state-changing action is attempted before its server-clock
 * cooldown has elapsed. Carries the seconds remaining so the router can return
 * an HTTP 429 with a Retry-After hint. Message keeps bilingual result keys.
 */
final class CooldownException extends RuntimeException
{
    public function __construct(
        public readonly string $action,
        public readonly int $retryAfter,
    ) {
        parent::__construct("Action '{$action}' is on cooldown for {$retryAfter}s.");
    }
}

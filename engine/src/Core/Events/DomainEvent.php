<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Events;

final readonly class DomainEvent
{
    public string $id;
    public string $occurredAt;

    public function __construct(
        public string $name,
        public array $payload,
        ?string $id = null,
        ?string $occurredAt = null,
    ) {
        $this->id = $id ?? bin2hex(random_bytes(16));
        $this->occurredAt = $occurredAt ?? gmdate('c');
    }
}

<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Contracts;

use Zone\Engine\Core\Events\DomainEvent;

interface EventSubscriber
{
    public function eventName(): string;

    public function handle(DomainEvent $event): void;
}

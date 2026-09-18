<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Contracts;

use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

interface GameModule
{
    public function boot(EventBus $events, Database $database): void;
}

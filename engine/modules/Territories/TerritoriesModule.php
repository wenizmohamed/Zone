<?php

declare(strict_types=1);

namespace Zone\Modules\Territories;

use Zone\Engine\Core\Contracts\GameModule;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

final class TerritoriesModule implements GameModule
{
    public function boot(EventBus $events, Database $database): void
    {
        // Territory definitions and initial world state are migrated and seeded
        // by the persistence adapter. Gameplay mutations remain behind the
        // application service and publish domain events through EventBus.
    }
}

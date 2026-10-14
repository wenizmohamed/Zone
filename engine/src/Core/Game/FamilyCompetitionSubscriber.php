<?php
declare(strict_types=1);
namespace Zone\Engine\Core\Game;
use Zone\Engine\Core\Contracts\EventSubscriber;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/** Only settled authoritative actions earn seasonal points; retries are deduplicated. */
final readonly class FamilyCompetitionSubscriber implements EventSubscriber
{
    public function __construct(private Database $database,private EventBus $events,private string $name) {}
    public function eventName(): string { return $this->name; }
    public function handle(DomainEvent $event): void
    {
        $payload=$event->payload; $kind=null;
        if ($event->name==='PlayerCombatResolved' && ($payload['outcome']??'')==='won' && ($payload['approach']??'')==='hosp') $kind='player-hospitalize';
        if ($event->name==='TerritoryControlChanged' && in_array($payload['action']??'', ['assault','reinforce'],true) && ($payload['warContribution']??0)>0) $kind='territory-assault';
        if ($kind!==null && is_string($payload['playerId']??null)) (new FamilyActivityService($this->database,$this->events))->recordCompetition($payload['playerId'],$kind,(string)($payload['correlationId']??$event->id));
    }
}

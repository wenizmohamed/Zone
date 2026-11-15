<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

final class SyndicateSocialService
{
    private const SEED_META_KEY = 'syndicate-social-seed-v1';
    private const BOUNTIES_META_KEY = 'syndicate-bounties-v1';
    private const CHANNELS = ['global', 'faction', 'trade', 'private'];

    private readonly Ledger $ledger;
    private readonly ResourceService $resources;

    public function __construct(
        private readonly Database $database,
        private readonly EventBus $events,
    ) {
        $this->ledger = new Ledger($database);
        $this->resources = new ResourceService($database, new NotificationService($database));
    }

    public function snapshot(string $playerId): array
    {
        $this->ensureSeeded();
        $player = $this->requirePlayer($playerId);
        $factionId = $this->playerFaction($playerId);

        return [
            'player' => [
                'id' => (string) $player['id'],
                'username' => (string) $player['username'],
                'factionId' => $factionId,
            ],
            'chat' => $this->loadChatChannels($playerId, $factionId),
            'mail' => $this->loadMail($playerId, (string) $player['username']),
            'bounties' => $this->formatBounties($this->loadBounties(), $playerId),
            'chronicle' => $this->loadChronicle(),
            'serverTime' => gmdate('c'),
        ];
    }

    public function sendChat(string $playerId, string $channel, string $message, ?string $recipientQuery = null): array
    {
        $this->ensureSeeded();
        $cleanChannel = strtolower(trim($channel));
        if (!in_array($cleanChannel, self::CHANNELS, true)) {
            throw new InvalidArgumentException('Invalid syndicate chat channel.');
        }
        $cleanText = trim(preg_replace('/\s+/u', ' ', $message) ?? '');
        if ($cleanText === '' || $this->utf8Length($cleanText) > 280) {
            throw new InvalidArgumentException('Message must be between 1 and 280 characters.');
        }

        $this->database->playerTransaction($playerId, function () use ($playerId, $cleanChannel, $cleanText, $recipientQuery): void {
            $player = $this->requirePlayer($playerId);
            $factionId = $this->playerFaction($playerId);
            $recipientId = null;
            $recipientName = null;
            if ($cleanChannel === 'private' && $recipientQuery !== null && trim($recipientQuery) !== '') {
                $target = $this->resolveTargetPlayer(trim($recipientQuery));
                if ($target !== null) {
                    $recipientId = (string) $target['id'];
                    $recipientName = (string) $target['username'];
                }
            }

            $payload = [
                'channel' => $cleanChannel,
                'senderId' => $playerId,
                'sender' => (string) $player['username'],
                'senderLevel' => (int) $player['level'],
                'factionId' => $factionId,
                'recipientId' => $recipientId,
                'recipientName' => $recipientName,
                'text' => $cleanText,
                'sentAt' => gmdate('c'),
            ];

            $this->database->execute(
                'INSERT INTO event_log (id, event_name, payload_json, occurred_at) VALUES (:id, :name, :payload, :occurred_at)',
                [
                    'id' => bin2hex(random_bytes(16)),
                    'name' => 'syndicate.chat.' . $cleanChannel,
                    'payload' => json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                    'occurred_at' => gmdate('c'),
                ],
            );
        });

        return $this->snapshot($playerId);
    }

    public function sendMail(string $playerId, string $recipientQuery, string $subject, string $body): array
    {
        $this->ensureSeeded();
        $cleanRecipient = trim($recipientQuery);
        $cleanSubject = trim(preg_replace('/\s+/u', ' ', $subject) ?? '');
        $cleanBody = trim($body);
        if ($cleanRecipient === '') {
            throw new InvalidArgumentException('Recipient username or player ID is required.');
        }
        if ($cleanSubject === '') {
            $cleanSubject = 'Syndicate Dispatch';
        }
        if ($this->utf8Length($cleanSubject) > 90) {
            $cleanSubject = $this->utf8Slice($cleanSubject, 90);
        }
        if ($cleanBody === '' || $this->utf8Length($cleanBody) > 1200) {
            throw new InvalidArgumentException('Mail body must be between 1 and 1200 characters.');
        }

        $target = $this->resolveTargetPlayer($cleanRecipient);
        if ($target === null) {
            throw new InvalidArgumentException('Operative "' . $cleanRecipient . '" was not found in Zone City.');
        }
        if ((string) $target['id'] === $playerId) {
            throw new InvalidArgumentException('Cannot send a syndicate dispatch to yourself.');
        }

        $mailId = 'mail-' . bin2hex(random_bytes(8));
        $this->database->playerTransaction($playerId, function () use ($playerId, $target, $cleanSubject, $cleanBody, $mailId): void {
            $sender = $this->requirePlayer($playerId);
            $payload = [
                'id' => $mailId,
                'senderId' => $playerId,
                'senderName' => (string) $sender['username'],
                'recipientId' => (string) $target['id'],
                'recipientName' => (string) $target['username'],
                'subject' => $cleanSubject,
                'body' => $cleanBody,
                'sentAt' => gmdate('c'),
            ];
            $this->database->execute(
                'INSERT INTO event_log (id, event_name, payload_json, occurred_at) VALUES (:id, :name, :payload, :occurred_at)',
                [
                    'id' => bin2hex(random_bytes(16)),
                    'name' => 'syndicate.mail',
                    'payload' => json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                    'occurred_at' => gmdate('c'),
                ],
            );
        });

        return [
            'mailId' => $mailId,
            'recipient' => (string) $target['username'],
            'social' => $this->snapshot($playerId),
        ];
    }

    public function markMailRead(string $playerId, string $mailId): array
    {
        $this->ensureSeeded();
        $cleanId = trim($mailId);
        if ($cleanId === '') {
            throw new InvalidArgumentException('Mail identifier is required.');
        }
        $metaKey = $this->mailReadMetaKey($playerId);
        $this->database->playerTransaction($playerId, function () use ($metaKey, $cleanId): void {
            $readIds = $this->loadJsonMeta($metaKey, []);
            if (!in_array($cleanId, $readIds, true)) {
                $readIds[] = $cleanId;
                if (count($readIds) > 200) {
                    $readIds = array_slice($readIds, -200);
                }
                $this->saveJsonMeta($metaKey, array_values($readIds));
            }
        });

        return $this->snapshot($playerId);
    }

    public function placeBounty(string $playerId, string $targetQuery, int $rewardCash, string $reason = ''): array
    {
        $this->ensureSeeded();
        $cleanTarget = trim($targetQuery);
        if ($cleanTarget === '') {
            throw new InvalidArgumentException('Target operative username or ID is required.');
        }
        if ($rewardCash < 5000 || $rewardCash > 25000000) {
            throw new InvalidArgumentException('Bounty reward must be between $5,000 and $25,000,000.');
        }
        $cleanReason = trim(preg_replace('/\s+/u', ' ', $reason) ?? '');
        if ($cleanReason === '') {
            $cleanReason = 'Unpaid syndicate debt';
        }
        if ($this->utf8Length($cleanReason) > 120) {
            $cleanReason = $this->utf8Slice($cleanReason, 120);
        }

        $target = $this->resolveTargetPlayer($cleanTarget);
        if ($target === null) {
            throw new InvalidArgumentException('Target operative "' . $cleanTarget . '" was not found in Zone City.');
        }
        if ((string) $target['id'] === $playerId) {
            throw new InvalidArgumentException('Cannot place a bounty contract on yourself.');
        }

        $createdContract = $this->database->playerTransaction($playerId, function () use ($playerId, $target, $rewardCash, $cleanReason): array {
            $player = $this->requirePlayer($playerId);
            if ((int) $player['cash'] < $rewardCash) {
                throw new RuntimeException('Not enough cash on hand to fund that bounty escrow.');
            }
            $correlationId = bin2hex(random_bytes(16));
            $newCash = (int) $player['cash'] - $rewardCash;
            $this->database->execute(
                'UPDATE players SET cash = :cash WHERE id = :id',
                ['cash' => $newCash, 'id' => $playerId],
            );
            $this->ledger->record($playerId, 'cash', -$rewardCash, $newCash, 'bounty.escrow', $correlationId);

            $targetPower = (int) $target['strength'] + (int) $target['defense'] + (int) $target['speed'] + (int) $target['dexterity'] + ((int) $target['level'] * 35);
            $contract = [
                'id' => 'bty-' . bin2hex(random_bytes(6)),
                'targetId' => (string) $target['id'],
                'targetName' => (string) $target['username'],
                'targetLevel' => (int) $target['level'],
                'targetPower' => max(250, $targetPower),
                'rewardCash' => $rewardCash,
                'reasonEn' => $cleanReason,
                'reasonAr' => $cleanReason,
                'placedById' => $playerId,
                'placedByName' => (string) $player['username'],
                'status' => 'active',
                'attempts' => 0,
                'createdAt' => gmdate('c'),
            ];

            $bounties = $this->loadBounties();
            array_unshift($bounties, $contract);
            if (count($bounties) > 40) {
                $bounties = array_slice($bounties, 0, 40);
            }
            $this->saveJsonMeta(self::BOUNTIES_META_KEY, $bounties);

            $event = new DomainEvent('BountyPlaced', [
                'bountyId' => $contract['id'],
                'playerId' => $playerId,
                'placedBy' => (string) $player['username'],
                'targetId' => $contract['targetId'],
                'targetName' => $contract['targetName'],
                'rewardCash' => $rewardCash,
                'reason' => $cleanReason,
                'correlationId' => $correlationId,
            ]);
            $this->events->publish($event);

            return $contract;
        });

        return [
            'bounty' => $createdContract,
            'player' => $this->resources->normalize($this->requirePlayer($playerId)),
            'social' => $this->snapshot($playerId),
        ];
    }

    public function claimBounty(string $playerId, string $bountyId): array
    {
        $this->ensureSeeded();
        $cleanId = trim($bountyId);
        if ($cleanId === '') {
            throw new InvalidArgumentException('Bounty identifier is required.');
        }

        $settlement = $this->database->playerTransaction($playerId, function () use ($playerId, $cleanId): array {
            $this->resources->regenerate($playerId);
            $player = $this->requirePlayer($playerId);
            $energyCost = 15;
            if ((int) $player['energy'] < $energyCost) {
                throw new RuntimeException('Need 15 Energy to hunt an active bounty target.');
            }
            if ((int) $player['life'] <= 1) {
                throw new RuntimeException('Recover your Life in Hospital before hunting bounties.');
            }

            $bounties = $this->loadBounties();
            $foundIndex = null;
            foreach ($bounties as $idx => $item) {
                if (($item['id'] ?? '') === $cleanId) {
                    $foundIndex = $idx;
                    break;
                }
            }
            if ($foundIndex === null) {
                throw new InvalidArgumentException('Bounty contract not found.');
            }
            $contract = $bounties[$foundIndex];
            if (($contract['status'] ?? '') !== 'active') {
                throw new RuntimeException('That bounty contract has already been claimed.');
            }
            if (($contract['targetId'] ?? '') === $playerId) {
                throw new RuntimeException('Cannot claim a bounty contract on yourself.');
            }
            if (($contract['placedById'] ?? '') === $playerId) {
                throw new RuntimeException('Another operative must execute a bounty contract you funded.');
            }

            $attackerPower = (int) $player['strength'] + (int) $player['defense'] + (int) $player['speed'] + (int) $player['dexterity'] + ((int) $player['level'] * 40);
            $targetPower = max(200, (int) ($contract['targetPower'] ?? 600));
            $winBasisPoints = $attackerPower >= $targetPower * 2
                ? 10000
                : min(9600, max(3800, (int) round(($attackerPower / $targetPower) * 6400)));
            $roll = random_int(1, 10000);
            $won = $roll <= $winBasisPoints;

            $lifeLoss = max(8, (int) round((int) $player['max_life'] * ($won ? 0.05 : 0.12)));
            $newLife = max(1, (int) $player['life'] - $lifeLoss);
            $newEnergy = max(0, (int) $player['energy'] - $energyCost);
            $correlationId = bin2hex(random_bytes(16));

            if ($won) {
                $rewardCash = (int) $contract['rewardCash'];
                $xpGain = 25 + min(50, (int) floor($rewardCash / 5000));
                $newCash = (int) $player['cash'] + $rewardCash;
                $newXp = (int) $player['xp'] + $xpGain;

                $this->database->execute(
                    'UPDATE players SET cash = :cash, energy = :energy, life = :life, xp = :xp WHERE id = :id',
                    [
                        'cash' => $newCash,
                        'energy' => $newEnergy,
                        'life' => $newLife,
                        'xp' => $newXp,
                        'id' => $playerId,
                    ],
                );
                $this->ledger->record($playerId, 'cash', $rewardCash, $newCash, 'bounty.claim', $correlationId);

                $bounties[$foundIndex]['status'] = 'claimed';
                $bounties[$foundIndex]['claimedById'] = $playerId;
                $bounties[$foundIndex]['claimedByName'] = (string) $player['username'];
                $bounties[$foundIndex]['claimedAt'] = gmdate('c');
                $bounties[$foundIndex]['attempts'] = (int) ($contract['attempts'] ?? 0) + 1;

                $bounties = $this->replenishContractsIfLow($bounties);
                $this->saveJsonMeta(self::BOUNTIES_META_KEY, $bounties);

                $event = new DomainEvent('BountyClaimed', [
                    'bountyId' => $cleanId,
                    'playerId' => $playerId,
                    'hunterName' => (string) $player['username'],
                    'targetId' => (string) $contract['targetId'],
                    'targetName' => (string) $contract['targetName'],
                    'rewardCash' => $rewardCash,
                    'xpGain' => $xpGain,
                    'correlationId' => $correlationId,
                ]);
                $this->events->publish($event);

                return [
                    'outcome' => 'claimed',
                    'won' => true,
                    'rewardCash' => $rewardCash,
                    'xpGain' => $xpGain,
                    'lifeLost' => (int) $player['life'] - $newLife,
                    'energySpent' => $energyCost,
                    'winChancePct' => (int) round($winBasisPoints / 100),
                    'bounty' => $bounties[$foundIndex],
                    'correlationId' => $correlationId,
                ];
            }

            $this->database->execute(
                'UPDATE players SET energy = :energy, life = :life WHERE id = :id',
                [
                    'energy' => $newEnergy,
                    'life' => $newLife,
                    'id' => $playerId,
                ],
            );
            $bounties[$foundIndex]['attempts'] = (int) ($contract['attempts'] ?? 0) + 1;
            $this->saveJsonMeta(self::BOUNTIES_META_KEY, $bounties);

            $event = new DomainEvent('BountyAttempted', [
                'bountyId' => $cleanId,
                'playerId' => $playerId,
                'hunterName' => (string) $player['username'],
                'targetName' => (string) $contract['targetName'],
                'correlationId' => $correlationId,
            ]);
            $this->events->publish($event);

            return [
                'outcome' => 'repelled',
                'won' => false,
                'rewardCash' => 0,
                'xpGain' => 0,
                'lifeLost' => (int) $player['life'] - $newLife,
                'energySpent' => $energyCost,
                'winChancePct' => (int) round($winBasisPoints / 100),
                'bounty' => $bounties[$foundIndex],
                'correlationId' => $correlationId,
            ];
        });

        return [
            ...$settlement,
            'player' => $this->resources->normalize($this->requirePlayer($playerId)),
            'social' => $this->snapshot($playerId),
        ];
    }

    private function ensureSeeded(): void
    {
        $row = $this->database->fetchOne(
            'SELECT value FROM engine_metadata WHERE name = :name',
            ['name' => self::SEED_META_KEY],
        );
        if (($row['value'] ?? null) === '1') {
            return;
        }

        $this->database->transaction(function (): void {
            $check = $this->database->fetchOne(
                'SELECT value FROM engine_metadata WHERE name = :name',
                ['name' => self::SEED_META_KEY],
            );
            if (($check['value'] ?? null) === '1') {
                return;
            }

            $now = gmdate('c');
            $today = gmdate('Y-m-d');
            foreach ([
                ['npc-north-enforcer', 'Tariq', 7, 1820, 34000, 100, 40, 1050, 350, 100, 40, 1050, 350, $now, 140, 130, 145, 135, 68000, 'Zone City', 2, $today],
                ['npc-viper-lieutenant', 'Omar_Z', 9, 2850, 48000, 110, 45, 1250, 350, 110, 45, 1250, 500, $now, 210, 195, 215, 205, 115000, 'Zone City', 3, $today],
                ['npc-harbor-king', 'Rayan_Black', 13, 5240, 78000, 120, 45, 1650, 450, 120, 45, 1650, 500, $now, 340, 310, 320, 300, 290000, 'Zone City', 4, $today],
                ['npc-crown-capo', 'K1ng', 20, 11300, 164000, 130, 45, 2350, 1000, 130, 45, 2350, 1000, $now, 620, 590, 610, 580, 840000, 'Zone City', 7, $today],
                ['npc-syndicate-apex', 'Duke_X', 34, 28400, 420000, 150, 55, 3600, 2500, 150, 55, 3600, 2500, $now, 1450, 1380, 1410, 1320, 2850000, 'Zone City', 14, $today],
            ] as $npc) {
                $this->database->insertIgnore(
                    'players',
                    ['id', 'username', 'level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'resources_updated_at', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance', 'city', 'login_streak', 'last_login_day'],
                    $npc,
                );
            }

            $seedChats = [
                ['global', 'npc-syndicate-apex', 'Duke_X', 34, 'oldguard', 'Harbor checkpoints tightened tonight. Move contraband before 02:00 UTC.'],
                ['global', 'npc-harbor-king', 'Rayan_Black', 13, 'kings', 'Two fresh contracts just went up on the City Hitlist. Cash escrow is live.'],
                ['faction', 'npc-viper-lieutenant', 'Omar_Z', 9, 'vipers', 'Sector ZC-045 walls reinforced. Hold energy for synchronized family push.'],
                ['trade', 'npc-crown-capo', 'K1ng', 20, 'vipers', 'Buying First Aid Kits and Kevlar Vests on the Player Market - instant cash settlement.'],
            ];
            foreach ($seedChats as $idx => [$chan, $sid, $sname, $slvl, $fid, $txt]) {
                $ts = gmdate('c', time() - (300 - $idx * 60));
                $this->database->execute(
                    'INSERT INTO event_log (id, event_name, payload_json, occurred_at) VALUES (:id, :name, :payload, :occurred_at)',
                    [
                        'id' => bin2hex(random_bytes(16)),
                        'name' => 'syndicate.chat.' . $chan,
                        'payload' => json_encode([
                            'channel' => $chan,
                            'senderId' => $sid,
                            'sender' => $sname,
                            'senderLevel' => $slvl,
                            'factionId' => $fid,
                            'recipientId' => null,
                            'recipientName' => null,
                            'text' => $txt,
                            'sentAt' => $ts,
                        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                        'occurred_at' => $ts,
                    ],
                );
            }

            $this->database->execute(
                'INSERT INTO event_log (id, event_name, payload_json, occurred_at) VALUES (:id, :name, :payload, :occurred_at)',
                [
                    'id' => bin2hex(random_bytes(16)),
                    'name' => 'syndicate.mail',
                    'payload' => json_encode([
                        'id' => 'mail-syndicate-welcome',
                        'senderId' => 'npc-syndicate-apex',
                        'senderName' => 'Duke_X',
                        'recipientId' => '*',
                        'recipientName' => 'All Operatives',
                        'subject' => 'Zone City Encrypted Wire Active',
                        'body' => 'Welcome to the live Zone City wire. Contracts on the Hitlist pay immediate escrowed cash on takedown, and every casino table settles on the central ledger.',
                        'sentAt' => $now,
                    ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                    'occurred_at' => $now,
                ],
            );

            $initialBounties = $this->defaultContracts();
            $this->saveJsonMeta(self::BOUNTIES_META_KEY, $initialBounties);
            $this->saveRawMeta(self::SEED_META_KEY, '1');
        });
    }

    /** @return list<array<string, mixed>> */
    private function defaultContracts(): array
    {
        $now = gmdate('c');
        return [
            [
                'id' => 'bty-seed-tariq',
                'targetId' => 'npc-north-enforcer',
                'targetName' => 'Tariq',
                'targetLevel' => 7,
                'targetPower' => 420,
                'rewardCash' => 18500,
                'reasonEn' => 'Skimmed North District protection tribute',
                'reasonAr' => 'اختلاس إتاوة الحماية في القطاع الشمالي',
                'placedById' => 'npc-syndicate-apex',
                'placedByName' => 'Duke_X',
                'status' => 'active',
                'attempts' => 1,
                'createdAt' => $now,
            ],
            [
                'id' => 'bty-seed-omar',
                'targetId' => 'npc-viper-lieutenant',
                'targetName' => 'Omar_Z',
                'targetLevel' => 9,
                'targetPower' => 580,
                'rewardCash' => 28000,
                'reasonEn' => 'Hijacked armored courier van near Dock 4',
                'reasonAr' => 'اعتراض شاحنة نقل مصفحة قرب الرصيف الرابع',
                'placedById' => 'npc-harbor-king',
                'placedByName' => 'Rayan_Black',
                'status' => 'active',
                'attempts' => 2,
                'createdAt' => $now,
            ],
            [
                'id' => 'bty-seed-rayan',
                'targetId' => 'npc-harbor-king',
                'targetName' => 'Rayan_Black',
                'targetLevel' => 13,
                'targetPower' => 1050,
                'rewardCash' => 52000,
                'reasonEn' => 'Burned Old Guard contraband warehouse',
                'reasonAr' => 'إحراق مستودع بضائع الحرس القديم',
                'placedById' => 'npc-crown-capo',
                'placedByName' => 'K1ng',
                'status' => 'active',
                'attempts' => 3,
                'createdAt' => $now,
            ],
            [
                'id' => 'bty-seed-k1ng',
                'targetId' => 'npc-crown-capo',
                'targetName' => 'K1ng',
                'targetLevel' => 20,
                'targetPower' => 2100,
                'rewardCash' => 95000,
                'reasonEn' => 'Broke Red-Light casino truce at midnight',
                'reasonAr' => 'خرق هدنة كازينو المنطقة الحمراء منتصف الليل',
                'placedById' => 'npc-syndicate-apex',
                'placedByName' => 'Duke_X',
                'status' => 'active',
                'attempts' => 4,
                'createdAt' => $now,
            ],
            [
                'id' => 'bty-seed-duke',
                'targetId' => 'npc-syndicate-apex',
                'targetName' => 'Duke_X',
                'targetLevel' => 34,
                'targetPower' => 3900,
                'rewardCash' => 210000,
                'reasonEn' => 'High-value Syndicate Apex contract',
                'reasonAr' => 'عقد تصفية عالي القيمة لزعيم النقابة',
                'placedById' => 'npc-crown-capo',
                'placedByName' => 'K1ng',
                'status' => 'active',
                'attempts' => 6,
                'createdAt' => $now,
            ],
        ];
    }

    /**
     * @param list<array<string, mixed>> $bounties
     * @return list<array<string, mixed>>
     */
    private function replenishContractsIfLow(array $bounties): array
    {
        $activeCount = 0;
        foreach ($bounties as $item) {
            if (($item['status'] ?? '') === 'active') {
                $activeCount++;
            }
        }
        if ($activeCount >= 4) {
            return $bounties;
        }
        $templates = $this->defaultContracts();
        $pick = $templates[random_int(0, count($templates) - 1)];
        $pick['id'] = 'bty-' . bin2hex(random_bytes(6));
        $pick['attempts'] = 0;
        $pick['createdAt'] = gmdate('c');
        array_unshift($bounties, $pick);
        return array_slice($bounties, 0, 40);
    }

    /** @return array<string, list<array<string, mixed>>> */
    private function loadChatChannels(string $playerId, ?string $factionId): array
    {
        $result = [];
        foreach (self::CHANNELS as $chan) {
            $rows = $this->database->fetchAll(
                'SELECT id, payload_json, occurred_at FROM event_log WHERE event_name = :name ORDER BY occurred_at DESC LIMIT 30',
                ['name' => 'syndicate.chat.' . $chan],
            );
            $items = [];
            foreach (array_reverse($rows) as $row) {
                $payload = json_decode((string) $row['payload_json'], true);
                if (!is_array($payload)) {
                    continue;
                }
                if ($chan === 'private') {
                    $senderId = (string) ($payload['senderId'] ?? '');
                    $recipientId = (string) ($payload['recipientId'] ?? '');
                    if ($recipientId !== '' && $senderId !== $playerId && $recipientId !== $playerId) {
                        continue;
                    }
                }
                $occurred = (string) ($payload['sentAt'] ?? $row['occurred_at']);
                $ts = strtotime($occurred);
                $items[] = [
                    'id' => (string) $row['id'],
                    'channel' => $chan,
                    'senderId' => (string) ($payload['senderId'] ?? ''),
                    'sender' => (string) ($payload['sender'] ?? 'Operative'),
                    'senderLevel' => (int) ($payload['senderLevel'] ?? 1),
                    'factionId' => $payload['factionId'] ?? $factionId,
                    'text' => (string) ($payload['text'] ?? ''),
                    'time' => $ts !== false ? gmdate('H:i', $ts) : gmdate('H:i'),
                    'sentAt' => $occurred,
                ];
            }
            $result[$chan] = array_slice($items, -25);
        }
        return $result;
    }

    /** @return array<string, mixed> */
    private function loadMail(string $playerId, string $username): array
    {
        $readIds = $this->loadJsonMeta($this->mailReadMetaKey($playerId), []);
        $rows = $this->database->fetchAll(
            "SELECT id, payload_json, occurred_at FROM event_log WHERE event_name = 'syndicate.mail' ORDER BY occurred_at DESC LIMIT 80",
        );
        $inbox = [];
        $sent = [];
        $unreadCount = 0;

        foreach ($rows as $row) {
            $payload = json_decode((string) $row['payload_json'], true);
            if (!is_array($payload)) {
                continue;
            }
            $mailId = (string) ($payload['id'] ?? $row['id']);
            $senderId = (string) ($payload['senderId'] ?? '');
            $recipientId = (string) ($payload['recipientId'] ?? '');
            $recipientName = (string) ($payload['recipientName'] ?? '');
            $sentAt = (string) ($payload['sentAt'] ?? $row['occurred_at']);
            $ts = strtotime($sentAt);
            $formatted = [
                'id' => $mailId,
                'senderId' => $senderId,
                'senderName' => (string) ($payload['senderName'] ?? 'Syndicate'),
                'recipientId' => $recipientId,
                'recipientName' => $recipientName,
                'subject' => (string) ($payload['subject'] ?? 'Syndicate Dispatch'),
                'body' => (string) ($payload['body'] ?? ''),
                'sentAt' => $sentAt,
                'timeLabel' => $ts !== false ? gmdate('M d · H:i', $ts) : $sentAt,
                'read' => in_array($mailId, $readIds, true),
            ];

            $isBroadcast = $recipientId === '*';
            $isToMe = $recipientId === $playerId || ($recipientName !== '' && strcasecmp($recipientName, $username) === 0);
            if ($isBroadcast || $isToMe) {
                if (!$formatted['read']) {
                    $unreadCount++;
                }
                $inbox[] = $formatted;
            }
            if ($senderId === $playerId) {
                $sent[] = $formatted;
            }
        }

        return [
            'unreadCount' => $unreadCount,
            'inbox' => array_slice($inbox, 0, 25),
            'sent' => array_slice($sent, 0, 15),
        ];
    }

    /**
     * @param list<array<string, mixed>> $bounties
     * @return array<string, mixed>
     */
    private function formatBounties(array $bounties, string $playerId): array
    {
        $active = [];
        $claimed = [];
        foreach ($bounties as $item) {
            $entry = [
                'id' => (string) ($item['id'] ?? ''),
                'targetId' => (string) ($item['targetId'] ?? ''),
                'targetName' => (string) ($item['targetName'] ?? 'Unknown'),
                'targetLevel' => (int) ($item['targetLevel'] ?? 1),
                'targetPower' => (int) ($item['targetPower'] ?? 500),
                'rewardCash' => (int) ($item['rewardCash'] ?? 10000),
                'reasonEn' => (string) ($item['reasonEn'] ?? 'Syndicate contract'),
                'reasonAr' => (string) ($item['reasonAr'] ?? ($item['reasonEn'] ?? 'عقد ملاحقة في المدينة')),
                'placedById' => (string) ($item['placedById'] ?? ''),
                'placedByName' => (string) ($item['placedByName'] ?? 'Syndicate'),
                'status' => (string) ($item['status'] ?? 'active'),
                'attempts' => (int) ($item['attempts'] ?? 0),
                'claimedByName' => (string) ($item['claimedByName'] ?? ''),
                'claimedAt' => (string) ($item['claimedAt'] ?? ''),
                'createdAt' => (string) ($item['createdAt'] ?? ''),
                'canClaim' => ($item['status'] ?? '') === 'active'
                    && ($item['targetId'] ?? '') !== $playerId
                    && ($item['placedById'] ?? '') !== $playerId,
            ];
            if ($entry['status'] === 'active') {
                $active[] = $entry;
            } else {
                $claimed[] = $entry;
            }
        }

        return [
            'activeCount' => count($active),
            'totalEscrowCash' => array_sum(array_column($active, 'rewardCash')),
            'active' => array_slice($active, 0, 15),
            'recentClaimed' => array_slice($claimed, 0, 8),
        ];
    }

    /** @return list<array<string, mixed>> */
    private function loadChronicle(): array
    {
        $rows = $this->database->fetchAll(
            "SELECT id, event_name, payload_json, occurred_at FROM event_log
             WHERE event_name IN ('BountyPlaced', 'BountyClaimed', 'CrimeSucceeded', 'PlayerAttacked', 'BlackjackPlayed', 'HighLowPlayed', 'RouletteSpun', 'SlotsSpun', 'PlayerTraveled', 'TerritoryControlChanged', 'PlayerCombatResolved')
             ORDER BY occurred_at DESC LIMIT 18",
        );

        $playerNames = [];
        foreach ($this->database->fetchAll('SELECT id, username FROM players LIMIT 200') as $prow) {
            $playerNames[(string) $prow['id']] = (string) $prow['username'];
        }

        $feed = [];
        foreach ($rows as $row) {
            $payload = json_decode((string) $row['payload_json'], true);
            if (!is_array($payload)) {
                continue;
            }
            $pid = (string) ($payload['playerId'] ?? $payload['attackerId'] ?? '');
            $actor = $playerNames[$pid] ?? (string) ($payload['hunterName'] ?? $payload['placedBy'] ?? 'An operative');
            $name = (string) $row['event_name'];
            $occurred = (string) $row['occurred_at'];
            $ts = strtotime($occurred);
            $timeLabel = $ts !== false ? gmdate('H:i', $ts) : 'Live';

            [$cat, $en, $ar] = match ($name) {
                'BountyPlaced' => [
                    'BOUNTY',
                    sprintf('%s posted a $%s contract on %s.', $actor, number_format((int) ($payload['rewardCash'] ?? 0)), (string) ($payload['targetName'] ?? 'a rival')),
                    sprintf('رصد %s مكافأة بقيمة $%s لملاحقة %s.', $actor, number_format((int) ($payload['rewardCash'] ?? 0)), (string) ($payload['targetName'] ?? 'خصم')),
                ],
                'BountyClaimed' => [
                    'HITLIST',
                    sprintf('%s took down %s and collected $%s!', $actor, (string) ($payload['targetName'] ?? 'target'), number_format((int) ($payload['rewardCash'] ?? 0))),
                    sprintf('أسقط %s الهدف %s وحصد مكافأة $%s!', $actor, (string) ($payload['targetName'] ?? 'الهدف'), number_format((int) ($payload['rewardCash'] ?? 0))),
                ],
                'CrimeSucceeded' => [
                    'CRIME',
                    sprintf('%s pulled off an operation in Zone City (+$%s).', $actor, number_format((int) ($payload['cashReward'] ?? $payload['reward'] ?? 0))),
                    sprintf('نفّذ %s عملية ناجحة في شوارع زون (+$%s).', $actor, number_format((int) ($payload['cashReward'] ?? $payload['reward'] ?? 0))),
                ],
                'PlayerAttacked', 'PlayerCombatResolved' => [
                    'COMBAT',
                    sprintf('%s engaged in an armed street clash in Zone City.', $actor),
                    sprintf('خاض %s اشتباكاً مسلحاً في شوارع زون.', $actor),
                ],
                'RouletteSpun' => [
                    'CASINO',
                    sprintf('%s spun #%d (%s) at the Noir Roulette table.', $actor, (int) ($payload['pocket'] ?? 0), strtoupper((string) ($payload['color'] ?? 'green'))),
                    sprintf('أدار %s عجلة الروليت واستقرت على #%d.', $actor, (int) ($payload['pocket'] ?? 0)),
                ],
                'SlotsSpun' => [
                    'CASINO',
                    ((int) ($payload['payout'] ?? 0)) > 0
                        ? sprintf('%s hit $%s on the Syndicate Jackpot Slots!', $actor, number_format((int) ($payload['payout'] ?? 0)))
                        : sprintf('%s fed the Syndicate Progressive Slots pot.', $actor),
                    ((int) ($payload['payout'] ?? 0)) > 0
                        ? sprintf('ربح %s مبلغ $%s على ماكينة جاكبوت النقابة!', $actor, number_format((int) ($payload['payout'] ?? 0)))
                        : sprintf('ساهم %s في رفع جائزة الجاكبوت التراكمية.', $actor),
                ],
                'BlackjackPlayed' => [
                    'CASINO',
                    sprintf('%s settled a Blackjack 21 hand (%s).', $actor, strtoupper((string) ($payload['result'] ?? 'hand'))),
                    sprintf('حسم %s جولة بلاك جاك 21 (%s).', $actor, (string) ($payload['result'] ?? 'جولة')),
                ],
                'HighLowPlayed' => [
                    'CASINO',
                    sprintf('%s played High-Low cards at the Velvet Pit.', $actor),
                    sprintf('لعب %s جولة أعلى أو أقل في صالة القمار.', $actor),
                ],
                'PlayerTraveled' => [
                    'TRAVEL',
                    sprintf('%s departed on a flight to %s.', $actor, (string) ($payload['city'] ?? 'abroad')),
                    sprintf('غادر %s في رحلة جوية إلى %s.', $actor, (string) ($payload['city'] ?? 'الخارج')),
                ],
                default => [
                    'CITY',
                    sprintf('Syndicate wire logged %s activity in Zone City.', $name),
                    'سجلت شبكة النقابة تحركاً جديداً في مدينة زون.',
                ],
            };

            $feed[] = [
                'id' => (string) $row['id'],
                'category' => $cat,
                'headlineEn' => $en,
                'headlineAr' => $ar,
                'time' => $timeLabel,
                'occurredAt' => $occurred,
            ];
        }

        if ($feed === []) {
            $feed[] = [
                'id' => 'chronicle-boot',
                'category' => 'CITY',
                'headlineEn' => 'Zone City Harbor syndicates opened high-stakes casino tables and live bounty escrow.',
                'headlineAr' => 'عصابات الميناء تفتتح طاولات الرهان الكبرى ولوحة المكافآت الحية في مدينة زون.',
                'time' => gmdate('H:i'),
                'occurredAt' => gmdate('c'),
            ];
        }

        return $feed;
    }

    private function requirePlayer(string $playerId): array
    {
        $row = $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $playerId]);
        if ($row === null) {
            throw new RuntimeException('Unknown player: ' . $playerId);
        }
        return $row;
    }

    private function playerFaction(string $playerId): ?string
    {
        $row = $this->database->fetchOne(
            'SELECT faction_id FROM faction_members WHERE player_id = :id',
            ['id' => $playerId],
        );
        return isset($row['faction_id']) ? (string) $row['faction_id'] : null;
    }

    private function resolveTargetPlayer(string $query): ?array
    {
        $byId = $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $query]);
        if ($byId !== null) {
            return $byId;
        }
        return $this->database->fetchOne(
            'SELECT * FROM players WHERE LOWER(username) = LOWER(:username) LIMIT 1',
            ['username' => $query],
        );
    }

    private function mailReadMetaKey(string $playerId): string
    {
        return 'mail-read:' . substr(hash('sha256', $playerId), 0, 48);
    }

    /** @return list<array<string, mixed>> */
    private function loadBounties(): array
    {
        $decoded = $this->loadJsonMeta(self::BOUNTIES_META_KEY, []);
        return array_values(array_filter($decoded, 'is_array'));
    }

    private function loadJsonMeta(string $name, array $default): array
    {
        $row = $this->database->fetchOne('SELECT value FROM engine_metadata WHERE name = :name', ['name' => $name]);
        if ($row === null || !isset($row['value'])) {
            return $default;
        }
        $decoded = json_decode((string) $row['value'], true);
        return is_array($decoded) ? $decoded : $default;
    }

    private function saveJsonMeta(string $name, array $data): void
    {
        $this->saveRawMeta($name, json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }

    private function saveRawMeta(string $name, string $value): void
    {
        $this->database->execute(
            'INSERT INTO engine_metadata (name, value) VALUES (:name, :value) ON CONFLICT (name) DO UPDATE SET value = :updated',
            ['name' => $name, 'value' => $value, 'updated' => $value],
        );
    }

    private function utf8Length(string $text): int
    {
        if (function_exists('mb_strlen')) {
            return mb_strlen($text, 'UTF-8');
        }
        $count = preg_match_all('/./us', $text);
        return $count === false ? strlen($text) : $count;
    }

    private function utf8Slice(string $text, int $maxChars): string
    {
        if (function_exists('mb_substr')) {
            return mb_substr($text, 0, $maxChars, 'UTF-8');
        }
        $chars = preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY);
        if (!is_array($chars)) {
            return substr($text, 0, $maxChars);
        }
        return implode('', array_slice($chars, 0, $maxChars));
    }
}

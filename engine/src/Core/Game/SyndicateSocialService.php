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
            $this->recordNotification((string) $target['id'], 'mail', [
                'mailId' => $mailId,
                'senderId' => $playerId,
                'senderName' => (string) $sender['username'],
                'subject' => $cleanSubject,
                'message_en' => sprintf('New mail from %s: "%s".', (string) $sender['username'], $cleanSubject),
                'message_ar' => sprintf('رسالة جديدة من %s: "%s".', (string) $sender['username'], $cleanSubject),
            ]);
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
            if (getenv('ZONE_EPHEMERAL_VERCEL_SQLITE') === '1') {
                (new ProgressionService($this->database, $this->events))->snapshot($playerId);
            }
            $this->lockMetaKey(self::BOUNTIES_META_KEY);
            $bounties = $this->loadBounties();
            $activeCount = 0;
            foreach ($bounties as $existing) {
                if (($existing['status'] ?? '') === 'active') {
                    $activeCount++;
                }
            }
            if ($activeCount >= 60) {
                throw new RuntimeException('City Hitlist escrow board is at capacity (60 active contracts). Claim an active contract first.');
            }

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

            array_unshift($bounties, $contract);
            $bounties = $this->pruneClaimedBounties($bounties);
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

            $this->recordNotification($contract['targetId'], 'bounty_placed', [
                'bountyId' => $contract['id'],
                'placedById' => $playerId,
                'placedByName' => (string) $player['username'],
                'rewardCash' => $rewardCash,
                'reason' => $cleanReason,
                'correlationId' => $correlationId,
                'message_en' => sprintf('%s placed a $%s bounty on your head ("%s").', (string) $player['username'], number_format($rewardCash), $cleanReason),
                'message_ar' => sprintf('رصد %s مكافأة بقيمة $%s لملاحقتك ("%s").', (string) $player['username'], number_format($rewardCash), $cleanReason),
            ]);

            return $contract;
        });

        self::refreshEphemeralLedgerCookie($this->database, $this->events, $playerId);

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
            if (getenv('ZONE_EPHEMERAL_VERCEL_SQLITE') === '1') {
                (new ProgressionService($this->database, $this->events))->snapshot($playerId);
            }
            $this->resources->regenerate($playerId);
            $player = $this->requirePlayer($playerId);
            $energyCost = 15;
            if ((int) $player['energy'] < $energyCost) {
                throw new RuntimeException('Need 15 Energy to hunt an active bounty target.');
            }
            if ((int) $player['life'] <= 1) {
                throw new RuntimeException('Recover your Life in Hospital before hunting bounties.');
            }

            $this->lockMetaKey(self::BOUNTIES_META_KEY);
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

        self::refreshEphemeralLedgerCookie($this->database, $this->events, $playerId);

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

            $existingBounties = $this->loadBounties();
            $initialBounties = $this->pruneClaimedBounties([...$existingBounties, ...$this->defaultContracts()]);
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
        return $this->pruneClaimedBounties($bounties);
    }

    /**
     * Never evict active escrowed bounties; prune only settled/historical contracts.
     *
     * @param list<array<string, mixed>> $bounties
     * @return list<array<string, mixed>>
     */
    private function pruneClaimedBounties(array $bounties): array
    {
        $kept = [];
        $settledKept = 0;
        foreach ($bounties as $item) {
            if (($item['status'] ?? '') === 'active') {
                $kept[] = $item;
                continue;
            }
            if ($settledKept < 15) {
                $kept[] = $item;
                $settledKept++;
            }
        }
        return $kept;
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

    private function lockMetaKey(string $name, string $defaultRaw = '[]'): void
    {
        $this->database->insertIgnore('engine_metadata', ['name', 'value'], [$name, $defaultRaw]);
        if ($this->database->driver() === 'sqlite') {
            $this->database->execute('UPDATE engine_metadata SET value = value WHERE name = :name', ['name' => $name]);
        } else {
            $this->database->fetchOne('SELECT value FROM engine_metadata WHERE name = :name FOR UPDATE', ['name' => $name]);
        }
    }

    private function utf8Length(string $text): int
    {
        if (function_exists('mb_strlen')) {
            return mb_strlen($text, 'UTF-8');
        }
        $count = preg_match_all('/./us', $text);
        return $count === false ? strlen($text) : $count;
    }

    /**
     * Settles all active escrowed bounties on $defenderId when $hunterId wins a PvP hospitalize finish.
     * Caller (PlayerCombatService) already holds canonical paired player locks on [$hunterId, $defenderId].
     *
     * @return array{bountiesClaimed: list<array<string, mixed>>, bountyCashAwarded: int}
     */
    public function settleBountiesOnHospitalize(string $hunterId, string $defenderId, string $correlationId): array
    {
        if ($hunterId === '' || $defenderId === '' || $hunterId === $defenderId) {
            return ['bountiesClaimed' => [], 'bountyCashAwarded' => 0];
        }
        if (str_starts_with($defenderId, 'npc-')) {
            $this->ensureSeeded();
        }
        return $this->database->transaction(function () use ($hunterId, $defenderId, $correlationId): array {
            $this->lockMetaKey(self::BOUNTIES_META_KEY);
            $bounties = $this->loadBounties();
            if ($bounties === []) {
                return ['bountiesClaimed' => [], 'bountyCashAwarded' => 0];
            }

            $matchedIndices = [];
            foreach ($bounties as $idx => $contract) {
                if (($contract['status'] ?? '') === 'active'
                    && (string) ($contract['targetId'] ?? '') === $defenderId
                    && (string) ($contract['placedById'] ?? '') !== $hunterId) {
                    $matchedIndices[] = $idx;
                }
            }
            if ($matchedIndices === []) {
                return ['bountiesClaimed' => [], 'bountyCashAwarded' => 0];
            }

            $hunter = $this->requirePlayer($hunterId);
            $defender = $this->requirePlayer($defenderId);
            $runningCash = (int) $hunter['cash'];
            $totalAwarded = 0;
            $claimedContracts = [];
            $nowIso = gmdate('c');

            foreach ($matchedIndices as $idx) {
                $rewardCash = max(0, (int) ($bounties[$idx]['rewardCash'] ?? 0));
                if ($rewardCash <= 0) {
                    continue;
                }
                $totalAwarded += $rewardCash;
                $runningCash += $rewardCash;

                $bounties[$idx]['status'] = 'claimed';
                $bounties[$idx]['claimedById'] = $hunterId;
                $bounties[$idx]['claimedByName'] = (string) $hunter['username'];
                $bounties[$idx]['claimedAt'] = $nowIso;
                $bounties[$idx]['attempts'] = (int) ($bounties[$idx]['attempts'] ?? 0) + 1;
                $claimedContracts[] = $bounties[$idx];
            }

            if ($totalAwarded <= 0 || $claimedContracts === []) {
                return ['bountiesClaimed' => [], 'bountyCashAwarded' => 0];
            }

            $this->database->execute(
                'UPDATE players SET cash = :cash WHERE id = :id',
                ['cash' => $runningCash, 'id' => $hunterId],
            );

            $balanceCursor = (int) $hunter['cash'];
            foreach ($claimedContracts as $claimed) {
                $rewardCash = (int) $claimed['rewardCash'];
                $balanceCursor += $rewardCash;
                $this->ledger->record($hunterId, 'cash', $rewardCash, $balanceCursor, 'bounty.claim', $correlationId);

                $this->events->publish(new DomainEvent('BountyClaimed', [
                    'bountyId' => (string) $claimed['id'],
                    'playerId' => $hunterId,
                    'hunterName' => (string) $hunter['username'],
                    'targetId' => $defenderId,
                    'targetName' => (string) $defender['username'],
                    'rewardCash' => $rewardCash,
                    'xpGain' => 0,
                    'viaHospitalize' => true,
                    'correlationId' => $correlationId,
                ]));

                $placedById = (string) ($claimed['placedById'] ?? '');
                if ($placedById !== '' && $placedById !== $hunterId && $placedById !== $defenderId) {
                    $funderExists = $this->database->fetchOne('SELECT id FROM players WHERE id = :id', ['id' => $placedById]);
                    if ($funderExists !== null) {
                        $this->recordNotification($placedById, 'bounty_claimed', [
                            'bountyId' => (string) $claimed['id'],
                            'hunterName' => (string) $hunter['username'],
                            'targetName' => (string) $defender['username'],
                            'rewardCash' => $rewardCash,
                            'correlationId' => $correlationId,
                            'message_en' => sprintf('%s hospitalized %s and fulfilled your $%s bounty!', (string) $hunter['username'], (string) $defender['username'], number_format($rewardCash)),
                            'message_ar' => sprintf('أسقط %s الهدف %s وأنجز عقد المكافأة البالغ $%s!', (string) $hunter['username'], (string) $defender['username'], number_format($rewardCash)),
                        ]);
                    }
                }
            }

            $this->recordNotification($defenderId, 'bounty_claimed', [
                'hunterName' => (string) $hunter['username'],
                'rewardCash' => $totalAwarded,
                'count' => count($claimedContracts),
                'correlationId' => $correlationId,
                'message_en' => sprintf('%s hospitalized you and claimed $%s in active bounties on your head.', (string) $hunter['username'], number_format($totalAwarded)),
                'message_ar' => sprintf('أدخلك %s المستشفى وحصد مكافآت ملاحقتك بقيمة $%s.', (string) $hunter['username'], number_format($totalAwarded)),
            ]);

            $this->recordNotification($hunterId, 'bounty_claimed', [
                'targetName' => (string) $defender['username'],
                'rewardCash' => $totalAwarded,
                'count' => count($claimedContracts),
                'correlationId' => $correlationId,
                'message_en' => sprintf('Collected $%s from %d escrowed bounty contract(s) for hospitalizing %s!', number_format($totalAwarded), count($claimedContracts), (string) $defender['username']),
                'message_ar' => sprintf('حصدت $%s من %d عقد ملاحقة بعد إدخال %s المستشفى!', number_format($totalAwarded), count($claimedContracts), (string) $defender['username']),
            ]);

            $bounties = $this->replenishContractsIfLow($bounties);
            $this->saveJsonMeta(self::BOUNTIES_META_KEY, $bounties);

            return [
                'bountiesClaimed' => $claimedContracts,
                'bountyCashAwarded' => $totalAwarded,
            ];
        });
    }

    public function sendCash(string $senderId, string $recipientQuery, int $amount, string $note = ''): array
    {
        $this->ensureSeeded();
        $cleanRecipient = trim($recipientQuery);
        if ($cleanRecipient === '') {
            throw new InvalidArgumentException('Recipient username or player ID is required.');
        }
        if ($amount < 100 || $amount > 500000000) {
            throw new InvalidArgumentException('Cash transfer must be between $100 and $500,000,000.');
        }
        $target = $this->resolveTargetPlayer($cleanRecipient);
        if ($target === null) {
            throw new InvalidArgumentException('Operative "' . $cleanRecipient . '" was not found in Zone City.');
        }
        $recipientId = (string) $target['id'];
        if ($recipientId === $senderId) {
            throw new InvalidArgumentException('Cannot wire cash to yourself.');
        }
        $cleanNote = $this->utf8Slice(trim(preg_replace('/\s+/u', ' ', $note) ?? ''), 120);

        $receipt = $this->database->playersTransaction([$senderId, $recipientId], function () use ($senderId, $recipientId, $amount, $cleanNote): array {
            (new TravelService($this->database, $this->events))->assertAvailable($senderId);
            (new ProgressionService($this->database, $this->events))->assertAvailable($senderId, 'wire');
            $sender = $this->requirePlayer($senderId);
            $recipient = $this->requirePlayer($recipientId);
            if ((int) $sender['cash'] < $amount) {
                throw new RuntimeException('Not enough cash on hand for that transfer.');
            }
            $correlationId = bin2hex(random_bytes(16));
            $senderCash = (int) $sender['cash'] - $amount;
            $recipientCash = (int) $recipient['cash'] + $amount;

            $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['cash' => $senderCash, 'id' => $senderId]);
            $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['cash' => $recipientCash, 'id' => $recipientId]);

            $this->ledger->record($senderId, 'cash', -$amount, $senderCash, 'social.wire.debit', $correlationId);
            $this->ledger->record($recipientId, 'cash', $amount, $recipientCash, 'social.wire.credit', $correlationId);

            $this->events->publish(new DomainEvent('CashTransferred', [
                'playerId' => $senderId,
                'senderName' => (string) $sender['username'],
                'recipientId' => $recipientId,
                'recipientName' => (string) $recipient['username'],
                'amount' => $amount,
                'note' => $cleanNote,
                'correlationId' => $correlationId,
            ]));

            $this->recordNotification($recipientId, 'cash_received', [
                'senderId' => $senderId,
                'senderName' => (string) $sender['username'],
                'amount' => $amount,
                'note' => $cleanNote,
                'correlationId' => $correlationId,
                'message_en' => sprintf('%s sent you $%s%s.', (string) $sender['username'], number_format($amount), $cleanNote !== '' ? ' ("' . $cleanNote . '")' : ''),
                'message_ar' => sprintf('أرسل إليك %s مبلغ $%s%s.', (string) $sender['username'], number_format($amount), $cleanNote !== '' ? ' ("' . $cleanNote . '")' : ''),
            ]);

            return [
                'recipientId' => $recipientId,
                'recipientName' => (string) $recipient['username'],
                'amount' => $amount,
                'note' => $cleanNote,
                'correlationId' => $correlationId,
            ];
        });

        self::refreshEphemeralLedgerCookie($this->database, $this->events, $senderId);

        return [
            'transfer' => $receipt,
            'player' => $this->resources->normalize($this->requirePlayer($senderId)),
            'social' => $this->snapshot($senderId),
        ];
    }

    public function hospitalPatients(string $playerId): array
    {
        $this->ensureSeeded();
        $progression = new ProgressionService($this->database, $this->events);
        $revSnap = $progression->snapshot($playerId);
        $reviver = $revSnap['player'];
        $revState = $revSnap['state'];
        $nowMs = (int) floor(microtime(true) * 1000);

        $hasMedEdu = !empty($revState['eduDone']['bio']) || !empty($revState['eduDone']['med']);
        $energyCost = $hasMedEdu ? 25 : 75;
        $reviverUnavailable = ((int) ($revState['hospUntil'] ?? 0) > $nowMs)
            || ((int) ($revState['jailUntil'] ?? 0) > $nowMs)
            || (new TravelService($this->database, $this->events))->isTraveling($playerId);

        $rows = $this->database->fetchAll(
            'SELECT p.id, p.username, p.level, p.life, p.max_life, p.city, s.state_json
             FROM players p
             JOIN player_progression s ON s.player_id = p.id
             ORDER BY p.level DESC, p.username ASC
             LIMIT 200',
        );

        $realPatients = [];
        foreach ($rows as $row) {
            $state = json_decode((string) $row['state_json'], true);
            if (!is_array($state)) {
                continue;
            }
            $hospUntil = (int) ($state['hospUntil'] ?? 0);
            if ($hospUntil <= $nowMs) {
                continue;
            }
            $pid = (string) $row['id'];
            $inFight = $this->database->fetchOne(
                'SELECT encounter_id FROM player_combat_locks WHERE player_id = :id AND expires_at > :now',
                ['id' => $pid, 'now' => time()],
            ) !== null;
            $sameCity = strtolower(trim((string) $reviver['city'])) === strtolower(trim((string) $row['city']));
            $remainingSec = max(1, (int) ceil(($hospUntil - $nowMs) / 1000));
            $canRevive = $pid !== $playerId && !$reviverUnavailable && !$inFight && $sameCity && (int) $reviver['energy'] >= $energyCost;

            $realPatients[] = [
                'id' => $pid,
                'targetPlayerId' => $pid,
                'username' => (string) $row['username'],
                'name' => (string) $row['username'],
                'level' => (int) $row['level'],
                'life' => (int) $row['life'],
                'maxLife' => (int) $row['max_life'],
                'city' => (string) $row['city'],
                'hospUntil' => $hospUntil,
                'remainingSeconds' => $remainingSec,
                'reason' => 'Hospitalized in Zone City trauma ward',
                'npc' => false,
                'isSelf' => $pid === $playerId,
                'canRevive' => $canRevive,
            ];
        }

        $npcPatients = [];
        foreach (is_array($revState['patients'] ?? null) ? $revState['patients'] : [] as $npc) {
            $until = (int) ($npc['until'] ?? 0);
            if ($until <= $nowMs) {
                continue;
            }
            $nid = (string) ($npc['id'] ?? '');
            $npcPatients[] = [
                'id' => $nid,
                'targetPlayerId' => $nid,
                'username' => (string) ($npc['name'] ?? 'Ward Patient'),
                'name' => (string) ($npc['name'] ?? 'Ward Patient'),
                'level' => (int) ($npc['lvl'] ?? 5),
                'life' => 0,
                'maxLife' => 250 + ((int) ($npc['lvl'] ?? 5) * 40),
                'city' => 'Zone City',
                'hospUntil' => $until,
                'remainingSeconds' => max(1, (int) ceil(($until - $nowMs) / 1000)),
                'reason' => match ((string) ($npc['reason'] ?? 'attack')) {
                    'od' => 'Xanax / Drug Overdose',
                    'crime' => 'Critical Crime Injury',
                    default => 'Hospitalized by ' . (string) ($npc['who'] ?? 'Someone'),
                },
                'npc' => true,
                'isSelf' => false,
                'canRevive' => !$reviverUnavailable && (int) $reviver['energy'] >= $energyCost,
            ];
        }

        $allPatients = [...$realPatients, ...$npcPatients];

        return [
            'patients' => $allPatients,
            'realPatientCount' => count($realPatients),
            'npcPatientCount' => count($npcPatients),
            'energyCost' => $energyCost,
            'reviver' => [
                'playerId' => $playerId,
                'username' => (string) $reviver['username'],
                'energy' => (int) $reviver['energy'],
                'maxEnergy' => (int) $reviver['max_energy'],
                'energyCost' => $energyCost,
                'hasMedicalEducation' => $hasMedEdu,
                'reviveSkill' => (int) ($revState['skill']['revive'] ?? 0),
                'available' => !$reviverUnavailable,
            ],
            'serverTime' => gmdate('c'),
        ];
    }

    public function revivePlayer(string $playerId, string $targetPlayerId): array
    {
        $this->ensureSeeded();
        $cleanTarget = trim($targetPlayerId);
        if ($cleanTarget === '') {
            throw new InvalidArgumentException('Target patient ID is required.');
        }
        if ($cleanTarget === $playerId) {
            throw new InvalidArgumentException('Cannot revive yourself. Use a medical item or paid hospital treatment.');
        }

        $targetRow = $this->resolveTargetPlayer($cleanTarget);
        if ($targetRow !== null) {
            $realTargetId = (string) $targetRow['id'];
            if ($realTargetId === $playerId) {
                throw new InvalidArgumentException('Cannot revive yourself.');
            }

            $settlement = $this->database->playersTransaction([$playerId, $realTargetId], function () use ($playerId, $realTargetId): array {
                $this->resources->regenerate($playerId);
                $this->resources->regenerate($realTargetId);
                (new TravelService($this->database, $this->events))->assertAvailable($playerId);
                $progression = new ProgressionService($this->database, $this->events);
                $progression->assertAvailable($playerId, 'revive');
                $progression->assertNotInPlayerCombat($realTargetId);

                $reviver = $this->requirePlayer($playerId);
                $target = $this->requirePlayer($realTargetId);
                $revProg = $this->loadProgressionRow($playerId);
                $targetProg = $this->loadProgressionRow($realTargetId);
                $nowMs = (int) floor(microtime(true) * 1000);

                if ((int) ($targetProg['state']['hospUntil'] ?? 0) <= $nowMs) {
                    throw new RuntimeException('That player has already recovered and left the hospital.');
                }
                if (strtolower(trim((string) $reviver['city'])) !== strtolower(trim((string) $target['city']))) {
                    throw new RuntimeException(sprintf(
                        'You must be in %s to revive %s.',
                        (string) $target['city'],
                        (string) $target['username'],
                    ));
                }

                $hasMedEdu = !empty($revProg['state']['eduDone']['bio']) || !empty($revProg['state']['eduDone']['med']);
                $energyCost = $hasMedEdu ? 25 : 75;
                if ((int) $reviver['energy'] < $energyCost) {
                    throw new RuntimeException(sprintf('Need %d Energy to perform a hospital revive.', $energyCost));
                }

                $correlationId = bin2hex(random_bytes(16));
                $newEnergy = (int) $reviver['energy'] - $energyCost;
                $newXp = (int) $reviver['xp'] + 15;
                $this->database->execute(
                    'UPDATE players SET energy = :energy, xp = :xp WHERE id = :id',
                    ['energy' => $newEnergy, 'xp' => $newXp, 'id' => $playerId],
                );
                (new LevelingService($this->database, $this->ledger, $this->events))->sync($playerId, $correlationId);

                $revProg['state']['skill'] = is_array($revProg['state']['skill'] ?? null) ? $revProg['state']['skill'] : [];
                $revProg['state']['skill']['revive'] = (int) ($revProg['state']['skill']['revive'] ?? 0) + 1;
                $this->saveProgressionRow($playerId, $revProg['state'], $revProg['version'] + 1);

                $targetProg['state']['hospUntil'] = 0;
                $this->saveProgressionRow($realTargetId, $targetProg['state'], $targetProg['version'] + 1);

                $restoredFloor = (int) ceil((int) $target['max_life'] * 0.25);
                $newTargetLife = min((int) $target['max_life'], max((int) $target['life'], max(1, $restoredFloor)));
                $this->database->execute(
                    'UPDATE players SET life = :life WHERE id = :id',
                    ['life' => $newTargetLife, 'id' => $realTargetId],
                );

                $this->recordNotification($realTargetId, 'revived', [
                    'reviverId' => $playerId,
                    'reviverName' => (string) $reviver['username'],
                    'lifeAfter' => $newTargetLife,
                    'correlationId' => $correlationId,
                    'message_en' => sprintf('%s revived you from the hospital (+25%% Life restored).', (string) $reviver['username']),
                    'message_ar' => sprintf('قام %s بإنعاشك وإخراجك من المستشفى (+25%% صحة).', (string) $reviver['username']),
                ]);

                $this->events->publish(new DomainEvent('PlayerRevived', [
                    'playerId' => $playerId,
                    'reviverName' => (string) $reviver['username'],
                    'targetPlayerId' => $realTargetId,
                    'targetName' => (string) $target['username'],
                    'energySpent' => $energyCost,
                    'hasMedicalEducation' => $hasMedEdu,
                    'targetLifeAfter' => $newTargetLife,
                    'reviveSkill' => (int) $revProg['state']['skill']['revive'],
                    'npc' => false,
                    'correlationId' => $correlationId,
                ]));

                return [
                    'revived' => true,
                    'npc' => false,
                    'targetPlayerId' => $realTargetId,
                    'targetUsername' => (string) $target['username'],
                    'energySpent' => $energyCost,
                    'hasMedicalEducation' => $hasMedEdu,
                    'xpAwarded' => 15,
                    'targetLifeAfter' => $newTargetLife,
                    'targetHospUntil' => 0,
                    'reviveSkill' => (int) $revProg['state']['skill']['revive'],
                    'correlationId' => $correlationId,
                ];
            });

            return [
                ...$settlement,
                'player' => $this->resources->normalize($this->requirePlayer($playerId)),
                'hospital' => $this->hospitalPatients($playerId),
            ];
        }

        // NPC ward patient fallback (e.g., patient-0)
        $settlement = $this->database->playerTransaction($playerId, function () use ($playerId, $cleanTarget): array {
            $this->resources->regenerate($playerId);
            (new TravelService($this->database, $this->events))->assertAvailable($playerId);
            (new ProgressionService($this->database, $this->events))->assertAvailable($playerId, 'revive');

            $reviver = $this->requirePlayer($playerId);
            $revProg = $this->loadProgressionRow($playerId);
            $nowMs = (int) floor(microtime(true) * 1000);
            $patients = is_array($revProg['state']['patients'] ?? null) ? $revProg['state']['patients'] : [];
            $foundIdx = array_search($cleanTarget, array_column($patients, 'id'), true);
            if ($foundIdx === false || (int) ($patients[$foundIdx]['until'] ?? 0) <= $nowMs) {
                throw new RuntimeException('That patient has already recovered.');
            }

            $hasMedEdu = !empty($revProg['state']['eduDone']['bio']) || !empty($revProg['state']['eduDone']['med']);
            $energyCost = $hasMedEdu ? 25 : 75;
            if ((int) $reviver['energy'] < $energyCost) {
                throw new RuntimeException(sprintf('Need %d Energy to perform a hospital revive.', $energyCost));
            }

            $correlationId = bin2hex(random_bytes(16));
            $this->database->execute(
                'UPDATE players SET energy = energy - :cost, xp = xp + 15 WHERE id = :id',
                ['cost' => $energyCost, 'id' => $playerId],
            );
            (new LevelingService($this->database, $this->ledger, $this->events))->sync($playerId, $correlationId);

            $patientName = (string) ($patients[$foundIdx]['name'] ?? 'Ward Patient');
            $revProg['state']['patients'][$foundIdx]['until'] = 0;
            $revProg['state']['skill'] = is_array($revProg['state']['skill'] ?? null) ? $revProg['state']['skill'] : [];
            $revProg['state']['skill']['revive'] = (int) ($revProg['state']['skill']['revive'] ?? 0) + 1;
            $this->saveProgressionRow($playerId, $revProg['state'], $revProg['version'] + 1);

            $this->events->publish(new DomainEvent('PlayerRevived', [
                'playerId' => $playerId,
                'reviverName' => (string) $reviver['username'],
                'targetPlayerId' => $cleanTarget,
                'targetName' => $patientName,
                'energySpent' => $energyCost,
                'hasMedicalEducation' => $hasMedEdu,
                'reviveSkill' => (int) $revProg['state']['skill']['revive'],
                'npc' => true,
                'correlationId' => $correlationId,
            ]));

            return [
                'revived' => true,
                'npc' => true,
                'targetPlayerId' => $cleanTarget,
                'targetUsername' => $patientName,
                'energySpent' => $energyCost,
                'hasMedicalEducation' => $hasMedEdu,
                'xpAwarded' => 15,
                'targetLifeAfter' => 100,
                'targetHospUntil' => 0,
                'reviveSkill' => (int) $revProg['state']['skill']['revive'],
                'correlationId' => $correlationId,
            ];
        });

        return [
            ...$settlement,
            'player' => $this->resources->normalize($this->requirePlayer($playerId)),
            'hospital' => $this->hospitalPatients($playerId),
        ];
    }

    public function playerProfile(string $viewerId, ?string $targetId = null, ?string $query = null): array
    {
        $this->ensureSeeded();
        $this->requirePlayer($viewerId);

        $rows = $this->database->fetchAll(
            'SELECT p.id, p.username, p.level, p.xp, p.cash, p.bank_balance, p.life, p.max_life, p.city,
                    m.faction_id, m.role AS faction_role, f.name_en AS faction_name_en, f.name_ar AS faction_name_ar,
                    s.state_json, t.status AS travel_status, t.arrives_at AS travel_arrives_at, t.destination AS travel_dest
             FROM players p
             LEFT JOIN faction_members m ON m.player_id = p.id
             LEFT JOIN factions f ON f.id = m.faction_id
             LEFT JOIN player_progression s ON s.player_id = p.id
             LEFT JOIN player_travel t ON t.player_id = p.id
             ORDER BY p.level DESC, p.xp DESC, p.username ASC
             LIMIT 100',
        );

        $bountiesByTarget = [];
        foreach ($this->loadBounties() as $b) {
            if (($b['status'] ?? '') === 'active' && !empty($b['targetId'])) {
                $tid = (string) $b['targetId'];
                $bountiesByTarget[$tid] ??= ['count' => 0, 'totalRewardCash' => 0];
                $bountiesByTarget[$tid]['count']++;
                $bountiesByTarget[$tid]['totalRewardCash'] += (int) ($b['rewardCash'] ?? 0);
            }
        }

        $nowSec = time();
        $nowMs = $nowSec * 1000;
        $directory = [];
        $rowsById = [];

        foreach ($rows as $row) {
            $pid = (string) $row['id'];
            $rowsById[$pid] = $row;
            $summary = $this->summarizePlayerRow($row, $bountiesByTarget[$pid] ?? ['count' => 0, 'totalRewardCash' => 0], $nowSec, $nowMs);
            $directory[] = $summary;
        }

        $cleanId = $targetId !== null ? trim($targetId) : '';
        $cleanQuery = $query !== null ? trim($query) : '';
        $filtered = $directory;
        $selectedRow = null;

        if ($cleanId !== '') {
            if (isset($rowsById[$cleanId])) {
                $selectedRow = $rowsById[$cleanId];
            } else {
                $resolved = $this->resolveTargetPlayer($cleanId);
                if ($resolved === null) {
                    throw new InvalidArgumentException('Player profile not found: ' . $cleanId);
                }
                $selectedRow = $this->fetchSingleProfileRow((string) $resolved['id']);
            }
        } elseif ($cleanQuery !== '') {
            $needle = strtolower($cleanQuery);
            $filtered = array_values(array_filter($directory, static function (array $entry) use ($needle): bool {
                return str_contains(strtolower((string) $entry['username']), $needle)
                    || str_contains(strtolower((string) $entry['id']), $needle)
                    || str_contains(strtolower((string) ($entry['faction']['name'] ?? '')), $needle)
                    || str_contains(strtolower((string) $entry['city']), $needle);
            }));
            if ($filtered !== []) {
                $firstId = (string) $filtered[0]['id'];
                $selectedRow = $rowsById[$firstId] ?? $this->fetchSingleProfileRow($firstId);
            }
        } else {
            $selectedRow = $rowsById[$viewerId] ?? $this->fetchSingleProfileRow($viewerId);
        }

        $profile = null;
        if ($selectedRow !== null) {
            $pid = (string) $selectedRow['id'];
            $profile = $this->buildDetailedProfile(
                $viewerId,
                $selectedRow,
                $bountiesByTarget[$pid] ?? ['count' => 0, 'totalRewardCash' => 0],
                $nowSec,
                $nowMs,
            );
        }

        return [
            'profile' => $profile,
            'players' => array_slice($filtered, 0, 50),
            'directory' => array_slice($directory, 0, 50),
            'totalCount' => count($filtered),
            'serverTime' => gmdate('c', $nowSec),
        ];
    }

    public function eventsFeed(string $playerId, int $limit = 40): array
    {
        $this->ensureSeeded();
        $player = $this->requirePlayer($playerId);
        $username = (string) $player['username'];
        $safeLimit = max(1, min(40, $limit));

        $playerNames = [];
        foreach ($this->database->fetchAll('SELECT id, username FROM players LIMIT 250') as $prow) {
            $playerNames[(string) $prow['id']] = (string) $prow['username'];
        }

        $seenCorrelations = [];
        $seenMailIds = [];
        $merged = [];
        $unreadCount = 0;

        $notifRows = $this->database->fetchAll(
            'SELECT id, type, payload_json, read_at, created_at FROM notifications WHERE player_id = :id ORDER BY created_at DESC LIMIT 40',
            ['id' => $playerId],
        );
        foreach ($notifRows as $nrow) {
            $type = (string) $nrow['type'];
            if (str_starts_with($type, 'cap-waste:')) {
                continue;
            }
            $payload = json_decode((string) $nrow['payload_json'], true);
            if (!is_array($payload)) {
                continue;
            }
            $corr = (string) ($payload['correlationId'] ?? '');
            if ($corr !== '') {
                $seenCorrelations[$corr . ':' . $type] = true;
            }
            $mailId = (string) ($payload['mailId'] ?? '');
            if ($mailId !== '') {
                $seenMailIds[$mailId] = true;
            }
            $isUnread = $nrow['read_at'] === null;
            if ($isUnread) {
                $unreadCount++;
            }
            $created = (string) $nrow['created_at'];
            $ts = strtotime($created) ?: time();
            $merged[] = [
                'id' => 'ntf-' . (string) $nrow['id'],
                'type' => $type,
                'messageEn' => (string) ($payload['message_en'] ?? 'Syndicate event recorded.'),
                'messageAr' => (string) ($payload['message_ar'] ?? ($payload['message_en'] ?? 'تم تسجيل حدث جديد.')),
                'occurredAt' => $created,
                'epoch' => $ts,
                'time' => gmdate('H:i', $ts),
                'unread' => $isUnread,
            ];
        }

        $eventRows = $this->database->fetchAll(
            "SELECT id, event_name, payload_json, occurred_at FROM event_log
             WHERE event_name IN (
                'PlayerCombatResolved', 'PlayerRevived', 'PlayerReleased',
                'BountyPlaced', 'BountyClaimed', 'PlayerMarketBought',
                'syndicate.mail', 'CashTransferred', 'ForeignItemPurchased'
             )
             ORDER BY occurred_at DESC LIMIT 120",
        );

        foreach ($eventRows as $erow) {
            $ename = (string) $erow['event_name'];
            $payload = json_decode((string) $erow['payload_json'], true);
            if (!is_array($payload)) {
                continue;
            }
            $corr = (string) ($payload['correlationId'] ?? '');
            $occurred = (string) $erow['occurred_at'];
            $ts = strtotime($occurred) ?: time();

            $entry = null;
            if ($ename === 'PlayerCombatResolved') {
                $attId = (string) ($payload['playerId'] ?? '');
                $defId = (string) ($payload['defenderId'] ?? $payload['opponentId'] ?? '');
                $outcome = (string) ($payload['outcome'] ?? '');
                $approach = (string) ($payload['approach'] ?? 'leave');
                $stealthed = !empty($payload['stealthed']);
                $cashDelta = (int) ($payload['cashDelta'] ?? 0);

                if ($defId === $playerId && $outcome === 'won') {
                    $feedType = $approach === 'mug' ? 'mugged' : ($approach === 'hosp' ? 'hospitalized' : 'attacked');
                    if ($corr !== '' && isset($seenCorrelations[$corr . ':' . $feedType])) {
                        continue;
                    }
                    $attLabelEn = $stealthed ? 'Someone' : ($playerNames[$attId] ?? 'An operative');
                    $attLabelAr = $stealthed ? 'مجهول' : ($playerNames[$attId] ?? 'عميل');
                    $en = match ($approach) {
                        'mug' => sprintf('%s mugged you for $%s and left you injured.', $attLabelEn, number_format($cashDelta)),
                        'hosp' => sprintf('%s attacked and hospitalized you.', $attLabelEn),
                        default => sprintf('%s defeated and left you on the street.', $attLabelEn),
                    };
                    $ar = match ($approach) {
                        'mug' => sprintf('سطا عليك %s وسلب $%s.', $attLabelAr, number_format($cashDelta)),
                        'hosp' => sprintf('هاجمك %s وأدخلك المستشفى.', $attLabelAr),
                        default => sprintf('هزمك %s وتركك في الشارع.', $attLabelAr),
                    };
                    $entry = ['type' => $feedType, 'messageEn' => $en, 'messageAr' => $ar];
                } elseif ($attId === $playerId && $outcome === 'won') {
                    $defName = $playerNames[$defId] ?? 'opponent';
                    $feedType = $approach === 'mug' ? 'mugged' : 'hospitalized';
                    $en = match ($approach) {
                        'mug' => sprintf('You mugged %s for $%s%s.', $defName, number_format($cashDelta), $stealthed ? ' (Stealth)' : ''),
                        'hosp' => sprintf('You hospitalized %s (+%s Respect)%s.', $defName, (string) ($payload['respectDelta'] ?? 0), $stealthed ? ' (Stealth)' : ''),
                        default => sprintf('You defeated %s and left them (+%d XP).', $defName, (int) ($payload['xp'] ?? 0)),
                    };
                    $ar = match ($approach) {
                        'mug' => sprintf('سطوت على %s وربحت $%s.', $defName, number_format($cashDelta)),
                        'hosp' => sprintf('أدخلت %s المستشفى (+%s احترام).', $defName, (string) ($payload['respectDelta'] ?? 0)),
                        default => sprintf('هزمت %s في الشارع (+%d خبرة).', $defName, (int) ($payload['xp'] ?? 0)),
                    };
                    $entry = ['type' => $feedType, 'messageEn' => $en, 'messageAr' => $ar];
                }
            } elseif ($ename === 'PlayerRevived') {
                $revId = (string) ($payload['playerId'] ?? '');
                $tgtId = (string) ($payload['targetPlayerId'] ?? '');
                if ($tgtId === $playerId) {
                    if ($corr !== '' && isset($seenCorrelations[$corr . ':revived'])) {
                        continue;
                    }
                    $revName = (string) ($payload['reviverName'] ?? ($playerNames[$revId] ?? 'A medic'));
                    $entry = [
                        'type' => 'revived',
                        'messageEn' => sprintf('%s revived you from the hospital.', $revName),
                        'messageAr' => sprintf('أنعشك %s وأخرجك من المستشفى.', $revName),
                    ];
                } elseif ($revId === $playerId) {
                    $tgtName = (string) ($payload['targetName'] ?? ($playerNames[$tgtId] ?? 'patient'));
                    $entry = [
                        'type' => 'revived',
                        'messageEn' => sprintf('You revived %s (-%dE).', $tgtName, (int) ($payload['energySpent'] ?? 25)),
                        'messageAr' => sprintf('أنعشت %s في المستشفى (-%d طاقة).', $tgtName, (int) ($payload['energySpent'] ?? 25)),
                    ];
                }
            } elseif ($ename === 'PlayerReleased') {
                $inmateId = (string) ($payload['playerId'] ?? '');
                $actorId = (string) ($payload['actorPlayerId'] ?? '');
                if ($inmateId === $playerId) {
                    $actorName = $playerNames[$actorId] ?? 'An ally';
                    $entry = [
                        'type' => 'busted',
                        'messageEn' => sprintf('%s broke/bailed you out of Zone City Jail!', $actorName),
                        'messageAr' => sprintf('أخرجك %s من سجن مدينة زون!', $actorName),
                    ];
                } elseif ($actorId === $playerId) {
                    $inmateName = $playerNames[$inmateId] ?? 'an inmate';
                    $entry = [
                        'type' => 'busted',
                        'messageEn' => sprintf('You freed %s from Zone City Jail.', $inmateName),
                        'messageAr' => sprintf('حررت %s من سجن مدينة زون.', $inmateName),
                    ];
                }
            } elseif ($ename === 'BountyPlaced') {
                $tgtId = (string) ($payload['targetId'] ?? '');
                $funderId = (string) ($payload['playerId'] ?? '');
                $amt = number_format((int) ($payload['rewardCash'] ?? 0));
                if ($tgtId === $playerId) {
                    if ($corr !== '' && isset($seenCorrelations[$corr . ':bounty_placed'])) {
                        continue;
                    }
                    $entry = [
                        'type' => 'bounty_placed',
                        'messageEn' => sprintf('%s placed a $%s bounty on you.', (string) ($payload['placedBy'] ?? 'Someone'), $amt),
                        'messageAr' => sprintf('رصد %s مكافأة بقيمة $%s لملاحقتك.', (string) ($payload['placedBy'] ?? 'أحدهم'), $amt),
                    ];
                } elseif ($funderId === $playerId) {
                    $entry = [
                        'type' => 'bounty_placed',
                        'messageEn' => sprintf('You funded a $%s bounty on %s.', $amt, (string) ($payload['targetName'] ?? 'target')),
                        'messageAr' => sprintf('موّلت مكافأة بقيمة $%s لملاحقة %s.', $amt, (string) ($payload['targetName'] ?? 'هدف')),
                    ];
                }
            } elseif ($ename === 'BountyClaimed') {
                $hunterId = (string) ($payload['playerId'] ?? '');
                $tgtId = (string) ($payload['targetId'] ?? '');
                $amt = number_format((int) ($payload['rewardCash'] ?? 0));
                if (($hunterId === $playerId || $tgtId === $playerId) && $corr !== '' && isset($seenCorrelations[$corr . ':bounty_claimed'])) {
                    continue;
                }
                if ($hunterId === $playerId) {
                    $entry = [
                        'type' => 'bounty_claimed',
                        'messageEn' => sprintf('You claimed a $%s bounty on %s!', $amt, (string) ($payload['targetName'] ?? 'target')),
                        'messageAr' => sprintf('حصدت مكافأة $%s بعد إسقاط %s!', $amt, (string) ($payload['targetName'] ?? 'الهدف')),
                    ];
                } elseif ($tgtId === $playerId) {
                    $entry = [
                        'type' => 'bounty_claimed',
                        'messageEn' => sprintf('%s claimed a $%s bounty on you.', (string) ($payload['hunterName'] ?? 'A hunter'), $amt),
                        'messageAr' => sprintf('حصد %s مكافأة $%s الموضوعة عليك.', (string) ($payload['hunterName'] ?? 'صائد مكافآت'), $amt),
                    ];
                }
            } elseif ($ename === 'PlayerMarketBought') {
                $sellerId = (string) ($payload['sellerId'] ?? '');
                $buyerId = (string) ($payload['buyerId'] ?? $payload['playerId'] ?? '');
                if ($sellerId === $playerId) {
                    $buyerName = $playerNames[$buyerId] ?? 'A buyer';
                    $entry = [
                        'type' => 'market_sale',
                        'messageEn' => sprintf('%s bought %dx %s from your market listing (+$%s).', $buyerName, (int) ($payload['quantity'] ?? 1), (string) ($payload['itemId'] ?? 'item'), number_format((int) ($payload['sellerProceeds'] ?? $payload['totalPrice'] ?? 0))),
                        'messageAr' => sprintf('اشترى %s عدد %d من %s من عرضك في السوق.', $buyerName, (int) ($payload['quantity'] ?? 1), (string) ($payload['itemId'] ?? 'عنصر')),
                    ];
                }
            } elseif ($ename === 'syndicate.mail') {
                $recId = (string) ($payload['recipientId'] ?? '');
                $recName = (string) ($payload['recipientName'] ?? '');
                $mailId = (string) ($payload['id'] ?? '');
                if ($mailId !== '' && isset($seenMailIds[$mailId])) {
                    continue;
                }
                if ($recId === $playerId || ($recName !== '' && strcasecmp($recName, $username) === 0)) {
                    $entry = [
                        'type' => 'mail',
                        'messageEn' => sprintf('Mail received from %s: "%s".', (string) ($payload['senderName'] ?? 'Syndicate'), (string) ($payload['subject'] ?? 'Dispatch')),
                        'messageAr' => sprintf('رسالة واردة من %s: "%s".', (string) ($payload['senderName'] ?? 'النقابة'), (string) ($payload['subject'] ?? 'رسالة')),
                    ];
                }
            } elseif ($ename === 'ForeignItemPurchased' && ($payload['playerId'] ?? '') === $playerId) {
                $entry = [
                    'type' => 'market_sale',
                    'messageEn' => sprintf('Purchased %dx %s abroad in %s (-$%s).', (int) ($payload['quantity'] ?? 1), (string) ($payload['itemId'] ?? 'item'), ucfirst((string) ($payload['hubId'] ?? 'foreign hub')), number_format((int) ($payload['totalCost'] ?? 0))),
                    'messageAr' => sprintf('اشتريت %dx %s من السوق الخارجي (-$%s).', (int) ($payload['quantity'] ?? 1), (string) ($payload['itemId'] ?? 'عنصر'), number_format((int) ($payload['totalCost'] ?? 0))),
                ];
            }

            if ($entry !== null) {
                $merged[] = [
                    'id' => 'evt-' . (string) $erow['id'],
                    'type' => $entry['type'],
                    'messageEn' => $entry['messageEn'],
                    'messageAr' => $entry['messageAr'],
                    'occurredAt' => $occurred,
                    'epoch' => $ts,
                    'time' => gmdate('H:i', $ts),
                    'unread' => false,
                ];
            }
        }

        usort($merged, static fn (array $a, array $b): int => ($b['epoch'] <=> $a['epoch']));
        $sliced = array_slice($merged, 0, $safeLimit);
        foreach ($sliced as &$item) {
            unset($item['epoch']);
        }
        unset($item);

        return [
            'events' => $sliced,
            'unreadCount' => $unreadCount,
            'total' => count($sliced),
            'serverTime' => gmdate('c'),
        ];
    }

    public function recordNotification(string $playerId, string $type, array $payload): void
    {
        if ($playerId === '') {
            return;
        }
        $exists = $this->database->fetchOne('SELECT id FROM players WHERE id = :id', ['id' => $playerId]);
        if ($exists === null) {
            return;
        }
        $this->database->execute(
            'INSERT INTO notifications (id, player_id, type, payload_json, read_at, created_at) VALUES (:id, :player, :type, :payload, NULL, :created_at)',
            [
                'id' => bin2hex(random_bytes(16)),
                'player' => $playerId,
                'type' => $type,
                'payload' => json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'created_at' => gmdate('c'),
            ],
        );
    }

    /**
     * @param array<string, mixed> $row
     * @param array{count: int, totalRewardCash: int} $bountyInfo
     * @return array<string, mixed>
     */
    private function summarizePlayerRow(array $row, array $bountyInfo, int $nowSec, int $nowMs): array
    {
        $state = is_string($row['state_json'] ?? null) && $row['state_json'] !== ''
            ? (json_decode($row['state_json'], true) ?: [])
            : [];
        [$status, $statusUntil, $statusRemaining] = $this->computeLiveStatus($row, $state, $nowSec, $nowMs);
        $cash = (int) ($row['cash'] ?? 0);
        $bank = (int) ($row['bank_balance'] ?? 0);
        $vault = (int) ($state['vaultBalance'] ?? ($state['tornState']['vaultBalance'] ?? 0));
        $netWorth = max(0, $cash + $bank + $vault);
        $level = (int) ($row['level'] ?? 1);

        $faction = !empty($row['faction_id']) ? [
            'id' => (string) $row['faction_id'],
            'name' => (string) ($row['faction_name_en'] ?? $row['faction_id']),
            'nameAr' => (string) ($row['faction_name_ar'] ?? ($row['faction_name_en'] ?? $row['faction_id'])),
            'role' => (string) ($row['faction_role'] ?? 'member'),
        ] : null;

        return [
            'id' => (string) $row['id'],
            'username' => (string) $row['username'],
            'level' => $level,
            'xp' => (int) ($row['xp'] ?? 0),
            'rank' => $this->rankTitleForLevel($level),
            'cashTier' => $this->cashTierLabel($cash),
            'netWorth' => $netWorth,
            'city' => $status === 'Traveling' && !empty($row['travel_dest']) ? (string) $row['travel_dest'] : (string) ($row['city'] ?? 'Zone City'),
            'status' => $status,
            'statusUntil' => $statusUntil,
            'statusRemainingSeconds' => $statusRemaining,
            'life' => (int) ($row['life'] ?? 250),
            'maxLife' => (int) ($row['max_life'] ?? 250),
            'faction' => $faction,
            'property' => (string) ($state['prop'] ?? 'shack'),
            'bountyCount' => $bountyInfo['count'],
            'bountyTotalCash' => $bountyInfo['totalRewardCash'],
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @param array{count: int, totalRewardCash: int} $bountyInfo
     * @return array<string, mixed>
     */
    private function buildDetailedProfile(string $viewerId, array $row, array $bountyInfo, int $nowSec, int $nowMs): array
    {
        $summary = $this->summarizePlayerRow($row, $bountyInfo, $nowSec, $nowMs);
        $pid = $summary['id'];
        $state = is_string($row['state_json'] ?? null) && $row['state_json'] !== ''
            ? (json_decode($row['state_json'], true) ?: [])
            : [];

        $honorsCount = is_array($state['claimedHonors'] ?? null) ? count(array_filter($state['claimedHonors'])) : 0;
        $achRow = $this->database->fetchOne('SELECT COUNT(*) AS c FROM achievements WHERE player_id = :id', ['id' => $pid]);
        $wins = (int) ($state['ctr']['wins'] ?? 0);
        $crimes = (int) ($state['ctr']['crimes'] ?? 0);
        $revives = (int) ($state['skill']['revive'] ?? 0);
        $medalsCount = (int) ($achRow['c'] ?? 0)
            + ($wins >= 1 ? 1 : 0) + ($wins >= 10 ? 1 : 0) + ($wins >= 50 ? 1 : 0)
            + ($crimes >= 10 ? 1 : 0) + ($crimes >= 50 ? 1 : 0) + ($revives >= 1 ? 1 : 0);

        $playerNames = [];
        foreach ($this->database->fetchAll('SELECT id, username FROM players LIMIT 250') as $prow) {
            $playerNames[(string) $prow['id']] = (string) $prow['username'];
        }

        $attackRows = $this->database->fetchAll(
            "SELECT id, payload_json, occurred_at FROM event_log WHERE event_name = 'PlayerCombatResolved' ORDER BY occurred_at DESC LIMIT 60",
        );
        $recentAttacks = [];
        foreach ($attackRows as $arow) {
            $payload = json_decode((string) $arow['payload_json'], true);
            if (!is_array($payload)) {
                continue;
            }
            $attId = (string) ($payload['playerId'] ?? '');
            $defId = (string) ($payload['defenderId'] ?? $payload['opponentId'] ?? '');
            if ($attId !== $pid && $defId !== $pid) {
                continue;
            }
            $stealthed = !empty($payload['stealthed']);
            $maskAttacker = $stealthed && $viewerId !== $attId;
            $recentAttacks[] = [
                'id' => (string) $arow['id'],
                'attackerId' => $maskAttacker ? null : $attId,
                'attackerName' => $maskAttacker ? 'Someone' : ($playerNames[$attId] ?? 'Operative'),
                'defenderId' => $defId,
                'defenderName' => $playerNames[$defId] ?? 'Operative',
                'approach' => (string) ($payload['approach'] ?? 'leave'),
                'outcome' => (string) ($payload['outcome'] ?? 'stalemate'),
                'stealthed' => $stealthed,
                'fairFight' => (float) ($payload['modifiers']['fair_fight'] ?? 1.0),
                'respectDelta' => (int) ($payload['respectDelta'] ?? 0),
                'cashDelta' => (int) ($payload['cashDelta'] ?? 0),
                'occurredAt' => (string) $arow['occurred_at'],
            ];
            if (count($recentAttacks) >= 10) {
                break;
            }
        }

        return [
            ...$summary,
            'honorsCount' => $honorsCount,
            'medalsCount' => $medalsCount,
            'combatStats' => [
                'wins' => $wins,
                'crimes' => $crimes,
                'revives' => $revives,
                'bestChain' => (int) ($state['fac']['best'] ?? 0),
            ],
            'activeBounties' => $bountyInfo,
            'recentAttacks' => $recentAttacks,
            'isSelf' => $pid === $viewerId,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @param array<string, mixed> $state
     * @return array{0: string, 1: int, 2: int}
     */
    private function computeLiveStatus(array $row, array $state, int $nowSec, int $nowMs): array
    {
        $hospUntil = (int) ($state['hospUntil'] ?? 0);
        if ($hospUntil > $nowMs) {
            return ['Hospital', $hospUntil, max(1, (int) ceil(($hospUntil - $nowMs) / 1000))];
        }
        $jailUntil = (int) ($state['jailUntil'] ?? 0);
        if ($jailUntil > $nowMs) {
            return ['Jail', $jailUntil, max(1, (int) ceil(($jailUntil - $nowMs) / 1000))];
        }
        if (($row['travel_status'] ?? '') === 'traveling' && !empty($row['travel_arrives_at'])) {
            $arrivesSec = strtotime((string) $row['travel_arrives_at']);
            if ($arrivesSec !== false && $arrivesSec > $nowSec) {
                return ['Traveling', $arrivesSec * 1000, $arrivesSec - $nowSec];
            }
        }
        return ['Okay', 0, 0];
    }

    private function rankTitleForLevel(int $level): string
    {
        return match (true) {
            $level >= 30 => 'Syndicate Apex',
            $level >= 20 => 'Underboss',
            $level >= 12 => 'Capo',
            $level >= 5 => 'Enforcer',
            default => 'Street Operative',
        };
    }

    private function cashTierLabel(int $cash): string
    {
        return match (true) {
            $cash >= 1000000 => 'High Roller ($1M+)',
            $cash >= 100000 => 'Loaded ($100k+)',
            $cash >= 10000 => 'Liquid ($10k+)',
            $cash > 0 => 'Pocket Change (<$10k)',
            default => 'Empty Wallet ($0)',
        };
    }

    private function fetchSingleProfileRow(string $playerId): ?array
    {
        return $this->database->fetchOne(
            'SELECT p.id, p.username, p.level, p.xp, p.cash, p.bank_balance, p.life, p.max_life, p.city,
                    m.faction_id, m.role AS faction_role, f.name_en AS faction_name_en, f.name_ar AS faction_name_ar,
                    s.state_json, t.status AS travel_status, t.arrives_at AS travel_arrives_at, t.destination AS travel_dest
             FROM players p
             LEFT JOIN faction_members m ON m.player_id = p.id
             LEFT JOIN factions f ON f.id = m.faction_id
             LEFT JOIN player_progression s ON s.player_id = p.id
             LEFT JOIN player_travel t ON t.player_id = p.id
             WHERE p.id = :id',
            ['id' => $playerId],
        );
    }

    /** @return array{state: array<string, mixed>, version: int} */
    private function loadProgressionRow(string $playerId): array
    {
        (new ProgressionService($this->database, $this->events))->snapshot($playerId);
        $row = $this->database->fetchOne('SELECT state_json, version FROM player_progression WHERE player_id = :id', ['id' => $playerId]);
        if ($row === null) {
            throw new RuntimeException('Progression state missing for player: ' . $playerId);
        }
        return [
            'state' => json_decode((string) $row['state_json'], true, 512, JSON_THROW_ON_ERROR),
            'version' => (int) $row['version'],
        ];
    }

    private function saveProgressionRow(string $playerId, array $state, int $version): void
    {
        $state['version'] = $version;
        $this->database->execute(
            'UPDATE player_progression SET state_json = :state, version = :version, updated_at = :updated WHERE player_id = :id',
            [
                'state' => json_encode($state, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'version' => $version,
                'updated' => gmdate('c'),
                'id' => $playerId,
            ],
        );
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

    public static function refreshEphemeralLedgerCookie(Database $database, EventBus $events, string $playerId): void
    {
        if (getenv('ZONE_EPHEMERAL_VERCEL_SQLITE') !== '1') {
            return;
        }
        $secret = \Zone\Engine\Core\Security\RequestGuard::ledgerSecret();
        if ($secret === '' || $playerId === '') {
            return;
        }
        $p = $database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $playerId]);
        if ($p === null) {
            return;
        }
        $progRow = $database->fetchOne('SELECT state_json, version FROM player_progression WHERE player_id = :id', ['id' => $playerId]);
        if ($progRow === null) {
            (new ProgressionService($database, $events))->snapshot($playerId);
            $progRow = $database->fetchOne('SELECT state_json, version FROM player_progression WHERE player_id = :id', ['id' => $playerId]);
            if ($progRow === null) {
                return;
            }
        }
        $state = json_decode((string) $progRow['state_json'], true);
        if (!is_array($state)) {
            return;
        }

        $nextVersion = max((int) ($progRow['version'] ?? 1), (int) ($state['version'] ?? 1)) + 1;
        $state['version'] = $nextVersion;
        $database->execute(
            'UPDATE player_progression SET state_json = :state, version = :version, updated_at = :updated WHERE player_id = :id',
            [
                'state' => json_encode($state, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'version' => $nextVersion,
                'updated' => gmdate('c'),
                'id' => $playerId,
            ],
        );

        $compactInv = array_filter(is_array($state['inv'] ?? null) ? $state['inv'] : [], static fn (mixed $qty): bool => (int) $qty > 0);
        $compactSkill = array_filter(is_array($state['skill'] ?? null) ? $state['skill'] : [], static fn (mixed $lvl): bool => (int) $lvl > 0);
        $snap = [
            'p' => $playerId,
            'u' => (string) ($p['username'] ?? ''),
            'c' => (int) ($p['cash'] ?? 85000),
            'b' => (int) ($p['bank_balance'] ?? 125000),
            'v' => $nextVersion,
            'pts' => (int) ($state['points'] ?? 45),
            'm' => (int) ($state['merits'] ?? 6),
            'inv' => $compactInv,
            'eq' => $state['equip'] ?? null,
            'aeq' => $state['armorEquip'] ?? null,
            'gym' => (int) ($state['gym'] ?? 1),
            'gxp' => (int) ($state['gymXp'] ?? 0),
            'job' => (string) ($state['job'] ?? 'grocer'),
            'jp' => (int) ($state['jobPts'] ?? 0),
            'ed' => $state['eduDone'] ?? [],
            'prop' => (string) ($state['prop'] ?? 'shack'),
            'op' => $state['ownedProperties'] ?? ['shack' => 1],
            'cxp' => (int) ($state['crimeXp'] ?? 0),
            'fac' => $state['fac'] ?? [],
            'tc' => $state['tornCombat'] ?? [],
            'ts' => $state['tornState'] ?? [],
            'cd' => $state['cooldowns'] ?? [],
            'add' => (int) ($state['addiction'] ?? 0),
            'vb' => (int) ($state['vaultBalance'] ?? 0),
            'stk' => $state['stocks'] ?? [],
            'acd' => $state['activeCd'] ?? null,
            'prf' => $state['pointsRefills'] ?? [],
            'abk' => $state['activeBook'] ?? null,
            'mfr' => !empty($state['meritFreeResetUsed']) ? 1 : 0,
            'skl' => $compactSkill,
            'ws' => $state['workStats'] ?? [],
            'ju' => (int) ($state['jailUntil'] ?? 0),
            'hu' => (int) ($state['hospUntil'] ?? 0),
            'mt' => $state['meritTree'] ?? [],
            'pl' => $state['propertyLease'] ?? [],
            'plu' => $state['plushies'] ?? [],
            'ch' => $state['claimedHonors'] ?? [],
            'cs' => $state['claimedCitySpawns'] ?? [],
            'fl' => $state['friendsList'] ?? [],
            'tl' => $state['targetsList'] ?? [],
            'pn' => substr((string) ($state['personalNotes'] ?? ''), 0, 200),
        ];

        $encodeCookie = static function (array $payloadArr) use ($secret): ?string {
            $deflated = gzdeflate((string) json_encode($payloadArr, JSON_UNESCAPED_UNICODE), 6);
            if ($deflated === false) {
                return null;
            }
            $payload = rtrim(strtr(base64_encode($deflated), '+/', '-_'), '=');
            $sig = hash_hmac('sha256', $payload, $secret);
            return $payload . '.' . $sig;
        };

        $cookie = $encodeCookie($snap);
        if ($cookie !== null && strlen($cookie) > 3500) {
            $snap['tc'] = [];
            $snap['ch'] = [];
            $snap['cs'] = [];
            $snap['pn'] = '';
            $cookie = $encodeCookie($snap);
        }
        if ($cookie !== null && strlen($cookie) <= 3500) {
            $GLOBALS['__zone_ledger_cookie'] = $cookie;
            $_COOKIE['zone_player_ledger'] = $cookie;
        }
    }
}

<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';
use Zone\Engine\Core\Content\GameplayDefinitionValidator;
use Zone\Engine\Core\Persistence\Database;
putenv('ZONE_REDIS_URL='); // No inherited external cache in this isolated proof.

$path = ZONE_ENGINE_ROOT . '/var/launch-studio-richness-' . bin2hex(random_bytes(8)) . '.sqlite';
$url = 'sqlite:' . $path;
$engine = zone_engine($url); $db = Database::connect($url); $passed = 0;
function richness(bool $ok, string $label): void { global $passed; if (!$ok) throw new RuntimeException('FAIL: ' . $label); $passed++; echo 'PASS: ' . $label . PHP_EOL; }
function richnessReject(callable $call, string $label): void { try { $call(); } catch (InvalidArgumentException|RuntimeException $error) { richness(true, $label); return; } throw new RuntimeException('FAIL: expected rejection: ' . $label); }
function richnessAction(string $action, string $id): array { global $engine, $player; return $engine->gameplayAction($action, $id, $engine->gameplay($player)['state']['version'], $player); }
function richnessHistory(): array { global $db, $player; return $db->fetchAll('SELECT * FROM economy_ledger WHERE player_id=:id ORDER BY id', ['id' => $player]); }
function richnessEdit(string $category, string $id, array $changes): void { global $engine; $engine->saveGameplayCatalog($category, $id, $changes, $engine->adminGameplayCatalog()['revision'], 'isolated-studio'); }

$baseline = $engine->publishRelease('isolated-studio');
$session = $engine->browserSessions()->create('isolated-richness-player'); $player = $engine->browserSessions()->resolve($session['token']);
$before = $engine->gameplay($player);
richness($player !== 'founder-player' && $before['player']['cash'] === 2500 && $before['player']['level'] === 1, 'normal player has no staff or fixture grants');
$armor = ['type' => 'armor', 'price' => 100, 'red' => .6, 'name' => ['en' => 'Studio fitted armor', 'ar' => 'درع الاستوديو الملائم'], 'description' => ['en' => 'An owned armor-slot choice.', 'ar' => 'اختيار لخانة الدرع المملوك.']];
$booster = ['type' => 'booster', 'price' => 30, 'energy' => 9, 'happy' => 5000, 'name' => ['en' => 'Studio recovery', 'ar' => 'استعادة الاستوديو']];
$property = ['price' => 25, 'happy' => 10000, 'name' => ['en' => 'Studio base', 'ar' => 'قاعدة الاستوديو'], 'image' => 'art/p_shack.jpg'];
foreach (['studio-armor' => $armor, 'studio-booster' => $booster] as $id => $definition) $engine->createGameplayCatalog('items', $id, $definition, $engine->adminGameplayCatalog()['revision'], 'isolated-studio');
$engine->createGameplayCatalog('properties', 'studio-base', $property, $engine->adminGameplayCatalog()['revision'], 'isolated-studio');
richnessReject(fn () => GameplayDefinitionValidator::definition('items', [...$armor, 'red' => .951], true), 'armor over 95% is rejected');
richnessReject(fn () => GameplayDefinitionValidator::definition('items', [...$armor, 'model' => 'bat'], true), 'armor cannot borrow an unsupported weapon model');
richnessReject(fn () => GameplayDefinitionValidator::definition('items', [...$booster, 'happy' => -1], true), 'negative restorative effect is rejected');
richnessReject(fn () => GameplayDefinitionValidator::definition('items', [...$booster, 'energy' => 0, 'happy' => 0], true), 'zero-effect new consumable is rejected');
richnessReject(fn () => richnessAction('item.buy', 'studio-armor'), 'unpublished armor cannot be acquired');
richness(!isset($engine->gameBootstrap()['content']['gameplayCatalog']['items']['studio-booster']), 'saved booster is draft-only');
richnessEdit('items', 'drink', ['energy' => 1, 'happy' => 10]);
richness($engine->adminGameplayCatalog()['catalogs']['items']['drink']['nerve'] === 4, 'adding missing effects retains the existing nerve dose');
$draft = $engine->releaseDraft(); $preview = $draft['manifest']; $preview['content']['gameplayCatalog'] = $engine->adminGameplayCatalog()['catalogs'];
$engine->saveReleaseDraft($preview, 'isolated-studio', $draft['draftFingerprint']);
richness($engine->releaseDraft()['manifest']['content']['gameplayCatalog']['items']['studio-booster']['happy'] === 5000 && $engine->activeRelease()['id'] === $baseline['id'], 'preview retains authored happiness without publishing');
$release = $engine->publishRelease('isolated-studio', $engine->releaseDraft()['draftFingerprint']);
$engine = zone_engine($url);
richness($engine->gameBootstrap()['content']['gameplayCatalog']['items']['studio-armor']['name']['ar'] === $armor['name']['ar'], 'fresh engine reads published bilingual armor');
richnessAction('item.buy', 'studio-armor'); $equipped = richnessAction('item.equip', 'studio-armor');
richness($equipped['state']['armorEquip'] === 'studio-armor' && $equipped['loadout']['armorReduction'] === .6, 'ordinary player buys and equips authored armor with real reduction');
richness(($equipped['state']['equip'] ?? null) === ($before['state']['equip'] ?? null), 'armor does not replace weapon slot');
richnessAction('property.buy', 'studio-base'); $low = $engine->trainGym('strength', 1, $player);
richnessAction('item.buy', 'studio-booster'); $preUse = $engine->gameplay($player); $used = richnessAction('item.use', 'studio-booster');
richness($used['result']['restored']['energy'] === min(9, $preUse['player']['max_energy'] - $preUse['player']['energy']) && $used['result']['restored']['happy'] === 5000, 'real use restores capped energy and exact authored happiness');
richness($used['state']['inv']['studio-booster'] === 0 && $used['player']['happy'] === $preUse['player']['happy'] + 5000, 'one owned booster is consumed once, no optimistic client grant');
// Wait only the real configured gym cooldown, never rewrite it for this proof.
$ready = $engine->gameplay($player)['cooldowns']['actions']['gym']['availableAtEpoch'];
while (time() < $ready) usleep(100000);
$high = $engine->trainGym('defense', 1, $player);
richness($high['happiness']['value'] === $used['player']['happy'] && $high['happiness']['multiplier'] > $low['happiness']['multiplier'], 'published happy booster feeds actual server Gym happiness calculation');
richness($high['gain'] > $low['gain'], 'large earned happiness increase raises this actual bounded Gym gain');
$history = richnessHistory(); $saved = $engine->gameplay($player);
$consumption = array_values(array_filter($history, static fn (array $row): bool => $row['asset'] === 'item:studio-booster' && $row['reason'] === 'item.use' && $row['correlation_id'] === $used['result']['correlationId']));
richness(count($consumption) === 1 && (int) $consumption[0]['amount'] === -1, 'consumption has exactly one correlated inventory debit');
richness(array_sum(array_column(array_filter($history, static fn (array $row): bool => $row['asset'] === 'cash'), 'amount')) === $saved['player']['cash'], 'authored acquisitions and earned rewards reconcile to the ordinary wallet');
$engine->activateRelease($baseline['id'], 'isolated-studio');
richness(richnessHistory() === $history && $engine->gameplay($player)['state']['inv']['studio-armor'] === 1, 'rollback hides authored rules without erasing acquisition ledger or owned armor');
$engine->activateRelease($release['id'], 'isolated-studio'); $engine = zone_engine($url);
richness($engine->browserSessions()->resolve($session['token']) === $player && $engine->gameplay($player)['state']['armorEquip'] === 'studio-armor' && richnessHistory() === $history, 'reactivation and fresh connection retain session, armor slot and economic history');
echo 'STUDIO RICHNESS EVIDENCE: ' . json_encode(['adapter' => 'sqlite', 'database' => $path, 'armorReduction' => .6, 'restored' => $used['result']['restored'], 'lowGymGain' => $low['gain'], 'highGymGain' => $high['gain'], 'staffGrants' => false], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES) . PHP_EOL;
echo "LAUNCH STUDIO RICHNESS RESULT: {$passed} passed, 0 failed\n";

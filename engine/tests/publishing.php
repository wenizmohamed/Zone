<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Persistence\Database;

$path = dirname(__DIR__) . '/var/publishing-' . bin2hex(random_bytes(6)) . '.sqlite';
$engine = zone_engine('sqlite:' . $path);
$db = Database::connect('sqlite:' . $path);
$passed = 0;
function proof(bool $ok, string $label): void {
    global $passed;
    if (!$ok) throw new RuntimeException('FAIL: ' . $label);
    $passed++;
    echo 'PASS: ' . $label . PHP_EOL;
}
function attempt($engine, $db, string $id): array {
    $db->execute('DELETE FROM action_cooldowns');
    return $engine->attemptCrime($id);
}
function rejected(callable $fn, string $prefix): bool {
    try { $fn(); } catch (RuntimeException $error) { return str_starts_with($error->getMessage(), $prefix); }
    return false;
}
try {
    $initial = $engine->gameBootstrap();
    $crime = ['name_en' => 'Release proof', 'name_ar' => 'اختبار الإصدار', 'nerve_cost' => 1, 'success_basis_points' => 10000, 'cash_min' => 111, 'cash_max' => 111, 'xp_reward' => 0, 'level_required' => 1, 'enabled' => true];
    $engine->saveCrime('release-proof', $crime, 'test');
    proof(count($engine->crimes()) === count($initial['content']['crimes']), 'first draft crime stays outside the initial public catalog');
    proof(rejected(fn () => attempt($engine, $db, 'release-proof'), 'Unknown crime:'), 'first draft crime cannot execute before first publish');
    $engine = zone_engine('sqlite:' . $path);
    proof(rejected(fn () => attempt($engine, $db, 'release-proof'), 'Unknown crime:'), 'initial runtime survives a new request without reading draft crimes');
    $one = $engine->publishRelease('test');
    proof(attempt($engine, $db, 'release-proof')['reward']['cash'] === 111, 'published crime executes its snapshotted reward');
    $engine->saveCrime('release-proof', [...$crime, 'cash_min' => 222, 'cash_max' => 222], 'test');
    proof(attempt($engine, $db, 'release-proof')['reward']['cash'] === 111, 'draft reward edits cannot change active gameplay');
    $engine->changeModule('crime', 'disable');
    proof(attempt($engine, $db, 'release-proof')['reward']['cash'] === 111, 'draft module disable cannot change active gameplay');
    $disabled = $engine->publishRelease('test');
    proof($engine->crimes() === [], 'published module disable removes public crime capability');
    proof(rejected(fn () => attempt($engine, $db, 'release-proof'), 'Crime module is disabled.'), 'published module disable blocks execution specifically');
    $engine->activateRelease($one['id'], 'test');
    proof(attempt($engine, $db, 'release-proof')['reward']['cash'] === 111, 'rollback restores module and exact crime reward despite changed draft');
    $engine->changeModule('crime', 'enable');
    $two = $engine->publishRelease('test');
    proof(attempt($engine, $db, 'release-proof')['reward']['cash'] === 222, 'next publish activates edited reward');
    $engine->activateRelease($one['id'], 'test');
    proof(attempt($engine, $db, 'release-proof')['reward']['cash'] === 111, 'second rollback restores economic rules');
    $css = $engine->activeThemeStylesheet();
    $engine->activateTheme('terminal');
    proof($engine->activeThemeStylesheet() === $css, 'theme draft preserves published stylesheet');
    $themeRelease = $engine->publishRelease('test');
    proof(str_contains($engine->activeThemeStylesheet(), '#42e8e0'), 'theme publish changes stylesheet');
    $engine->activateRelease($one['id'], 'test');
    proof($engine->activeThemeStylesheet() === $css, 'theme rollback restores stylesheet');
    $draft = $engine->releaseDraft()['manifest'];
    $draft['modules']['crimes'] = false;
    $engine->saveReleaseDraft($draft, 'test');
    $engine->publishRelease('test');
    proof($engine->crimes() === [], 'published page module switch also gates its server capability');
    proof(rejected(fn () => attempt($engine, $db, 'release-proof'), 'Crime module is disabled.'), 'hidden crimes screen cannot be bypassed through its API');
    echo "PUBLISHING RESULT: {$passed} passed, 0 failed\n";
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL . $error->getTraceAsString() . PHP_EOL);
    exit(1);
}

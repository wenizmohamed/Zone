<?php
declare(strict_types=1);

// Read-only schema export. No database, engine instance or fixture file writes.
// Regenerate the committed JSON from this stdout, never by hand-editing fields.
require dirname(__DIR__) . '/engine/bootstrap.php';

$inputs = ['engine/src/Core/Content/GameplayDefinitionValidator.php', 'engine/data/gameplay-catalog.json', 'scripts/export-studio-schema114.php'];
$hashes = [];
foreach ($inputs as $path) {
    $source = file_get_contents(ZONE_REPOSITORY_ROOT . '/' . $path);
    if ($source === false) throw new RuntimeException('Missing Studio schema input: ' . $path);
    // These are ordinary source/data files with LF checkout rules, not any
    // byte-protected map, model, image or historical asset receipt.
    $hashes[$path] = hash('sha256', str_replace("\r\n", "\n", $source));
}
echo json_encode([
    'schemaVersion' => 1,
    'generatedBy' => 'scripts/export-studio-schema114.php',
    'sourceNormalization' => 'CRLF-to-LF for ordinary source/data only',
    'sourceSha256' => $hashes,
    'schema' => \Zone\Engine\Core\Content\GameplayDefinitionValidator::schema(),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL;

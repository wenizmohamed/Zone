<?php

declare(strict_types=1);

$rewrittenPath = $_GET['__zone_path'] ?? null;
if (is_string($rewrittenPath) && str_starts_with($rewrittenPath, '/')) {
    $_SERVER['REQUEST_URI'] = $rewrittenPath;
    unset($_GET['__zone_path']);
}

if (getenv('VERCEL') === '1' && !getenv('ZONE_DATABASE_URL')) {
    $databaseUrl = getenv('DATABASE_URL') ?: getenv('POSTGRES_URL') ?: '';
    if ($databaseUrl !== '') {
        putenv('ZONE_DATABASE_URL=' . $databaseUrl);
    }
}

require dirname(__DIR__) . '/engine/router.php';

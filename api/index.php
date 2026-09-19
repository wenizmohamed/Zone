<?php

declare(strict_types=1);

$rewrittenPath = $_GET['__zone_path'] ?? null;
if (is_string($rewrittenPath) && str_starts_with($rewrittenPath, '/')) {
    $_SERVER['REQUEST_URI'] = $rewrittenPath;
    unset($_GET['__zone_path']);
}

if (getenv('VERCEL') === '1') {
    if (!getenv('ZONE_DATABASE_URL')) {
        $deployment = preg_replace('/[^a-zA-Z0-9_-]/', '', getenv('VERCEL_GIT_COMMIT_SHA') ?: 'presentation');
        putenv('ZONE_DATABASE_URL=sqlite:/tmp/zone-engine-' . $deployment . '.sqlite');
        putenv('ZONE_PRESENTATION_MODE=1');
    }
    if (!getenv('ZONE_ADMIN_TOKEN')) {
        putenv('ZONE_DEMO_MODE=1');
    }
}

require dirname(__DIR__) . '/engine/router.php';

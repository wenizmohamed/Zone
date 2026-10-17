<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Media;

use InvalidArgumentException;
use RuntimeException;

/** Validate container bytes and dependencies before any model parser is started. */
final class AssetInspector
{
    public const EXTENSIONS = ['glb', 'gltf', 'fbx', 'obj', 'zip', 'png', 'webp', 'jpg', 'jpeg', 'mp3'];

    public static function mime(string $name): string
    {
        return match (strtolower(pathinfo($name, PATHINFO_EXTENSION))) {
            'glb' => 'model/gltf-binary', 'gltf' => 'model/gltf+json', 'obj' => 'text/plain', 'mtl' => 'text/plain',
            'png' => 'image/png', 'jpg', 'jpeg' => 'image/jpeg', 'webp' => 'image/webp', 'mp3' => 'audio/mpeg',
            'json' => 'application/json', 'txt' => 'text/plain', 'zip' => 'application/zip', default => 'application/octet-stream',
        };
    }

    /** @param list<array{name:string,size:int,mime:string}> $members */
    public static function inspect(string $directory, string $entry, array $members): array
    {
        $format = strtolower(pathinfo($entry, PATHINFO_EXTENSION));
        $path = $directory . '/' . $entry;
        $kind = in_array($format, ['glb', 'gltf', 'fbx', 'obj'], true) ? 'model' : ($format === 'mp3' ? 'audio' : 'image');
        if ($kind === 'image') {
            $image = @getimagesize($path);
            $expected = self::mime($entry);
            if ($image === false || ($image['mime'] ?? '') !== $expected || $image[0] < 1 || $image[1] < 1 || $image[0] > 16384 || $image[1] > 16384 || $image[0] * $image[1] > 67108864) {
                throw new InvalidArgumentException('Image is invalid or exceeds 16,384 pixels per side / 64 megapixels.');
            }
            $handle = fopen($path, 'rb'); $first = fread($handle, 12); $size = filesize($path); fclose($handle);
            if ($format === 'webp' && (substr($first, 0, 4) !== 'RIFF' || substr($first, 8, 4) !== 'WEBP' || unpack('V', substr($first, 4, 4))[1] + 8 !== $size)) throw new InvalidArgumentException('WebP container length is invalid.');
            if ($format === 'png') self::pngIntegrity($path, $image[0], $image[1]);
            if (in_array($format, ['jpg','jpeg'], true)) {
                $handle = fopen($path, 'rb'); $start = fread($handle, 2); fseek($handle, -2, SEEK_END); $end = fread($handle, 2); fclose($handle);
                if ($start !== "\xff\xd8" || $end !== "\xff\xd9") throw new InvalidArgumentException('JPEG is missing its complete image boundary markers.');
            }
            return ['kind' => $kind, 'format' => $format, 'metadata' => ['width' => $image[0], 'height' => $image[1], 'mime' => $expected, 'warnings' => [], 'thumbnail' => null, 'thumbnailKind' => 'source-image']];
        }
        if ($kind === 'audio') {
            return ['kind' => $kind, 'format' => $format, 'metadata' => self::audio($path)];
        }
        if ($format === 'gltf') self::validateGltf(self::jsonFile($path), $entry, $members);
        if ($format === 'glb') self::validateGlb($path, $entry, $members);
        if ($format === 'obj') {
            $handle = fopen($path, 'rb'); $vertices = 0; $lines = 0;
            try {
                while (($line = fgets($handle, 65537)) !== false) {
                    if (++$lines > 4000000 || strlen($line) > 65536) throw new InvalidArgumentException('OBJ line or record budget is exceeded.');
                    if (preg_match('/^\s*v\s+/', $line)) $vertices++;
                    if (preg_match('/^\s*mtllib\s+(.+)$/', trim($line), $match)) self::dependency(trim($match[1]), $entry, $members);
                }
            } finally { fclose($handle); }
            if ($vertices < 3 || $vertices > 3000000) throw new InvalidArgumentException('OBJ needs 3 to 3,000,000 vertices.');
            foreach ($members as $member) if (strtolower(pathinfo($member['name'], PATHINFO_EXTENSION)) === 'mtl') {
                $material = file_get_contents($directory . '/' . $member['name']);
                if ($material === false || strlen($material) > 2097152) throw new InvalidArgumentException('MTL material file is too large.');
                foreach (preg_split('/\R/', $material) as $line) {
                    if (preg_match('/^\s*(?:map_[a-z]+|bump|disp|decal|norm)\s+(.+)$/i', $line, $match)) {
                        $reference = trim($match[1]);
                        // Option-bearing MTL textures are loaded only when the final path is an exact member.
                        if (str_starts_with($reference, '-')) {
                            $parts = preg_split('/\s+/', $reference); $reference = (string) end($parts);
                        }
                        self::dependency($reference, $member['name'], $members);
                    }
                }
            }
        }
        if ($format === 'fbx') {
            $handle = fopen($path, 'rb'); $prefix = fread($handle, 65536); fclose($handle);
            if (!str_starts_with($prefix, "Kaydara FBX Binary  \0\x1a\0") && !str_contains($prefix, 'FBXHeaderExtension')) throw new InvalidArgumentException('FBX signature is invalid.');
        }
        $metadata = self::node($directory, $entry, $format);
        return ['kind' => 'model', 'format' => $format, 'metadata' => $metadata];
    }

    /** @param list<array{name:string,size:int,mime:string}> $members */
    public static function chooseEntry(array $members): string
    {
        $candidates = array_values(array_filter($members, static fn (array $m): bool => in_array(strtolower(pathinfo($m['name'], PATHINFO_EXTENSION)), self::EXTENSIONS, true) && !str_ends_with(strtolower($m['name']), '.zip')));
        $priority = ['glb' => 0, 'gltf' => 1, 'fbx' => 2, 'obj' => 3, 'png' => 4, 'jpg' => 5, 'jpeg' => 5, 'webp' => 6, 'mp3' => 7];
        usort($candidates, static fn (array $a, array $b): int => [$priority[strtolower(pathinfo($a['name'], PATHINFO_EXTENSION))], substr_count($a['name'], '/'), strlen($a['name']), $a['name']] <=> [$priority[strtolower(pathinfo($b['name'], PATHINFO_EXTENSION))], substr_count($b['name'], '/'), strlen($b['name']), $b['name']]);
        if ($candidates === []) throw new InvalidArgumentException('Bundle has no supported model, image or audio entry.');
        return $candidates[0]['name'];
    }

    private static function validateGlb(string $path, string $entry, array $members): void
    {
        $handle = fopen($path, 'rb');
        try {
            $header = fread($handle, 12);
            if (strlen($header) !== 12 || substr($header, 0, 4) !== 'glTF') throw new InvalidArgumentException('GLB header is invalid.');
            $info = unpack('Vversion/Vlength', substr($header, 4));
            if ($info['version'] !== 2 || $info['length'] !== filesize($path)) throw new InvalidArgumentException('Only complete GLB version 2 files are supported.');
            $json = null; $first = true; $binaryBytes = 0;
            while (ftell($handle) < $info['length']) {
                $chunk = fread($handle, 8);
                if (strlen($chunk) !== 8) throw new InvalidArgumentException('GLB chunk is truncated.');
                $part = unpack('Vlength/Vtype', $chunk);
                if ($part['length'] % 4 !== 0 || ftell($handle) + $part['length'] > $info['length']) throw new InvalidArgumentException('GLB chunk bounds are invalid.');
                if ($first && $part['type'] !== 0x4e4f534a) throw new InvalidArgumentException('GLB must begin with JSON.');
                if ($part['type'] === 0x4e4f534a) {
                    if ($json !== null || $part['length'] > 8388608) throw new InvalidArgumentException('GLB JSON is duplicated or oversized.');
                    $json = json_decode(fread($handle, $part['length']), true, 128, JSON_THROW_ON_ERROR);
                } else { $binaryBytes += $part['type'] === 0x004e4942 ? $part['length'] : 0; fseek($handle, $part['length'], SEEK_CUR); }
                $first = false;
            }
            if (!is_array($json)) throw new InvalidArgumentException('GLB scene description is missing.');
            self::validateGltf($json, $entry, $members, $binaryBytes);
        } finally { fclose($handle); }
    }

    private static function validateGltf(array $json, string $entry, array $members, ?int $binaryBytes = null): void
    {
        if (($json['asset']['version'] ?? null) !== '2.0') throw new InvalidArgumentException('Only glTF 2.0 models are supported.');
        foreach ($json['extensionsRequired'] ?? [] as $extension) if (in_array($extension, ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'], true)) {
            throw new InvalidArgumentException('Compressed glTF needs an uncompressed GLB/glTF export before upload: ' . $extension);
        }
        foreach ($json['buffers'] ?? [] as $index => $buffer) {
            $length = $buffer['byteLength'] ?? null;
            if (!is_int($length) || $length < 0 || $length > SafeBundle::MAX_EXPANDED_BYTES) throw new InvalidArgumentException('glTF buffer size is invalid.');
            if (isset($buffer['uri'])) self::dependency($buffer['uri'], $entry, $members);
            elseif ($binaryBytes === null || $index !== 0 || $length > $binaryBytes) throw new InvalidArgumentException('glTF buffer data is missing. Upload its bundle or a self-contained GLB.');
        }
        foreach ($json['images'] ?? [] as $image) if (isset($image['uri'])) self::dependency($image['uri'], $entry, $members);
        if (count($json['nodes'] ?? []) > 50000 || count($json['meshes'] ?? []) > 20000 || count($json['accessors'] ?? []) > 100000) throw new InvalidArgumentException('glTF scene exceeds the interactive model budget.');
    }

    private static function dependency(mixed $reference, string $entry, array $members): void
    {
        if (!is_string($reference) || $reference === '') throw new InvalidArgumentException('Model resource reference is invalid.');
        if (str_starts_with($reference, 'data:')) {
            if (!preg_match('~^data:(?:application/(?:octet-stream|gltf-buffer)|image/(?:png|jpeg|webp));base64,[a-zA-Z0-9+/=\r\n]+$~D', $reference)) throw new InvalidArgumentException('Model data URI is not a supported binary/image payload.');
            return;
        }
        $resolved = SafeBundle::resolve($reference, $entry);
        foreach ($members as $member) if ($member['name'] === $resolved) return;
        throw new InvalidArgumentException('Model resource is missing from its ZIP bundle: ' . substr($reference, 0, 120));
    }

    private static function jsonFile(string $path): array
    {
        if (filesize($path) > 8388608) throw new InvalidArgumentException('glTF JSON exceeds 8 MiB; use a GLB binary export.');
        $json = json_decode((string) file_get_contents($path), true, 128, JSON_THROW_ON_ERROR);
        if (!is_array($json)) throw new InvalidArgumentException('glTF JSON must be an object.');
        return $json;
    }

    private static function audio(string $path): array
    {
        $handle = fopen($path, 'rb'); $head = fread($handle, 10); $size = filesize($path); $offset = 0;
        try {
            if (str_starts_with($head, 'ID3')) {
                if (strlen($head) !== 10 || ord($head[3]) < 2 || ord($head[3]) > 4) throw new InvalidArgumentException('MP3 ID3 version is invalid.');
                for ($i = 6; $i < 10; $i++) { if (ord($head[$i]) > 127) throw new InvalidArgumentException('MP3 tag size is invalid.'); $offset = ($offset << 7) | ord($head[$i]); }
                $offset += 10 + ((ord($head[5]) & 0x10) !== 0 ? 10 : 0);
            }
            if ($offset > min($size - 4, 16777216)) throw new InvalidArgumentException('MP3 contains no bounded audio data.');
            fseek($handle, $offset); $header = fread($handle, 65536); $found = null;
            for ($i = 0; $i + 4 < strlen($header); $i++) {
                $frame = self::mp3Frame(substr($header, $i, 4));
                if ($frame === null || $offset + $i + $frame['bytes'] + 4 > $size) continue;
                fseek($handle, $offset + $i + $frame['bytes']);
                if (self::mp3Frame(fread($handle, 4)) !== null) { $found = $offset + $i; break; }
            }
            if ($found === null) throw new InvalidArgumentException('MP3 needs at least two complete consecutive MPEG Layer III frames.');
            $frames = 0; $duration = 0.0; $at = $found;
            while ($at + 4 <= $size) {
                fseek($handle, $at); $frame = self::mp3Frame(fread($handle, 4));
                if ($frame === null) break;
                if ($at + $frame['bytes'] > $size) throw new InvalidArgumentException('MP3 audio ends in a truncated frame.');
                $at += $frame['bytes']; $duration += $frame['samples'] / $frame['sampleRate'];
                if (++$frames > 1000000) throw new InvalidArgumentException('MP3 frame budget is exceeded.');
            }
            return ['mime' => 'audio/mpeg', 'bytes' => $size, 'frames' => $frames, 'durationEstimateSeconds' => round($duration, 4), 'warnings' => ['Audio frame boundaries are validated; encoder padding and loudness are not normalized. Original bytes are retained.'], 'thumbnail' => null];
        } finally { fclose($handle); }
    }

    private static function mp3Frame(string $header): ?array
    {
        if (strlen($header) !== 4) return null;
        $a = ord($header[0]); $b = ord($header[1]); $c = ord($header[2]);
        $version = ($b >> 3) & 3; $layer = ($b >> 1) & 3; $bitrate = ($c >> 4) & 15; $sample = ($c >> 2) & 3;
        if ($a !== 255 || ($b & 0xe0) !== 0xe0 || $version === 1 || $layer !== 1 || $bitrate === 0 || $bitrate === 15 || $sample === 3) return null;
        $rates = $version === 3 ? [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320] : [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160];
        $sampleRate = (int) ([44100,48000,32000][$sample] / ($version === 3 ? 1 : ($version === 2 ? 2 : 4)));
        $bytes = (int) floor(($version === 3 ? 144000 : 72000) * $rates[$bitrate] / $sampleRate) + (($c >> 1) & 1);
        return ['bytes' => $bytes, 'sampleRate' => $sampleRate, 'samples' => $version === 3 ? 1152 : 576];
    }

    /** Validate PNG structure/CRC and bounded pixel stream, without loading a bitmap into PHP memory. */
    private static function pngIntegrity(string $path, int $width, int $height): void
    {
        $handle = fopen($path, 'rb'); $size = filesize($path); $inflater = null; $decoded = 0; $expected = null; $headerSeen = false; $dataSeen = false; $ended = false;
        try {
            if (fread($handle, 8) !== "\x89PNG\r\n\x1a\n") throw new InvalidArgumentException('PNG signature is invalid.');
            while (ftell($handle) < $size) {
                $head = fread($handle, 8);
                if (strlen($head) !== 8) throw new InvalidArgumentException('PNG chunk is truncated.');
                $length = unpack('N', substr($head, 0, 4))[1]; $type = substr($head, 4, 4);
                if (!preg_match('/^[a-zA-Z]{4}$/D', $type) || ftell($handle) + $length + 4 > $size) throw new InvalidArgumentException('PNG chunk bounds are invalid.');
                if (!$headerSeen && $type !== 'IHDR') throw new InvalidArgumentException('PNG must begin with its image header.');
                $hash = hash_init('crc32b'); hash_update($hash, $type); $remaining = $length; $small = '';
                if ($type === 'IHDR' && ($headerSeen || $length !== 13)) throw new InvalidArgumentException('PNG image header is duplicated or invalid.');
                if ($type === 'IDAT' && $inflater === null) $inflater = inflate_init(ZLIB_ENCODING_DEFLATE);
                while ($remaining > 0) {
                    $bytes = fread($handle, min(4096, $remaining));
                    if ($bytes === false || $bytes === '') throw new InvalidArgumentException('PNG chunk data is truncated.');
                    $remaining -= strlen($bytes); hash_update($hash, $bytes);
                    if ($type === 'IHDR') $small .= $bytes;
                    if ($type === 'IDAT') {
                        $pixels = @inflate_add($inflater, $bytes, ZLIB_SYNC_FLUSH);
                        if ($pixels === false) throw new InvalidArgumentException('PNG pixel stream is invalid.');
                        $decoded += strlen($pixels);
                        if ($expected === null || $decoded > $expected) throw new InvalidArgumentException('PNG pixel stream exceeds its declared dimensions.');
                        $dataSeen = true;
                    }
                }
                $crc = fread($handle, 4);
                if (strlen($crc) !== 4 || bin2hex($crc) !== hash_final($hash)) throw new InvalidArgumentException('PNG chunk integrity check failed.');
                if ($type === 'IHDR') {
                    $info = unpack('Nwidth/Nheight/Cdepth/Ccolor/Ccompression/Cfilter/Cinterlace', $small);
                    $channels = [0 => 1, 2 => 3, 3 => 1, 4 => 2, 6 => 4][$info['color']] ?? 0;
                    if (!$channels || $info['width'] !== $width || $info['height'] !== $height || !in_array($info['depth'], [1,2,4,8,16], true) || $info['compression'] !== 0 || $info['filter'] !== 0 || $info['interlace'] > 1) throw new InvalidArgumentException('PNG pixel encoding is unsupported.');
                    $expected = 0;
                    $passes = $info['interlace'] === 0 ? [[0,0,1,1]] : [[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]];
                    foreach ($passes as [$x,$y,$dx,$dy]) {
                        $columns = max(0, (int) ceil(($width - $x) / $dx)); $rows = max(0, (int) ceil(($height - $y) / $dy));
                        if ($columns > 0) $expected += ((int) ceil($columns * $channels * $info['depth'] / 8) + 1) * $rows;
                    }
                    $headerSeen = true;
                }
                if ($type === 'IEND') {
                    if ($length !== 0 || !$dataSeen || $decoded !== $expected || inflate_get_status($inflater) !== ZLIB_STREAM_END || ftell($handle) !== $size) throw new InvalidArgumentException('PNG is incomplete or has an invalid final image boundary.');
                    $ended = true; break;
                }
            }
            if (!$ended) throw new InvalidArgumentException('PNG final image boundary is missing.');
        } finally { fclose($handle); }
    }

    private static function node(string $directory, string $entry, string $format): array
    {
        $node = getenv('ZONE_NODE_BINARY') ?: 'node';
        $process = proc_open([$node, '--max-old-space-size=384', ZONE_ENGINE_ROOT . '/bin/inspect-asset.mjs', $directory, $entry, $format], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, ZONE_REPOSITORY_ROOT, null, ['bypass_shell' => true]);
        if (!is_resource($process)) throw new RuntimeException('Model inspection needs the configured Node.js runtime.');
        fclose($pipes[0]); stream_set_blocking($pipes[1], false); stream_set_blocking($pipes[2], false);
        $out = ''; $error = ''; $started = microtime(true); $exit = null;
        try {
            do {
                $out .= stream_get_contents($pipes[1]); $error .= stream_get_contents($pipes[2]);
                if (strlen($out) > 1048576 || strlen($error) > 131072) throw new InvalidArgumentException('Model inspector exceeded its output budget.');
                $status = proc_get_status($process);
                if (!$status['running']) { $exit = $status['exitcode']; break; }
                if (microtime(true) - $started > 60) throw new InvalidArgumentException('Model inspection exceeded 60 seconds. Reduce the scene complexity.');
                usleep(20000);
            } while (true);
            $out .= stream_get_contents($pipes[1]); $error .= stream_get_contents($pipes[2]);
        } finally {
            if (proc_get_status($process)['running']) proc_terminate($process);
            fclose($pipes[1]); fclose($pipes[2]); proc_close($process);
        }
        if ($exit !== 0) {
            $message = json_decode($out, true);
            throw new InvalidArgumentException('Model inspection rejected the asset: ' . substr((string) ($message['error'] ?? 'geometry could not be read safely'), 0, 300));
        }
        $metadata = json_decode($out, true, 64, JSON_THROW_ON_ERROR);
        if (!is_array($metadata) || !isset($metadata['bounds']['size']) || !is_array($metadata['bounds']['size'])) throw new RuntimeException('Model inspector did not return actual geometry bounds.');
        return $metadata;
    }
}

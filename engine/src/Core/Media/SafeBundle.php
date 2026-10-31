<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Media;

use InvalidArgumentException;
use RuntimeException;

/** Bounded ZIP reader. Does not depend on ext-zip and never invokes a shell. */
final class SafeBundle
{
    public const MAX_EXPANDED_BYTES = 125829120;
    public const MAX_MEMBERS = 256;
    private const EXTENSIONS = ['glb', 'gltf', 'fbx', 'obj', 'mtl', 'bin', 'png', 'jpg', 'jpeg', 'webp', 'mp3', 'txt', 'json'];

    public static function member(string $name): string
    {
        if ($name === '' || strlen($name) > 500 || !mbSafeUtf8($name) || preg_match('/[\x00-\x1f\x7f\\\\:%?#<>"|]/', $name)
            || str_starts_with($name, '/') || str_ends_with($name, '.') || str_ends_with($name, ' ')) {
            throw new InvalidArgumentException('Bundle contains an unsafe file name.');
        }
        foreach (explode('/', rtrim($name, '/')) as $part) {
            if ($part === '' || $part === '.' || $part === '..' || str_ends_with($part, '.') || str_ends_with($part, ' ')
                || preg_match('/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i', $part)) {
                throw new InvalidArgumentException('Bundle contains an unsafe path component.');
            }
        }
        return $name;
    }

    public static function resolve(string $reference, string $entry): string
    {
        $reference = rawurldecode($reference);
        if ($reference === '' || str_starts_with($reference, '/') || preg_match('/[\\\\\x00-\x1f:%?#<>"|]/', $reference)) throw new InvalidArgumentException('Model resource reference is unsafe.');
        $parts = dirname($entry) === '.' ? [] : explode('/', dirname($entry));
        foreach (explode('/', $reference) as $part) {
            if ($part === '' || $part === '.') continue;
            if ($part === '..') { if ($parts === []) throw new InvalidArgumentException('Model resource leaves its ZIP bundle.'); array_pop($parts); }
            else $parts[] = $part;
        }
        return self::member(implode('/', $parts));
    }

    /** @return list<array{name:string,size:int,mime:string}> */
    public static function extract(string $source, string $destination): array
    {
        $stream = fopen($source, 'rb');
        if ($stream === false) throw new RuntimeException('Bundle file cannot be opened.');
        $size = filesize($source);
        try {
            if ($size === false || $size < 22) throw new InvalidArgumentException('ZIP is truncated.');
            fseek($stream, max(0, $size - 65557));
            $tail = stream_get_contents($stream);
            $end = $tail === false ? false : strrpos($tail, "PK\x05\x06");
            if ($end === false || strlen($tail) < $end + 22) throw new InvalidArgumentException('ZIP directory is missing.');
            $directory = unpack('vdisk/vstart/ventriesDisk/ventries/Vlength/Voffset/vcomment', substr($tail, $end + 4, 18));
            if ($directory === false || $directory['disk'] !== 0 || $directory['start'] !== 0 || $directory['entriesDisk'] !== $directory['entries']
                || $directory['entries'] < 1 || $directory['entries'] > self::MAX_MEMBERS || $directory['entries'] === 65535
                || $directory['offset'] + $directory['length'] > $size - 22 || $end + 22 + $directory['comment'] !== strlen($tail)) {
                throw new InvalidArgumentException('ZIP must be a single bounded archive, without ZIP64 or trailing data.');
            }
            fseek($stream, $directory['offset']);
            $centralEnd = $directory['offset'] + $directory['length'];
            $entries = []; $seen = []; $expanded = 0;
            for ($i = 0; $i < $directory['entries']; $i++) {
                $header = self::read($stream, 46);
                if (substr($header, 0, 4) !== "PK\x01\x02") throw new InvalidArgumentException('ZIP directory record is invalid.');
                $field = unpack('vmade/vneeded/vflags/vmethod/vtime/vdate/Vcrc/Vcompressed/Vexpanded/vname/vextra/vcomment/vdisk/vinternal/Vattributes/Voffset', substr($header, 4));
                if ($field === false || $field['name'] < 1 || $field['disk'] !== 0 || ($field['flags'] & 0x2041) !== 0
                    || !in_array($field['method'], [0, 8], true) || $field['compressed'] === 0xffffffff || $field['expanded'] === 0xffffffff
                    || $field['offset'] >= $directory['offset'] || $field['expanded'] > self::MAX_EXPANDED_BYTES) {
                    throw new InvalidArgumentException('ZIP uses encryption, unsupported compression, ZIP64, or excessive member sizes.');
                }
                $name = self::member(self::read($stream, $field['name']));
                self::read($stream, $field['extra'] + $field['comment']);
                if (ftell($stream) > $centralEnd) throw new InvalidArgumentException('ZIP directory exceeds declared bounds.');
                $identity = strtolower($name);
                if (isset($seen[$identity])) throw new InvalidArgumentException('ZIP has duplicate or case-ambiguous paths.');
                $seen[$identity] = true;
                $unixMode = ($field['attributes'] >> 16) & 0170000;
                if ($unixMode !== 0 && $unixMode !== 0100000 && $unixMode !== 0040000) throw new InvalidArgumentException('Links and special files are not permitted in model bundles.');
                if (str_ends_with($name, '/')) {
                    if ($field['expanded'] !== 0) throw new InvalidArgumentException('ZIP directory has data.');
                    continue;
                }
                if ($unixMode === 0040000 || !in_array(strtolower(pathinfo($name, PATHINFO_EXTENSION)), self::EXTENSIONS, true)) {
                    throw new InvalidArgumentException('Model bundle contains an unsupported member type.');
                }
                $expanded += $field['expanded'];
                if ($expanded > self::MAX_EXPANDED_BYTES || $field['expanded'] > max(1048576, $field['compressed'] * 150)) {
                    throw new InvalidArgumentException('ZIP expansion exceeds the safe bundle budget.');
                }
                $entries[] = [...$field, 'name' => $name];
            }
            if (ftell($stream) !== $centralEnd || $entries === []) throw new InvalidArgumentException('ZIP directory size does not match its members.');
            $ranges = []; $members = [];
            foreach ($entries as $entry) {
                fseek($stream, $entry['offset']);
                $local = self::read($stream, 30);
                $localFields = unpack('vneeded/vflags/vmethod/vtime/vdate/Vcrc/Vcompressed/Vexpanded/vname/vextra', substr($local, 4));
                if (substr($local, 0, 4) !== "PK\x03\x04" || $localFields === false || $localFields['flags'] !== $entry['flags'] || $localFields['method'] !== $entry['method']
                    || self::read($stream, $localFields['name']) !== $entry['name']) {
                    throw new InvalidArgumentException('ZIP member header does not match its directory.');
                }
                self::read($stream, $localFields['extra']);
                $start = ftell($stream); $end = $start + $entry['compressed'];
                if ($end > $directory['offset']) throw new InvalidArgumentException('ZIP member data exceeds the archive area.');
                foreach ($ranges as [$a, $b]) if ($entry['offset'] < $b && $end > $a) throw new InvalidArgumentException('ZIP members overlap.');
                $ranges[] = [$entry['offset'], $end];
                $target = $destination . '/' . $entry['name'];
                self::directory(dirname($target));
                if (is_link($target) || file_exists($target)) throw new InvalidArgumentException('Bundle destination already contains this member.');
                $output = fopen($target, 'xb');
                if ($output === false) throw new RuntimeException('Bundle member cannot be stored.');
                $hash = hash_init('crc32b'); $written = 0; $remaining = $entry['compressed'];
                $inflate = $entry['method'] === 8 ? inflate_init(ZLIB_ENCODING_RAW) : null;
                if ($entry['method'] === 8 && $inflate === false) throw new RuntimeException('ZIP inflation is unavailable.');
                try {
                    while ($remaining > 0) {
                        $chunk = self::read($stream, min(4096, $remaining)); $remaining -= strlen($chunk);
                        $bytes = $inflate !== null ? @inflate_add($inflate, $chunk, $remaining === 0 ? ZLIB_FINISH : ZLIB_SYNC_FLUSH) : $chunk;
                        if ($bytes === false) throw new InvalidArgumentException('ZIP deflate stream is invalid.');
                        $written += strlen($bytes);
                        if ($written > $entry['expanded'] || $written > self::MAX_EXPANDED_BYTES) throw new InvalidArgumentException('ZIP member expands beyond its declared size.');
                        hash_update($hash, $bytes);
                        self::write($output, $bytes);
                    }
                    if ($written !== $entry['expanded'] || strtolower(hash_final($hash)) !== sprintf('%08x', $entry['crc'])
                        || ($inflate !== null && (inflate_get_status($inflate) !== ZLIB_STREAM_END || inflate_get_read_len($inflate) !== $entry['compressed']))) {
                        throw new InvalidArgumentException('ZIP member integrity check failed.');
                    }
                } finally { fclose($output); }
                $members[] = ['name' => $entry['name'], 'size' => $written, 'mime' => AssetInspector::mime($entry['name'])];
            }
            return $members;
        } finally { fclose($stream); }
    }

    public static function directory(string $path): void
    {
        if (is_link($path)) throw new RuntimeException('Asset storage cannot use symbolic links.');
        if (!is_dir($path) && !mkdir($path, 0770, true) && !is_dir($path)) throw new RuntimeException('Asset directory cannot be created.');
    }

    private static function read(mixed $stream, int $length): string
    {
        if ($length === 0) return '';
        $bytes = fread($stream, $length);
        if ($bytes === false || strlen($bytes) !== $length) throw new InvalidArgumentException('ZIP is truncated.');
        return $bytes;
    }

    private static function write(mixed $stream, string $bytes): void
    {
        $offset = 0;
        while ($offset < strlen($bytes)) {
            $count = fwrite($stream, substr($bytes, $offset));
            if ($count === false || $count === 0) throw new RuntimeException('Asset storage is full or unavailable.');
            $offset += $count;
        }
    }

    public static function limits(): array
    {
        return [
            'maxExpandedBytes' => self::MAX_EXPANDED_BYTES,
            'maxMembers' => self::MAX_MEMBERS,
            'extensions' => self::EXTENSIONS,
        ];
    }
}

/** ext-mbstring is optional in the PC PHP runtime. */
function mbSafeUtf8(string $value): bool { return preg_match('//u', $value) === 1; }

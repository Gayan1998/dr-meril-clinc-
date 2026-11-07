<?php
/**
 * Generates PWA PNG icons (no external tooling required).
 * Run: php frontend/scripts/generate-icons.php
 */

declare(strict_types=1);

$outDir = __DIR__ . '/../public/icons';
if (!is_dir($outDir)) {
    mkdir($outDir, 0777, true);
}

/** Brand teal from the design system. */
function brand(int $shade): array
{
    return [
        600 => [13, 148, 136],
        700 => [15, 118, 110],
    ][$shade];
}

function make_icon(string $path, int $size, bool $fullBleed): void
{
    $img = imagecreatetruecolor($size, $size);
    imagesavealpha($img, true);
    imageantialias($img, true);

    [$r, $g, $b] = brand(700);
    $bg = imagecolorallocate($img, $r, $g, $b);
    $white = imagecolorallocate($img, 255, 255, 255);

    if ($fullBleed) {
        imagefilledrectangle($img, 0, 0, $size, $size, $bg);
    } else {
        // rounded square
        imagealphablending($img, false);
        imagesavealpha($img, true);
        $transparent = imagecolorallocatealpha($img, 0, 0, 0, 127);
        imagefilledrectangle($img, 0, 0, $size, $size, $transparent);
        imagealphablending($img, true);

        $radius = (int) ($size * 0.22);
        imagefilledrectangle($img, $radius, 0, $size - $radius, $size, $bg);
        imagefilledrectangle($img, 0, $radius, $size, $size - $radius, $bg);
        foreach ([[0, 0], [$size - 2 * $radius, 0], [0, $size - 2 * $radius], [$size - 2 * $radius, $size - 2 * $radius]] as [$x, $y]) {
            imagefilledellipse($img, $x + $radius, $y + $radius, 2 * $radius, 2 * $radius, $bg);
        }
    }

    // medical cross mark, centered with padding
    $pad = (int) ($size * 0.30);
    $arm = (int) ($size * 0.11);
    $center = (int) ($size / 2);
    imagefilledrectangle($img, $pad, $center - $arm, $size - $pad, $center + $arm, $white);
    imagefilledrectangle($img, $center - $arm, $pad, $center + $arm, $size - $pad, $white);

    imagepng($img, $path);
    imagedestroy($img);
    echo "wrote " . basename($path) . " ({$size}px)\n";
}

make_icon($outDir . '/icon-192.png', 192, false);
make_icon($outDir . '/icon-512.png', 512, false);
make_icon($outDir . '/maskable-512.png', 512, true);
make_icon($outDir . '/apple-touch-icon.png', 180, false);

// simple SVG favicon (crisp at any size)
$svg = <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Clinic">
  <rect width="64" height="64" rx="14" fill="#0f766e"/>
  <rect x="27" y="15" width="10" height="34" rx="2" fill="#ffffff"/>
  <rect x="15" y="27" width="34" height="10" rx="2" fill="#ffffff"/>
</svg>
SVG;
file_put_contents(__DIR__ . '/../public/favicon.svg', $svg);
echo "wrote favicon.svg\n";

from pathlib import Path
from PIL import Image

ROOT = Path("public/mira-assets")
TARGETS = [
    (ROOT / "scenes", 88),
    (ROOT / "expressions", 86),
]

def convert_folder(folder: Path, quality: int) -> tuple[int, int, int]:
    source_bytes = 0
    output_bytes = 0
    converted = 0
    for source in sorted(folder.glob("*.png")):
        target = source.with_suffix(".webp")
        with Image.open(source) as image:
            image.load()
            source_bytes += source.stat().st_size
            save_args = {
                "format": "WEBP",
                "quality": quality,
                "method": 6,
            }
            if image.mode in ("RGBA", "LA") or ("transparency" in image.info):
                image = image.convert("RGBA")
                save_args["exact"] = True
            else:
                image = image.convert("RGB")
            image.save(target, **save_args)
        output_bytes += target.stat().st_size
        converted += 1
        print(f"{source} -> {target} · {target.stat().st_size / 1024:.1f} KiB")
    return converted, source_bytes, output_bytes

def main() -> None:
    total_count = 0
    total_source = 0
    total_output = 0
    for folder, quality in TARGETS:
        count, source_bytes, output_bytes = convert_folder(folder, quality)
        total_count += count
        total_source += source_bytes
        total_output += output_bytes

    mib = 1024 * 1024
    ratio = total_output / total_source if total_source else 0
    print(
        f"Converted {total_count} assets: "
        f"{total_source / mib:.2f} MiB PNG -> {total_output / mib:.2f} MiB WebP "
        f"({ratio * 100:.1f}% of source)"
    )

    # Hard safety gate. Keep runtime derivatives small enough to materially
    # improve Pages delivery; PNG source remains untouched in git.
    if total_output > 8 * mib:
        raise SystemExit("Optimized WebP derivatives exceed 8 MiB budget.")

if __name__ == "__main__":
    main()

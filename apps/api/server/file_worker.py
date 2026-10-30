"""Isolated file processing worker. Invoked with a trusted JSON job path, never a shell command."""
import argparse
import bz2
import csv
import gzip
import html
import io
import json
import lzma
import os
import re
import shutil
import signal
import subprocess
import sys
import tarfile
import tempfile
import time
import warnings
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TOOLS_ROOT = Path(os.environ.get("FILE_TOOLS_RUNTIME_ROOT", ROOT / ".file-tools")).resolve()
MAX_OUTPUT = 200 * 1024 * 1024
MAX_EXPANDED = 250 * 1024 * 1024
PRESETS = {"small": (55, 36, "720"), "balanced": (76, 28, "1080"), "quality": (90, 22, "original")}
ACTIVE_JOB_DIRECTORY = None


class FileError(Exception):
    pass


def kill_native_tree(child):
    import psutil
    try:
        parent = psutil.Process(child.pid)
        descendants = parent.children(recursive=True)
        for process in reversed(descendants):
            try: process.kill()
            except psutil.Error: pass
        try: parent.kill()
        except psutil.Error: pass
        psutil.wait_procs([parent, *descendants], timeout=5)
    except psutil.Error:
        pass
    try:
        child.communicate(timeout=5)
    except subprocess.TimeoutExpired:
        child.kill()
        child.communicate(timeout=5)


def office_path():
    configured = os.environ.get("FILE_TOOLS_OFFICE")
    candidates = [configured, shutil.which("libreoffice"), shutil.which("soffice"),
                  str(TOOLS_ROOT / "libreoffice/program/soffice.exe"),
                  str(TOOLS_ROOT / "libreoffice/LibreOffice/program/soffice.exe"),
                  r"C:\Program Files\LibreOffice\program\soffice.exe"]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            resolved = Path(candidate).resolve()
            if os.name == "nt" and resolved.with_suffix(".com").is_file():
                resolved = resolved.with_suffix(".com")
            return str(resolved)
    folder = TOOLS_ROOT / "libreoffice"
    if folder.exists():
        found = next(folder.glob("**/soffice.exe"), None)
        if found:
            return str(found.resolve())
    return None


def capabilities():
    import importlib.util
    return {"image": bool(importlib.util.find_spec("PIL")),
            "pdf": bool(importlib.util.find_spec("pymupdf")),
            "data": bool(importlib.util.find_spec("yaml") and importlib.util.find_spec("openpyxl")),
            "media": bool(importlib.util.find_spec("imageio_ffmpeg")),
            "office": office_path() is not None, "archive": True}


def prepare_office_profile():
    binary = office_path()
    if not binary:
        raise FileError("Engine Office belum tersedia.")
    seed = TOOLS_ROOT / "office-seed"
    seed.mkdir(parents=True, exist_ok=True)
    child = subprocess.Popen([binary, f"-env:UserInstallation={seed.as_uri()}", "--headless", "--nologo",
                              "--nofirststartwizard", "--terminate_after_init"],
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                             creationflags=0x08000000 if os.name == "nt" else 0)
    try:
        child.communicate(timeout=150)
    except subprocess.TimeoutExpired as error:
        kill_native_tree(child)
        raise FileError("Inisialisasi profil Office melewati batas waktu.") from error
    if child.returncode != 0:
        raise FileError("Profil Office belum berhasil diinisialisasi.")
    (seed / "celi-ready").write_text("ready", encoding="utf-8")
    return {"officeProfile": "ready"}


def check_zip(path):
    """Check document containers before handing them to parsers; do not extract."""
    if not zipfile.is_zipfile(path):
        return
    with zipfile.ZipFile(path) as archive:
        entries = archive.infolist()
        if len(entries) > 10000 or sum(item.file_size for item in entries) > MAX_EXPANDED:
            raise FileError("Isi dokumen terlalu besar setelah dibuka.")
        for item in entries:
            if item.flag_bits & 1:
                raise FileError("File dengan kata sandi tidak didukung.")
            if item.filename.endswith(".rels") and item.file_size < 2 * 1024 * 1024:
                rels = archive.read(item)
                if re.search(br'TargetMode\s*=\s*["\']External', rels, re.I):
                    raise FileError("Dokumen memiliki referensi eksternal. Hapus tautan eksternal terlebih dahulu.")


def checked_output(path):
    if not path.is_file() or path.stat().st_size > MAX_OUTPUT:
        raise FileError("Hasil melebihi batas 200 MB atau tidak berhasil dibuat.")
    return path


def white_background(image):
    from PIL import Image
    if image.mode in ("RGBA", "LA") or "transparency" in image.info:
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, "white")
        background.paste(rgba, mask=rgba.getchannel("A"))
        return background
    return image.convert("RGB")


def image_convert(source, output, target, preset, notes):
    from PIL import Image, ImageOps
    if source.suffix.lower() == ".svg":
        import pymupdf
        text = source.read_text(encoding="utf-8-sig")
        if re.search(r"<!DOCTYPE|<!ENTITY|<script|@import", text, re.I):
            raise FileError("SVG dengan script atau referensi eksternal tidak didukung.")
        for href in re.findall(r'(?:href|src)\s*=\s*["\']([^"\']+)', text, re.I):
            if not href.startswith("#") and not re.match(r"data:image/(?:png|jpeg|jpg|webp|gif);base64,", href, re.I):
                raise FileError("SVG hanya mendukung gambar tertanam dan referensi internal.")
        for url in re.findall(r"url\(([^)]+)\)", text, re.I):
            if not url.strip().strip("\"'").startswith("#"):
                raise FileError("SVG dengan URL CSS eksternal tidak didukung.")
        document = pymupdf.open(stream=text.encode("utf-8"), filetype="svg")
        try:
            page = document[0]
            if page.rect.width * page.rect.height > 40_000_000:
                raise FileError("Dimensi SVG terlalu besar.")
            if target == "pdf":
                output.write_bytes(document.convert_to_pdf())
                return
            raster = output.parent / "svg-render.png"
            page.get_pixmap(alpha=True).save(raster)
            source = raster
            notes.append("SVG dirasterisasi untuk output gambar bitmap.")
        finally:
            document.close()
    try:
        import pillow_heif
        pillow_heif.register_heif_opener()
    except ImportError:
        pass
    Image.MAX_IMAGE_PIXELS = 40_000_000
    warnings.simplefilter("error", Image.DecompressionBombWarning)
    quality = PRESETS[preset][0]
    with Image.open(source) as image:
        count = getattr(image, "n_frames", 1)
        if count > 200 or image.width * image.height * count > 80_000_000:
            raise FileError("Gambar terlalu besar atau memiliki terlalu banyak frame (maksimum 80 juta piksel total).")
        preserve = count > 1 and target in ("gif", "webp", "tiff", "pdf")
        if count > 1 and not preserve:
            notes.append("Output gambar memakai frame/halaman pertama.")
        frames, durations = [], []
        for index in range(count if preserve else 1):
            image.seek(index)
            frame = ImageOps.exif_transpose(image.copy())
            durations.append(image.info.get("duration", 100))
            if target in ("jpg", "bmp", "pdf"):
                frame = white_background(frame)
            elif target == "ico":
                frame = frame.convert("RGBA")
                frame.thumbnail((256, 256))
            else:
                frame = frame.convert("RGBA")
            frames.append(frame)
        options = {}
        if target in ("jpg", "webp", "avif"):
            options["quality"] = quality
        if target in ("jpg", "png"):
            options["optimize"] = True
        if target == "tiff":
            options["compression"] = "tiff_deflate"
        if preserve:
            options.update(save_all=True, append_images=frames[1:])
            if target in ("gif", "webp"):
                options.update(duration=durations, loop=image.info.get("loop", 0))
        if target == "pdf":
            options["resolution"] = 150
        formats = {"jpg": "JPEG", "png": "PNG", "webp": "WEBP", "avif": "AVIF", "gif": "GIF",
                   "bmp": "BMP", "tiff": "TIFF", "ico": "ICO", "pdf": "PDF"}
        frames[0].save(output, format=formats[target], **options)
    notes.append("Metadata gambar tidak disertakan dalam hasil.")


def pdf_open(source):
    import pymupdf
    document = pymupdf.open(source)
    if document.needs_pass:
        if not document.is_closed:
            document.close()
        raise FileError("PDF terkunci. Buka proteksi kata sandi sebelum diproses.")
    if document.page_count > 200:
        document.close()
        raise FileError("PDF maksimum 200 halaman.")
    if document.get_sigflags() > 0:
        document.close()
        raise FileError("PDF bertanda tangan digital tidak diproses agar tanda tangan tidak rusak.")
    return document


def pdf_convert(source, output, target, notes):
    document = pdf_open(source)
    try:
        if target == "txt":
            text = "\n\n".join(page.get_text() for page in document)
            output.write_text(text, encoding="utf-8")
            if not text.strip():
                notes.append("PDF tidak memiliki lapisan teks. OCR tidak disediakan.")
        elif target in ("jpg", "png"):
            output = output.with_suffix(".zip")
            with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                total = 0
                for index, page in enumerate(document):
                    if page.rect.width * page.rect.height * 4 > 20_000_000:
                        raise FileError("Ukuran halaman PDF terlalu besar untuk dirender.")
                    pixmap = page.get_pixmap(dpi=120, alpha=False)
                    data = pixmap.tobytes("jpeg" if target == "jpg" else "png")
                    total += len(data)
                    if total > MAX_OUTPUT:
                        raise FileError("Hasil render PDF melebihi 200 MB.")
                    archive.writestr(f"halaman-{index + 1:03d}.{target}", data)
            notes.append("Semua halaman PDF dikemas dalam ZIP.")
        elif target == "docx":
            if document.page_count > 80:
                raise FileError("PDF ke DOCX maksimum 80 halaman.")
            document.close()
            from pdf2docx import Converter
            converter = Converter(str(source))
            try:
                converter.convert(str(output), multi_processing=False)
            finally:
                converter.close()
            notes.append("Layout PDF ke DOCX dapat berubah. Periksa hasil sebelum digunakan.")
        return output
    finally:
        if not document.is_closed:
            document.close()


def pdf_compress(source, output, preset, notes):
    document = pdf_open(source)
    try:
        # Preserve vectors and selectable text; recompress embedded raster images only.
        if hasattr(document, "rewrite_images"):
            quality = PRESETS[preset][0]
            document.rewrite_images(dpi_threshold=160 if preset == "small" else 220,
                                    dpi_target=120 if preset == "small" else 150,
                                    quality=quality)
        document.set_metadata({})
        document.save(output, garbage=4, deflate=True, deflate_images=True, deflate_fonts=True)
        notes.append("Struktur dan gambar PDF dioptimalkan; metadata dihapus. Teks tetap dapat dipilih.")
    finally:
        document.close()


def office_convert(source, folder, target):
    # Office's extension cache creates deep paths. Keep its isolated profile short
    # on Windows, even when the upload/output directory has a long path.
    with tempfile.TemporaryDirectory(prefix="cf-") as profile_directory:
        profile = Path(profile_directory)
        if ACTIVE_JOB_DIRECTORY:
            manifest = ACTIVE_JOB_DIRECTORY / "office-profiles.json"
            profiles = json.loads(manifest.read_text(encoding="utf-8")) if manifest.exists() else []
            profiles.append(str(profile))
            manifest.write_text(json.dumps(profiles), encoding="utf-8")
        seed = TOOLS_ROOT / "office-seed"
        if (seed / "celi-ready").is_file():
            # Bootstrap only; per-job extension caches are never shared.
            for name in ("basic", "config", "autotext", "gallery"):
                source_directory = seed / "user" / name
                if source_directory.is_dir():
                    shutil.copytree(source_directory, profile / "user" / name)
        return office_convert_with_profile(source, folder, target, profile)


def office_convert_with_profile(source, folder, target, profile):
    folder.mkdir(parents=True, exist_ok=True)
    binary = office_path()
    if not binary:
        raise FileError("Engine Office belum tersedia di server.")
    check_zip(source)
    if source.suffix.lower() == ".epub":
        import pymupdf
        with pymupdf.open(source) as book:
            if book.page_count > 200:
                raise FileError("EPUB maksimum 200 halaman hasil layout.")
            if target == "pdf":
                rendered = folder / "ebook.pdf"
                rendered.write_bytes(book.convert_to_pdf())
                return rendered
            text = "\n\n".join(page.get_text() for page in book)
        if target == "txt":
            rendered = folder / "ebook.txt"; rendered.write_text(text, encoding="utf-8"); return rendered
        converted = folder / "ebook-input.html"
        converted.write_text('<html><head><meta charset="utf-8"></head><body>' + ''.join('<p>' + html.escape(paragraph) + '</p>' for paragraph in text.splitlines()) + '</body></html>', encoding="utf-8")
        source = converted
    if source.suffix.lower() == ".md":
        import markdown
        converted = folder / "markdown-input.html"
        converted.write_text('<html><head><meta charset="utf-8"></head><body>' + markdown.markdown(source.read_text(encoding="utf-8-sig"), extensions=["tables", "fenced_code"]) + '</body></html>', encoding="utf-8")
        source = converted
    if target == "txt":
        # Writer's encoded-text export can open a modal encoding dialog on Windows.
        # Render through its non-interactive PDF filter, then extract the text layer.
        import pymupdf
        intermediate = office_convert(source, folder / "text-intermediate", "pdf")
        with pymupdf.open(intermediate) as document:
            text = "\n\n".join(page.get_text() for page in document)
        destination = folder / "document-text.txt"
        destination.write_text(text, encoding="utf-8")
        return destination
    if source.suffix.lower() in (".html", ".htm"):
        value = source.read_text(encoding="utf-8-sig")
        if re.search(r'<(?:img|iframe|object|link|script)\b|(?:src|href)\s*=\s*["\'](?:https?:|file:|//)', value, re.I):
            raise FileError("HTML dengan resource eksternal atau script tidak didukung.")
    user = profile / "user"
    user.mkdir(parents=True, exist_ok=True)
    (user / "registrymodifications.xcu").write_text(
        '<?xml version="1.0"?><oor:items xmlns:oor="http://openoffice.org/2001/registry">'
        '<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item>'
        '<item oor:path="/org.openoffice.Office.Common/Load"><prop oor:name="UpdateDocMode" oor:op="fuse"><value>0</value></prop></item></oor:items>', encoding="utf-8")
    formats = {"pdf": "pdf", "docx": "docx:Office Open XML Text", "odt": "odt:writer8",
               "rtf": "rtf:Rich Text Format", "txt": "txt:Text (encoded):UTF8,LF",
               "html": "html", "epub": "epub", "xlsx": "xlsx:Calc MS Excel 2007 XML",
               "xls": "xls:MS Excel 97", "ods": "ods:calc8", "csv": "csv:Text - txt - csv (StarCalc):44,34,76",
               "tsv": "csv:Text - txt - csv (StarCalc):9,34,76",
               "pptx": "pptx:Impress MS PowerPoint 2007 XML", "odp": "odp:impress8"}
    destination = folder / "office-output"
    destination.mkdir(exist_ok=True)
    child = subprocess.Popen([binary, f"-env:UserInstallation={profile.as_uri()}", "--headless", "--nologo",
                                 "--nodefault", "--nofirststartwizard", "--norestore", "--convert-to",
                                 formats[target], "--outdir", str(destination), str(source)],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, creationflags=0x08000000 if os.name == "nt" else 0)
    try:
        child.communicate(timeout=90)
    except subprocess.TimeoutExpired as error:
        kill_native_tree(child)
        raise FileError("Konversi Office melewati batas waktu 90 detik.") from error
    extension = "csv" if target == "tsv" else target
    expected = destination / f"{source.stem}.{extension}"
    if child.returncode != 0 or not expected.is_file():
        raise FileError("Dokumen tidak dapat dikonversi. Periksa isi, proteksi, dan kompatibilitas format.")
    if target == "html":
        assets = [path for path in destination.iterdir() if path != expected]
        if assets:
            bundle = folder / "document-html.zip"
            with zipfile.ZipFile(bundle, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                for path in destination.rglob("*"):
                    if path.is_file():
                        archive.write(path, path.relative_to(destination).as_posix())
            return bundle
    return expected


def validate_data(value, depth=0, count=None, seen=None):
    count = [0] if count is None else count
    seen = set() if seen is None else seen
    count[0] += 1
    if depth > 40 or count[0] > 150_000:
        raise FileError("Data terlalu besar atau terlalu dalam.")
    if isinstance(value, (dict, list)):
        if id(value) in seen:
            raise FileError("Data siklik/alias rekursif tidak didukung.")
        seen.add(id(value))
        for child in (value.values() if isinstance(value, dict) else value):
            validate_data(child, depth + 1, count, seen)
        seen.remove(id(value))


def xml_read(text):
    import xml.etree.ElementTree as ET
    if re.search(r"<!DOCTYPE|<!ENTITY", text, re.I):
        raise FileError("XML dengan DTD atau entity tidak didukung.")
    root = ET.fromstring(text)
    def walk(node, depth=0):
        if depth > 40:
            raise FileError("XML terlalu dalam.")
        values = {"@" + name: value for name, value in node.attrib.items()}
        for child in node:
            if child.tail and child.tail.strip():
                raise FileError("XML dengan teks campuran di antara elemen tidak didukung agar teks tidak hilang.")
            value = walk(child, depth + 1)
            if child.tag in values:
                if not isinstance(values[child.tag], list):
                    values[child.tag] = [values[child.tag]]
                values[child.tag].append(value)
            else:
                values[child.tag] = value
        text_value = (node.text or "").strip()
        if not values:
            return text_value
        if text_value:
            values["#text"] = text_value
        return values
    return {root.tag: walk(root)}


def xml_write(value):
    import xml.etree.ElementTree as ET
    def valid(name):
        if not re.fullmatch(r"[A-Za-z_][\w.-]*", str(name)):
            raise FileError("Nama key tidak valid untuk XML. Gunakan huruf, angka, garis bawah, titik, atau tanda hubung.")
        return str(name)
    def fill(node, item):
        if isinstance(item, dict):
            for key, child in item.items():
                if str(key).startswith("@"):
                    node.set(valid(str(key)[1:]), str(child))
                elif key == "#text":
                    node.text = str(child)
                else:
                    for entry in child if isinstance(child, list) else [child]:
                        fill(ET.SubElement(node, valid(key)), entry)
        elif isinstance(item, list):
            for entry in item:
                fill(ET.SubElement(node, "item"), entry)
        else:
            node.text = "" if item is None else str(item).lower() if isinstance(item, bool) else str(item)
    if isinstance(value, dict) and len(value) == 1 and not next(iter(value)).startswith("@"):
        name = next(iter(value)); root = ET.Element(valid(name)); fill(root, value[name])
    else:
        root = ET.Element("root"); fill(root, value)
    ET.indent(root)
    return ET.tostring(root, encoding="unicode", xml_declaration=False)


def tabular(value):
    if isinstance(value, dict):
        value = [value]
    if not isinstance(value, list):
        raise FileError("Output tabel memerlukan array atau objek JSON.")
    if not value:
        return []
    if all(isinstance(row, dict) for row in value):
        headers = list(dict.fromkeys(key for row in value for key in row))
        return [headers] + [[json.dumps(row.get(key), ensure_ascii=False) if isinstance(row.get(key), (dict, list))
                              else row.get(key, "") for key in headers] for row in value]
    if all(isinstance(row, list) for row in value):
        return value
    if all(not isinstance(row, (dict, list)) for row in value):
        return [["value"]] + [[row] for row in value]
    raise FileError("Campuran objek dan nilai sederhana tidak dapat diubah menjadi tabel tanpa kehilangan data.")


def data_convert(source, output, target, folder, notes, sheet=False):
    import yaml
    from openpyxl import load_workbook, Workbook
    extension = source.suffix.lower().lstrip(".")
    rows = None
    if sheet:
        check_zip(source)
        workbook_file = office_convert(source, folder, "xlsx")
        workbook = load_workbook(workbook_file, read_only=True, data_only=True)
        try:
            rows = []
            for row in workbook.worksheets[0].iter_rows(values_only=True):
                if len(rows) >= 100_000 or len(row) > 500:
                    raise FileError("Tabel maksimum 100.000 baris dan 500 kolom.")
                rows.append([cell.isoformat() if hasattr(cell, "isoformat") else cell for cell in row])
            notes.append("Hanya nilai sheet pertama; rumus dan format tidak disertakan.")
        finally:
            workbook.close()
    else:
        if source.stat().st_size > 12 * 1024 * 1024:
            raise FileError("Konversi data terstruktur maksimum 12 MB per file.")
        text = source.read_text(encoding="utf-8-sig")
        if extension == "json":
            value = json.loads(text)
        elif extension in ("yaml", "yml"):
            value = yaml.safe_load(text)
        elif extension == "xml":
            value = xml_read(text)
        elif extension in ("csv", "tsv"):
            rows = list(csv.reader(io.StringIO(text, newline=""), delimiter="\t" if extension == "tsv" else ","))
            if len(rows) > 100_000 or any(len(row) > 500 for row in rows):
                raise FileError("Tabel maksimum 100.000 baris dan 500 kolom.")
    if rows is not None:
        if rows:
            headers = rows[0]
            if target not in ("csv", "tsv", "xlsx"):
                if len(set(str(item) for item in headers)) != len(headers):
                    raise FileError("Header tabel harus unik untuk konversi ke objek.")
                if any(len(row) != len(headers) for row in rows[1:]):
                    raise FileError("Jumlah kolom tiap baris harus sama untuk konversi ke objek.")
            value = [dict(zip([str(key) for key in headers], row)) for row in rows[1:]]
        else:
            value = []
    validate_data(value)
    if target in ("csv", "tsv", "xlsx"):
        rows = rows if rows is not None else tabular(value)
        if target == "xlsx":
            workbook = Workbook(); worksheet = workbook.active; worksheet.title = "Data"
            for row in rows:
                worksheet.append(row)
            # Strings starting with '=' are data, not formulas supplied by the upload.
            for row in worksheet:
                for cell in row:
                    if cell.data_type == "f":
                        cell.data_type = "s"
            workbook.save(output); workbook.close()
        else:
            with output.open("w", encoding="utf-8-sig", newline="") as stream:
                writer = csv.writer(stream, delimiter="\t" if target == "tsv" else ",")
                for row in rows:
                    writer.writerow(row)
    elif target in ("json", "txt"):
        output.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    elif target == "yaml":
        output.write_text(yaml.safe_dump(value, allow_unicode=True, sort_keys=False), encoding="utf-8")
    elif target == "xml":
        output.write_text(xml_write(value), encoding="utf-8")
    return output


def media_convert(source, output, target, preset, notes, compress=False):
    import imageio_ffmpeg
    binary = os.environ.get("FILE_TOOLS_FFMPEG") or imageio_ffmpeg.get_ffmpeg_exe()
    args = [binary, "-hide_banner", "-nostdin", "-y", "-loglevel", "error", "-protocol_whitelist", "file,pipe",
            "-i", str(source), "-map_metadata", "-1", "-t", "600", "-threads", "2"]
    # Probe duration with ffmpeg itself; reject rather than silently truncating.
    probe = subprocess.run([binary, "-hide_banner", "-nostdin", "-protocol_whitelist", "file,pipe",
                            "-i", str(source)], capture_output=True, timeout=15,
                           creationflags=0x08000000 if os.name == "nt" else 0)
    details = probe.stderr.decode("utf-8", "replace")
    duration = re.search(r"Duration: (\d+):(\d+):(\d+(?:\.\d+)?)", details)
    if not duration:
        raise FileError("Durasi media tidak dapat dibaca. File rusak, tidak kompatibel, atau bukan audio/video.")
    seconds = int(duration[1]) * 3600 + int(duration[2]) * 60 + float(duration[3])
    if seconds > 600:
        raise FileError("Audio/video maksimum 10 menit per file.")
    audio = {"mp3": ("libmp3lame", "128k"), "wav": ("pcm_s16le", None), "flac": ("flac", None),
             "aac": ("aac", "128k"), "m4a": ("aac", "128k"), "ogg": ("libvorbis", "128k"),
             "opus": ("libopus", "96k")}
    if target in audio:
        codec, bitrate = audio[target]
        args += ["-vn", "-map", "0:a:0", "-c:a", codec, "-ac", "2", "-ar", "48000"]
        if bitrate:
            bitrate = {"small": "64k", "balanced": bitrate, "quality": "192k"}[preset]
            args += ["-b:a", bitrate]
    else:
        crf = PRESETS[preset][1]
        args += ["-map", "0:v:0", "-map", "0:a:0?"]
        filters = ["scale=trunc(iw/2)*2:trunc(ih/2)*2"]
        if compress and PRESETS[preset][2] != "original":
            height = PRESETS[preset][2]
            filters = [f"scale=-2:'trunc(min({height},ih)/2)*2'"]
        args += ["-vf", ",".join(filters)]
        if target == "webm":
            args += ["-c:v", "libvpx-vp9", "-crf", str(crf + 4), "-b:v", "0", "-deadline", "realtime",
                     "-cpu-used", "5", "-c:a", "libopus", "-b:a", "96k"]
        elif target == "avi":
            args += ["-c:v", "mpeg4", "-q:v", "5", "-c:a", "libmp3lame", "-b:a", "128k"]
        else:
            args += ["-c:v", "libx264", "-preset", "veryfast", "-crf", str(crf), "-pix_fmt", "yuv420p",
                     "-c:a", "aac", "-b:a", "128k"]
            if target in ("mp4", "mov"):
                args += ["-movflags", "+faststart"]
    args += [str(output)]
    started = time.monotonic()
    with (output.parent / "media.log").open("wb") as log:
        child = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=log,
                                 creationflags=0x08000000 if os.name == "nt" else 0)
        while child.poll() is None:
            if time.monotonic() - started > 150 or (output.exists() and output.stat().st_size > MAX_OUTPUT):
                child.kill(); child.wait()
                raise FileError("Proses media melampaui batas waktu/ukuran. Gunakan file lebih kecil atau preset ukuran kecil.")
            time.sleep(0.2)
    if child.returncode != 0:
        raise FileError("Codec/track media tidak didukung atau file rusak. Ekstraksi audio membutuhkan track audio.")
    if output.stat().st_size >= MAX_OUTPUT:
        raise FileError("Hasil media melampaui batas ukuran. Gunakan preset ukuran kecil.")
    notes.append("Media di-encode ulang; kualitas dapat berubah dan metadata tidak disalin. Audio keluaran memakai maksimum 2 kanal, 48 kHz.")


def archive_files(files, output, method):
    if method == "zip":
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for item in files:
                archive.write(item["path"], item["safeName"])
    elif method == "tar.gz":
        with tarfile.open(output, "w:gz", compresslevel=9) as archive:
            for item in files:
                archive.add(item["path"], arcname=item["safeName"], recursive=False)
    else:
        openers = {"gzip": gzip.open, "bz2": bz2.open, "xz": lzma.open}
        with Path(files[0]["path"]).open("rb") as source, openers[method](output, "wb") as destination:
            shutil.copyfileobj(source, destination)


def execute(job):
    global ACTIVE_JOB_DIRECTORY
    folder = Path(job["directory"]).resolve()
    ACTIVE_JOB_DIRECTORY = folder
    preset = job.get("preset", "balanced")
    if preset not in PRESETS:
        raise FileError("Preset tidak valid.")
    target = job["target"]
    files = job["files"]
    notes = []
    if job["mode"] == "compress" and target in ("zip", "tar.gz", "gzip", "bz2", "xz"):
        extension = {"gzip": "gz"}.get(target, target)
        output = folder / ("celi-archive." + extension if len(files) > 1 or target in ("zip", "tar.gz")
                           else files[0]["safeName"] + "." + extension)
        archive_files(files, output, target)
        notes.append("Arsip mempertahankan isi file. File yang sudah terkompresi mungkin tidak menjadi lebih kecil.")
        return {"path": str(checked_output(output)), "name": output.name, "notes": notes}
    outputs = []
    for index, item in enumerate(files):
        source = Path(item["path"]).resolve()
        if not source.is_relative_to(folder):
            raise FileError("Path file tidak valid.")
        part = folder / f"result-{index}"
        part.mkdir()
        group = item["group"]
        destination_type = target
        if job["mode"] == "compress":
            destination_type = {"image": "webp", "pdf": "pdf", "audio": "mp3", "video": "mp4"}[target]
        output = part / f"{Path(item['safeName']).stem}.{destination_type}"
        if group == "image":
            image_convert(source, output, destination_type, preset, notes)
        elif group == "pdf":
            if job["mode"] == "compress":
                pdf_compress(source, output, preset, notes)
            else:
                output = pdf_convert(source, output, destination_type, notes)
        elif group == "data":
            output = data_convert(source, output, destination_type, part, notes)
        elif group == "sheet" and destination_type in ("json", "csv", "tsv"):
            output = data_convert(source, output, destination_type, part, notes, sheet=True)
        elif group in ("document", "sheet", "slides"):
            output = office_convert(source, part, destination_type)
            if source.suffix.lower() == ".epub" and destination_type not in ("pdf", "txt"):
                notes.append("EPUB ke format Office merekonstruksi teks; gambar dan layout asli tidak disertakan.")
            # Native engine may create assets; preserve these in a ZIP for HTML.
            extension = ".zip" if output.suffix == ".zip" else "." + destination_type
            renamed = part / ("converted-" + Path(item["safeName"]).stem + extension)
            shutil.copyfile(output, renamed)
            output = renamed
            notes.append("Periksa layout/font setelah konversi Office.")
        elif group in ("audio", "video"):
            media_convert(source, output, destination_type, preset, notes, job["mode"] == "compress")
        else:
            raise FileError("Konversi ini tidak didukung.")
        outputs.append(checked_output(output))
    if len(outputs) == 1:
        final = outputs[0]
    else:
        final = folder / "celi-results.zip"
        with zipfile.ZipFile(final, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            used = set()
            for index, output in enumerate(outputs):
                name = output.name
                if name in used:
                    name = f"{index + 1}-{name}"
                used.add(name)
                archive.write(output, name)
        notes.append("Hasil batch dikemas dalam ZIP.")
    return {"path": str(checked_output(final)), "name": final.name, "notes": list(dict.fromkeys(notes))}


def main():
    def cancelled(_signum, _frame):
        import psutil
        for child in reversed(psutil.Process().children(recursive=True)):
            try: child.kill()
            except psutil.Error: pass
        raise SystemExit(143)
    signal.signal(signal.SIGTERM, cancelled)
    parser = argparse.ArgumentParser()
    parser.add_argument("--capabilities", action="store_true")
    parser.add_argument("--prepare-office", action="store_true")
    parser.add_argument("job", nargs="?")
    args = parser.parse_args()
    try:
        if args.prepare_office:
            result = prepare_office_profile()
        elif args.capabilities:
            result = {"engines": capabilities()}
        else:
            with Path(args.job).open(encoding="utf-8") as stream:
                result = execute(json.load(stream))
        print(json.dumps({"ok": True, **result}, ensure_ascii=True))
    except Exception as error:
        message = str(error) if isinstance(error, FileError) else "File tidak dapat diproses. Periksa apakah isi file sesuai format dan tidak rusak."
        print(json.dumps({"ok": False, "error": message}, ensure_ascii=True))
        print(type(error).__name__ + ": " + str(error)[:400], file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()


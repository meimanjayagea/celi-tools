import bz2
import gzip
import io
import json
import lzma
import math
import struct
import subprocess
import tempfile
import unittest
import wave
import zipfile
from pathlib import Path

from file_worker import execute, office_path, check_zip, FileError

ROOT = Path(__file__).resolve().parents[1]


def fixtures(folder):
    from PIL import Image
    import pymupdf
    from docx import Document
    from openpyxl import Workbook
    from pptx import Presentation
    from pptx.util import Inches
    folder.mkdir(parents=True, exist_ok=True)
    image = Image.new("RGBA", (320, 180))
    image.putdata([(x % 256, y % 256, (x + y) % 256, 160 if x < 80 else 255) for y in range(180) for x in range(320)])
    image.save(folder / "sample.png")
    image.convert("RGB").save(folder / "sample.jpg", quality=98)
    frames = [Image.new("RGB", (80, 60), color) for color in ["red", "blue", "green"]]
    frames[0].save(folder / "animated.gif", save_all=True, append_images=frames[1:], duration=100, loop=0)
    (folder / "sample.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="red"/></svg>', encoding="utf-8")
    document = pymupdf.open()
    for number in range(2):
        page = document.new_page(); page.insert_text((60, 60), "Celi Tools page " + str(number + 1))
    document.save(folder / "sample.pdf"); document.close()
    document = Document(); document.add_heading("Celi Tools", 0); document.add_paragraph("File conversion example.")
    document.add_table(rows=2, cols=2).cell(0, 0).text = "Amount"
    document.save(folder / "sample.docx")
    workbook = Workbook(); sheet = workbook.active; sheet.append(["nama", "jumlah"]); sheet.append(["Celi", 2]); sheet.append(["Tools", "=1+2"])
    workbook.save(folder / "sample.xlsx"); workbook.close()
    presentation = Presentation(); slide = presentation.slides.add_slide(presentation.slide_layouts[0]); slide.shapes.title.text = "Celi Tools"
    presentation.save(folder / "sample.pptx")
    (folder / "sample.json").write_text(json.dumps([{"nama":"Celi","nilai":"001"},{"nama":"Tools","nilai":"002"}]), encoding="utf-8")
    (folder / "sample.csv").write_text('nama,nilai\nCeli,001\nTools,002\n', encoding="utf-8")
    (folder / "sample.md").write_text('# Celi Tools\n\nA **useful** workspace.\n', encoding="utf-8")
    (folder / "sample.txt").write_text("Celi Tools\nConversion fixture.\n", encoding="utf-8")
    with wave.open(str(folder / "sample.wav"), "wb") as stream:
        stream.setnchannels(1); stream.setsampwidth(2); stream.setframerate(16000)
        stream.writeframes(b"".join(struct.pack("<h", int(12000 * math.sin(2 * math.pi * 440 * i / 16000))) for i in range(16000)))
    import imageio_ffmpeg
    command = [imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=160x90:rate=8", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=16000", "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(folder / "sample.mp4")]
    subprocess.run(command, check=True, timeout=30, capture_output=True)


class FileWorkerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sandbox = tempfile.TemporaryDirectory(prefix="celi-file-tests-")
        cls.root = Path(cls.sandbox.name)
        cls.source = cls.root / "fixtures"
        fixtures(cls.source)

    @classmethod
    def tearDownClass(cls):
        # Windows scanners can briefly hold freshly generated Office profile files.
        import time
        for attempt in range(6):
            try:
                cls.sandbox.cleanup()
                return
            except OSError:
                if attempt == 5:
                    raise
                time.sleep(0.5)

    def run_job(self, name, group, target, mode="convert", extra=None):
        import shutil
        folder = Path(tempfile.mkdtemp(dir=self.root))
        copied = folder / name; shutil.copyfile(self.source / name, copied)
        files = [{"path":str(copied),"safeName":name,"group":group}]
        for item in extra or []:
            destination = folder / item; shutil.copyfile(self.source / item, destination)
            files.append({"path":str(destination),"safeName":item,"group":group})
        result = execute({"mode":mode,"target":target,"preset":"balanced","directory":str(folder),"files":files})
        self.assertTrue(Path(result["path"]).is_file())
        return result

    def test_image_outputs_are_real_images(self):
        from PIL import Image
        for target in ["jpg","png","webp","avif","gif","bmp","tiff","ico"]:
            with self.subTest(target=target):
                result = self.run_job("sample.png", "image", target)
                with Image.open(result["path"]) as image:
                    image.load(); self.assertGreater(image.width, 0)

    def test_animation_and_svg(self):
        from PIL import Image
        result = self.run_job("animated.gif", "image", "webp")
        with Image.open(result["path"]) as image: self.assertEqual(image.n_frames, 3)
        result = self.run_job("sample.svg", "image", "png")
        with Image.open(result["path"]) as image: self.assertEqual(image.size, (120,80))

    def test_pdf_conversion_retains_all_pages_and_text(self):
        import pymupdf
        text = self.run_job("sample.pdf", "pdf", "txt")
        self.assertIn("page 2", Path(text["path"]).read_text())
        for target in ["png","jpg"]:
            result = self.run_job("sample.pdf", "pdf", target)
            with zipfile.ZipFile(result["path"]) as archive: self.assertEqual(len(archive.namelist()), 2)
        result = self.run_job("sample.pdf", "pdf", "pdf", "compress")
        with pymupdf.open(result["path"]) as pdf:
            self.assertEqual(pdf.page_count, 2); self.assertIn("page 1", pdf[0].get_text())

    def test_pdf_to_docx_creates_valid_document(self):
        from docx import Document
        result = self.run_job("sample.pdf", "pdf", "docx")
        document = Document(result["path"])
        self.assertTrue(any("Celi" in paragraph.text for paragraph in document.paragraphs))

    def test_data_conversion_preserves_leading_zero_strings(self):
        for target in ["json","yaml","xml","csv","tsv","xlsx","txt"]:
            with self.subTest(target=target): self.run_job("sample.json", "data", target)
        result = self.run_job("sample.csv", "data", "json")
        self.assertEqual(json.loads(Path(result["path"]).read_text())[0]["nilai"], "001")

    def test_archives_round_trip_arbitrary_file_contents(self):
        original = (self.source / "sample.txt").read_bytes()
        for target, opener in [("gzip",gzip.open),("bz2",bz2.open),("xz",lzma.open)]:
            result = self.run_job("sample.txt", "archive", target,"compress")
            with opener(result["path"],"rb") as stream: self.assertEqual(stream.read(),original)
        result = self.run_job("sample.txt", "archive", "zip","compress",["sample.png"])
        with zipfile.ZipFile(result["path"]) as archive: self.assertEqual(archive.read("sample.txt"),original); self.assertEqual(len(archive.namelist()),2)

    @unittest.skipUnless(office_path(), "LibreOffice unavailable")
    def test_office_document_and_presentation(self):
        import pymupdf
        for source, group in [("sample.docx","document"),("sample.pptx","slides"),("sample.md","document"),("sample.txt","document")]:
            with self.subTest(source=source):
                result = self.run_job(source,group,"pdf")
                with pymupdf.open(result["path"]) as document: self.assertGreater(document.page_count,0)
        for target in ["odt","rtf","txt","html","epub"]:
            with self.subTest(target=target): self.run_job("sample.docx","document",target)

    @unittest.skipUnless(office_path(), "LibreOffice unavailable")
    def test_spreadsheet_recalculates_formulas_before_export(self):
        result = self.run_job("sample.xlsx", "sheet", "json")
        values = json.loads(Path(result["path"]).read_text())
        self.assertEqual(values[1]["jumlah"],3)
        for target in ["xls","ods","pdf","html","csv","tsv"]:
            with self.subTest(target=target): self.run_job("sample.xlsx","sheet",target)

    def test_media_conversion(self):
        for target in ["mp3","wav","flac","aac","m4a","ogg","opus"]:
            with self.subTest(target=target): self.run_job("sample.wav", "audio", target)
        for target in ["mp4","webm","mkv","mov","avi","mp3"]:
            with self.subTest(target=target): self.run_job("sample.mp4", "video", target)
        self.run_job("sample.mp4","video","video","compress")

    def test_xml_entities_and_external_office_links_are_rejected(self):
        from file_worker import xml_read
        with self.assertRaises(FileError): xml_read('<!DOCTYPE a [<!ENTITY x "bad">]><a>&x;</a>')
        with self.assertRaises(FileError): xml_read('<a>one<b>two</b>three</a>')
        bad = self.root / "external.docx"
        with zipfile.ZipFile(bad,"w") as archive: archive.writestr('word/_rels/document.xml.rels','<Relationship TargetMode="External" Target="https://example.com"/>')
        with self.assertRaises(FileError): check_zip(bad)


if __name__ == "__main__":
    if "--fixtures" in __import__("sys").argv:
        fixtures(ROOT / "test-output/fixtures")
        print("Fixtures ready in test-output/fixtures")
    else:
        unittest.main(verbosity=2)

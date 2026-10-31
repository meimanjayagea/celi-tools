# File processing


`/converter` and `/compress` call the separate HTTP API under `/api/files/` directly. Each job runs a Python worker with Pillow/HEIF, PyMuPDF, LibreOffice and FFmpeg. The format picker only exposes compatible destinations and available engines. Unsupported formats receive an explicit error.

| Category | Supported input examples | Destinations |
| --- | --- | --- |
| Images | JPEG, PNG, WebP, AVIF, GIF, BMP, TIFF, ICO, HEIC/HEIF, JPEG 2000, SVG | JPEG, PNG, WebP, AVIF, GIF, BMP, TIFF, ICO, PDF |
| PDF | PDF | TXT, DOCX, all pages as PNG/JPEG in ZIP |
| Documents | DOC/DOCX, ODT, RTF, TXT, HTML, EPUB, Markdown | PDF, DOCX, ODT, RTF, TXT, HTML, EPUB |
| Spreadsheets | XLS/XLSX, ODS | XLSX, XLS, ODS, CSV, TSV, JSON, PDF, HTML |
| Presentations | PPT/PPTX, ODP | PPTX, ODP, PDF |
| Structured data | JSON, YAML, XML, CSV, TSV | JSON, YAML, XML, CSV, TSV, XLSX, TXT |
| Audio | MP3, WAV, FLAC, AAC, M4A, OGG, Opus, WMA, AIFF | MP3, WAV, FLAC, AAC, M4A, OGG, Opus |
| Video | MP4, MOV, MKV, WebM, AVI, M4V, MPEG, WMV, FLV, 3GP, TS | MP4, WebM, MKV, MOV, AVI; audio extraction to MP3, WAV, M4A |

All file types can be archived losslessly to ZIP/TAR.GZ, or individually to GZIP/BZIP2/XZ. Specialized compression optimizes images to WebP, PDFs, audio to MP3, and video to MP4. Already compressed files may grow; the interface reports actual sizes rather than promising savings. Format support depends on the source codec and file contents, not only its extension.

Limits: 10 files and 100 MiB total per upload, 200 MiB result, two concurrent jobs per Node process, one active upload and six uploads per minute per client address, 30 readiness/capabilities checks per minute per client address, four minutes per job, 90 seconds per Office conversion, 10 minutes of media, 200 PDF pages (80 for PDF-to-DOCX), and 12 MiB per structured data source. Batch conversion returns ZIP. CSV/TSV exports prefix formula-like cells with an apostrophe so spreadsheet software treats them as text. PDF text extraction does not include OCR. Spreadsheet tabular exports use calculated values from the first sheet only. EPUB-to-Office reconstruction can lose images/layout. Lossy output and format changes can reduce quality; relevant notes appear beside settings and results.

Files are uploaded to this application's server, processed in separate temporary job folders and removed after the response is sent or a handled failure occurs. Results stream to the client. No third-party conversion API is used. Per-process and per-address controls do not provide a shared quota across instances; configure ingress rate, body-size, and request-time limits for internet-facing deployments. When behind a trusted proxy, configure `FILE_TOOLS_TRUST_PROXY` and the correct `FILE_TOOLS_TRUSTED_PROXY_HOPS`; otherwise the API uses the socket peer address. A hard process/server crash can leave job folders: periodically remove **inactive** `.file-tools/jobs/job-*` on the API host directories in production. Do not log uploaded contents. Archives are created, never extracted. Encrypted PDFs, signed PDFs and external Office references are rejected. Native file parsers still require OS/container isolation for an internet-facing service.


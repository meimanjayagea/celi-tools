export const FILE_LIMITS = { maxFiles: 10, maxBytes: 100 * 1024 * 1024, maxOutputBytes: 200 * 1024 * 1024 };

export const CONVERTER_GROUPS = [
  { id: "image", label: "Gambar", engine: "image", inputs: ["jpg", "jpeg", "png", "webp", "avif", "gif", "bmp", "tif", "tiff", "ico", "heic", "heif", "jp2", "svg"], outputs: ["jpg", "png", "webp", "avif", "gif", "bmp", "tiff", "ico", "pdf"], note: "Frame dipertahankan untuk GIF/WebP, TIFF multipage, atau halaman PDF. Output lain memakai frame pertama. JPEG/BMP mengubah transparansi menjadi putih." },
  { id: "pdf", label: "PDF", engine: "pdf", inputs: ["pdf"], outputs: ["txt", "docx", "png", "jpg"], note: "PDF ke gambar menghasilkan ZIP berisi semua halaman. Ekstraksi teks tidak melakukan OCR; layout PDF ke DOCX dapat berubah." },
  { id: "document", label: "Dokumen", engine: "office", inputs: ["doc", "docx", "odt", "rtf", "txt", "html", "htm", "epub", "md"], outputs: ["pdf", "docx", "odt", "rtf", "txt", "html", "epub"], note: "Font atau layout dapat berubah antarformat. File terenkripsi dan dokumen dengan referensi eksternal tidak didukung." },
  { id: "sheet", label: "Spreadsheet", engine: "office", inputs: ["xlsx", "xls", "ods"], outputs: ["xlsx", "xls", "ods", "csv", "tsv", "json", "pdf", "html"], note: "CSV/TSV/JSON mengambil nilai dari sheet pertama; rumus, format sel, dan sheet lain tidak disertakan. PDF memakai pengaturan cetak dokumen." },
  { id: "slides", label: "Presentasi", engine: "office", inputs: ["ppt", "pptx", "odp"], outputs: ["pptx", "odp", "pdf"], note: "Animasi dan transisi tidak ikut dalam PDF. Layout dapat berubah jika font sumber tidak tersedia." },
  { id: "data", label: "Data terstruktur", engine: "data", inputs: ["json", "yaml", "yml", "xml", "csv", "tsv"], outputs: ["json", "yaml", "xml", "csv", "tsv", "xlsx", "txt"], note: "CSV/TSV membutuhkan data tabular yang konsisten. Data terstruktur maksimum 12 MB per file. File teks dibaca sebagai UTF-8; XML memakai pemetaan atribut @ dan teks #text." },
  { id: "audio", label: "Audio", engine: "media", inputs: ["mp3", "wav", "flac", "aac", "m4a", "ogg", "opus", "wma", "aiff", "aif"], outputs: ["mp3", "wav", "flac", "aac", "m4a", "ogg", "opus"], note: "Output lossy dapat menurunkan kualitas. Codec sumber tetap harus dapat dibaca engine. Metadata tidak disalin." },
  { id: "video", label: "Video", engine: "media", inputs: ["mp4", "mov", "mkv", "webm", "avi", "m4v", "mpeg", "mpg", "wmv", "flv", "3gp", "ts"], outputs: ["mp4", "webm", "mkv", "mov", "avi", "mp3", "wav", "m4a"], note: "Konversi melakukan encoding ulang. MP3/WAV/M4A mengekstrak audio dan membutuhkan track audio. Durasi maksimum 10 menit." },
];

export const COMPRESS_METHODS = [
  { id: "zip", label: "Arsip ZIP", engine: "archive", inputs: null, multiple: true, note: "Semua jenis file dapat diarsipkan tanpa mengubah isinya. File yang sudah terkompresi dapat menghasilkan ZIP lebih besar." },
  { id: "tar.gz", label: "Arsip TAR.GZ", engine: "archive", inputs: null, multiple: true, note: "Gabungkan file dalam arsip TAR.GZ tanpa mengubah isinya." },
  { id: "gzip", label: "GZIP", engine: "archive", inputs: null, multiple: false, note: "Kompresi lossless satu file. Untuk banyak file, gunakan ZIP atau TAR.GZ." },
  { id: "bz2", label: "BZIP2", engine: "archive", inputs: null, multiple: false, note: "Kompresi lossless satu file, cocok untuk data teks. Hasil tidak selalu lebih kecil." },
  { id: "xz", label: "XZ", engine: "archive", inputs: null, multiple: false, note: "Kompresi lossless satu file; pemrosesan dapat lebih lama daripada ZIP." },
  { id: "image", label: "Optimalkan gambar", engine: "image", inputs: ["jpg", "jpeg", "png", "webp", "avif", "gif", "bmp", "tif", "tiff", "ico", "heic", "heif", "jp2", "svg"], multiple: true, note: "Hasil WebP, kualitas dapat berkurang. Animasi GIF dipertahankan. Metadata gambar dihapus." },
  { id: "pdf", label: "Optimalkan PDF", engine: "pdf", inputs: ["pdf"], multiple: true, note: "Optimasi struktur dan gambar PDF tanpa merasterisasi teks. Hasil dapat tetap sama atau lebih besar. PDF terenkripsi/bertanda tangan ditolak." },
  { id: "audio", label: "Perkecil audio", engine: "media", inputs: ["mp3", "wav", "flac", "aac", "m4a", "ogg", "opus", "wma", "aiff", "aif"], multiple: true, note: "Output MP3 dengan bitrate sesuai preset. Kualitas dapat berkurang; metadata tidak disalin." },
  { id: "video", label: "Perkecil video", engine: "media", inputs: ["mp4", "mov", "mkv", "webm", "avi", "m4v", "mpeg", "mpg", "wmv", "flv", "3gp", "ts"], multiple: true, note: "Output MP4/H.264. Preset mengatur kualitas dan resolusi; hasil dapat lebih besar dari sumber yang sudah optimal. Maksimum 10 menit." },
];

export function fileExtension(name) { return String(name).split(".").pop().toLowerCase(); }
export function converterGroup(name) { const extension = fileExtension(name); return CONVERTER_GROUPS.find(group => group.inputs.includes(extension)) ?? null; }
export function conversionTargets(names, engines = {}) {
  if (!names.length) return [];
  return names.reduce((targets, name, index) => {
    const group = converterGroup(name);
    if (!group || engines[group.engine] === false) return [];
    const outputs = group.outputs.filter(output => output !== fileExtension(name));
    return index === 0 ? outputs : targets.filter(output => outputs.includes(output));
  }, []);
}
export function validateSelection(files, mode, target, engines = {}) {
  if (!files.length) return "Pilih file terlebih dahulu.";
  if (files.length > FILE_LIMITS.maxFiles) return `Maksimum ${FILE_LIMITS.maxFiles} file per proses.`;
  if (files.reduce((sum, file) => sum + file.size, 0) > FILE_LIMITS.maxBytes) return "Total ukuran file maksimum 100 MB.";
  if (mode === "convert") {
    if (files.some(file => !converterGroup(file.name))) return "Ada jenis file yang belum mendukung konversi. Lihat daftar format di bawah.";
    if (!conversionTargets(files.map(file => file.name), engines).includes(target)) return "Pilih format tujuan yang didukung untuk semua file.";
  } else {
    const method = COMPRESS_METHODS.find(item => item.id === target);
    if (!method || engines[method.engine] === false) return "Metode kompresi belum tersedia.";
    if (!method.multiple && files.length !== 1) return "Metode ini hanya mendukung satu file. Gunakan ZIP/TAR.GZ untuk banyak file.";
    if (method.inputs && files.some(file => !method.inputs.includes(fileExtension(file.name)))) return "Jenis file tidak sesuai metode kompresi. Gunakan ZIP untuk semua jenis file.";
  }
  return "";
}
export function formatBytes(bytes) { if (!bytes) return "0 B"; const index = Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024))); return `${(bytes / 1024 ** index).toLocaleString("id-ID", { maximumFractionDigits: 1 })} ${["B", "KB", "MB", "GB"][index]}`; }

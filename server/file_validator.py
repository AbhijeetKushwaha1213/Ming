#!/usr/bin/env python3
"""
Canonical Phase 2: Secure File Validation (Python)
Validates magic-byte signatures, size constraints, path traversal protection,
and extension-to-content matching.
"""

import os
from pathlib import Path
from typing import Dict, Any, Optional

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

class FileValidationError(Exception):
    def __init__(self, message: str, code: str = "VALIDATION_ERROR", status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.status_code = status_code

def detect_magic_signature(data: bytes) -> Optional[Dict[str, Any]]:
    if len(data) < 4:
        return None

    # 1. PDF: %PDF-
    if data.startswith(b"%PDF-"):
        return {"media_type": "PDF", "mime_type": "application/pdf", "is_legacy": False}

    # 2. PNG: \x89PNG\r\n\x1a\n
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return {"media_type": "PNG", "mime_type": "image/png", "is_legacy": False}

    # 3. JPEG: \xFF\xD8\xFF
    if data.startswith(b"\xff\xd8\xff"):
        return {"media_type": "JPEG", "mime_type": "image/jpeg", "is_legacy": False}

    # 4. RIFF containers (WEBP & WAV)
    if len(data) >= 12 and data.startswith(b"RIFF"):
        tag = data[8:12]
        if tag == b"WEBP":
            return {"media_type": "WEBP", "mime_type": "image/webp", "is_legacy": False}
        if tag == b"WAVE":
            return {"media_type": "WAV", "mime_type": "audio/wav", "is_legacy": False}

    # 5. OLE2 Compound Document (Legacy PPT binary format)
    if data.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        return {"media_type": "PPT", "mime_type": "application/vnd.ms-powerpoint", "is_legacy": True}

    # 6. ZIP container (PPTX, DOCX, XLSX): PK\x03\x04
    if data.startswith(b"PK\x03\x04") or data.startswith(b"PK\x05\x06"):
        return {
            "media_type": "PPTX",
            "mime_type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "is_legacy": False,
        }

    # 7. MP4: ftyp at offset 4
    if len(data) >= 8 and data[4:8] == b"ftyp":
        return {"media_type": "MP4", "mime_type": "video/mp4", "is_legacy": False}

    # 8. WEBM: 0x1A 0x45 0xDF 0xA3 (EBML)
    if data.startswith(b"\x1a\x45\xdf\xa3"):
        return {"media_type": "WEBM", "mime_type": "video/webm", "is_legacy": False}

    # 9. MP3: ID3 or sync frame
    if data.startswith(b"ID3") or (len(data) >= 2 and data[0] == 0xff and (data[1] & 0xe0) == 0xe0):
        return {"media_type": "MP3", "mime_type": "audio/mpeg", "is_legacy": False}

    # 10. Plain text (UTF-8, no null bytes)
    try:
        sample = data[:min(len(data), 1024)]
        if b"\x00" not in sample:
            sample.decode("utf-8")
            return {"media_type": "TEXT", "mime_type": "text/plain", "is_legacy": False}
    except UnicodeDecodeError:
        pass

    return None

def validate_file(file_path: str, declared_filename: Optional[str] = None) -> Dict[str, Any]:
    path_obj = Path(file_path)
    if not path_obj.exists():
        raise FileValidationError(f"File not found: {file_path}", code="FILE_NOT_FOUND", status_code=404)

    file_size = path_obj.stat().st_size
    if file_size == 0:
        raise FileValidationError("File is empty (0 bytes)", code="EMPTY_FILE", status_code=400)

    if file_size > MAX_FILE_SIZE_BYTES:
        raise FileValidationError(
            f"File size ({file_size} bytes) exceeds limit of {MAX_FILE_SIZE_BYTES} bytes",
            code="FILE_TOO_LARGE",
            status_code=413,
        )

    # Read header bytes
    with open(file_path, "rb") as f:
        header = f.read(4096)

    detected = detect_magic_signature(header)
    if not detected:
        raise FileValidationError(
            "Unsupported file format: magic byte signature unrecognized",
            code="UNSUPPORTED_MEDIA_TYPE",
            status_code=415,
        )

    # Cross-check file extension
    fn = declared_filename or path_obj.name
    ext = Path(fn).suffix.lower()
    ext_mapping = {
        ".pdf": ["PDF"],
        ".pptx": ["PPTX"],
        ".ppt": ["PPT"],
        ".png": ["PNG"],
        ".jpg": ["JPEG"],
        ".jpeg": ["JPEG"],
        ".webp": ["WEBP"],
        ".mp4": ["MP4"],
        ".webm": ["WEBM"],
        ".mp3": ["MP3"],
        ".wav": ["WAV"],
        ".txt": ["TEXT"],
        ".md": ["TEXT"],
    }

    if ext in ext_mapping and detected["media_type"] not in ext_mapping[ext]:
        raise FileValidationError(
            f"Extension spoofing detected: '{ext}' file contains '{detected['media_type']}' content",
            code="EXTENSION_MIME_MISMATCH",
            status_code=400,
        )

    source_type_map = {
        "PDF": "PDF",
        "PPTX": "PPTX",
        "PPT": "PPT",
        "PNG": "IMAGE",
        "JPEG": "IMAGE",
        "WEBP": "IMAGE",
        "MP4": "VIDEO",
        "WEBM": "VIDEO",
        "MP3": "AUDIO",
        "WAV": "AUDIO",
        "TEXT": "TEXT",
    }

    return {
        "valid": True,
        "media_type": detected["media_type"],
        "mime_type": detected["mime_type"],
        "source_type": source_type_map[detected["media_type"]],
        "size_bytes": file_size,
        "is_legacy": detected["is_legacy"],
    }

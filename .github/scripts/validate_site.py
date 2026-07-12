#!/usr/bin/env python3
"""Dependency-free quality checks for the static portfolio."""

from __future__ import annotations

import base64
import hashlib
import json
import re
import struct
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[2]
ORIGIN = "https://ahmadothmann.github.io"
LOCALE_PAGES = {
    Path("index.html"): ("en", "ltr", f"{ORIGIN}/"),
    Path("de/index.html"): ("de", "ltr", f"{ORIGIN}/de/"),
    Path("ar/index.html"): ("ar", "rtl", f"{ORIGIN}/ar/"),
}
EXPECTED_ALTERNATES = {
    "en": f"{ORIGIN}/",
    "de": f"{ORIGIN}/de/",
    "ar": f"{ORIGIN}/ar/",
    "x-default": f"{ORIGIN}/",
}
TEXT_EXTENSIONS = {
    ".css",
    ".html",
    ".js",
    ".json",
    ".md",
    ".svg",
    ".webmanifest",
    ".xml",
    ".yml",
    ".yaml",
}


class PageParser(HTMLParser):
    """Collect the small set of facts needed for static validation."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tags: Counter[str] = Counter()
        self.classes: Counter[str] = Counter()
        self.ids: list[str] = []
        self.references: list[tuple[str, str, str]] = []
        self.images: list[dict[str, str]] = []
        self.blank_links: list[dict[str, str]] = []
        self.language_links: list[dict[str, str]] = []
        self.inline_scripts: list[str] = []
        self.inline_styles_or_handlers: list[str] = []
        self.meta: dict[str, str] = {}
        self.links: list[dict[str, str]] = []
        self.html_attrs: dict[str, str] = {}
        self.title_parts: list[str] = []
        self._inside_title = False
        self._inside_inline_script = False
        self._script_parts: list[str] = []

    def handle_decl(self, decl: str) -> None:
        if decl.lower() == "doctype html":
            self.tags["!doctype"] += 1

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key.lower(): value or "" for key, value in attrs}
        tag = tag.lower()
        self.tags[tag] += 1

        if tag == "html":
            self.html_attrs = values
        if "id" in values:
            self.ids.append(values["id"])
        for class_name in values.get("class", "").split():
            self.classes[class_name] += 1
        if tag == "title":
            self._inside_title = True
        if tag == "script" and not values.get("src"):
            self._inside_inline_script = True
            self._script_parts = []
        if tag == "meta":
            key = values.get("name") or values.get("property") or values.get("http-equiv")
            if key:
                self.meta[key.lower()] = values.get("content", "")
            if "charset" in values:
                self.meta["charset"] = values["charset"]
        if tag == "link":
            self.links.append(values)
        if tag == "img":
            self.images.append(values)
        if tag == "a" and values.get("target", "").lower() == "_blank":
            self.blank_links.append(values)
        if tag == "a" and "data-language-link" in values:
            self.language_links.append(values)
        for attr in values:
            if attr == "style" or attr.startswith("on"):
                self.inline_styles_or_handlers.append(f"<{tag}> {attr}")

        for attr in ("href", "src", "poster"):
            value = values.get(attr)
            if value:
                self.references.append((tag, attr, value))

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._inside_title = False
        if tag.lower() == "script" and self._inside_inline_script:
            self.inline_scripts.append("".join(self._script_parts))
            self._inside_inline_script = False
            self._script_parts = []

    def handle_data(self, data: str) -> None:
        if self._inside_title:
            self.title_parts.append(data)
        if self._inside_inline_script:
            self._script_parts.append(data)


def add_error(errors: list[str], path: Path | str, message: str) -> None:
    errors.append(f"{path}: {message}")


def parse_page(relative_path: Path, errors: list[str]) -> PageParser | None:
    path = ROOT / relative_path
    if not path.is_file():
        add_error(errors, relative_path, "required page is missing")
        return None

    parser = PageParser()
    try:
        parser.feed(path.read_text(encoding="utf-8"))
        parser.close()
    except (OSError, UnicodeError) as exc:
        add_error(errors, relative_path, f"cannot parse as UTF-8 HTML: {exc}")
        return None
    return parser


def rel_tokens(link: dict[str, str]) -> set[str]:
    return set(link.get("rel", "").lower().split())


def check_page_metadata(
    relative_path: Path,
    parser: PageParser,
    expected_lang: str,
    expected_dir: str,
    expected_canonical: str,
    errors: list[str],
) -> None:
    if parser.tags["!doctype"] != 1:
        add_error(errors, relative_path, "must contain one HTML5 doctype")
    if parser.html_attrs.get("lang", "").lower() != expected_lang:
        add_error(errors, relative_path, f"html lang must be {expected_lang!r}")
    if parser.html_attrs.get("dir", "").lower() != expected_dir:
        add_error(errors, relative_path, f"html dir must be {expected_dir!r}")
    if not "".join(parser.title_parts).strip():
        add_error(errors, relative_path, "document title is missing or empty")
    if parser.meta.get("charset", "").lower() != "utf-8":
        add_error(errors, relative_path, "UTF-8 charset metadata is missing")
    if "width=device-width" not in parser.meta.get("viewport", ""):
        add_error(errors, relative_path, "responsive viewport metadata is missing")
    if not parser.meta.get("description", "").strip():
        add_error(errors, relative_path, "meta description is missing or empty")
    if parser.tags["main"] != 1:
        add_error(errors, relative_path, "must contain exactly one main element")
    if parser.tags["h1"] != 1:
        add_error(errors, relative_path, "must contain exactly one h1 element")

    duplicates = sorted(item for item, count in Counter(parser.ids).items() if count > 1)
    if duplicates:
        add_error(errors, relative_path, f"duplicate IDs: {', '.join(duplicates)}")
    if "main-content" not in parser.ids:
        add_error(errors, relative_path, "main content needs id=\"main-content\"")
    if not any(tag == "a" and value == "#main-content" for tag, _, value in parser.references):
        add_error(errors, relative_path, "skip-to-content link is missing")

    if parser.classes["career-card"] != 9:
        add_error(errors, relative_path, "must contain all nine resume-based career entries")
    if parser.classes["career-facts"] != 9:
        add_error(errors, relative_path, "every career entry must use aligned date and location facts")
    if parser.classes["current-badge"] != 3:
        add_error(errors, relative_path, "must identify the three current career entries")
    if parser.classes["timeline"]:
        add_error(errors, relative_path, "legacy timeline markup must not be present")
    if parser.classes["tool-menu"] != 2:
        add_error(errors, relative_path, "must contain language and appearance dropdowns")
    if parser.classes["chevron"] != 2:
        add_error(errors, relative_path, "both dropdowns must use vector chevrons")
    if parser.classes["project-visual"] != 7:
        add_error(errors, relative_path, "must contain all seven project logo stages")
    if parser.classes["details-indicator"] != 7:
        add_error(errors, relative_path, "every project disclosure must use a vector indicator")
    if parser.classes["hero-portrait-frame"] != 1 or parser.classes["profile-portrait"] != 1:
        add_error(errors, relative_path, "hero must contain one framed profile portrait")
    for control_id in ("language-options", "appearance-options", "theme-select"):
        if control_id not in parser.ids:
            add_error(errors, relative_path, f"dropdown control {control_id!r} is missing")
    if len(parser.language_links) != 3:
        add_error(errors, relative_path, "language dropdown must contain exactly three locale links")
    elif sum("page" in link.get("aria-current", "").lower().split() for link in parser.language_links) != 1:
        add_error(errors, relative_path, "language dropdown must identify exactly one current locale")

    for image in parser.images:
        if "alt" not in image:
            add_error(errors, relative_path, f"image {image.get('src', '<unknown>')!r} has no alt attribute")
        if "profile-portrait" in image.get("class", "").split() and not image.get("alt", "").strip():
            add_error(errors, relative_path, "profile portrait needs meaningful alternative text")
    for link in parser.blank_links:
        if "noopener" not in link.get("rel", "").lower().split():
            add_error(errors, relative_path, f"target=_blank link lacks rel=noopener: {link.get('href', '<unknown>')}")

    canonical = [link.get("href", "") for link in parser.links if "canonical" in rel_tokens(link)]
    if canonical != [expected_canonical]:
        add_error(errors, relative_path, f"canonical must be exactly {expected_canonical!r}")

    alternates = {
        link.get("hreflang", "").lower(): link.get("href", "")
        for link in parser.links
        if "alternate" in rel_tokens(link) and link.get("hreflang")
    }
    if alternates != EXPECTED_ALTERNATES:
        add_error(errors, relative_path, "hreflang links must cover en, de, ar and x-default")

    if not any("icon" in rel_tokens(link) for link in parser.links):
        add_error(errors, relative_path, "favicon link is missing")
    if not any("apple-touch-icon" in rel_tokens(link) for link in parser.links):
        add_error(errors, relative_path, "Apple touch icon link is missing")
    if not any("manifest" in rel_tokens(link) for link in parser.links):
        add_error(errors, relative_path, "web app manifest link is missing")

    required_social = ("og:title", "og:description", "og:type", "og:url", "og:image", "twitter:card")
    for key in required_social:
        if not parser.meta.get(key, "").strip():
            add_error(errors, relative_path, f"social metadata {key!r} is missing")
    if parser.meta.get("og:url") != expected_canonical:
        add_error(errors, relative_path, "og:url must match the canonical URL")
    if parser.meta.get("og:image") != f"{ORIGIN}/assets/social-preview.png":
        add_error(errors, relative_path, "og:image must use the canonical social preview URL")
    if parser.meta.get("twitter:image") != f"{ORIGIN}/assets/social-preview.png":
        add_error(errors, relative_path, "twitter:image must use the canonical social preview URL")

    policy = parser.meta.get("content-security-policy", "")
    directives = (
        "script-src 'self'",
        "style-src 'self'",
        "connect-src 'none'",
        "object-src 'none'",
        "form-action 'none'",
        "upgrade-insecure-requests",
    )
    for directive in directives:
        if directive not in policy:
            add_error(errors, relative_path, f"Content Security Policy lacks {directive!r}")
    if "default-src 'none'" not in policy and "default-src 'self'" not in policy:
        add_error(errors, relative_path, "Content Security Policy needs a restrictive default-src")
    if "base-uri 'none'" not in policy and "base-uri 'self'" not in policy:
        add_error(errors, relative_path, "Content Security Policy needs a restrictive base-uri")
    if "'unsafe-inline'" in policy or "'unsafe-eval'" in policy:
        add_error(errors, relative_path, "Content Security Policy contains an unsafe script allowance")
    for inline_script in parser.inline_scripts:
        if not inline_script.strip():
            continue
        digest = base64.b64encode(hashlib.sha256(inline_script.encode("utf-8")).digest()).decode("ascii")
        if f"'sha256-{digest}'" not in policy:
            add_error(errors, relative_path, "inline script is not covered by its exact CSP hash")
    for location in parser.inline_styles_or_handlers:
        add_error(errors, relative_path, f"inline style or event handler is not allowed: {location}")


def local_target(source_page: Path, reference: str) -> Path | None:
    """Resolve a local browser URL to its repository path."""
    parsed = urlsplit(reference)
    if parsed.scheme in {"mailto", "tel"}:
        return None
    if parsed.scheme in {"http", "https"}:
        if f"{parsed.scheme}://{parsed.netloc}" != ORIGIN:
            return None
        url_path = parsed.path
    elif parsed.scheme or parsed.netloc:
        return None
    else:
        url_path = parsed.path

    if not url_path:
        return None
    decoded = unquote(url_path)
    if decoded.startswith("/"):
        target = ROOT / decoded.lstrip("/")
    else:
        target = ROOT / source_page.parent / decoded

    if decoded.endswith("/"):
        target = target / "index.html"
    return target.resolve()


def check_references(relative_path: Path, parser: PageParser, errors: list[str]) -> None:
    root_resolved = ROOT.resolve()
    page_ids = set(parser.ids)

    for tag, attr, reference in parser.references:
        if reference.startswith("#"):
            fragment = unquote(reference[1:])
            if fragment and fragment not in page_ids:
                add_error(errors, relative_path, f"broken fragment reference {reference!r}")
            continue

        target = local_target(relative_path, reference)
        if target is None:
            continue
        if target != root_resolved and root_resolved not in target.parents:
            add_error(errors, relative_path, f"reference leaves repository root: {reference!r}")
        elif not target.exists():
            add_error(errors, relative_path, f"missing local {attr} target for <{tag}>: {reference!r}")


def translation_shape(value: object) -> object:
    if isinstance(value, dict):
        return {key: translation_shape(item) for key, item in sorted(value.items())}
    if isinstance(value, list):
        return [translation_shape(item) for item in value]
    return type(value).__name__


def check_translations(errors: list[str]) -> None:
    documents: dict[str, object] = {}
    for locale in ("en", "de", "ar"):
        relative = Path("i18n") / f"{locale}.json"
        try:
            documents[locale] = json.loads((ROOT / relative).read_text(encoding="utf-8"))
        except FileNotFoundError:
            add_error(errors, relative, "translation file is missing")
        except (json.JSONDecodeError, UnicodeError) as exc:
            add_error(errors, relative, f"invalid translation JSON: {exc}")

    if len(documents) != 3:
        return
    baseline = translation_shape(documents["en"])
    for locale in ("de", "ar"):
        if translation_shape(documents[locale]) != baseline:
            add_error(errors, Path("i18n") / f"{locale}.json", "translation structure differs from en.json")

    def walk(value: object, location: str) -> None:
        if isinstance(value, dict):
            for key, item in value.items():
                walk(item, f"{location}.{key}")
        elif isinstance(value, list):
            for index, item in enumerate(value):
                walk(item, f"{location}[{index}]")
        elif isinstance(value, str) and not value.strip():
            add_error(errors, location, "translation string is empty")

    for locale, document in documents.items():
        walk(document, f"i18n/{locale}.json")


def check_manifest(errors: list[str]) -> None:
    relative = Path("site.webmanifest")
    try:
        manifest = json.loads((ROOT / relative).read_text(encoding="utf-8"))
    except FileNotFoundError:
        add_error(errors, relative, "manifest is missing")
        return
    except (json.JSONDecodeError, UnicodeError) as exc:
        add_error(errors, relative, f"manifest is invalid JSON: {exc}")
        return

    for key in ("name", "short_name", "start_url", "display", "icons"):
        if not manifest.get(key):
            add_error(errors, relative, f"required field {key!r} is missing")
    icons = manifest.get("icons", [])
    if not isinstance(icons, list):
        add_error(errors, relative, "icons must be an array")
        return
    for index, icon in enumerate(icons):
        if not isinstance(icon, dict) or not icon.get("src"):
            add_error(errors, relative, f"icon {index} has no src")
            continue
        target = local_target(relative, str(icon["src"]))
        if target is None or not target.is_file():
            add_error(errors, relative, f"icon {index} points to a missing file: {icon['src']!r}")
            continue
        declared_size = str(icon.get("sizes", ""))
        if icon.get("type") == "image/png" and re.fullmatch(r"\d+x\d+", declared_size):
            expected_size = tuple(int(part) for part in declared_size.split("x"))
            actual_size = png_size(target, errors)
            if actual_size is not None and actual_size != expected_size:
                add_error(
                    errors,
                    relative,
                    f"icon {index} declares {declared_size} but is {actual_size[0]}x{actual_size[1]}",
                )


def png_size(path: Path, errors: list[str]) -> tuple[int, int] | None:
    """Read PNG dimensions without an imaging dependency."""
    try:
        header = path.read_bytes()[:24]
    except OSError as exc:
        add_error(errors, path.relative_to(ROOT), f"cannot read image: {exc}")
        return None
    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        add_error(errors, path.relative_to(ROOT), "is not a valid PNG file")
        return None
    return struct.unpack(">II", header[16:24])


def check_social_preview(errors: list[str]) -> None:
    path = ROOT / "assets/social-preview.png"
    if not path.is_file():
        add_error(errors, "assets/social-preview.png", "social preview is missing")
        return
    dimensions = png_size(path, errors)
    if dimensions is not None and dimensions != (1200, 630):
        add_error(errors, "assets/social-preview.png", "social preview must be 1200x630 pixels")


def check_sitemap(errors: list[str]) -> None:
    relative = Path("sitemap.xml")
    try:
        tree = ET.parse(ROOT / relative)
    except FileNotFoundError:
        add_error(errors, relative, "sitemap is missing")
        return
    except ET.ParseError as exc:
        add_error(errors, relative, f"invalid XML: {exc}")
        return

    locations = {node.text.strip() for node in tree.findall(".//{*}loc") if node.text and node.text.strip()}
    expected = {item[2] for item in LOCALE_PAGES.values()}
    if locations != expected:
        add_error(errors, relative, "must list exactly the English, German and Arabic canonical URLs")


def check_css_references(errors: list[str]) -> None:
    pattern = re.compile(r"url\(\s*(['\"]?)(.*?)\1\s*\)", re.IGNORECASE)
    for path in ROOT.rglob("*.css"):
        if ".git" in path.parts:
            continue
        relative = path.relative_to(ROOT)
        text = path.read_text(encoding="utf-8")
        for _, reference in pattern.findall(text):
            reference = reference.strip()
            if not reference or reference.startswith(("#", "data:")):
                continue
            target = local_target(relative, reference)
            if target is not None and not target.is_file():
                add_error(errors, relative, f"missing CSS asset: {reference!r}")


def check_user_content(errors: list[str]) -> None:
    for path in ROOT.rglob("*"):
        if not path.is_file() or ".git" in path.parts or path.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeError as exc:
            add_error(errors, path.relative_to(ROOT), f"is not valid UTF-8: {exc}")
            continue
        if "\N{EM DASH}" in text:
            add_error(errors, path.relative_to(ROOT), "contains a disallowed em dash character")


def main() -> int:
    errors: list[str] = []
    parsed_pages: dict[Path, PageParser] = {}

    for page, (lang, direction, canonical) in LOCALE_PAGES.items():
        parser = parse_page(page, errors)
        if parser is None:
            continue
        parsed_pages[page] = parser
        check_page_metadata(page, parser, lang, direction, canonical, errors)
        check_references(page, parser, errors)

    not_found = parse_page(Path("404.html"), errors)
    if not_found is not None:
        check_references(Path("404.html"), not_found, errors)
        destinations = {value for tag, attr, value in not_found.references if tag == "a" and attr == "href"}
        for destination in ("/", "/de/", "/ar/"):
            if destination not in destinations:
                add_error(errors, Path("404.html"), f"missing locale destination {destination!r}")

    check_translations(errors)
    check_manifest(errors)
    check_social_preview(errors)
    check_sitemap(errors)
    check_css_references(errors)
    check_user_content(errors)

    if errors:
        print(f"Static site validation failed with {len(errors)} issue(s):", file=sys.stderr)
        for error in sorted(errors):
            print(f"  - {error}", file=sys.stderr)
        return 1

    print(f"Static site validation passed for {len(parsed_pages)} localized pages and the 404 page.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

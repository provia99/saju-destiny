#!/usr/bin/env python3
"""pdf_render.py — Playwright로 URL을 PDF로 저장 (독립 프로세스)
사용: python pdf_render.py <edit_url> <output_pdf_path> [session_cookie] [host]
"""
import sys
from playwright.sync_api import sync_playwright

def main():
    if len(sys.argv) < 3:
        print("usage: pdf_render.py <url> <output_pdf> [session_cookie] [host]", file=sys.stderr)
        sys.exit(1)
    url = sys.argv[1]
    out = sys.argv[2]
    session_cookie = sys.argv[3] if len(sys.argv) > 3 else ""
    host = sys.argv[4] if len(sys.argv) > 4 else "localhost"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        if session_cookie:
            context.add_cookies([{
                "name": "session", "value": session_cookie,
                "domain": host, "path": "/",
            }])
        page = context.new_page()
        page.goto(url, wait_until="networkidle", timeout=60000)
        try:
            page.wait_for_function(
                "() => window._fillerDone === true || document.querySelectorAll('.filler-block').length === 0",
                timeout=30000,
            )
        except Exception:
            pass
        page.wait_for_timeout(1500)
        page.pdf(
            path=out,
            print_background=True,
            prefer_css_page_size=True,
        )
        browser.close()
    print("OK")

if __name__ == "__main__":
    main()

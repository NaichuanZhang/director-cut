from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    print("Navigating to app...")
    page.goto("http://localhost:3001")
    page.wait_for_load_state("networkidle")

    print("Taking screenshot of main page...")
    page.screenshot(path="/tmp/saycut-main.png", full_page=False)
    print("Screenshot saved to /tmp/saycut-main.png")

    # Check page content
    title = page.title()
    print(f"Page title: {title}")

    # Check key elements are present
    content = page.content()
    checks = {
        "SayCut heading": "SayCut" in content,
        "Director panel": "Director" in content,
        "Voice orb": "Tap to speak" in content or "tap to speak" in content.lower(),
        "Empty state": "Direct your story" in content,
    }

    for name, found in checks.items():
        status = "OK" if found else "MISSING"
        print(f"  [{status}] {name}")

    browser.close()
    print("Done!")

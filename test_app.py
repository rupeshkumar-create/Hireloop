from playwright.sync_api import sync_playwright

def test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Catch any console errors
        errors = []
        def log_console(msg):
            if msg.type == "error":
                errors.append(msg.text)
        
        page.on("console", log_console)
        page.on("pageerror", lambda err: errors.append(str(err)))
        
        print("Navigating to localhost:3000...")
        response = page.goto('http://localhost:3000')
        print(f"Status code: {response.status if response else 'Unknown'}")
        
        page.wait_for_load_state('networkidle')
        
        print("Checking for console errors...")
        if errors:
            print("Found errors:")
            for error in errors:
                print(f"- {error}")
        else:
            print("No console errors found.")
            
        # Check title
        title = page.title()
        print(f"Page title: {title}")
        
        # Check if a specific element is present (e.g. the main h1)
        try:
            h1 = page.locator('h1').first.text_content()
            print(f"First H1: {h1}")
        except Exception as e:
            print(f"Could not find H1: {e}")
            
        page.screenshot(path='/tmp/hireschema_test.png', full_page=True)
        print("Saved screenshot to /tmp/hireschema_test.png")
        
        browser.close()

if __name__ == "__main__":
    test()

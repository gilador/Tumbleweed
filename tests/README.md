# E2E Tests with Playwright

## Setup

1. Install Playwright:

```bash
npm install -D @playwright/test
npx playwright install
```

2. Run tests:

```bash
# Run all tests
npm run test:e2e

# Run tests with UI
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Debug tests
npm run test:e2e:debug

# Generate test code
npm run codegen
```

## Writing Tests

- Use `data-testid` attributes for reliable element selection
- Use semantic selectors (roles, labels) when possible
- Tests are located in `tests/e2e/`

## Test Structure

- `add-staff-member.spec.ts` - Tests for adding and editing staff members

## Test Coverage

### Staff Management Tests

- **Add new staff member**: Verifies that clicking the add user button in edit mode creates a new staff member
- **Edit staff member name**: Tests the inline editing functionality for staff member names
- **Default workers load**: Ensures the app loads with default staff members on first visit

## Best Practices

1. **Wait for elements**: Always use `await expect().toBeVisible()` before interacting with elements
2. **Use semantic selectors**: Prefer `getByRole()`, `getByLabel()`, etc. over CSS selectors when possible
3. **Test IDs for complex elements**: Use `data-testid` for elements that are hard to select semantically
4. **Timeouts**: Use appropriate timeouts for async operations (app sync, animations)
5. **Clean state**: Each test should be independent and not rely on state from other tests

## Configuration

The Playwright configuration (`playwright.config.ts`) includes:

- Multiple browser testing (Chromium, Firefox, WebKit)
- Automatic dev server startup
- Trace collection on test failures
- CI-optimized settings

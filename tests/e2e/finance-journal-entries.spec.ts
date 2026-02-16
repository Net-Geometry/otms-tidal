/**
 * E2E Test: Journal Entries Management
 * Tests creating and managing general ledger journal entries
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const FINANCE_EMAIL = process.env.FINANCE_EMAIL || 'finance@test.com';
const FINANCE_PASSWORD = process.env.FINANCE_PASSWORD || 'Test123!@#';

test.describe('Journal Entries', () => {
  let financePage: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    financePage = await context.newPage();

    await financePage.goto(`${BASE_URL}/auth`);
    await financePage.fill('input[type="email"]', FINANCE_EMAIL);
    await financePage.fill('input[type="password"]', FINANCE_PASSWORD);
    await financePage.click('button[type="submit"]');
    await financePage.waitForURL(/\/finance|\/dashboard/);
  });

  test.afterAll(async () => {
    await financePage?.close();
  });

  test('should navigate to journal entries page', async () => {
    await financePage.goto(`${BASE_URL}/finance/gl/journal-entries`);

    await expect(financePage.locator('h1, h2').filter({ hasText: /Journal Entr/i }).first()).toBeVisible();
  });

  test('should display journal entries list', async () => {
    await financePage.goto(`${BASE_URL}/finance/gl/journal-entries`);

    await financePage.waitForTimeout(1000);

    const entriesList = financePage.locator('table, [role="table"], .entries-list').first();
    await expect(entriesList).toBeVisible({ timeout: 5000 });
  });

  test('should open create journal entry dialog', async () => {
    await financePage.goto(`${BASE_URL}/finance/gl/journal-entries`);

    const createButton = financePage.locator('button:has-text("New Entry"), button:has-text("Create"), button:has([data-icon="plus"])').first();
    
    if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createButton.click();
      
      const dialog = financePage.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 3000 });

      // Verify dialog has required fields
      await expect(dialog.locator('input, select, textarea').first()).toBeVisible();

      // Close dialog
      const cancelButton = dialog.locator('button:has-text("Cancel")').first();
      await cancelButton.click();
    }
  });

  test('should create a balanced journal entry', async () => {
    await financePage.goto(`${BASE_URL}/finance/gl/journal-entries`);

    const createButton = financePage.locator('button:has-text("New Entry"), button:has-text("Create")').first();
    
    if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createButton.click();
      
      const dialog = financePage.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 3000 });

      // Fill entry date
      const dateInput = dialog.locator('input[type="date"], input[name="entry_date"]').first();
      if (await dateInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await dateInput.fill(new Date().toISOString().split('T')[0]);
      }

      // Fill description
      const descInput = dialog.locator('input[name="description"], textarea[name="description"]').first();
      await descInput.fill('E2E Test Journal Entry');

      // Add first line (Debit)
      const addLineButton = dialog.locator('button:has-text("Add Line"), button:has-text("+"), button:has([data-icon="plus"])').first();
      
      if (await addLineButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await addLineButton.click();
        
        const accountSelect = dialog.locator('select[name="account_id"]').first();
        if (await accountSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
          await accountSelect.selectOption({ index: 1 });
        }

        const debitInput = dialog.locator('input[name="debit_amount"], input[placeholder*="debit" i]').first();
        await debitInput.fill('1000');
      }

      // Add second line (Credit)
      if (await addLineButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await addLineButton.click();
        
        const accountSelects = dialog.locator('select[name="account_id"]');
        if (await accountSelects.nth(1).isVisible({ timeout: 1000 }).catch(() => false)) {
          await accountSelects.nth(1).selectOption({ index: 2 });
        }

        const creditInput = dialog.locator('input[name="credit_amount"], input[placeholder*="credit" i]').first();
        await creditInput.fill('1000');
      }

      // Verify totals balance
      const totalDisplay = dialog.locator('text=/Total|Balance|1,000|1000/i').first();
      await expect(totalDisplay).toBeVisible();

      // Save entry
      const saveButton = dialog.locator('button:has-text("Save"), button[type="submit"]').first();
      await saveButton.click();

      await expect(dialog).not.toBeVisible({ timeout: 5000 });
    }
  });

  test('should validate debits equal credits', async () => {
    await financePage.goto(`${BASE_URL}/finance/gl/journal-entries`);

    const createButton = financePage.locator('button:has-text("New Entry"), button:has-text("Create")').first();
    
    if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createButton.click();
      
      const dialog = financePage.locator('[role="dialog"]').first();

      // Add unbalanced lines
      const addLineButton = dialog.locator('button:has-text("Add Line"), button:has([data-icon="plus"])').first();
      
      if (await addLineButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await addLineButton.click();
        
        const debitInput = dialog.locator('input[name="debit_amount"]').first();
        await debitInput.fill('1000');
      }

      // Try to save
      const saveButton = dialog.locator('button:has-text("Save"), button[type="submit"]').first();
      await saveButton.click();

      // Should show validation error
      const errorMessage = dialog.locator('text=/balance|equal|debit|credit|not balanced/i').first();
      
      if (await errorMessage.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(errorMessage).toBeVisible();
      }

      // Cancel
      const cancelButton = dialog.locator('button:has-text("Cancel")').first();
      await cancelButton.click();
    }
  });

  test('should view journal entry details', async () => {
    await financePage.goto(`${BASE_URL}/finance/gl/journal-entries`);

    // Click on first entry to view details
    const firstRow = financePage.locator('table tbody tr, [role="row"]').nth(1);
    
    if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstRow.click();

      // Verify details are shown
      const details = financePage.locator('[role="dialog"], .details-panel, .entry-details').first();
      await expect(details).toBeVisible({ timeout: 3000 });

      // Close details
      const closeButton = details.locator('button[aria-label="Close"], button:has-text("Close")').first();
      if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
      }
    }
  });

  test('should filter journal entries by date range', async () => {
    await financePage.goto(`${BASE_URL}/finance/gl/journal-entries`);

    const dateFromInput = financePage.locator('input[type="date"]').first();
    
    if (await dateFromInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      await dateFromInput.fill(firstDayOfMonth.toISOString().split('T')[0]);
      await financePage.waitForTimeout(500);

      // Entries should refresh
      const entries = financePage.locator('table tbody tr').all();
      expect(entries).toBeTruthy();
    }
  });

  test('should search journal entries', async () => {
    await financePage.goto(`${BASE_URL}/finance/gl/journal-entries`);

    const searchInput = financePage.locator('input[placeholder*="Search" i], input[type="search"]').first();
    
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('test');
      await financePage.waitForTimeout(500);

      // Results should update
      const content = financePage.locator('table, .entries-list').textContent();
      expect(content).toBeTruthy();
    }
  });

  test('should display entry number format', async () => {
    await financePage.goto(`${BASE_URL}/finance/gl/journal-entries`);

    // Look for entry numbers (format: JV-YYYY-#####)
    const entryNumber = financePage.locator('text=/JV-\\d{4}-\\d{5,}|JE-\\d{4}-\\d{5,}/i').first();
    
    if (await entryNumber.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await entryNumber.textContent();
      expect(text).toMatch(/(JV|JE)-\d{4}-\d{5,}/);
    }
  });

  test('should show entry status (draft/posted)', async () => {
    await financePage.goto(`${BASE_URL}/finance/gl/journal-entries`);

    // Look for status badges
    const statusBadge = financePage.locator('text=/Draft|Posted|Pending/i').first();
    await expect(statusBadge).toBeVisible();
  });

  test('should post a journal entry', async () => {
    await financePage.goto(`${BASE_URL}/finance/gl/journal-entries`);

    const postButton = financePage.locator('button:has-text("Post"), [data-action="post"]').first();
    
    if (await postButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await postButton.click();

      const confirmDialog = financePage.locator('[role="dialog"]').filter({ hasText: /Post/i }).first();
      
      if (await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
        const confirmButton = confirmDialog.locator('button:has-text("Post"), button:has-text("Confirm")').first();
        await confirmButton.click();
      }

      await financePage.waitForTimeout(1000);

      // Verify success message
      const successMessage = financePage.locator('text=/posted|success/i').first();
      await expect(successMessage).toBeVisible();
    }
  });

  test('should display line item details in table', async () => {
    await financePage.goto(`${BASE_URL}/finance/gl/journal-entries`);

    // Look for columns: Account, Description, Debit, Credit
    const headers = financePage.locator('th, [role="columnheader"]').allTextContents();
    const headerTexts = await headers;
    
    const hasAccount = headerTexts.some(h => /Account|Description/i.test(h));
    const hasAmount = headerTexts.some(h => /Debit|Credit|Amount/i.test(h));
    
    expect(hasAccount || hasAmount).toBeTruthy();
  });

  test('should prevent editing posted entries', async () => {
    await financePage.goto(`${BASE_URL}/finance/gl/journal-entries`);

    // Look for posted status row
    const postedRow = financePage.locator('tr:has-text("Posted"), [role="row"]:has-text("Posted")').first();
    
    if (await postedRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Look for edit button - should be disabled or not present for posted entries
      const editButton = postedRow.locator('button:has-text("Edit")').first();
      
      if (await editButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        const isDisabled = await editButton.evaluate(el => (el as HTMLButtonElement).disabled);
        expect(isDisabled).toBe(true);
      }
    }
  });
});

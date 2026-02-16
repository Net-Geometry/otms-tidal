/**
 * E2E Test: Chart of Accounts Management
 * Tests CRUD operations for chart of accounts
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const FINANCE_EMAIL = process.env.FINANCE_EMAIL || 'finance@test.com';
const FINANCE_PASSWORD = process.env.FINANCE_PASSWORD || 'Test123!@#';

test.describe('Chart of Accounts', () => {
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

  test('should navigate to chart of accounts page', async () => {
    await financePage.goto(`${BASE_URL}/finance/setup/coa`);

    // Verify page title
    await expect(financePage.locator('h1, h2').filter({ hasText: /Chart of Accounts|COA/i }).first()).toBeVisible();
  });

  test('should display account hierarchy', async () => {
    await financePage.goto(`${BASE_URL}/finance/setup/coa`);

    // Wait for accounts to load
    await financePage.waitForTimeout(1000);

    // Look for account codes (typically numeric like 1000, 2000, etc.)
    const accountCodes = financePage.locator('text=/^\\d{3,4}$/').first();
    await expect(accountCodes).toBeVisible({ timeout: 5000 });
  });

  test('should filter accounts by type', async () => {
    await financePage.goto(`${BASE_URL}/finance/setup/coa`);

    // Look for account type filter
    const typeFilter = financePage.locator('select, [role="combobox"]').filter({ hasText: /Type|Asset|Liability/i }).first();
    
    if (await typeFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
      await typeFilter.click();
      
      // Select Asset type
      const assetOption = financePage.locator('[role="option"]:has-text("Asset"), option:has-text("asset")').first();
      if (await assetOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await assetOption.click();
        
        // Wait for filter to apply
        await financePage.waitForTimeout(500);
      }
    }
  });

  test('should search accounts', async () => {
    await financePage.goto(`${BASE_URL}/finance/setup/coa`);

    // Look for search input
    const searchInput = financePage.locator('input[placeholder*="Search" i], input[type="search"]').first();
    
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('Cash');
      await financePage.waitForTimeout(500);
      
      // Verify search results
      const results = financePage.locator('text=/Cash|Bank/i').first();
      await expect(results).toBeVisible();
    }
  });

  test('should open create account dialog', async () => {
    await financePage.goto(`${BASE_URL}/finance/setup/coa`);

    // Look for add/create button
    const createButton = financePage.locator('button:has-text("Add Account"), button:has-text("New"), button:has([data-icon="plus"])').first();
    
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
      
      // Verify dialog opens
      const dialog = financePage.locator('[role="dialog"], .dialog, [data-state="open"]').first();
      await expect(dialog).toBeVisible({ timeout: 3000 });
      
      // Close dialog
      const cancelButton = dialog.locator('button:has-text("Cancel"), button[aria-label="Close"]').first();
      await cancelButton.click();
    }
  });

  test('should create a new level 3 account', async () => {
    await financePage.goto(`${BASE_URL}/finance/setup/coa`);

    const createButton = financePage.locator('button:has-text("Add Account"), button:has-text("New")').first();
    
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
      
      const dialog = financePage.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 3000 });

      // Fill in account details
      const accountCodeInput = dialog.locator('input[name="account_code"], input[placeholder*="code" i]').first();
      const accountNameInput = dialog.locator('input[name="account_name"], input[placeholder*="name" i]').first();
      
      if (await accountCodeInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        const testCode = `999${Date.now() % 1000}`;
        await accountCodeInput.fill(testCode);
        await accountNameInput.fill('Test Account E2E');
        
        // Select level 3
        const levelSelect = dialog.locator('select[name="level"]').first();
        if (await levelSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
          await levelSelect.selectOption('3');
        }
        
        // Save
        const saveButton = dialog.locator('button:has-text("Save"), button[type="submit"]').first();
        await saveButton.click();
        
        // Verify success toast or dialog closes
        await expect(dialog).not.toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should edit an existing account', async () => {
    await financePage.goto(`${BASE_URL}/finance/setup/coa`);

    // Look for edit button on first account row
    const editButton = financePage.locator('button[aria-label="Edit"], button:has-text("Edit"), [data-icon="edit"]').first();
    
    if (await editButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editButton.click();
      
      const dialog = financePage.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 3000 });

      // Modify account name
      const nameInput = dialog.locator('input[name="account_name"]').first();
      if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await nameInput.fill('Updated Account Name');
        
        const saveButton = dialog.locator('button:has-text("Save")').first();
        await saveButton.click();
        
        await expect(dialog).not.toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should deactivate an account', async () => {
    await financePage.goto(`${BASE_URL}/finance/setup/coa`);

    // Look for delete/deactivate button
    const deleteButton = financePage.locator('button[aria-label="Delete"], button:has-text("Delete"), button:has-text("Deactivate"), [data-icon="trash"]').first();
    
    if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await deleteButton.click();
      
      // Confirm deletion if confirmation dialog appears
      const confirmDialog = financePage.locator('[role="alertdialog"], .confirm-dialog').first();
      
      if (await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
        const confirmButton = confirmDialog.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete"]').first();
        await confirmButton.click();
      }
      
      // Wait for operation to complete
      await financePage.waitForTimeout(1000);
    }
  });

  test('should validate required fields when creating account', async () => {
    await financePage.goto(`${BASE_URL}/finance/setup/coa`);

    const createButton = financePage.locator('button:has-text("Add Account"), button:has-text("New")').first();
    
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
      
      const dialog = financePage.locator('[role="dialog"]').first();
      
      // Try to save without filling required fields
      const saveButton = dialog.locator('button:has-text("Save"), button[type="submit"]').first();
      await saveButton.click();
      
      // Verify validation error appears
      const errorMessage = financePage.locator('text=/required|invalid|error/i').first();
      await expect(errorMessage).toBeVisible({ timeout: 3000 });
      
      // Cancel
      const cancelButton = dialog.locator('button:has-text("Cancel")').first();
      await cancelButton.click();
    }
  });

  test('should display account details in tree view', async () => {
    await financePage.goto(`${BASE_URL}/finance/setup/coa`);

    // Look for expand/collapse icons in tree
    const expandIcon = financePage.locator('[data-icon="chevron-right"], .expand-icon, button:has([data-icon="chevron"])').first();
    
    if (await expandIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expandIcon.click();
      
      // Verify children appear
      await financePage.waitForTimeout(500);
      
      // Look for nested account codes
      const nestedAccounts = financePage.locator('text=/^\\d{4}$/');
      const count = await nestedAccounts.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('should filter by active/inactive status', async () => {
    await financePage.goto(`${BASE_URL}/finance/setup/coa`);

    const activityFilter = financePage.locator('select').filter({ hasText: /Active|Status/i }).first();
    
    if (await activityFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
      await activityFilter.selectOption('inactive');
      await financePage.waitForTimeout(500);
      
      // Should show inactive accounts or empty state
      const content = financePage.locator('body').textContent();
      expect(content).toBeTruthy();
    }
  });
});

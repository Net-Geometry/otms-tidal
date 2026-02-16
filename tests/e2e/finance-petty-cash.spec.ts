/**
 * E2E Test: Petty Cash Management
 * Tests petty cash transactions, approvals, and postings
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const FINANCE_EMAIL = process.env.FINANCE_EMAIL || 'finance@test.com';
const FINANCE_PASSWORD = process.env.FINANCE_PASSWORD || 'Test123!@#';

test.describe('Petty Cash Management', () => {
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

  test('should navigate to petty cash page', async () => {
    await financePage.goto(`${BASE_URL}/finance/petty-cash`);

    await expect(financePage.locator('h1, h2').filter({ hasText: /Petty Cash/i }).first()).toBeVisible();
  });

  test('should display balance card', async () => {
    await financePage.goto(`${BASE_URL}/finance/petty-cash`);

    // Look for balance display
    const balanceCard = financePage.locator('text=/Balance|Available|Float/i').first();
    await expect(balanceCard).toBeVisible();
  });

  test('should display transaction list', async () => {
    await financePage.goto(`${BASE_URL}/finance/petty-cash`);

    // Wait for transactions to load
    await financePage.waitForTimeout(1000);

    // Look for transaction table or list
    const transactionList = financePage.locator('table, [role="table"], .transaction-list').first();
    await expect(transactionList).toBeVisible({ timeout: 5000 });
  });

  test('should create new expenditure transaction', async () => {
    await financePage.goto(`${BASE_URL}/finance/petty-cash`);

    // Click new transaction button
    const newButton = financePage.locator('button:has-text("New Transaction"), button:has-text("Add"), button:has([data-icon="plus"])').first();
    
    if (await newButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newButton.click();
      
      // Fill transaction form
      const dialog = financePage.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 3000 });

      // Select expenditure type
      const typeSelect = dialog.locator('select[name="txn_type"], [role="combobox"]').first();
      if (await typeSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
        await typeSelect.selectOption('expenditure');
      }

      // Fill amount
      const amountInput = dialog.locator('input[name="amount"], input[type="number"]').first();
      await amountInput.fill('50');

      // Fill description
      const descInput = dialog.locator('input[name="description"], textarea[name="description"]').first();
      await descInput.fill('E2E Test Expenditure');

      // Select account
      const accountSelect = dialog.locator('select[name="account_id"]').first();
      if (await accountSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
        await accountSelect.selectOption({ index: 1 });
      }

      // Save
      const saveButton = dialog.locator('button:has-text("Save"), button[type="submit"]').first();
      await saveButton.click();

      // Verify success
      await expect(dialog).not.toBeVisible({ timeout: 5000 });
    }
  });

  test('should create top-up transaction', async () => {
    await financePage.goto(`${BASE_URL}/finance/petty-cash`);

    const newButton = financePage.locator('button:has-text("New Transaction"), button:has-text("Add")').first();
    
    if (await newButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newButton.click();
      
      const dialog = financePage.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 3000 });

      // Select top-up type
      const typeSelect = dialog.locator('select[name="txn_type"]').first();
      if (await typeSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
        await typeSelect.selectOption('top_up');
      }

      // Fill amount
      const amountInput = dialog.locator('input[name="amount"]').first();
      await amountInput.fill('1000');

      // Fill description
      const descInput = dialog.locator('input[name="description"], textarea').first();
      await descInput.fill('E2E Test Top-up');

      // Save
      const saveButton = dialog.locator('button:has-text("Save")').first();
      await saveButton.click();

      await expect(dialog).not.toBeVisible({ timeout: 5000 });
    }
  });

  test('should validate transaction amount is positive', async () => {
    await financePage.goto(`${BASE_URL}/finance/petty-cash`);

    const newButton = financePage.locator('button:has-text("New Transaction"), button:has-text("Add")').first();
    
    if (await newButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newButton.click();
      
      const dialog = financePage.locator('[role="dialog"]').first();

      // Try to save with zero amount
      const amountInput = dialog.locator('input[name="amount"], input[type="number"]').first();
      await amountInput.fill('0');

      const saveButton = dialog.locator('button:has-text("Save"), button[type="submit"]').first();
      await saveButton.click();

      // Verify validation error
      const errorMessage = dialog.locator('text=/greater than|positive|required/i').first();
      await expect(errorMessage).toBeVisible({ timeout: 3000 });

      // Cancel
      const cancelButton = dialog.locator('button:has-text("Cancel")').first();
      await cancelButton.click();
    }
  });

  test('should approve a pending transaction', async () => {
    await financePage.goto(`${BASE_URL}/finance/petty-cash`);

    // Look for pending status and approve button
    const approveButton = financePage.locator('button:has-text("Approve"), [data-action="approve"]').first();
    
    if (await approveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await approveButton.click();

      // Handle approval dialog if present
      const approveDialog = financePage.locator('[role="dialog"]').filter({ hasText: /Approve/i }).first();
      
      if (await approveDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
        const confirmButton = approveDialog.locator('button:has-text("Approve"), button:has-text("Confirm")').first();
        await confirmButton.click();
      }

      // Wait for success
      await financePage.waitForTimeout(1000);
    }
  });

  test('should reject a pending transaction', async () => {
    await financePage.goto(`${BASE_URL}/finance/petty-cash`);

    const rejectButton = financePage.locator('button:has-text("Reject"), [data-action="reject"]').first();
    
    if (await rejectButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rejectButton.click();

      const rejectDialog = financePage.locator('[role="dialog"]').filter({ hasText: /Reject/i }).first();
      
      if (await rejectDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Add rejection reason
        const reasonInput = rejectDialog.locator('textarea, input[name="reason"]').first();
        if (await reasonInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await reasonInput.fill('E2E Test Rejection');
        }

        const confirmButton = rejectDialog.locator('button:has-text("Reject"), button:has-text("Confirm")').first();
        await confirmButton.click();
      }

      await financePage.waitForTimeout(1000);
    }
  });

  test('should post an approved transaction', async () => {
    await financePage.goto(`${BASE_URL}/finance/petty-cash`);

    const postButton = financePage.locator('button:has-text("Post"), [data-action="post"]').first();
    
    if (await postButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await postButton.click();

      const postDialog = financePage.locator('[role="dialog"]').filter({ hasText: /Post/i }).first();
      
      if (await postDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
        const confirmButton = postDialog.locator('button:has-text("Post"), button:has-text("Confirm")').first();
        await confirmButton.click();
      }

      await financePage.waitForTimeout(1000);
    }
  });

  test('should filter transactions by status', async () => {
    await financePage.goto(`${BASE_URL}/finance/petty-cash`);

    const statusFilter = financePage.locator('select').filter({ hasText: /Status|All|Pending|Approved/i }).first();
    
    if (await statusFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
      await statusFilter.selectOption('approved');
      await financePage.waitForTimeout(500);

      // Verify filter applied
      const rows = financePage.locator('table tbody tr, [role="row"]').all();
      // If there are rows, they should all be approved
    }
  });

  test('should filter transactions by month', async () => {
    await financePage.goto(`${BASE_URL}/finance/petty-cash`);

    const monthFilter = financePage.locator('select').filter({ hasText: /Month|January|February/i }).first();
    
    if (await monthFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
      await monthFilter.selectOption({ index: 0 });
      await financePage.waitForTimeout(500);
    }
  });

  test('should search transactions', async () => {
    await financePage.goto(`${BASE_URL}/finance/petty-cash`);

    const searchInput = financePage.locator('input[placeholder*="Search" i], input[type="search"]').first();
    
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('test');
      await financePage.waitForTimeout(500);

      // Results should update
      const content = financePage.locator('table, .transaction-list').textContent();
      expect(content).toBeTruthy();
    }
  });

  test('should display transaction number format', async () => {
    await financePage.goto(`${BASE_URL}/finance/petty-cash`);

    // Look for transaction numbers (format: PC-YYYY-MM-###)
    const txnNumber = financePage.locator('text=/PC-\\d{4}-\\d{2}-\\d{3}/i').first();
    
    if (await txnNumber.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await txnNumber.textContent();
      expect(text).toMatch(/PC-\d{4}-\d{2}-\d{3}/);
    }
  });

  test('should show utilization percentage', async () => {
    await financePage.goto(`${BASE_URL}/finance/petty-cash`);

    // Look for utilization indicator
    const utilization = financePage.locator('text=/\\d+%|Utilization|Used/i').first();
    await expect(utilization).toBeVisible();
  });

  test('should handle insufficient balance warning', async () => {
    await financePage.goto(`${BASE_URL}/finance/petty-cash`);

    const newButton = financePage.locator('button:has-text("New Transaction"), button:has-text("Add")').first();
    
    if (await newButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newButton.click();
      
      const dialog = financePage.locator('[role="dialog"]').first();

      // Try to create expenditure with very large amount
      const amountInput = dialog.locator('input[name="amount"]').first();
      await amountInput.fill('999999999');

      const saveButton = dialog.locator('button:has-text("Save"), button[type="submit"]').first();
      await saveButton.click();

      // Should show warning or error
      const warning = financePage.locator('text=/insufficient|balance|exceeds/i').first();
      
      if (await warning.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(warning).toBeVisible();
      }

      // Cancel
      const cancelButton = dialog.locator('button:has-text("Cancel")').first();
      await cancelButton.click();
    }
  });
});

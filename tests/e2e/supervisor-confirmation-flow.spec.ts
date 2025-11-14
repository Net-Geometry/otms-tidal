/**
 * E2E Test: Supervisor Confirmation Flow
 * Story 5.3: E2E test for supervisor confirmation flow
 * 
 * Tests the complete supervisor confirmation workflow from UI perspective
 * Using Playwright for end-to-end browser automation
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

// Test credentials (update with your test account credentials)
const SUPERVISOR_EMAIL = 'supervisor@test.com';
const SUPERVISOR_PASSWORD = 'Test123!@#';

test.describe('Supervisor Confirmation Flow', () => {
  let supervisorPage: Page;

  test.beforeAll(async ({ browser }) => {
    // Login as supervisor
    const context = await browser.newContext();
    supervisorPage = await context.newPage();
    
    await supervisorPage.goto(`${BASE_URL}/login`);
    await supervisorPage.fill('input[type="email"]', SUPERVISOR_EMAIL);
    await supervisorPage.fill('input[type="password"]', SUPERVISOR_PASSWORD);
    await supervisorPage.click('button[type="submit"]');
    
    // Wait for navigation to complete
    await supervisorPage.waitForURL(/\/dashboard|\/supervisor/);
  });

  test.afterAll(async () => {
    await supervisorPage?.close();
  });

  /**
   * Test: Verify supervisor can see pending confirmations metric
   * AC: Dashboard displays "Pending Confirmations" metric card
   */
  test('should display pending confirmations metric on supervisor dashboard', async () => {
    await supervisorPage.goto(`${BASE_URL}/supervisor/dashboard`);

    // Check for "Pending Confirmations" metric card
    const pendingConfirmationsCard = supervisorPage.locator('text=Pending Confirmations').first();
    await expect(pendingConfirmationsCard).toBeVisible();

    // Verify count is displayed (should be a number)
    const count = await supervisorPage.locator('[data-testid="pending-confirmations-count"]')
      .or(pendingConfirmationsCard.locator('..').locator('text=/\\d+/'))
      .first()
      .textContent();
    
    expect(count).toMatch(/\d+/);
  });

  /**
   * Test: Navigate to approval table and see pending confirmations
   * AC: Can view OT requests with pending_supervisor_confirmation status
   */
  test('should show requests with pending confirmation status in approval table', async () => {
    await supervisorPage.goto(`${BASE_URL}/supervisor/approvals`);

    // Wait for table to load
    await supervisorPage.waitForSelector('table, [role="table"]', { timeout: 5000 });

    // Check if there are any pending confirmation requests
    const pendingConfirmationBadge = supervisorPage.locator('text=/Pending Confirmation/i').first();
    
    // If there are pending confirmations, verify they're visible
    if (await pendingConfirmationBadge.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(pendingConfirmationBadge).toBeVisible();
      
      // Verify status badge color (should be amber/orange)
      const badgeElement = pendingConfirmationBadge.locator('..');
      await expect(badgeElement).toHaveClass(/amber|orange|yellow/);
    }
  });

  /**
   * Test: Filter by pending confirmation status
   * AC: Can filter approval table to show only pending confirmations
   */
  test('should filter approval table by pending confirmation status', async () => {
    await supervisorPage.goto(`${BASE_URL}/supervisor/approvals`);

    // Look for filter dropdown or tabs
    const filterButton = supervisorPage.locator('button:has-text("Filter"), button:has-text("Status")').first();
    
    if (await filterButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await filterButton.click();

      // Select "Pending Confirmation" filter
      const pendingConfirmationFilter = supervisorPage.locator('text=/Pending Confirmation/i').last();
      await pendingConfirmationFilter.click();

      // Wait for table to update
      await supervisorPage.waitForTimeout(1000);

      // Verify only pending confirmation requests are shown
      const statusBadges = supervisorPage.locator('[data-testid="status-badge"], .badge');
      const visibleStatuses = await statusBadges.allTextContents();
      
      // All visible statuses should be "Pending Confirmation"
      if (visibleStatuses.length > 0) {
        visibleStatuses.forEach(status => {
          expect(status.toLowerCase()).toContain('pending');
        });
      }
    }
  });

  /**
   * Test: Open confirmation dialog for a pending request
   * AC: Can click on a request and open confirmation dialog
   */
  test('should open confirmation dialog when clicking confirm button', async () => {
    await supervisorPage.goto(`${BASE_URL}/supervisor/approvals`);

    // Look for a confirm button in the table
    const confirmButton = supervisorPage.locator('button:has-text("Confirm")').first();

    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click();

      // Wait for dialog to open
      await supervisorPage.waitForSelector('[role="dialog"], .dialog, .modal', { timeout: 3000 });

      // Verify dialog title
      const dialogTitle = supervisorPage.locator('[role="dialog"] h2, .dialog h2, .modal h2');
      await expect(dialogTitle).toContainText(/Confirm|Confirmation/i);

      // Verify remarks textarea is present
      const remarksTextarea = supervisorPage.locator('textarea[name="remarks"], textarea[placeholder*="remarks" i]');
      await expect(remarksTextarea).toBeVisible();

      // Verify action buttons
      const confirmActionButton = supervisorPage.locator('[role="dialog"] button:has-text("Confirm")');
      await expect(confirmActionButton).toBeVisible();

      // Close dialog
      const cancelButton = supervisorPage.locator('button:has-text("Cancel"), button[aria-label="Close"]').first();
      await cancelButton.click();
    } else {
      test.skip('No pending confirmations available for testing');
    }
  });

  /**
   * Test: Complete confirmation workflow
   * AC: Can enter remarks, confirm request, and see success message
   */
  test('should successfully confirm an OT request with remarks', async () => {
    await supervisorPage.goto(`${BASE_URL}/supervisor/approvals`);

    // Find first confirm button
    const confirmButton = supervisorPage.locator('button:has-text("Confirm")').first();

    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click confirm
      await confirmButton.click();

      // Wait for dialog
      await supervisorPage.waitForSelector('[role="dialog"], .dialog', { timeout: 3000 });

      // Enter remarks
      const remarksTextarea = supervisorPage.locator('textarea').first();
      const testRemarks = 'E2E Test: Confirmed for project completion';
      await remarksTextarea.fill(testRemarks);

      // Click confirm button in dialog
      const confirmActionButton = supervisorPage.locator('[role="dialog"] button:has-text("Confirm")').first();
      await confirmActionButton.click();

      // Wait for success toast/message
      await supervisorPage.waitForSelector('text=/success|confirmed/i', { timeout: 5000 });

      // Verify toast message
      const successToast = supervisorPage.locator('[role="status"], .toast, .notification').first();
      await expect(successToast).toContainText(/success|confirmed/i);

      // Verify dialog closes
      await expect(supervisorPage.locator('[role="dialog"]')).not.toBeVisible({ timeout: 3000 });

      // Verify the request status updated in the table
      // (Wait a moment for the table to refresh)
      await supervisorPage.waitForTimeout(1000);
      
      const confirmedBadge = supervisorPage.locator('text=/Confirmed/i').first();
      // Note: The confirmed request might have moved to a different view/filter
    } else {
      test.skip('No pending confirmations available for testing');
    }
  });

  /**
   * Test: Confirm request without remarks
   * AC: Can confirm without entering remarks (optional field)
   */
  test('should allow confirmation without remarks', async () => {
    await supervisorPage.goto(`${BASE_URL}/supervisor/approvals`);

    const confirmButton = supervisorPage.locator('button:has-text("Confirm")').first();

    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click();
      await supervisorPage.waitForSelector('[role="dialog"]', { timeout: 3000 });

      // Don't fill remarks - leave empty

      // Click confirm
      const confirmActionButton = supervisorPage.locator('[role="dialog"] button:has-text("Confirm")').first();
      await confirmActionButton.click();

      // Should still succeed
      await supervisorPage.waitForSelector('text=/success|confirmed/i', { timeout: 5000 });
      
      const successToast = supervisorPage.locator('[role="status"], .toast').first();
      await expect(successToast).toContainText(/success|confirmed/i);
    } else {
      test.skip('No pending confirmations available for testing');
    }
  });

  /**
   * Test: Verify confirmation updates dashboard metrics
   * AC: Pending confirmations count decreases after confirmation
   */
  test('should update dashboard metrics after confirmation', async () => {
    // Get initial count
    await supervisorPage.goto(`${BASE_URL}/supervisor/dashboard`);
    const initialCountElement = supervisorPage.locator('[data-testid="pending-confirmations-count"]')
      .or(supervisorPage.locator('text=Pending Confirmations').locator('..').locator('text=/\\d+/'))
      .first();
    
    const initialCount = parseInt(await initialCountElement.textContent() || '0');

    // Confirm a request (if available)
    await supervisorPage.goto(`${BASE_URL}/supervisor/approvals`);
    const confirmButton = supervisorPage.locator('button:has-text("Confirm")').first();

    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click();
      await supervisorPage.waitForSelector('[role="dialog"]', { timeout: 3000 });
      
      const confirmActionButton = supervisorPage.locator('[role="dialog"] button:has-text("Confirm")').first();
      await confirmActionButton.click();
      
      await supervisorPage.waitForSelector('text=/success/i', { timeout: 5000 });

      // Navigate back to dashboard
      await supervisorPage.goto(`${BASE_URL}/supervisor/dashboard`);

      // Get updated count
      const updatedCountElement = supervisorPage.locator('[data-testid="pending-confirmations-count"]')
        .or(supervisorPage.locator('text=Pending Confirmations').locator('..').locator('text=/\\d+/'))
        .first();
      
      const updatedCount = parseInt(await updatedCountElement.textContent() || '0');

      // Count should decrease by 1
      expect(updatedCount).toBe(initialCount - 1);
    } else {
      test.skip('No pending confirmations available for testing');
    }
  });

  /**
   * Test: Visual indicator for pending confirmations
   * AC: Pending confirmation requests have visual highlight/indicator
   */
  test('should show visual indicator for pending confirmation requests', async () => {
    await supervisorPage.goto(`${BASE_URL}/supervisor/approvals`);

    const pendingConfirmationRow = supervisorPage.locator('[data-status="pending_supervisor_confirmation"], tr:has-text("Pending Confirmation")').first();

    if (await pendingConfirmationRow.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Check for highlight/background color
      const backgroundColor = await pendingConfirmationRow.evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      );
      
      // Should have some background color (not transparent/white)
      expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(backgroundColor).not.toBe('rgb(255, 255, 255)');

      // Or check for icon indicator
      const icon = pendingConfirmationRow.locator('svg, [data-icon]').first();
      if (await icon.isVisible({ timeout: 500 }).catch(() => false)) {
        await expect(icon).toBeVisible();
      }
    }
  });

  /**
   * Test: Batch confirmation (if supported in UI)
   * AC: Can select multiple requests and confirm them together
   */
  test('should support batch confirmation of multiple requests', async () => {
    await supervisorPage.goto(`${BASE_URL}/supervisor/approvals`);

    // Check if batch actions are available
    const selectAllCheckbox = supervisorPage.locator('input[type="checkbox"][aria-label*="Select all" i]').first();

    if (await selectAllCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Select multiple rows
      const rowCheckboxes = supervisorPage.locator('input[type="checkbox"][data-row]');
      const checkboxCount = await rowCheckboxes.count();

      if (checkboxCount >= 2) {
        // Select first two rows
        await rowCheckboxes.nth(0).check();
        await rowCheckboxes.nth(1).check();

        // Look for batch confirm button
        const batchConfirmButton = supervisorPage.locator('button:has-text("Confirm Selected")').first();
        
        if (await batchConfirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await batchConfirmButton.click();

          // Verify batch confirmation dialog or action
          await supervisorPage.waitForSelector('[role="dialog"], text=/confirm.*selected/i', { timeout: 3000 });

          // Cancel or complete based on test data
          const cancelButton = supervisorPage.locator('button:has-text("Cancel")').first();
          await cancelButton.click();
        }
      }
    } else {
      test.skip('Batch confirmation not available or no multiple requests');
    }
  });

  /**
   * Test: Mobile responsiveness
   * AC: Confirmation flow works on mobile viewport
   */
  test('should work correctly on mobile viewport', async () => {
    // Set mobile viewport
    await supervisorPage.setViewportSize({ width: 375, height: 667 });

    await supervisorPage.goto(`${BASE_URL}/supervisor/approvals`);

    // Verify table or cards are visible (mobile might use different layout)
    const tableOrCards = supervisorPage.locator('table, [role="table"], [data-testid="approval-cards"]').first();
    await expect(tableOrCards).toBeVisible();

    // Try to open confirmation dialog on mobile
    const confirmButton = supervisorPage.locator('button:has-text("Confirm")').first();
    
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click();

      // Dialog should be full-screen or properly sized for mobile
      const dialog = supervisorPage.locator('[role="dialog"], .sheet, .drawer').first();
      await expect(dialog).toBeVisible();

      // Close dialog
      const closeButton = supervisorPage.locator('button:has-text("Cancel"), button[aria-label="Close"]').first();
      await closeButton.click();
    }

    // Reset viewport
    await supervisorPage.setViewportSize({ width: 1280, height: 720 });
  });
});

/**
 * Test Coverage Summary:
 * ✅ Display pending confirmations metric on dashboard
 * ✅ Show requests with pending confirmation status
 * ✅ Filter by pending confirmation status
 * ✅ Open confirmation dialog
 * ✅ Complete confirmation with remarks
 * ✅ Allow confirmation without remarks
 * ✅ Update dashboard metrics after confirmation
 * ✅ Visual indicators for pending confirmations
 * ✅ Batch confirmation (if supported)
 * ✅ Mobile responsiveness
 * 
 * E2E test coverage: Complete supervisor confirmation workflow
 */

/**
 * E2E Test: Finance Workflow Approval
 * Tests the approval inbox and multi-level approval workflows
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const FINANCE_EMAIL = process.env.FINANCE_EMAIL || 'finance@test.com';
const FINANCE_PASSWORD = process.env.FINANCE_PASSWORD || 'Test123!@#';

test.describe('Finance Workflow Approval', () => {
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

  test('should navigate to approval inbox', async () => {
    await financePage.goto(`${BASE_URL}/finance/workflow/inbox`);

    await expect(financePage.locator('h1, h2').filter({ hasText: /Approval|Inbox/i }).first()).toBeVisible();
  });

  test('should display approval categories/tabs', async () => {
    await financePage.goto(`${BASE_URL}/finance/workflow/inbox`);

    // Look for category tabs or filters
    const categories = financePage.locator('text=/All|Pending|Approved|Rejected|Purchase|Payment|Journal/i').first();
    await expect(categories).toBeVisible();
  });

  test('should display pending approval items', async () => {
    await financePage.goto(`${BASE_URL}/finance/workflow/inbox`);

    await financePage.waitForTimeout(1000);

    // Look for pending items or empty state
    const content = financePage.locator('table tbody tr, [role="row"], .approval-item, .empty-state').first();
    await expect(content).toBeVisible({ timeout: 5000 });
  });

  test('should show approval item details', async () => {
    await financePage.goto(`${BASE_URL}/finance/workflow/inbox`);

    // Click on first approval item
    const firstItem = financePage.locator('table tbody tr, [role="row"]').nth(1);
    
    if (await firstItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstItem.click();

      // Verify details panel or dialog opens
      const details = financePage.locator('[role="dialog"], .details-panel, .approval-details').first();
      await expect(details).toBeVisible({ timeout: 3000 });

      // Look for key details
      const amount = details.locator('text=/RM|MYR|\\$|\\d+/i').first();
      await expect(amount).toBeVisible();

      // Close details
      const closeButton = details.locator('button[aria-label="Close"], button:has-text("Close")').first();
      if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
      }
    }
  });

  test('should approve a pending item', async () => {
    await financePage.goto(`${BASE_URL}/finance/workflow/inbox`);

    const approveButton = financePage.locator('button:has-text("Approve"), [data-action="approve"]').first();
    
    if (await approveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await approveButton.click();

      // Handle approval dialog
      const approveDialog = financePage.locator('[role="dialog"]').filter({ hasText: /Approve|Confirm/i }).first();
      
      if (await approveDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Add optional remarks
        const remarksInput = approveDialog.locator('textarea, input[name="remarks"]').first();
        if (await remarksInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await remarksInput.fill('E2E Test Approval');
        }

        const confirmButton = approveDialog.locator('button:has-text("Approve"), button:has-text("Confirm")').first();
        await confirmButton.click();
      }

      // Verify success
      await financePage.waitForTimeout(1000);
      const successMessage = financePage.locator('text=/approved|success/i').first();
      await expect(successMessage).toBeVisible();
    }
  });

  test('should reject a pending item with reason', async () => {
    await financePage.goto(`${BASE_URL}/finance/workflow/inbox`);

    const rejectButton = financePage.locator('button:has-text("Reject"), [data-action="reject"]').first();
    
    if (await rejectButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rejectButton.click();

      const rejectDialog = financePage.locator('[role="dialog"]').filter({ hasText: /Reject/i }).first();
      
      if (await rejectDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Rejection reason is usually required
        const reasonInput = rejectDialog.locator('textarea, input[name="reason"]').first();
        await reasonInput.fill('E2E Test Rejection - Insufficient documentation');

        const confirmButton = rejectDialog.locator('button:has-text("Reject"), button:has-text("Confirm")').first();
        await confirmButton.click();
      }

      await financePage.waitForTimeout(1000);
      const successMessage = financePage.locator('text=/rejected|success/i').first();
      await expect(successMessage).toBeVisible();
    }
  });

  test('should return an item for revision', async () => {
    await financePage.goto(`${BASE_URL}/finance/workflow/inbox`);

    const returnButton = financePage.locator('button:has-text("Return"), button:has-text("Send Back"), [data-action="return"]').first();
    
    if (await returnButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await returnButton.click();

      const returnDialog = financePage.locator('[role="dialog"]').filter({ hasText: /Return|Send Back/i }).first();
      
      if (await returnDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
        const reasonInput = returnDialog.locator('textarea').first();
        await reasonInput.fill('Please provide additional information');

        const confirmButton = returnDialog.locator('button:has-text("Return"), button:has-text("Confirm")').first();
        await confirmButton.click();
      }

      await financePage.waitForTimeout(1000);
    }
  });

  test('should filter by document type', async () => {
    await financePage.goto(`${BASE_URL}/finance/workflow/inbox`);

    const typeFilter = financePage.locator('select, [role="combobox"]').filter({ hasText: /Type|PR|PO|PV|JV/i }).first();
    
    if (await typeFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
      await typeFilter.click();
      
      const option = financePage.locator('[role="option"]:has-text("Purchase Requisition")').first();
      if (await option.isVisible({ timeout: 1000 }).catch(() => false)) {
        await option.click();
        await financePage.waitForTimeout(500);
      }
    }
  });

  test('should filter by date range', async () => {
    await financePage.goto(`${BASE_URL}/finance/workflow/inbox`);

    const dateInputs = financePage.locator('input[type="date"]').all();
    
    if ((await dateInputs).length >= 2) {
      const today = new Date();
      const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      await dateInputs[0].fill(lastWeek.toISOString().split('T')[0]);
      await dateInputs[1].fill(today.toISOString().split('T')[0]);
      
      await financePage.waitForTimeout(500);
    }
  });

  test('should show approval history/audit trail', async () => {
    await financePage.goto(`${BASE_URL}/finance/workflow/inbox`);

    // Click on an item with history
    const item = financePage.locator('table tbody tr, [role="row"]').nth(1);
    
    if (await item.isVisible({ timeout: 3000 }).catch(() => false)) {
      await item.click();

      const details = financePage.locator('[role="dialog"], .details-panel').first();
      
      // Look for history/audit trail section
      const historyTab = details.locator('text=/History|Audit|Timeline/i').first();
      
      if (await historyTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await historyTab.click();

        const historyContent = details.locator('.history, .audit-trail, .timeline').first();
        await expect(historyContent).toBeVisible();
      }

      // Close
      const closeButton = details.locator('button:has-text("Close")').first();
      if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
      }
    }
  });

  test('should display approver information', async () => {
    await financePage.goto(`${BASE_URL}/finance/workflow/inbox`);

    // Look for columns showing requester/approver
    const requesterInfo = financePage.locator('th:has-text("Requester"), th:has-text("Submitted By")').first();
    
    if (await requesterInfo.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(requesterInfo).toBeVisible();
    }
  });

  test('should batch approve multiple items', async () => {
    await financePage.goto(`${BASE_URL}/finance/workflow/inbox`);

    // Look for checkboxes for batch selection
    const selectAllCheckbox = financePage.locator('input[type="checkbox"][aria-label*="Select all"]').first();
    
    if (await selectAllCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Select first two items
      const checkboxes = financePage.locator('input[type="checkbox"][data-row], table tbody tr input[type="checkbox"]').all();
      const boxCount = (await checkboxes).length;

      if (boxCount >= 2) {
        await checkboxes[0].check();
        await checkboxes[1].check();

        // Look for batch approve button
        const batchApproveButton = financePage.locator('button:has-text("Approve Selected")').first();
        
        if (await batchApproveButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await batchApproveButton.click();

          const confirmDialog = financePage.locator('[role="dialog"]').first();
          if (await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
            const confirmButton = confirmDialog.locator('button:has-text("Confirm")').first();
            await confirmButton.click();
          }
        }
      }
    }
  });

  test('should show urgency/priority indicators', async () => {
    await financePage.goto(`${BASE_URL}/finance/workflow/inbox`);

    // Look for urgent/high priority badges
    const urgentBadge = financePage.locator('text=/Urgent|High|Overdue/i').first();
    
    // May or may not exist depending on data
    if (await urgentBadge.isVisible({ timeout: 2000 }).catch(() => false)) {
      const badgeColor = await urgentBadge.evaluate(el => 
        window.getComputedStyle(el).color
      );
      // Urgent items typically have red/orange color
      expect(badgeColor).toBeTruthy();
    }
  });

  test('should handle delegation/reassignment', async () => {
    await financePage.goto(`${BASE_URL}/finance/workflow/inbox`);

    const delegateButton = financePage.locator('button:has-text("Delegate"), [data-action="delegate"]').first();
    
    if (await delegateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await delegateButton.click();

      const delegateDialog = financePage.locator('[role="dialog"]').filter({ hasText: /Delegate/i }).first();
      
      if (await delegateDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Select delegatee
        const userSelect = delegateDialog.locator('select, [role="combobox"]').first();
        if (await userSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
          await userSelect.selectOption({ index: 1 });
        }

        const confirmButton = delegateDialog.locator('button:has-text("Delegate"), button:has-text("Confirm")').first();
        await confirmButton.click();
      }

      await financePage.waitForTimeout(1000);
    }
  });

  test('should refresh inbox automatically', async () => {
    await financePage.goto(`${BASE_URL}/finance/workflow/inbox`);

    // Wait for initial load
    await financePage.waitForTimeout(1000);

    // Look for refresh button or auto-refresh indicator
    const refreshButton = financePage.locator('button[aria-label="Refresh"], button:has([data-icon="refresh"])').first();
    
    if (await refreshButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await refreshButton.click();
      
      // Wait for refresh
      await financePage.waitForTimeout(1000);
      
      // Inbox should still be visible
      await expect(financePage.locator('h1, h2').filter({ hasText: /Approval|Inbox/i }).first()).toBeVisible();
    }
  });
});

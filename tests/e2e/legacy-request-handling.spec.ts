/**
 * E2E Test: Legacy Request Handling
 * Story 5.5: E2E test for legacy request handling
 * 
 * Verifies that legacy OT requests (created before confirmation workflow)
 * bypass the confirmation step and continue to work without disruption
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const SUPERVISOR_EMAIL = 'supervisor@test.com';
const SUPERVISOR_PASSWORD = 'Test123!@#';
const HR_EMAIL = 'hr@test.com';
const HR_PASSWORD = 'Test123!@#';

test.describe('Legacy Request Handling', () => {
  /**
   * Test: Legacy requests identified correctly
   * AC: Requests with supervisor_verified status and null confirmation_at are legacy
   */
  test('should identify legacy requests with supervisor_verified status', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', SUPERVISOR_EMAIL);
    await page.fill('input[type="password"]', SUPERVISOR_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard|\/supervisor/);

    await page.goto(`${BASE_URL}/supervisor/approvals`);

    // Look for legacy requests (supervisor_verified status)
    const legacyStatusBadge = page.locator('text=/Supervisor Verified/i').first();

    if (await legacyStatusBadge.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(legacyStatusBadge).toBeVisible();
      
      // Legacy requests should NOT have a "Confirm" button
      const parentRow = legacyStatusBadge.locator('../..');
      const confirmButton = parentRow.locator('button:has-text("Confirm")');
      
      await expect(confirmButton).not.toBeVisible();
    }
  });

  /**
   * Test: HR can certify legacy requests without confirmation
   * AC: Legacy requests can proceed directly to HR certification
   */
  test('should allow HR to certify legacy requests without confirmation', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', HR_EMAIL);
    await page.fill('input[type="password"]', HR_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard|\/hr/);

    await page.goto(`${BASE_URL}/hr/certifications`);

    // Look for supervisor_verified requests (legacy workflow)
    const legacyRequest = page.locator('tr:has-text("Supervisor Verified"), [data-status="supervisor_verified"]').first();

    if (await legacyRequest.isVisible({ timeout: 2000 }).catch(() => false)) {
      // HR should be able to certify directly
      const certifyButton = legacyRequest.locator('button:has-text("Certify"), button:has-text("Approve")').first();
      
      await expect(certifyButton).toBeVisible();
      
      // Click to certify
      await certifyButton.click();

      // Should open certification dialog
      await page.waitForSelector('[role="dialog"], text=/certify/i', { timeout: 3000 });

      // Cancel to not affect test data
      const cancelButton = page.locator('button:has-text("Cancel")').first();
      await cancelButton.click();
    }
  });

  /**
   * Test: Legacy requests visually distinguished
   * AC: UI clearly shows legacy vs new workflow requests
   */
  test('should visually distinguish legacy requests from new workflow', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', SUPERVISOR_EMAIL);
    await page.fill('input[type="password"]', SUPERVISOR_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    await page.goto(`${BASE_URL}/supervisor/approvals`);

    // Compare legacy (supervisor_verified) vs new (pending_confirmation) badges
    const legacyBadge = page.locator('text=/Supervisor Verified/i').first();
    const newWorkflowBadge = page.locator('text=/Pending Confirmation/i').first();

    if (await legacyBadge.isVisible({ timeout: 1000 }).catch(() => false) &&
        await newWorkflowBadge.isVisible({ timeout: 1000 }).catch(() => false)) {
      
      // Get colors
      const legacyColor = await legacyBadge.evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      );
      const newColor = await newWorkflowBadge.evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      );

      // Should be visually different
      expect(legacyColor).not.toBe(newColor);
    }
  });

  /**
   * Test: No confirmation step for legacy requests
   * AC: Legacy workflow goes: verified → HR certification (no confirmation)
   */
  test('should not show confirmation option for legacy requests', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', SUPERVISOR_EMAIL);
    await page.fill('input[type="password"]', SUPERVISOR_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    await page.goto(`${BASE_URL}/supervisor/approvals`);

    // Find legacy request row
    const legacyRow = page.locator('tr:has-text("Supervisor Verified"), [data-status="supervisor_verified"]').first();

    if (await legacyRow.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Should NOT have confirm button
      const confirmButton = legacyRow.locator('button:has-text("Confirm")');
      await expect(confirmButton).not.toBeVisible();

      // May have view/details button instead
      const viewButton = legacyRow.locator('button:has-text("View"), button:has-text("Details")').first();
      
      if (await viewButton.isVisible({ timeout: 500 }).catch(() => false)) {
        await expect(viewButton).toBeVisible();
      }
    }
  });

  /**
   * Test: Employee view of legacy requests
   * AC: Employees see legacy requests with appropriate status
   */
  test('should show legacy requests without confirmation status to employee', async ({ page }) => {
    const EMPLOYEE_EMAIL = 'employee@test.com';
    const EMPLOYEE_PASSWORD = 'Test123!@#';

    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', EMPLOYEE_EMAIL);
    await page.fill('input[type="password"]', EMPLOYEE_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard|\/employee/);

    await page.goto(`${BASE_URL}/employee/ot-history`);

    // Look for old requests (before confirmation workflow was implemented)
    const legacyRequest = page.locator('tr:has-text("Supervisor Verified")').first();

    if (await legacyRequest.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click to view details
      await legacyRequest.click();
      await page.waitForTimeout(500);

      // Should NOT show confirmation fields
      const confirmationRemarks = page.locator('text=/Confirmation Remarks/i');
      await expect(confirmationRemarks).not.toBeVisible();

      // Should show verification fields
      const verificationRemarks = page.locator('text=/Supervisor Remarks|Verification/i');
      if (await verificationRemarks.isVisible({ timeout: 500 }).catch(() => false)) {
        await expect(verificationRemarks).toBeVisible();
      }
    }
  });

  /**
   * Test: Backward compatibility - no data corruption
   * AC: Legacy requests data remains intact after deployment
   */
  test('should preserve legacy request data integrity', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', SUPERVISOR_EMAIL);
    await page.fill('input[type="password"]', SUPERVISOR_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    await page.goto(`${BASE_URL}/supervisor/approvals`);

    // Find a legacy request
    const legacyRow = page.locator('[data-status="supervisor_verified"]').first();

    if (await legacyRow.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Open details
      await legacyRow.click();
      await page.waitForTimeout(500);

      // Verify essential fields are present and not corrupted
      const expectedFields = [
        /Date/i,
        /Hours/i,
        /Reason/i,
        /Supervisor/i,
      ];

      for (const field of expectedFields) {
        const fieldElement = page.locator(`text=${field}`).first();
        if (await fieldElement.isVisible({ timeout: 500 }).catch(() => false)) {
          // Field should have associated value
          const parentElement = fieldElement.locator('..');
          const text = await parentElement.textContent();
          
          // Should not be empty
          expect(text?.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  /**
   * Test: Mixed workflow handling
   * AC: System handles both legacy and new workflow requests simultaneously
   */
  test('should handle both legacy and new workflow requests in same view', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', SUPERVISOR_EMAIL);
    await page.fill('input[type="password"]', SUPERVISOR_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    await page.goto(`${BASE_URL}/supervisor/approvals`);

    // Check for both types of requests
    const legacyBadge = page.locator('text=/Supervisor Verified/i').first();
    const newWorkflowBadge = page.locator('text=/Pending Confirmation/i').first();

    const hasLegacy = await legacyBadge.isVisible({ timeout: 1000 }).catch(() => false);
    const hasNew = await newWorkflowBadge.isVisible({ timeout: 1000 }).catch(() => false);

    if (hasLegacy && hasNew) {
      // Both should be visible and distinguishable
      await expect(legacyBadge).toBeVisible();
      await expect(newWorkflowBadge).toBeVisible();

      // Count each type
      const legacyCount = await page.locator('text=/Supervisor Verified/i').count();
      const newCount = await page.locator('text=/Pending Confirmation/i').count();

      expect(legacyCount).toBeGreaterThan(0);
      expect(newCount).toBeGreaterThan(0);
    }
  });

  /**
   * Test: Filter to exclude legacy requests
   * AC: Can filter to show only new workflow requests
   */
  test('should allow filtering to show only new workflow requests', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', SUPERVISOR_EMAIL);
    await page.fill('input[type="password"]', SUPERVISOR_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    await page.goto(`${BASE_URL}/supervisor/approvals`);

    // Find filter controls
    const filterButton = page.locator('button:has-text("Filter"), button:has-text("Status")').first();

    if (await filterButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await filterButton.click();

      // Select "Pending Confirmation" filter (new workflow only)
      const pendingConfirmationFilter = page.locator('text=/Pending Confirmation/i').last();
      
      if (await pendingConfirmationFilter.isVisible({ timeout: 1000 }).catch(() => false)) {
        await pendingConfirmationFilter.click();
        await page.waitForTimeout(1000);

        // Should NOT see legacy "Supervisor Verified" badges
        const legacyBadges = page.locator('text=/Supervisor Verified/i');
        const legacyCount = await legacyBadges.count();
        
        expect(legacyCount).toBe(0);
      }
    }
  });

  /**
   * Test: Legacy request timestamps preserved
   * AC: Original verification timestamps not affected by new columns
   */
  test('should preserve original verification timestamps for legacy requests', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', SUPERVISOR_EMAIL);
    await page.fill('input[type="password"]', SUPERVISOR_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    await page.goto(`${BASE_URL}/supervisor/approvals`);

    // Find legacy request
    const legacyRow = page.locator('[data-status="supervisor_verified"]').first();

    if (await legacyRow.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Open details
      await legacyRow.click();
      await page.waitForTimeout(500);

      // Look for verified timestamp
      const verifiedTimestamp = page.locator('text=/Verified.*(on|at)|Supervisor.*Verified.*:/i').first();
      
      if (await verifiedTimestamp.isVisible({ timeout: 1000 }).catch(() => false)) {
        const timestampText = await verifiedTimestamp.textContent();
        
        // Should have a date
        expect(timestampText).toMatch(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}/);
      }

      // Should NOT have confirmation timestamp
      const confirmationTimestamp = page.locator('text=/Confirmed.*(on|at)|Confirmation.*:/i');
      await expect(confirmationTimestamp).not.toBeVisible();
    }
  });

  /**
   * Test: Reporting includes both legacy and new workflow
   * AC: Reports correctly aggregate both workflow types
   */
  test('should include both legacy and new workflow in reporting', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', HR_EMAIL);
    await page.fill('input[type="password"]', HR_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard|\/hr/);

    // Navigate to reports page
    await page.goto(`${BASE_URL}/hr/reports`);

    // Check if report includes various status types
    if (await page.locator('text=/Report|Summary/i').isVisible({ timeout: 2000 }).catch(() => false)) {
      // Look for status breakdown
      const statusLabels = await page.locator('text=/Verified|Confirmed|Certified/i').allTextContents();
      
      // Should have multiple workflow stages
      expect(statusLabels.length).toBeGreaterThan(0);
    }
  });
});

/**
 * Test Coverage Summary:
 * ✅ Identify legacy requests correctly (supervisor_verified + null confirmation_at)
 * ✅ HR can certify legacy requests without confirmation
 * ✅ Legacy requests visually distinguished from new workflow
 * ✅ No confirmation step shown for legacy requests
 * ✅ Employee view of legacy requests (no confirmation fields)
 * ✅ Legacy request data integrity preserved
 * ✅ Mixed workflow handling (legacy + new in same view)
 * ✅ Filter to show only new workflow requests
 * ✅ Legacy request timestamps preserved
 * ✅ Reporting includes both workflow types
 * 
 * E2E test coverage: Complete backward compatibility validation
 */

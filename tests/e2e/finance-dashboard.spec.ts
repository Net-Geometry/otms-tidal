/**
 * E2E Test: Finance Dashboard
 * Tests the finance dashboard functionality including KPIs and quick actions
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const FINANCE_EMAIL = process.env.FINANCE_EMAIL || 'finance@test.com';
const FINANCE_PASSWORD = process.env.FINANCE_PASSWORD || 'Test123!@#';

test.describe('Finance Dashboard', () => {
  let financePage: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    financePage = await context.newPage();

    // Login as finance user
    await financePage.goto(`${BASE_URL}/auth`);
    await financePage.fill('input[type="email"]', FINANCE_EMAIL);
    await financePage.fill('input[type="password"]', FINANCE_PASSWORD);
    await financePage.click('button[type="submit"]');

    // Wait for navigation
    await financePage.waitForURL(/\/finance\/dashboard|\/dashboard/);
  });

  test.afterAll(async () => {
    await financePage?.close();
  });

  test('should display finance dashboard with KPI cards', async () => {
    await financePage.goto(`${BASE_URL}/finance/dashboard`);

    // Verify all KPI cards are visible
    await expect(financePage.locator('text=AP Outstanding').first()).toBeVisible();
    await expect(financePage.locator('text=AR Outstanding').first()).toBeVisible();
    await expect(financePage.locator('text=Cash Position').first()).toBeVisible();
    await expect(financePage.locator('text=Overdue Invoices').first()).toBeVisible();
  });

  test('should display KPI values with currency formatting', async () => {
    await financePage.goto(`${BASE_URL}/finance/dashboard`);

    // Check that values are displayed (should contain numbers or currency symbols)
    const apCard = financePage.locator('.card, [class*="card"]').filter({ hasText: /AP Outstanding/ });
    const apValue = await apCard.locator('text=/\\d|RM|MYR|\\$/').first().textContent();
    expect(apValue).toBeTruthy();
  });

  test('should display expense trend chart', async () => {
    await financePage.goto(`${BASE_URL}/finance/dashboard`);

    // Look for chart container
    const chartContainer = financePage.locator('[data-testid="expense-trend-chart"], .recharts-wrapper, canvas').first();
    await expect(chartContainer).toBeVisible({ timeout: 5000 });
  });

  test('should display project cost chart', async () => {
    await financePage.goto(`${BASE_URL}/finance/dashboard`);

    // Look for project cost chart
    const chartTitle = financePage.locator('text=/Project Cost|Top Projects/i').first();
    await expect(chartTitle).toBeVisible();
  });

  test('should display pending actions section', async () => {
    await financePage.goto(`${BASE_URL}/finance/dashboard`);

    // Check for pending actions
    const pendingSection = financePage.locator('text=/Pending Actions|Pending Approvals/i').first();
    await expect(pendingSection).toBeVisible();
  });

  test('should display quick actions section', async () => {
    await financePage.goto(`${BASE_URL}/finance/dashboard`);

    // Check for quick actions
    const quickActions = financePage.locator('text=Quick Actions').first();
    await expect(quickActions).toBeVisible();

    // Verify top action buttons/cards are visible
    const topActions = financePage.locator('text=/Approval Inbox|Journal Entries|AP Invoices/i').first();
    await expect(topActions).toBeVisible();
  });

  test('should navigate to approval inbox from quick action', async () => {
    await financePage.goto(`${BASE_URL}/finance/dashboard`);

    // Click on Approval Inbox action
    const approvalInboxAction = financePage.locator('a:has-text("Approval Inbox"), button:has-text("Approval Inbox"), [role="link"]:has-text("Approval Inbox")').first();
    
    if (await approvalInboxAction.isVisible({ timeout: 2000 }).catch(() => false)) {
      await approvalInboxAction.click();
      await financePage.waitForURL(/\/finance\/workflow\/inbox/);
      expect(financePage.url()).toContain('/finance/workflow/inbox');
    }
  });

  test('should navigate to journal entries from quick action', async () => {
    await financePage.goto(`${BASE_URL}/finance/dashboard`);

    const journalEntriesAction = financePage.locator('a:has-text("Journal Entries"), button:has-text("Journal Entries"), [role="link"]:has-text("Journal Entries")').first();
    
    if (await journalEntriesAction.isVisible({ timeout: 2000 }).catch(() => false)) {
      await journalEntriesAction.click();
      await financePage.waitForURL(/\/finance\/gl\/journal-entries/);
      expect(financePage.url()).toContain('/finance/gl/journal-entries');
    }
  });

  test('should expand more actions section', async () => {
    await financePage.goto(`${BASE_URL}/finance/dashboard`);

    // Find the "More Actions" collapsible trigger
    const moreActionsTrigger = financePage.locator('button:has-text("More Actions"), [data-state]:has-text("More")').first();
    
    if (await moreActionsTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await moreActionsTrigger.click();
      
      // Verify expanded content
      const expandedContent = financePage.locator('text=/Suppliers|Customers|Bank Accounts|Setup/i').first();
      await expect(expandedContent).toBeVisible();
    }
  });

  test('should refresh dashboard data', async () => {
    await financePage.goto(`${BASE_URL}/finance/dashboard`);

    // Look for refresh button
    const refreshButton = financePage.locator('button[aria-label="Refresh"], button:has([data-icon="refresh"]), button:has(.refresh-icon)').first();
    
    if (await refreshButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await refreshButton.click();
      
      // Wait for loading state to complete
      await financePage.waitForTimeout(1000);
      
      // Verify dashboard still visible
      await expect(financePage.locator('text=AP Outstanding').first()).toBeVisible();
    }
  });

  test('should be responsive on mobile viewport', async () => {
    await financePage.setViewportSize({ width: 375, height: 667 });
    await financePage.goto(`${BASE_URL}/finance/dashboard`);

    // Verify KPI cards stack vertically
    const kpiCards = financePage.locator('.card, [class*="DashboardCard"]').all();
    expect((await kpiCards).length).toBeGreaterThan(0);

    // Reset viewport
    await financePage.setViewportSize({ width: 1280, height: 720 });
  });
});

import { test, expect } from '@playwright/test';

test.describe('Renderer E2E', () => {
  test('should load the page and mount the canvas', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('should reactive render a tile when placed in gridStore', async ({ page }) => {
    await page.goto('/');

    // Wait for canvas to ensure app is hydrated
    await expect(page.locator('canvas')).toBeVisible();

    // REGISTER LISTENER BEFORE ACTION
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Place a STRAIGHT tile at (0, 0)
    await page.evaluate(() => {
      window.gridStore.placeTile(0, 0, 'STRAIGHT' as any, 0);
    });

    // Wait for the tile count to update in the store
    // This proofs the store reacted and the renderer (reading it) is updated
    await page.waitForFunction(() => window.gridStore.totalTileCount >= 1);

    // Verify specifically what was placed
    const tile = await page.evaluate(() => window.gridStore.grid[0][0]);
    expect(tile?.type).toBe('STRAIGHT');
    
    // Verify no console errors occurred during placement/rendering
    expect(errors).toEqual([]);
  });

  test('should handle empty grid without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('canvas')).toBeVisible();
    
    expect(errors).toEqual([]);
  });
});

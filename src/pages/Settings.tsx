import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Card } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PWAInstallSection } from '@/components/pwa/PWAInstallSection';
import { NotificationSettings } from '@/components/pwa/NotificationSettings';
import { HRSettingsSection } from '@/components/settings/HRSettingsSection';

/**
 * General Settings Page
 *
 * Accessible to all authenticated users regardless of role.
 * Currently includes:
 * - PWA Installation settings
 * - Notification settings (hidden by feature flag)
 *
 * Future sections could include:
 * - User preferences
 * - Display settings (theme, language, etc.)
 *
 * @returns {JSX.Element} Settings page component
 */
export default function Settings() {
  return (
    <AppLayout>
      <PageLayout
        title="Settings"
        description="Manage your app preferences and settings"
      >

        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Appearance</h2>
              <p className="text-sm text-muted-foreground">
                Customize how the application looks on your device
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred color theme
                </p>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </Card>

        <PWAInstallSection />

        <HRSettingsSection />

        <NotificationSettings />

        {/* Future settings sections can be added here */}
      </PageLayout>
    </AppLayout>
  );
}

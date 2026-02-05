/**
 * Holiday Management Component
 *
 * Main admin interface for managing holiday overrides.
 * Displays merged holidays (scraped + overrides) with edit/delete actions.
 */

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Calendar, Plus, Upload, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { MalaysianStateKey } from '@/config/malaysia-states';
import type { MergedHoliday } from '@/types/holiday-overrides';
import { holidayOverrideService } from '@/services/HolidayOverrideService';
import { HolidayConfigService } from '@/services/HolidayConfigService';
import { AddHolidayForm } from './AddHolidayForm';
import { BulkHolidayImport } from './BulkHolidayImport';

const configService = new HolidayConfigService();

export function HolidayManagement() {
  const [holidays, setHolidays] = useState<MergedHoliday[]>([]);
  const [companyState, setCompanyState] = useState<MalaysianStateKey | null>(null);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<MergedHoliday | null>(null);
  const [deletingHoliday, setDeletingHoliday] = useState<MergedHoliday | null>(null);

  useEffect(() => {
    loadCompanyState();
  }, []);

  useEffect(() => {
    if (companyState) {
      loadHolidays();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyState, currentYear]);

  const loadCompanyState = async () => {
    try {
      const state = await configService.getCompanyState();
      if (state) {
        setCompanyState(state);
      } else {
        toast.error('Company state not configured', {
          description: 'Please configure your company state in Settings first.'
        });
      }
    } catch (error) {
      console.error('Error loading company state:', error);
      toast.error('Failed to load company configuration');
    }
  };

  const loadHolidays = async () => {
    if (!companyState) return;

    setLoading(true);
    try {
      const mergedHolidays = await holidayOverrideService.getMergedHolidays(companyState, currentYear);
      setHolidays(mergedHolidays);
    } catch (error) {
      console.error('Error loading holidays:', error);
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  const handleAddHoliday = () => {
    setEditingHoliday(null);
    setShowAddForm(true);
  };

  const handleEditHoliday = (holiday: MergedHoliday) => {
    if (holiday.source === 'scraped') {
      toast.warning('Cannot edit scraped holidays', {
        description: 'Create an override to replace this holiday instead.'
      });
      return;
    }
    setEditingHoliday(holiday);
    setShowAddForm(true);
  };

  const handleDeleteConfirm = (holiday: MergedHoliday) => {
    if (holiday.source === 'scraped') {
      toast.warning('Cannot delete scraped holidays', {
        description: 'Create an override to replace this holiday instead.'
      });
      return;
    }
    setDeletingHoliday(holiday);
  };

  const handleDelete = async () => {
    if (!deletingHoliday) return;

    try {
      const success = await holidayOverrideService.deleteOverride(deletingHoliday.id);
      if (success) {
        toast.success('Holiday deleted', {
          description: `${deletingHoliday.name} has been removed.`
        });
        await loadHolidays();
      } else {
        toast.error('Failed to delete holiday');
      }
    } catch (error) {
      console.error('Error deleting holiday:', error);
      toast.error('Failed to delete holiday');
    } finally {
      setDeletingHoliday(null);
    }
  };

  const handleFormClose = async (saved: boolean) => {
    setShowAddForm(false);
    setEditingHoliday(null);
    if (saved) {
      await loadHolidays();
    }
  };

  const handleBulkImportClose = async (imported: boolean) => {
    setShowBulkImport(false);
    if (imported) {
      await loadHolidays();
    }
  };

  const getTypeColor = (type: string, source: 'scraped' | 'override') => {
    if (source === 'override') {
      if (type === 'emergency') return 'destructive';
      if (type === 'government') return 'default';
      return 'secondary';
    }
    // Scraped holidays
    if (type === 'federal') return 'default';
    if (type === 'state') return 'outline';
    return 'secondary';
  };

  const formatHolidayDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'EEE, MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  if (!companyState) {
    return (
      <AppLayout>
        <Card>
          <CardHeader>
            <CardTitle>Holiday Management</CardTitle>
            <CardDescription>Company state not configured</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Please configure your company's Malaysian state in Settings before managing holidays.
            </p>
            <Button onClick={() => window.location.href = '/hr/settings'}>
              Go to Settings
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Calendar className="h-8 w-8" />
              Holiday Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage company holidays and overrides for {companyState}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowBulkImport(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Bulk Import
            </Button>
            <Button onClick={handleAddHoliday}>
              <Plus className="h-4 w-4 mr-2" />
              Add Holiday
            </Button>
          </div>
        </div>

        {/* Year Tabs */}
        {(() => {
          const baseYear = new Date().getFullYear();
          const years = [baseYear - 1, baseYear, baseYear + 1];
          return (
            <Tabs value={currentYear.toString()} onValueChange={(year) => setCurrentYear(parseInt(year))}>
              <TabsList>
                {years.map((year) => (
                  <TabsTrigger key={year} value={year.toString()}>
                    {year}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={currentYear.toString()} className="mt-6">
            {/* Holiday List */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : holidays.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No holidays found</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    No holidays found for {companyState} in {currentYear}
                  </p>
                  <Button onClick={handleAddHoliday}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Holiday
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {holidays.map((holiday) => (
                  <Card key={holiday.id} className="transition-shadow hover:shadow-md">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{holiday.name}</h3>
                          <Badge variant={getTypeColor(holiday.type, holiday.source)}>
                            {holiday.type}
                          </Badge>
                          {holiday.source === 'override' && (
                            <Badge variant="outline" className="gap-1">
                              <Edit className="h-3 w-3" />
                              Override
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatHolidayDate(holiday.date)}
                        </p>
                        {holiday.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {holiday.description}
                          </p>
                        )}
                      </div>

                      {holiday.source === 'override' && (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditHoliday(holiday)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteConfirm(holiday)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
            </Tabs>
          );
        })()}

        {/* Add/Edit Holiday Dialog */}
        {showAddForm && (
          <AddHolidayForm
            open={showAddForm}
            onClose={handleFormClose}
            existingHoliday={editingHoliday}
          />
        )}

        {/* Bulk Import Dialog */}
        {showBulkImport && (
          <BulkHolidayImport
            open={showBulkImport}
            onClose={handleBulkImportClose}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingHoliday} onOpenChange={() => setDeletingHoliday(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Delete Holiday Override
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deletingHoliday?.name}"? This action cannot be undone.
                {deletingHoliday?.type === 'emergency' && (
                  <p className="mt-2 text-destructive font-medium">
                    Warning: This is an emergency holiday that may have triggered notifications.
                  </p>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}

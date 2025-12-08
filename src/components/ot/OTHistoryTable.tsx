import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
import { ResubmissionBadge } from './ResubmissionBadge';
import { useIsMobile, useIsTablet, useDeviceType } from '@/hooks/use-mobile';
import { OTRequest, OTStatus, DayType } from '@/types/otms';
import { formatCurrency, formatHours, getDayTypeColor, getDayTypeLabel, formatTimeRange } from '@/lib/otCalculations';
import { getStatusTooltip } from '@/lib/otStatusTooltip';
import { Clock, Calendar, User } from 'lucide-react';

interface OTSession {
  id: string;
  startTime: string;
  endTime: string;
  hours: number;
  status: OTStatus;
  request: OTRequest;
}

interface GroupedOTRequest {
  date: string;
  dayType: DayType;
  sessions: OTSession[];
  totalHours: number;
  statuses: OTStatus[];
  hasRejected: boolean;
  resubmissionInfo?: {
    count: number;
    isResubmission: boolean;
  };
  profiles?: {
    employee_id: string;
    full_name: string;
  };
}

interface OTHistoryTableProps {
  requests: OTRequest[];
  onViewDetails: (request: OTRequest) => void;
}

function groupRequestsByDate(requests: OTRequest[]): GroupedOTRequest[] {
  const grouped = requests.reduce((acc, request) => {
    const date = request.ot_date;
    
    if (!acc[date]) {
      acc[date] = {
        date,
        dayType: request.day_type,
        sessions: new Map(), // Use Map for deduplication by time slot
        totalHours: 0,
        statuses: new Set<OTStatus>(),
        hasRejected: false,
        resubmissionInfo: undefined,
        profiles: request.profiles,
      };
    }

    // Create unique key for this time slot
    const timeSlotKey = `${request.start_time}_${request.end_time}`;
    
    // Check if we already have a session for this time slot
    const existingSession = acc[date].sessions.get(timeSlotKey);
    
    if (existingSession) {
      // Keep the most recent request (latest created_at or updated_at)
      const existingTimestamp = new Date(existingSession.request.updated_at || existingSession.request.created_at);
      const currentTimestamp = new Date(request.updated_at || request.created_at);
      
      if (currentTimestamp > existingTimestamp) {
        // Replace with newer request - adjust total hours
        acc[date].totalHours -= existingSession.hours;
        
        acc[date].sessions.set(timeSlotKey, {
          id: request.id,
          startTime: request.start_time,
          endTime: request.end_time,
          hours: request.total_hours,
          status: request.status,
          request,
        });
        
        acc[date].totalHours += request.total_hours;
      }
      // If existing is newer, skip this request
    } else {
      // First time seeing this time slot, add it
      acc[date].sessions.set(timeSlotKey, {
        id: request.id,
        startTime: request.start_time,
        endTime: request.end_time,
        hours: request.total_hours,
        status: request.status,
        request,
      });
      
      acc[date].totalHours += request.total_hours;
    }
    
    // Rebuild statuses from current sessions
    acc[date].statuses = new Set([...acc[date].sessions.values()].map((s: OTSession) => s.status));
    
    // Check for rejected status
    acc[date].hasRejected = [...acc[date].sessions.values()].some((s: OTSession) => s.status === 'rejected');
    
    // Track highest resubmission count
    if (request.is_resubmission || request.resubmission_count > 0) {
      if (!acc[date].resubmissionInfo || request.resubmission_count > acc[date].resubmissionInfo.count) {
        acc[date].resubmissionInfo = {
          count: request.resubmission_count,
          isResubmission: request.is_resubmission,
        };
      }
    }

    return acc;
  }, {} as Record<string, any>);

  return Object.values(grouped).map(g => ({
    ...g,
    statuses: Array.from(g.statuses),
    sessions: Array.from(g.sessions.values()).sort((a: OTSession, b: OTSession) => 
      a.startTime.localeCompare(b.startTime)
    ),
  }));
}

export function OTHistoryTable({ requests, onViewDetails }: OTHistoryTableProps) {
  const groupedRequests = groupRequestsByDate(requests);
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const deviceType = useDeviceType();
  
  if (requests.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No OT requests found</p>
      </div>
    );
  }

  // Mobile card layout
  if (isMobile) {
    return (
      <div className="space-y-4">
        {groupedRequests.map((grouped) => (
          <Card key={grouped.date} className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {grouped.sessions[0]?.request?.ticket_number}
                  </Badge>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{format(new Date(grouped.date), 'dd MMM yyyy')}</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-primary">
                    {formatHours(grouped.totalHours)}h
                  </span>
                </div>
              </div>
              {grouped.profiles && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>{grouped.profiles.full_name}</span>
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {grouped.sessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {formatTimeRange(session.startTime, session.endTime)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatHours(session.hours)} hours
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => onViewDetails(session.request)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <StatusBadge status={session.status} rejectionStage={session.request.rejection_stage} tooltip={getStatusTooltip(session.request as any)} />
                    </button>
                  </div>
                ))}
                {grouped.resubmissionInfo && (
                  <div className="mt-2">
                    <ResubmissionBadge 
                      resubmissionCount={grouped.resubmissionInfo.count} 
                      isResubmission={grouped.resubmissionInfo.isResubmission} 
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Tablet layout - hybrid card-table approach
  if (isTablet) {
    return (
      <div className="space-y-3">
        {groupedRequests.map((grouped) => (
          <Card key={grouped.date} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-4 items-start">
                <div>
                  <div className="font-medium text-sm">{grouped.profiles?.full_name || 'Unknown'}</div>
                  <div className="text-xs text-muted-foreground">{grouped.profiles?.employee_id || '-'}</div>
                </div>
                <div className="text-sm">
                  <div className="font-medium">{format(new Date(grouped.date), 'dd MMM yyyy')}</div>
                  <Badge variant="outline" className={`text-xs ${getDayTypeColor(grouped.dayType)}`}>
                    {getDayTypeLabel(grouped.dayType)}
                  </Badge>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-sm">{formatHours(grouped.totalHours)} hrs</div>
                  <div className="flex justify-end">
                    <StatusBadge status={grouped.statuses[0]} rejectionStage={grouped.sessions[0]?.request?.rejection_stage} tooltip={grouped.sessions[0]?.request ? getStatusTooltip(grouped.sessions[0].request as any) : null} />
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t">
                <div className="text-xs space-y-1">
                  {grouped.sessions.map((session) => (
                    <div key={session.id} className="flex justify-between">
                      <span>{formatTimeRange(session.startTime, session.endTime)}</span>
                      <span className="text-muted-foreground">{formatHours(session.hours)}h</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Desktop table layout
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ticket #</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Time Sessions</TableHead>
            <TableHead className="text-right">Hours</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedRequests.map((grouped) => (
            <TableRow key={grouped.date}>
              <TableCell>
                <span className="font-mono text-sm font-medium text-primary">
                  {grouped.sessions[0]?.request?.ticket_number}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{grouped.profiles?.full_name || 'Unknown'}</span>
                  <span className="text-sm text-muted-foreground">{grouped.profiles?.employee_id || '-'}</span>
                </div>
              </TableCell>
              <TableCell className="font-medium">
                {format(new Date(grouped.date), 'dd MMM yyyy')}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {grouped.sessions.map((session) => (
                    <div key={session.id} className="flex items-center gap-2">
                      <span className="text-sm text-foreground">
                        {formatTimeRange(session.startTime, session.endTime)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ({formatHours(session.hours)} hrs)
                      </span>
                      <button
                        onClick={() => onViewDetails(session.request)}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        <StatusBadge status={session.status} rejectionStage={session.request.rejection_stage} tooltip={getStatusTooltip(session.request as any)} />
                      </button>
                    </div>
                  ))}
                  {grouped.resubmissionInfo && (
                    <div className="mt-1">
                      <ResubmissionBadge 
                        resubmissionCount={grouped.resubmissionInfo.count} 
                        isResubmission={grouped.resubmissionInfo.isResubmission} 
                      />
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <span className="font-semibold text-primary">
                  {formatHours(grouped.totalHours)} hours
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

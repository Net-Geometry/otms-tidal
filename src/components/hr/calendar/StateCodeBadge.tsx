import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MALAYSIA_STATES } from '@/lib/malaysiaStates';

interface StateCodeBadgeProps {
  code: string;
}

export function StateCodeBadge({ code }: StateCodeBadgeProps) {
  const stateLabel = MALAYSIA_STATES.find(s => s.value === code)?.label || code;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="cursor-help">{code}</Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{stateLabel}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

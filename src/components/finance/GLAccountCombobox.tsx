import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { ChartOfAccount } from '@/types/finance';

interface GLAccountComboboxProps {
  value: string | null | undefined;
  onChange: (value: string) => void;
  options: ChartOfAccount[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  popoverWidth?: string;
}

export function GLAccountCombobox({
  value,
  onChange,
  options,
  placeholder = 'Select account',
  searchPlaceholder = 'Search account...',
  emptyText = 'No account found.',
  size = 'md',
  disabled,
  className,
  popoverWidth = 'w-[360px]',
}: GLAccountComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((a) => a.id === value);

  const triggerHeight = size === 'sm' ? 'h-8 text-xs' : 'h-10 text-sm';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            triggerHeight,
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">
            {selected ? `${selected.account_code} - ${selected.account_name}` : placeholder}
          </span>
          <ChevronsUpDown className={cn('ml-1 shrink-0 opacity-50', size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn(popoverWidth, 'p-0')} align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((row) => (
                <CommandItem
                  key={row.id}
                  value={`${row.account_code} ${row.account_name}`}
                  onSelect={() => {
                    onChange(row.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === row.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="font-mono text-xs mr-2 text-muted-foreground">{row.account_code}</span>
                  <span>{row.account_name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

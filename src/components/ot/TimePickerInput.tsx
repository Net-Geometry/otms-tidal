import { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';
import './TimePickerInput.css';

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  return isMobile;
};

interface TimePickerInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  minTime?: string; // Format: "HH:MM"
}

export function TimePickerInput({ value, onChange, minTime }: TimePickerInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hours, setHours] = useState('00');
  const [minutes, setMinutes] = useState('00');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const hourScrollRef = useRef<HTMLDivElement>(null);
  const minuteScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Parse minTime if provided
  const minHour = minTime ? parseInt(minTime.split(':')[0], 10) : -1;
  const minMinute = minTime ? parseInt(minTime.split(':')[1], 10) : -1;

  // Parse initial value
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':');
      setHours(h || '00');
      setMinutes(m || '00');
    }
  }, [value]);

  // Generate hour options (0-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

  // Generate minute options with 5-minute increments
  const minuteOptions = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

  // Check if hour is disabled based on minTime
  const isHourDisabled = (hour: string): boolean => {
    if (minHour === -1) return false; // No constraint
    const hourNum = parseInt(hour, 10);
    return hourNum < minHour;
  };

  // Check if minute is disabled based on minTime and selected hour
  const isMinuteDisabled = (minute: string): boolean => {
    if (minHour === -1) return false; // No constraint
    const hourNum = parseInt(hours, 10);
    const minuteNum = parseInt(minute, 10);

    // If hour is less than minHour, disable all minutes
    if (hourNum < minHour) return true;

    // If hour equals minHour, disable minutes less than minMinute
    if (hourNum === minHour && minuteNum < minMinute) return true;

    return false;
  };

  const handleHourChange = (newHour: string) => {
    if (isHourDisabled(newHour)) return;
    setHours(newHour);
    onChange(`${newHour}:${minutes}`);
  };

  const handleMinuteChange = (newMinute: string) => {
    if (isMinuteDisabled(newMinute)) return;
    setMinutes(newMinute);
    onChange(`${hours}:${newMinute}`);
  };

  const scrollToSelected = (ref: React.RefObject<HTMLDivElement>, value: string) => {
    if (ref.current) {
      const items = ref.current.querySelectorAll('[data-value]');
      items.forEach((item) => {
        if (item.getAttribute('data-value') === value) {
          item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }
  };

  // Position dropdown below input (or centered on mobile)
  useEffect(() => {
    if (isOpen && containerRef.current) {
      if (isMobile) {
        // Center the dropdown on mobile
        setDropdownPos({
          top: 0,
          left: 0,
        });
      } else {
        // Position below input on desktop
        const rect = containerRef.current.getBoundingClientRect();
        setDropdownPos({
          top: rect.bottom + 8,
          left: rect.left,
        });
      }
    }
  }, [isOpen, isMobile]);

  useEffect(() => {
    if (isOpen) {
      scrollToSelected(hourScrollRef, hours);
      scrollToSelected(minuteScrollRef, minutes);
    }
  }, [isOpen, hours, minutes]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="time-picker-container" ref={containerRef}>
      <div className="time-picker-input-wrapper">
        <Clock className="time-picker-icon" />
        <input
          ref={inputRef}
          type="text"
          value={`${hours}:${minutes}`}
          readOnly
          className="time-picker-display"
          onClick={() => setIsOpen(!isOpen)}
          placeholder="HH:MM"
        />
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="time-picker-dropdown"
          style={{
            top: `${dropdownPos.top}px`,
            left: `${dropdownPos.left}px`,
          }}
        >
          <div className="time-picker-spinners">
            {/* Hours Spinner */}
            <div className="spinner-column">
              <div className="spinner-label">Hours</div>
              <div className="spinner-container">
                <div className="spinner-highlight" />
                <div ref={hourScrollRef} className="spinner-scroll">
                  {hourOptions.map((hour) => {
                    const disabled = isHourDisabled(hour);
                    return (
                      <div
                        key={hour}
                        data-value={hour}
                        className={`spinner-item ${hours === hour ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                        onClick={() => handleHourChange(hour)}
                      >
                        {hour}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Minutes Spinner */}
            <div className="spinner-column">
              <div className="spinner-label">Minutes</div>
              <div className="spinner-container">
                <div className="spinner-highlight" />
                <div ref={minuteScrollRef} className="spinner-scroll">
                  {minuteOptions.map((minute) => {
                    const disabled = isMinuteDisabled(minute);
                    return (
                      <div
                        key={minute}
                        data-value={minute}
                        className={`spinner-item ${minutes === minute ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                        onClick={() => handleMinuteChange(minute)}
                      >
                        {minute}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="time-picker-actions">
            <button
              className="time-picker-btn cancel"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </button>
            <button
              className="time-picker-btn confirm"
              onClick={() => setIsOpen(false)}
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

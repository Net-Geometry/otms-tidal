import { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';
import './TimePickerInput.css';

interface TimePickerInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function TimePickerInput({ value, onChange }: TimePickerInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hours, setHours] = useState('00');
  const [minutes, setMinutes] = useState('00');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const hourScrollRef = useRef<HTMLDivElement>(null);
  const minuteScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleHourChange = (newHour: string) => {
    setHours(newHour);
    onChange(`${newHour}:${minutes}`);
  };

  const handleMinuteChange = (newMinute: string) => {
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

  // Position dropdown below input
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        left: rect.left,
      });
    }
  }, [isOpen]);

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
                  {hourOptions.map((hour) => (
                    <div
                      key={hour}
                      data-value={hour}
                      className={`spinner-item ${hours === hour ? 'selected' : ''}`}
                      onClick={() => handleHourChange(hour)}
                    >
                      {hour}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Minutes Spinner */}
            <div className="spinner-column">
              <div className="spinner-label">Minutes</div>
              <div className="spinner-container">
                <div className="spinner-highlight" />
                <div ref={minuteScrollRef} className="spinner-scroll">
                  {minuteOptions.map((minute) => (
                    <div
                      key={minute}
                      data-value={minute}
                      className={`spinner-item ${minutes === minute ? 'selected' : ''}`}
                      onClick={() => handleMinuteChange(minute)}
                    >
                      {minute}
                    </div>
                  ))}
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

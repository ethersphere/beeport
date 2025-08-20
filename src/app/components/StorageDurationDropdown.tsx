import React from 'react';
import CustomDropdown, { DropdownOption } from './CustomDropdown';

interface TimeOption {
  days: number;
  display: string;
}

interface StorageDurationDropdownProps {
  timeOptions: TimeOption[];
  selectedDays: number | null;
  onDaysChange: (days: number | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

const StorageDurationDropdown: React.FC<StorageDurationDropdownProps> = ({
  timeOptions,
  selectedDays,
  onDaysChange,
  disabled = false,
  className = '',
  placeholder = 'Please select duration',
}) => {
  // Convert time options to dropdown options
  const dropdownOptions: DropdownOption[] = timeOptions.map(({ days, display }) => ({
    value: days,
    label: display,
    icon: '⏰',
  }));

  const handleSelect = (value: string | number) => {
    if (value === '') {
      onDaysChange(null);
    } else {
      onDaysChange(Number(value));
    }
  };

  return (
    <CustomDropdown
      options={dropdownOptions}
      selectedValue={selectedDays}
      onSelect={handleSelect}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      showIcons={true}
      searchable={false}
    />
  );
};

export default StorageDurationDropdown;

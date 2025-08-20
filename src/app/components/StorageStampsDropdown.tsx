import React from 'react';
import CustomDropdown, { DropdownOption } from './CustomDropdown';
import { StorageOption } from './types';

interface StorageStampsDropdownProps {
  storageOptions: StorageOption[];
  selectedDepth: number | null;
  onDepthChange: (depth: number) => void;
  disabled?: boolean;
  className?: string;
}

const StorageStampsDropdown: React.FC<StorageStampsDropdownProps> = ({
  storageOptions,
  selectedDepth,
  onDepthChange,
  disabled = false,
  className = '',
}) => {
  // Convert storage options to dropdown options
  const dropdownOptions: DropdownOption[] = storageOptions.map(({ depth, size }) => ({
    value: depth,
    label: size,
    icon: '💾',
    description: `Depth: ${depth}`,
  }));

  const handleSelect = (value: string | number) => {
    onDepthChange(Number(value));
  };

  return (
    <CustomDropdown
      options={dropdownOptions}
      selectedValue={selectedDepth}
      onSelect={handleSelect}
      placeholder="Select storage capacity..."
      disabled={disabled}
      className={className}
      showIcons={true}
    />
  );
};

export default StorageStampsDropdown;

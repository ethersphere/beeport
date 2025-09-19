import React from 'react';
import CustomDropdown, { DropdownOption } from './CustomDropdown';

interface ErasureCodingDropdownProps {
  selectedLevel: number;
  onLevelChange: (level: number) => void;
  disabled?: boolean;
  className?: string;
}

const ErasureCodingDropdown: React.FC<ErasureCodingDropdownProps> = ({
  selectedLevel,
  onLevelChange,
  disabled = false,
  className = '',
}) => {
  // Define erasure coding options with icons and descriptions
  const erasureCodingOptions: DropdownOption[] = [
    {
      value: 0,
      label: 'None (Default)',
      icon: '🔓',
      description: 'No erasure coding - standard storage',
    },
    {
      value: 1,
      label: 'Medium',
      icon: '🛡️',
      description: 'Basic protection - ~25% more storage',
    },
    {
      value: 2,
      label: 'Strong',
      icon: '🔒',
      description: 'Enhanced protection - ~50% more storage',
    },
    {
      value: 3,
      label: 'Insane',
      icon: '🔐',
      description: 'High protection - ~100% more storage',
    },
    {
      value: 4,
      label: 'Paranoid',
      icon: '🏰',
      description: 'Maximum protection - ~200% more storage',
    },
  ];

  const handleSelect = (value: string | number) => {
    onLevelChange(Number(value));
  };

  return (
    <CustomDropdown
      options={erasureCodingOptions}
      selectedValue={selectedLevel}
      onSelect={handleSelect}
      placeholder="Select erasure coding level..."
      disabled={disabled}
      className={className}
      showIcons={true}
    />
  );
};

export default ErasureCodingDropdown;

import React, { useState, useRef, useEffect } from 'react';
import styles from './css/CustomDropdown.module.css';

export interface DropdownOption {
  value: string | number;
  label: string;
  icon?: string;
  description?: string;
}

interface CustomDropdownProps {
  options: DropdownOption[];
  selectedValue: string | number | null;
  onSelect: (value: string | number) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  searchable?: boolean;
  className?: string;
  showIcons?: boolean;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
  options,
  selectedValue,
  onSelect,
  placeholder = 'Select an option...',
  disabled = false,
  isLoading = false,
  searchable = false,
  className = '',
  showIcons = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Find selected option
  const selectedOption = options.find(option => option.value === selectedValue);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    if (!disabled && !isLoading && options.length > 0) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        setSearchTerm('');
      }
    }
  };

  const handleOptionSelect = (value: string | number) => {
    onSelect(value);
    setIsOpen(false);
    setSearchTerm('');
  };

  const getDisplayContent = () => {
    if (isLoading) {
      return (
        <div className={styles.loadingContent}>
          <div className={styles.spinner}></div>
          Loading...
        </div>
      );
    }

    if (selectedOption) {
      return (
        <div className={styles.selectedContent}>
          {showIcons && selectedOption.icon && (
            <span className={styles.optionIcon}>{selectedOption.icon}</span>
          )}
          <div className={styles.selectedText}>
            <span className={styles.selectedLabel}>{selectedOption.label}</span>
            {selectedOption.description && (
              <span className={styles.selectedDescription}>{selectedOption.description}</span>
            )}
          </div>
        </div>
      );
    }

    return <span className={styles.placeholder}>{placeholder}</span>;
  };

  return (
    <div className={`${styles.dropdownContainer} ${className}`} ref={dropdownRef}>
      <div
        className={`${styles.dropdownButton} ${isOpen ? styles.open : ''} ${
          !disabled && !isLoading && options.length > 0 ? styles.clickable : ''
        } ${disabled ? styles.disabled : ''}`}
        onClick={toggleDropdown}
      >
        {getDisplayContent()}
        {!isLoading && options.length > 0 && (
          <div className={`${styles.chevron} ${isOpen ? styles.chevronUp : ''}`}>▼</div>
        )}
      </div>

      {isOpen && !disabled && !isLoading && (
        <div className={styles.dropdown}>
          {searchable && options.length > 5 && (
            <div className={styles.searchContainer}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search options..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
          )}

          <div className={styles.optionsContainer}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => (
                <div
                  key={option.value}
                  className={`${styles.option} ${
                    option.value === selectedValue ? styles.selected : ''
                  }`}
                  onClick={() => handleOptionSelect(option.value)}
                >
                  {showIcons && option.icon && (
                    <span className={styles.optionIcon}>{option.icon}</span>
                  )}
                  <div className={styles.optionContent}>
                    <span className={styles.optionLabel}>{option.label}</span>
                    {option.description && (
                      <span className={styles.optionDescription}>{option.description}</span>
                    )}
                  </div>
                  {option.value === selectedValue && <span className={styles.checkmark}>✓</span>}
                </div>
              ))
            ) : (
              <div className={styles.noResults}>
                {searchTerm ? `No options found matching "${searchTerm}"` : 'No options available'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDropdown;

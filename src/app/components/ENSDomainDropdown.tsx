import React, { useState, useRef, useEffect } from 'react';
import styles from './css/ENSDomainDropdown.module.css';

interface ENSDomainDropdownProps {
  domains: string[];
  selectedDomain: string;
  onDomainSelect: (domain: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const ENSDomainDropdown: React.FC<ENSDomainDropdownProps> = ({
  domains,
  selectedDomain,
  onDomainSelect,
  isLoading = false,
  disabled = false,
  placeholder = 'Select a domain...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter domains based on search term
  const filteredDomains = domains.filter(domain =>
    domain.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    if (!disabled && domains.length > 0) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        setSearchTerm('');
      }
    }
  };

  const handleDomainSelect = (domain: string) => {
    onDomainSelect(domain);
    setIsOpen(false);
    setSearchTerm('');
  };

  const getDisplayText = () => {
    if (isLoading) {
      return (
        <div className={styles.loadingText}>
          <div className={styles.spinner}></div>
          Loading domains...
        </div>
      );
    }

    if (selectedDomain) {
      return (
        <div className={styles.selectedDomain}>
          <span className={styles.domainIcon}>🌐</span>
          {selectedDomain}
        </div>
      );
    }

    return <span className={styles.placeholder}>{placeholder}</span>;
  };

  return (
    <div className={styles.dropdownContainer} ref={dropdownRef}>
      <div
        className={`${styles.dropdownButton} ${isOpen ? styles.open : ''} ${
          !disabled && domains.length > 0 ? styles.clickable : ''
        } ${disabled ? styles.disabled : ''}`}
        onClick={toggleDropdown}
      >
        {getDisplayText()}
        {!isLoading && domains.length > 0 && (
          <div className={`${styles.chevron} ${isOpen ? styles.chevronUp : ''}`}>▼</div>
        )}
      </div>

      {isOpen && !disabled && (
        <div className={styles.dropdown}>
          {domains.length > 5 && (
            <div className={styles.searchContainer}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search domains..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
          )}

          <div className={styles.optionsContainer}>
            {filteredDomains.length > 0 ? (
              filteredDomains.map(domain => (
                <div
                  key={domain}
                  className={`${styles.option} ${domain === selectedDomain ? styles.selected : ''}`}
                  onClick={() => handleDomainSelect(domain)}
                >
                  <span className={styles.domainIcon}>🌐</span>
                  <span className={styles.domainName}>{domain}</span>
                  {domain === selectedDomain && <span className={styles.checkmark}>✓</span>}
                </div>
              ))
            ) : (
              <div className={styles.noResults}>
                {searchTerm ? `No domains found matching "${searchTerm}"` : 'No domains available'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ENSDomainDropdown;

# Testing Expiry Date Migration

This document explains how to test the automatic expiry date migration system for upload history.

## Overview

The migration system automatically detects and fixes old/incorrect expiry dates by querying the Bee API. It runs on component load and during CSV import.

## Migration Detection Logic

The system considers an expiry date invalid if it:

- Is not a valid Unix timestamp in milliseconds
- Is less than `1000000000000` (before Sep 9, 2001)
- Is greater than `32503680000000` (after year 3000)

## Testing Methods

### Method 1: Browser DevTools Console

#### View Current Data

```javascript
// View all upload history
const history = JSON.parse(localStorage.getItem('uploadHistory') || '{}');
console.log(history);

// View data for specific address
const address = '0x1234...'; // Replace with your address
console.log(history[address]);
```

#### Create Test Data with Invalid Expiry Dates

```javascript
// Get your current address
const address = '0x1234567890abcdef1234567890abcdef12345678'; // Replace with actual address

// Create test records with invalid expiry formats
const testRecords = [
  {
    reference: 'test-ref-1',
    timestamp: Date.now() - 86400000, // 1 day ago
    filename: 'test-file-1.pdf',
    stampId: '2b7d10161ce52ed1234567890abcdef1234567890',
    expiryDate: 2592000, // Invalid: TTL in seconds (old bug format)
    isWebpageUpload: false,
    isFolderUpload: false,
  },
  {
    reference: 'test-ref-2',
    timestamp: Date.now() - 172800000, // 2 days ago
    filename: 'test-file-2.jpg',
    stampId: '17583271609201234567890abcdef1234567890',
    expiryDate: 7, // Invalid: "7 days" format (very old format)
    isWebpageUpload: false,
    isFolderUpload: false,
  },
  {
    reference: 'test-ref-3',
    timestamp: Date.now() - 259200000, // 3 days ago
    filename: 'test-file-3.mp4',
    stampId: '1f5d421a3c1234567890abcdef1234567890abcd',
    expiryDate: 123456789, // Invalid: too small timestamp
    isWebpageUpload: false,
    isFolderUpload: false,
  },
];

// Save to localStorage
const uploadHistory = JSON.parse(localStorage.getItem('uploadHistory') || '{}');
uploadHistory[address] = testRecords;
localStorage.setItem('uploadHistory', JSON.stringify(uploadHistory));

console.log('Test data created!');
```

#### Modify Existing Record (Based on Real Data)

```javascript
// Your address from localStorage
const userAddress = '0xb1C7F17Ed88189Abf269Bf68A3B2Ed83C5276aAe';

// Get current upload history from localStorage
let uploadHistory = JSON.parse(localStorage.getItem('uploadHistory') || '{}');
let userRecords = uploadHistory[userAddress] || [];

console.log('Current records BEFORE modification:', JSON.parse(JSON.stringify(userRecords)));

// Target the record with reference and stampId as shown in the image
const targetReference = '5ddb3da38d12b8a81d5f76b2feaf2d83855e7ebf19af513d4c79143091b50349';
const targetStampId = 'd0e3b4d3d23a2f480018c0a11c5f0c2cc7928a649b47cecb12b7d10161ce52ed';

// Find the record's index
const recordIndex = userRecords.findIndex(
  record => record.reference === targetReference && record.stampId === targetStampId
);

if (recordIndex !== -1) {
  console.log('Found record at index:', recordIndex);

  // Change from valid timestamp to TTL seconds (old bug format)
  // 2592000 seconds = 30 days
  userRecords[recordIndex].expiryDate = 2592000;

  console.log(
    'Changed record expiryDate to TTL seconds format:',
    userRecords[recordIndex].expiryDate
  );

  // Update the uploadHistory object with the modified userRecords
  uploadHistory[userAddress] = userRecords;

  // Save the updated uploadHistory back to localStorage
  localStorage.setItem('uploadHistory', JSON.stringify(uploadHistory));

  console.log('localStorage updated successfully.');
  console.log('Current records AFTER modification:', userRecords);
} else {
  console.log('Record not found with the specified reference and stampId.');
}
```

#### Clear Migration Cache (Force Re-run)

```javascript
// Clear the migration cache to force re-run
const address = '0x1234567890abcdef1234567890abcdef12345678'; // Replace with actual address
localStorage.removeItem(`beeport_expiry_migrated_${address}`);
console.log('Migration cache cleared - will run again on next load');
```

#### View Migration Cache

```javascript
// Check if migration was run recently
const address = '0x1234567890abcdef1234567890abcdef12345678'; // Replace with actual address
const migrationKey = `beeport_expiry_migrated_${address}`;
const lastMigration = localStorage.getItem(migrationKey);
if (lastMigration) {
  const timeSince = Date.now() - parseInt(lastMigration);
  console.log(`Migration last ran ${Math.round(timeSince / 1000 / 60)} minutes ago`);
} else {
  console.log('No migration cache found');
}
```

### Method 2: Quick Test Script

Run this in the console to set up a complete test scenario:

```javascript
// Complete test setup
const address = '0x1234567890abcdef1234567890abcdef12345678'; // Replace with your address

// Clear existing data
localStorage.removeItem('uploadHistory');
localStorage.removeItem(`beeport_expiry_migrated_${address}`);

// Create test data with various invalid formats
const testData = {
  [address]: [
    {
      reference: 'ref-ttl-seconds',
      timestamp: Date.now() - 86400000,
      filename: 'ttl-test.pdf',
      stampId: '2b7d10161ce52ed1234567890abcdef1234567890',
      expiryDate: 2592000, // TTL in seconds (old bug)
      isWebpageUpload: false,
      isFolderUpload: false,
    },
    {
      reference: 'ref-days-string',
      timestamp: Date.now() - 172800000,
      filename: 'days-test.jpg',
      stampId: '17583271609201234567890abcdef1234567890',
      expiryDate: 7, // "7 days" format (very old)
      isWebpageUpload: false,
      isFolderUpload: false,
    },
    {
      reference: 'ref-small-timestamp',
      timestamp: Date.now() - 259200000,
      filename: 'small-test.mp4',
      stampId: '1f5d421a3c1234567890abcdef1234567890abcd',
      expiryDate: 123456789, // Too small timestamp
      isWebpageUpload: false,
      isFolderUpload: false,
    },
    {
      reference: 'ref-valid',
      timestamp: Date.now() - 345600000,
      filename: 'valid-test.txt',
      stampId: '9e842bb65bf6dbb9edb3dcf350a59aa812345678',
      expiryDate: Date.now() + 86400000, // Valid timestamp (1 day from now)
      isWebpageUpload: false,
      isFolderUpload: false,
    },
  ],
};

// Save test data
localStorage.setItem('uploadHistory', JSON.stringify(testData));

console.log('✅ Test data created!');
console.log('📊 Records with invalid expiry:', 3);
console.log('📊 Records with valid expiry:', 1);
console.log('🔄 Refresh the page to trigger migration');
```

## Testing Steps

1. **Set up test data** using one of the methods above
2. **Open the upload history** in your app
3. **Watch the console** for migration messages:

   - `🔄 Migrating 3 old expiry dates...`
   - `✅ Migrated filename: stampId -> expires date`
   - `✅ Successfully migrated 3 expiry dates`

4. **Check the UI** for the yellow progress banner
5. **Verify results** by checking localStorage again

## Debugging Commands

```javascript
// Check what needs migration
const address = '0x1234567890abcdef1234567890abcdef12345678'; // Your address
const history = JSON.parse(localStorage.getItem('uploadHistory') || '{}');
const records = history[address] || [];

const needsMigration = records.filter(r => {
  const expiry = r.expiryDate;
  return !(expiry > 1000000000000 && expiry < 32503680000000);
});

console.log(`Records needing migration: ${needsMigration.length}`);
console.log(needsMigration);
```

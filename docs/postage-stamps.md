# Postage Stamps Guide

## What are Postage Stamps?

Postage stamps are prepaid storage credits on the Swarm network. Think of them like buying storage space in advance - you purchase a stamp with a certain capacity and duration, then use it to upload files to Swarm.

## How Postage Stamps Work

### Basic Concept

1. **Purchase**: Buy a stamp with specific capacity and duration
2. **Upload**: Use the stamp to upload files to Swarm
3. **Storage**: Files remain accessible while stamp is valid
4. **Expiration**: Files may become inaccessible when stamp expires

### Key Properties

- **Batch ID**: Unique identifier for your stamp
- **Capacity**: How much data you can store (in bytes)
- **Depth**: Technical parameter affecting capacity
- **Amount**: How much xBZZ you paid for the stamp
- **Expiration**: When the stamp expires
- **Utilization**: How much capacity you've used

## Creating Postage Stamps

### Through the Application

1. **Connect wallet** with xBZZ tokens
2. **Navigate to stamp creation** section
3. **Choose capacity** based on your needs
4. **Set duration** (how long files should be stored)
5. **Confirm transaction** in your wallet
6. **Wait for confirmation** on Gnosis Chain

### Capacity Planning

| File Size   | Recommended Stamp | Notes                      |
| ----------- | ----------------- | -------------------------- |
| < 100MB     | 1GB stamp         | Small files, documents     |
| 100MB - 1GB | 2-5GB stamp       | Medium files, images       |
| 1GB - 10GB  | 10-20GB stamp     | Large files, videos        |
| > 10GB      | 50GB+ stamp       | Very large files, archives |

### Duration Considerations

- **Short term** (1-3 months): Testing, temporary files
- **Medium term** (6-12 months): Projects, active use
- **Long term** (1+ years): Permanent storage, archives

## Using Stamps for Uploads

### Selecting a Stamp

When uploading, you'll see:

- **Stamp ID**: Unique identifier
- **Available capacity**: How much space is left
- **Expiration date**: When stamp expires
- **Utilization**: Percentage used

### Capacity Management

- **Check before upload**: Ensure stamp has enough space
- **Monitor usage**: Track how much capacity you've used
- **Plan ahead**: Consider future uploads when choosing stamps

### Multiple Uploads

- **Same stamp**: Use one stamp for multiple uploads
- **Efficient usage**: Maximize stamp utilization
- **Organized storage**: Group related files on same stamp

## Stamp Management

### Viewing Your Stamps

The application shows:

- **Active stamps**: Currently valid stamps
- **Expired stamps**: No longer valid for new uploads
- **Utilization**: How much of each stamp is used
- **Remaining capacity**: Available space

### Top-Up Feature

- **Add capacity**: Increase stamp size without creating new stamp
- **Extend duration**: Add more time to existing stamp
- **Cost effective**: Often cheaper than creating new stamp

### Best Practices

- **Monitor expiration**: Keep track of when stamps expire
- **Plan capacity**: Estimate storage needs in advance
- **Use efficiently**: Don't waste stamp capacity
- **Organize by purpose**: Different stamps for different projects

## Technical Details

### Depth and Capacity

Stamp capacity is determined by depth:

- **Depth 16**: ~65KB capacity
- **Depth 17**: ~131KB capacity
- **Depth 18**: ~262KB capacity
- **Depth 20**: ~1MB capacity
- **Depth 24**: ~16MB capacity
- **Depth 28**: ~268MB capacity

### Amount and Duration

- **Higher amount**: Longer storage duration
- **Lower amount**: Shorter storage duration
- **Network conditions**: Affect actual duration
- **Redistribution**: Stamps participate in network incentives

### Batch ID Format

- **64-character hex string**: e.g., `abc123def456...`
- **Unique identifier**: Each stamp has unique batch ID
- **Case insensitive**: Upper/lower case doesn't matter
- **Permanent**: Batch ID never changes

## Economics

### Cost Factors

- **Capacity**: Larger stamps cost more
- **Duration**: Longer storage costs more
- **Network demand**: Prices may fluctuate
- **xBZZ price**: Token price affects costs

### Cost Optimization

- **Right-size stamps**: Don't over-purchase capacity
- **Batch uploads**: Use stamps efficiently
- **Monitor usage**: Track utilization to optimize
- **Plan ahead**: Buy stamps when xBZZ prices are favorable

### Payment

- **xBZZ tokens**: Native Swarm token required
- **Gnosis Chain**: Transactions happen on Gnosis Chain
- **Gas fees**: Small transaction fees apply
- **Wallet required**: MetaMask or compatible wallet

## Troubleshooting Stamps

### Common Issues

#### "Stamp not found"

**Causes**:

- Stamp ID entered incorrectly
- Stamp hasn't been mined yet
- Network synchronization issues

**Solutions**:

- Double-check stamp ID
- Wait a few minutes for network propagation
- Refresh the page
- Try different Bee node

#### "Insufficient stamp capacity"

**Causes**:

- File too large for remaining capacity
- Stamp already fully utilized
- Capacity calculation error

**Solutions**:

- Check stamp utilization
- Use different stamp with more capacity
- Top up existing stamp
- Compress files to reduce size

#### "Stamp expired"

**Causes**:

- Stamp duration has ended
- Network conditions changed
- Insufficient amount paid

**Solutions**:

- Create new stamp
- Use different active stamp
- Top up expired stamp (if possible)

### Stamp Status Indicators

| Status        | Meaning                         | Action Needed                 |
| ------------- | ------------------------------- | ----------------------------- |
| Active        | Stamp is valid and usable       | None                          |
| Expiring Soon | Stamp expires within 30 days    | Consider top-up or new stamp  |
| Expired       | Stamp is no longer valid        | Create new stamp              |
| Full          | Stamp capacity is exhausted     | Top up or use different stamp |
| Pending       | Stamp transaction not confirmed | Wait for confirmation         |

## Advanced Features

### Stamp Sharing

- **Team usage**: Multiple people can use same stamp
- **Batch ID sharing**: Share batch ID securely
- **Capacity management**: Monitor shared usage
- **Access control**: No built-in access restrictions

### Stamp Analytics

- **Usage tracking**: Monitor how stamps are used
- **Cost analysis**: Track spending on storage
- **Efficiency metrics**: Optimize stamp utilization
- **Historical data**: View past stamp performance

### Integration

- **API usage**: Use stamps programmatically
- **Automated uploads**: Scripts can use stamp batch IDs
- **Monitoring**: Set up alerts for stamp status
- **Bulk operations**: Efficient use for large uploads

## Migration and Backup

### Moving Between Stamps

- **No automatic migration**: Files stay on original stamp
- **Manual re-upload**: Must upload to new stamp
- **Reference preservation**: Original references remain valid
- **Cost consideration**: Re-uploading costs additional capacity

### Backup Strategies

- **Multiple stamps**: Store important files on multiple stamps
- **Different durations**: Stagger expiration dates
- **Local backups**: Keep local copies of important files
- **Reference tracking**: Maintain list of file references

### Long-term Storage

- **Renewable stamps**: Plan for stamp renewal
- **Redundant storage**: Use multiple stamps for critical files
- **Migration planning**: Prepare for stamp transitions
- **Cost budgeting**: Plan ongoing storage costs

---

_For upload-specific information, see: [Single File Upload](./single-file-upload.md), [Multiple File Upload](./multiple-file-upload.md), [ZIP File Upload](./zip-file-upload.md)_

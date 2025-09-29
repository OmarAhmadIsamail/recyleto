const Counter = require('../models/Counter');

function pad(n, width = 6) {
  return String(n).padStart(width, '0');
}

function prefixFor(type) {
  if (type === 'sale') return 'SAL';
  if (type === 'purchase') return 'PUR';
  return 'TXN';
}

/**
 * Atomically get next transaction number for (pharmacyId, transactionType).
 */
async function getNextTransactionNumber({ pharmacyId, transactionType = 'sale' }) {
  const key = `txn:${pharmacyId}:${transactionType}`;

  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }        // returns the incremented value
  );

  return `${prefixFor(transactionType)}-${pad(doc.seq)}`;
}

module.exports = { getNextTransactionNumber };

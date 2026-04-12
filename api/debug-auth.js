const crypto = require('crypto');

const SCRYPT_KEYLEN = 64;

module.exports = async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    const envHash = process.env.ADMIN_PASSWORD_HASH || '';
    const envUser = process.env.ADMIN_USERNAME || '';
    const nodeVer = process.version;

    const info = {
          nodeVersion: nodeVer,
          envUsername: envUser,
          hashLength: envHash.length,
          hashFirst30: envHash.substring(0, 30),
          hashLast20: envHash.substring(envHash.length - 20),
          isVercel: process.env.VERCEL || 'not set',
          nodeEnv: process.env.NODE_ENV || 'not set',
    };

    const normalized = String(envHash).trim().toLowerCase();
    info.normalizedLength = normalized.length;
    info.startsWithScrypt = normalized.startsWith('scrypt$');

    if (normalized.startsWith('scrypt$')) {
          const parts = normalized.split('$');
          info.partsCount = parts.length;
          info.saltLength = (parts[1] || '').length;
          info.digestLength = (parts[2] || '').length;

      const salt = parts[1];
          const expectedDigest = parts[2];

      try {
              const actualDigest = crypto.scryptSync('Jiso9999', salt, SCRYPT_KEYLEN).toString('hex');
              info.actualDigestLength = actualDigest.length;
              info.actualFirst20 = actualDigest.substring(0, 20);
              info.expectedFirst20 = (expectedDigest || '').substring(0, 20);
              info.digestsMatch = actualDigest === expectedDigest;
              info.lengthsMatch = actualDigest.length === (expectedDigest || '').length;
      } catch (err) {
              info.scryptError = err.message;
      }
    }

    return res.status(200).json(info);
};

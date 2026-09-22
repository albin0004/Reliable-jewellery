/**
 * Reliable Jewellery — Security Utilities
 * Cryptographic verification & security helpers.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SecurityUtils = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // SHA-256 digest of authorized manager/administrative PIN ('7722')
    const AUTHORIZED_PIN_HASH = 'd21753641f9e08316066324cd594c29bc8c130011556c81b219158f27dcc5910';

    /**
     * Pure JavaScript SHA-256 Implementation for reliable sync verification
     * in any browser environment (including HTTP, file:// and Web Workers)
     */
    function sha256(ascii) {
        function rightRotate(value, amount) {
            return (value >>> amount) | (value << (32 - amount));
        }

        const mathPow = Math.pow;
        const maxWord = mathPow(2, 32);
        let result = '';
        const words = [];
        const asciiBitLength = ascii.length * 8;

        let hash = [
            0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
            0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
        ];

        const k = [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
        ];

        for (let i = 0; i < ascii.length; i++) {
            words[i >> 2] |= (ascii.charCodeAt(i) & 0xff) << ((3 - (i % 4)) * 8);
        }

        words[asciiBitLength >> 5] |= 0x80 << ((3 - ((asciiBitLength >> 3) % 4)) * 8);
        words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

        const w = new Array(64);

        for (let j = 0; j < words.length; j += 16) {
            let a = hash[0], b = hash[1], c = hash[2], d = hash[3];
            let e = hash[4], f = hash[5], g = hash[6], h = hash[7];

            for (let i = 0; i < 64; i++) {
                if (i < 16) {
                    w[i] = words[j + i] | 0;
                } else {
                    const gamma0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
                    const gamma1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
                    w[i] = (w[i - 16] + gamma0 + w[i - 7] + gamma1) | 0;
                }

                const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
                const ch = (e & f) ^ ((~e) & g);
                const temp1 = (h + s1 + ch + k[i] + w[i]) | 0;
                const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
                const maj = (a & b) ^ (a & c) ^ (b & c);
                const temp2 = (s0 + maj) | 0;

                h = g;
                g = f;
                f = e;
                e = (d + temp1) | 0;
                d = c;
                c = b;
                b = a;
                a = (temp1 + temp2) | 0;
            }

            hash[0] = (hash[0] + a) | 0;
            hash[1] = (hash[1] + b) | 0;
            hash[2] = (hash[2] + c) | 0;
            hash[3] = (hash[3] + d) | 0;
            hash[4] = (hash[4] + e) | 0;
            hash[5] = (hash[5] + f) | 0;
            hash[6] = (hash[6] + g) | 0;
            hash[7] = (hash[7] + h) | 0;
        }

        for (let i = 0; i < 8; i++) {
            for (let j = 3; j >= 0; j--) {
                const b = (hash[i] >> (j * 8)) & 0xff;
                result += (b < 16 ? '0' : '') + b.toString(16);
            }
        }
        return result;
    }

    /**
     * Synchronously verify an administrative PIN against the authorized SHA-256 digest
     * @param {string|number} inputPin
     * @returns {boolean}
     */
    function verifyPin(inputPin) {
        if (inputPin === null || inputPin === undefined) return false;
        const clean = String(inputPin).trim();
        if (!clean) return false;
        return sha256(clean) === AUTHORIZED_PIN_HASH;
    }

    /**
     * Asynchronously verify an administrative PIN using Web Crypto if available
     * @param {string|number} inputPin
     * @returns {Promise<boolean>}
     */
    async function verifyPinAsync(inputPin) {
        if (inputPin === null || inputPin === undefined) return false;
        const clean = String(inputPin).trim();
        if (!clean) return false;

        if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
            try {
                const data = new TextEncoder().encode(clean);
                const digest = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(digest));
                const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                return hashHex === AUTHORIZED_PIN_HASH;
            } catch (e) {
                // Fall back to pure JS
            }
        }
        return verifyPin(clean);
    }

    return {
        sha256: sha256,
        verifyPin: verifyPin,
        verifyPinAsync: verifyPinAsync,
        AUTHORIZED_PIN_HASH: AUTHORIZED_PIN_HASH
    };
}));

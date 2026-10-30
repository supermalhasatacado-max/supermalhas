import assert from 'node:assert/strict';
import { build } from 'esbuild';
const built = await build({ stdin: { contents: "export * from './lib/shop/tokenize-card';", resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' });
const { tokenizeCard } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
const fields = Object.fromEntries(Object.entries({ number: '4000 0000 0000 0010', holder_name: 'CLIENTE EXEMPLO', holder_document: '529.982.247-25', expiry: '12/2099', cvv: '123' }).map(([key, value]) => [key, { value }]));
const form = { querySelector: selector => fields[selector.match(/"([a-z_]+)"/)[1]], querySelectorAll: () => Object.values(fields) };
let calls = 0, credentials;
globalThis.fetch = () => { throw new Error('Card information must use the official SDK, never the shop API'); };
globalThis.window = { CheckoutTransparent: {
  setCredentials(value) { credentials = value; },
  getCardBrand({ bin, success }) { assert.equal(bin, '400000'); success({ brand: 'Visa' }); },
  createTemporaryCard({ card, success }) { calls++; assert.equal(card.number, '4000000000000010'); assert.equal(card.cvv, '123'); assert.equal(card.holderDocument, '52998224725'); assert.equal(card.expirationYear, '2099'); success({ temporaryToken: 'card_t/offline-token' }); },
} };
assert.equal(await tokenizeCard(form, '58312831000189', 'public-sdk-token'), 'card_t/offline-token');
assert.deepEqual(credentials, { merchantCredential: '58312831000189', transparentToken: 'public-sdk-token' });
assert(Object.values(fields).every(f => f.value === ''), 'All card fields cleared after tokenization');
await assert.rejects(() => tokenizeCard(form, '58312831000189', ''), /temporariamente indisponível/);
await assert.rejects(() => tokenizeCard(form, '58312831000189', 'public-sdk-token'), /Confira/);
assert.equal(calls, 1);
const refill = () => { for (const [key, value] of Object.entries({ number: '4000000000000010', holder_name: 'CLIENTE EXEMPLO', holder_document: '52998224725', expiry: '12/2099', cvv: '123' })) fields[key].value = value; };
refill();
window.CheckoutTransparent.createTemporaryCard = ({ error }) => error({ message: 'Sensitive provider response' });
await assert.rejects(() => tokenizeCard(form, '58312831000189', 'public-sdk-token'), error => /não conseguiu validar/.test(error.message) && !error.message.includes('Sensitive'));
assert(Object.values(fields).every(f => f.value === ''), 'Failed tokenization clears card data too');
refill();
window.CheckoutTransparent.createTemporaryCard = ({ success }) => success({ temporaryToken: 'token_wrong_provider' });
await assert.rejects(() => tokenizeCard(form, '58312831000189', 'public-sdk-token'), /não conseguiu validar/);
console.log('PASS: PicPay official SDK interface, merchant credentials, holder document, one-use card tokens, error redaction, cleared fields and no shop card request.');

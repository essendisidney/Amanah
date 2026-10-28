import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { taifaEncrypt } from './sms.ts';

// Expected values come from Taifa's PHP library call, run with PHP's openssl:
// bin2hex(openssl_encrypt(json_encode([...]), 'aes-128-cbc', $key, OPENSSL_RAW_DATA, 'w4^dgd$%^62:)dgs'))
const PLAIN =
  '{"message":"Your Jameiyah code is 123456. Valid 15 min. Do not share.","recepients":"254712345678"}';

describe('taifaEncrypt', () => {
  it('matches PHP for a key shorter than 16 bytes (zero-padded)', async () => {
    assert.equal(
      await taifaEncrypt(PLAIN, 'shortkey'),
      'd73177fa8dd39ca6ea1464d85a10d2f6bd072eede5ba883dfabe83955bea0a3f6a085c2921eb2682ffedcc3c337857b155c8569418070d4c14967dd425eed287990488ad2e142423d572a43d828019231a704dd75ae372c96b589f279d6a0909fc02e8260fac287e683fea2bec9e3b0f',
    );
  });

  it('matches PHP for a key longer than 16 bytes (first 16 used)', async () => {
    assert.equal(
      await taifaEncrypt(PLAIN, 'abcdef0123456789ZZZZtail-longer-than-16'),
      'd2ef03d8a6cadb272cd90b0bbd2d6deb112c98a570702df9548bfbeef4a49887b45cb3a7660e5e190970f546b238e15c795cf1f1392de08bc02dda12dba801b5d1ec8b949f9b3c3e8b8f7b7bafcc73317237aaba8b66cd99e74bffad60d7bf2864d36e0e214bce526f98709e3111d521',
    );
  });
});

import { Client, generateCommand } from '@litehex/node-vault';
import { createInstance, destroyInstance, sleep } from '@tests/utils';
import { expect } from 'chai';
import { execSync } from 'node:child_process';
import { z } from 'zod';

describe('node-vault', () => {
  const vc = new Client();

  // Launch
  before(async () => {
    const { root_token } = await createInstance();
    vc.token = root_token;
  });

  // Down
  after(async () => {
    destroyInstance();
    await sleep(2e3);
  });

  it('should be able to implement custom command', async () => {
    const fooCommand = generateCommand({
      path: '/sys/seal-status',
      method: 'GET',
      client: vc,
      schema: {
        response: z.any()
      }
    });

    const result = await fooCommand();
    expect(result).to.have.property('sealed').be.a('boolean');
  });

  it('should get seal status', async () => {
    const result = await vc.status();

    expect(result).to.have.property('sealed').be.a('boolean');
    expect(result).to.have.property('t').be.a('number');
    expect(result).to.have.property('n').be.a('number');
    expect(result).to.have.property('progress').be.a('number');
    expect(result).to.have.property('nonce').be.a('string');
    expect(result).to.have.property('version').be.a('string');
    expect(result).to.have.property('build_date').be.a('string');
    expect(result).to.have.property('migration').be.a('boolean');
    expect(result).to.have.property('recovery_seal').be.a('boolean');
    expect(result).to.have.property('storage_type').be.a('string');
  });

  it('should seal and unseal vault', async () => {
    const { root_token, keys } = await createInstance(false);
    vc.token = root_token;

    await sleep(1e3);

    const status = await vc.status();
    expect(status).to.have.property('sealed').be.a('boolean').to.be.true;
    expect(status).to.have.property('storage_type').be.a('string').to.be.equal('inmem');

    const seal = await vc.seal();
    expect(seal).to.be.true;

    // Wait  seconds to ensure vault is sealed
    await sleep(2e3);

    const unseal = await vc.unseal({
      key: keys[0]
    });
    expect(unseal).to.have.property('sealed', false);
  });

  it('should write, read and delete secret', async () => {
    await vc.mount({
      type: 'kv',
      mountPath: 'secret'
    });

    await sleep(1e3);

    const write = await vc.write({
      path: 'secret/test',
      data: {
        foo: 'bar'
      }
    });
    expect(write).to.true;

    const read = await vc.read({
      path: 'secret/test'
    });
    expect(read).to.have.property('data').to.have.property('data').to.have.property('foo', 'bar');

    const deleted = await vc.delete({
      path: 'secret/test'
    });
    expect(deleted).to.true;
  });

  it('should init vault', async () => {
    execSync('docker compose up -d --force-recreate', {
      stdio: 'ignore'
    });
    await sleep(1e3);

    const vc = new Client();

    const initStats = await vc.initialized();
    expect(initStats).to.have.property('initialized').be.a('boolean').to.be.false;

    const result = await vc.init({
      secret_shares: 1,
      secret_threshold: 1
    });

    expect(result).to.have.property('keys').be.a('array').lengthOf(1);
    expect(result).to.have.property('keys_base64').be.a('array').lengthOf(1);
    expect(result).to.have.property('root_token').be.a('string');
  });
});

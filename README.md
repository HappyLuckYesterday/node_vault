# node-vault

A Javascript client for the HTTP API of HashiCorp's [vault](https://vaultproject.io/) with a focus on ease of use.

```bash
npm install @litehex/node-vault
```

### Usage

##### Init and unseal vault

```js
import { Client } from '@litehex/node-vault';

// Get a new instance of the client
const vc = new Client({
  apiVersion: 'v1', // default
  endpoint: 'http://127.0.0.1:8200', // default
  token: 'hv.xxxxxxxxxxxxxxxxxxxxx' // Optional unless you want to initialize the vault
});

// Init vault
vc.init({ secret_shares: 1, secret_threshold: 1 }).then((res) => {
  const { keys, root_token } = res;
  vc.token = root_token;
  // Unseal vault
  vc.unseal({ secret_shares: 1, key: keys[0] });
});
```

##### Write, read and delete secrets

```js
vc.write({ path: 'secret/hello', data: { foo: 'bar' } }).then(() => {
  vc.read({ path: 'secret/hello' }).then(({ data }) => {
    console.log(data); // { value: 'world' }
  });
});

vc.delete({ path: 'secret/hello' });
```

### Docs

- HashCorp's Vault [API docs](https://developer.hashicorp.com/vault/api-docs)

### Examples

##### Using a proxy or having the ability to modify the outgoing request.

```js
import { Client } from '@litehex/node-vault';
import { ProxyAgent } from 'undici';

const agent = new ProxyAgent('http://localhost:8080');

const vc = new Client({
  // ... other params
  request: {
    agent: agent,
    headers: {
      'X-Custom-Header': 'value'
    }
  }
});
```

### License

This project is licensed under the GPLv3 License - see the [LICENSE](LICENSE) file for details

import { z } from 'zod';
import { CommandInit, generateCommand, generateCommandRequestInit } from './utils/generate-command';
import { CommandArgs, RequestInit, RequestSchema, ValidatedResponse } from './typings';
import { PartialDeep } from 'type-fest';
import { request } from './lib/request';
import {
  AnyEngineSchema,
  Engine,
  EngineAction,
  EngineName,
  engines,
  EngineSchema
} from './lib/engine';

const ClientOptionsSchema = z.object({
  endpoint: z.string().optional(),
  apiVersion: z.string().optional(),
  pathPrefix: z.string().optional(),
  token: z.string().optional(),
  namespace: z.string().optional()
});

export type ClientOptions = z.infer<typeof ClientOptionsSchema> & {
  request?: PartialDeep<RequestInit>;
};

export class Client {
  endpoint: string;
  apiVersion: string;
  pathPrefix: string;
  namespace: string | undefined;
  token: string | undefined;
  request: PartialDeep<Omit<RequestInit, 'url'>> | undefined;

  constructor({ request, ...restOpts }: ClientOptions = {}) {
    const options = ClientOptionsSchema.parse(restOpts);

    this.endpoint = options.endpoint || process.env.VAULT_ADDR || 'http://127.0.0.1:8200';
    this.apiVersion = options.apiVersion || 'v1';
    this.pathPrefix = options.pathPrefix || '';
    this.namespace = options.namespace || process.env.VAULT_NAMESPACE;
    this.token = options.token || process.env.VAULT_TOKEN;

    this.request = request;
  }

  private assignCommands<T extends RequestSchema>(
    commands: Record<string, Omit<CommandInit<T>, 'client'>>
  ) {
    for (const [name, init] of Object.entries(commands)) {
      // @ts-ignore
      this[name] = generateCommand({ ...init, client: this });
    }
  }

  async read<Engine extends EngineName = any>(
    query: QueryArgs<Engine, 'read'>,
    options: Omit<RequestInit, 'url'> = {}
  ): Promise<ValidatedResponse<EngineSchema<Engine>['read']>> {
    const { engine, ...args } = query || {};

    const schema =
      engine && engines[engine] && engines[engine]['read']
        ? engines[engine]['read']
        : AnyEngineSchema;

    const init = await generateCommandRequestInit(
      {
        method: 'GET',
        path: '/{{path}}',
        client: this,
        schema
      },
      args as any,
      options
    );

    return request<any>(init, schema);
  }

  write = generateCommand({
    method: 'POST',
    path: '/{{path}}',
    client: this,
    schema: {
      path: z.object({
        path: z.string()
      }),
      body: z.any(),
      response: z.record(z.any())
    }
  });

  delete = generateCommand({
    method: 'DELETE',
    path: '/{{path}}',
    client: this,
    schema: {
      path: z.object({
        path: z.string()
      }),
      response: z.record(z.any())
    }
  });

  /**
   * @link https://developer.hashicorp.com/vault/api-docs/system/seal-status#seal-status
   */
  status = generateCommand({
    method: 'GET',
    path: '/sys/seal-status',
    client: this,
    schema: {
      response: z.object({
        type: z.string(),
        initialized: z.boolean(),
        sealed: z.boolean(),
        t: z.number(),
        n: z.number(),
        progress: z.number(),
        nonce: z.string(),
        version: z.string(),
        build_date: z.string(),
        migration: z.boolean(),
        recovery_seal: z.boolean(),
        storage_type: z.string()
      })
    }
  });

  /**
   * @link https://developer.hashicorp.com/vault/api-docs/system/init#read-initialization-status
   */
  initialized = generateCommand({
    method: 'GET',
    path: '/sys/init',
    client: this,
    schema: {
      response: z.object({
        initialized: z.boolean()
      })
    }
  });

  /**
   * @link https://developer.hashicorp.com/vault/api-docs/system/init#start-initialization
   */
  init = generateCommand({
    method: 'POST',
    path: '/sys/init',
    client: this,
    schema: {
      body: z.object({
        pgp_keys: z.array(z.string()).optional(),
        root_token_pgp_key: z.string().default('').optional(),
        secret_shares: z.number(),
        secret_threshold: z.number(),
        stored_shares: z.number().optional(),
        recovery_shares: z.number().default(0).optional(),
        recovery_threshold: z.number().default(0).optional(),
        recovery_pgp_keys: z.array(z.string()).optional()
      }),
      response: z.object({
        keys: z.array(z.string()),
        keys_base64: z.array(z.string()),
        root_token: z.string()
      })
    }
  });

  /**
   * @link https://developer.hashicorp.com/vault/api-docs/system/unseal#submit-unseal-key
   */
  unseal = generateCommand({
    method: 'POST',
    path: '/sys/unseal',
    client: this,
    schema: {
      body: z.object({
        key: z.string(),
        reset: z.boolean().default(false).optional(),
        migrate: z.boolean().default(false).optional()
      }),
      response: z.discriminatedUnion('sealed', [
        z.object({
          sealed: z.literal(true),
          t: z.number(),
          n: z.number(),
          progress: z.number(),
          version: z.string()
        }),
        z.object({
          sealed: z.literal(false),
          t: z.number(),
          n: z.number(),
          progress: z.number(),
          version: z.string(),
          cluster_name: z.string(),
          cluster_id: z.string()
        })
      ])
    }
  });

  /**
   * @link https://developer.hashicorp.com/vault/api-docs/system/seal#seal
   */
  seal = generateCommand({
    method: 'POST',
    path: '/sys/seal',
    client: this,
    schema: {
      response: z.record(z.any())
    }
  });
}

type QueryArgs<Name extends EngineName, Action extends EngineAction> = Name extends EngineName
  ? EngineSchema<Name> extends Engine
    ? CommandArgs<EngineSchema<Name>[Action]> & {
        engine?: Name;
      }
    : never
  : never;

export type * from './typings';

export { generateCommand };

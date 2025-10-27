import { createClient, type PolkadotClient, type TypedApi } from 'polkadot-api';
import { getWsProvider } from '@polkadot-api/ws-provider/node';
import { relayChain, assetHub } from '@polkadot-api/descriptors';

import { getConfig } from '../config';

// Type for the typed APIs
type RelayChainApi = TypedApi<typeof relayChain>;
type AssetHubApi = TypedApi<typeof assetHub>;

export class AbstractApi {
  private static instance: AbstractApi;
  private relayChainClient: PolkadotClient | null = null;
  private assetHubClient: PolkadotClient | null = null;
  private relayChainApi: RelayChainApi | null = null;
  private assetHubApi: AssetHubApi | null = null;

  private constructor() {}

  public static getInstance(): AbstractApi {
    if (!AbstractApi.instance) {
      AbstractApi.instance = new AbstractApi();
    }
    return AbstractApi.instance;
  }

  public getRelayChainApi(): RelayChainApi {
    if (!this.relayChainApi) {
      const config = getConfig();
      this.relayChainClient = createClient(getWsProvider(config.relayChainUrl));
      this.relayChainApi = this.relayChainClient.getTypedApi(relayChain);
    }
    return this.relayChainApi;
  }

  public getAssetHubApi(): AssetHubApi {
    if (!this.assetHubApi) {
      const config = getConfig();
      this.assetHubClient = createClient(getWsProvider(config.assetHubUrl));
      this.assetHubApi = this.assetHubClient.getTypedApi(assetHub);
    }
    return this.assetHubApi;
  }

  public getRelayChainClient(): PolkadotClient {
    if (!this.relayChainClient) {
      // Initialize the API if not already done
      this.getRelayChainApi();
    }
    return this.relayChainClient!;
  }

  public getAssetHubClient(): PolkadotClient {
    if (!this.assetHubClient) {
      // Initialize the API if not already done
      this.getAssetHubApi();
    }
    return this.assetHubClient!;
  }

  public disconnect(): void {
    if (this.relayChainClient) {
      this.relayChainClient.destroy();
      this.relayChainClient = null;
      this.relayChainApi = null;
    }
    if (this.assetHubClient) {
      this.assetHubClient.destroy();
      this.assetHubClient = null;
      this.assetHubApi = null;
    }
  }
}

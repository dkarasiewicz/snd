import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service.js';
import { MemoryService } from '../../memory/memory.service.js';
import { StoreService } from '../store/store.service.js';
import { PluginLoadResult } from './types.js';
import { PluginLoaderService } from './plugin-loader.service.js';

@Injectable()
export class PluginRegistryService {
  private cache: PluginLoadResult | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly memoryService: MemoryService,
    private readonly storeService: StoreService,
    private readonly pluginLoaderService: PluginLoaderService,
  ) {}

  async getPlugins(forceReload = false): Promise<PluginLoadResult> {
    if (this.cache && !forceReload) {
      return this.cache;
    }

    const config = this.configService.load();
    const loaded = await this.pluginLoaderService.load(config, this.memoryService, this.storeService);
    this.cache = loaded;
    return loaded;
  }

  invalidate(): void {
    this.cache = null;
  }
}

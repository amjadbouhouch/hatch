import { Chat } from 'chat';
import { createTelegramAdapter } from '@chat-adapter/telegram';
import { createDiscordAdapter } from '@chat-adapter/discord';
import { createMemoryState } from '@chat-adapter/state-memory';

import { db } from '@hatch/database';
import { harnessPool } from './harness-pool.js';
import type { PoolEntry } from './harness-pool.js';
import { eq } from 'drizzle-orm';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ChatPlatformConfig {
  workspaceId: string;
  platform: 'telegram' | 'discord';
  enabled: boolean;
}

export interface ChatThreadContext {
  platform: 'telegram' | 'discord';
  channelId: string;
  threadId: string;
  workspaceId: string;
  userId: string;
  userName?: string;
}

// ─── Chat Manager ───────────────────────────────────────────────────────────

export class ChatManager {
  private chat: Chat | null = null;
  private activePlatforms = new Map<string, { enabled: boolean; workspaceId: string }>();

  /**
   * Initialize the Chat SDK with configured platforms.
   */
  async init(): Promise<void> {
    if (this.chat) return;

    const memoryState = createMemoryState();

    this.chat = new Chat({
      userName: 'Hatch',
      adapters: {
        telegram: createTelegramAdapter(),
        discord: createDiscordAdapter(),
      },
      state: memoryState,
      dedupeTtlMs: 60_000,
    });

    this.setupHandlers();
  }

  /**
   * Start polling for a specific platform.
   */
  async startPolling(platform: 'telegram' | 'discord', workspaceId: string): Promise<void> {
    if (!this.chat) {
      await this.init();
    }

    this.activePlatforms.set(platform, { enabled: true, workspaceId });

    // Get adapter and start polling
    const adapter = this.chat!.adapters[platform];
    if (adapter?.startPolling) {
      await adapter.startPolling();
      console.log(`[chat] Started ${platform} polling for workspace ${workspaceId}`);
    }
  }

  /**
   * Stop polling for a specific platform.
   */
  async stopPolling(platform: 'telegram' | 'discord'): Promise<void> {
    const adapter = this.chat?.adapters[platform];
    if (adapter?.stopPolling) {
      await adapter.stopPolling();
    }
    this.activePlatforms.delete(platform);
    console.log(`[chat] Stopped ${platform} polling`);
  }

  /**
   * Check if a platform is active for a workspace.
   */
  isActive(platform: 'telegram' | 'discord', workspaceId: string): boolean {
    const config = this.activePlatforms.get(platform);
    return config?.enabled && config.workspaceId === workspaceId;
  }

  /**
   * Send a message through a platform thread.
   */
  async sendMessage(
    platform: 'telegram' | 'discord',
    threadId: string,
    content: string,
  ): Promise<void> {
    if (!this.chat) return;

    const adapter = this.chat.adapters[platform];
    if (!adapter) return;

    // Get channel from adapter
    const channelId = this.deriveChannelId(adapter, threadId);
    const channel = await adapter.getChannel(channelId);
    if (channel) {
      await channel.post(content);
    }
  }

  /**
   * Stream agent response to a platform thread.
   */
  async streamToThread(
    context: ChatThreadContext,
    response: AsyncIterable<string>,
  ): Promise<void> {
    if (!this.chat) return;

    const adapter = this.chat.adapters[context.platform];
    if (!adapter) return;

    const channelId = this.deriveChannelId(adapter, context.threadId);
    const thread = await adapter.getThread(channelId, context.channelId);
    if (thread) {
      await thread.post(response);
    }
  }

  private setupHandlers(): void {
    if (!this.chat) return;

    // Handle new mentions (Telegram @bot, Discord @bot)
    this.chat.onNewMention(async (thread) => {
      const ctx = this.extractContext(thread);
      if (!ctx) return;

      // Start streaming response
      await this.handleAgentMessage(ctx, thread);
    });

    // Handle direct messages
    this.chat.onDirectMessage(async (thread) => {
      const ctx = this.extractContext(thread);
      if (!ctx) return;

      await this.handleAgentMessage(ctx, thread);
    });

    // Handle subscribed messages (ongoing conversations)
    this.chat.onSubscribedMessage(async (thread, message) => {
      const ctx = this.extractContext(thread);
      if (!ctx) return;

      await this.handleAgentMessage(ctx, thread);
    });
  }

  private async handleAgentMessage(ctx: ChatThreadContext, thread: any): Promise<void> {
    const { platform, workspaceId, threadId } = ctx;

    // Get or create harness for this workspace
    const poolEntry = await harnessPool.getOrCreate(threadId, workspaceId);

    // Subscribe to harness events and stream responses
    const eventUnsub = poolEntry.harness.subscribe(async (event) => {
      if (event.type === 'message_update') {
        const msg = event.message;
        if (msg.role === 'assistant' && msg.content?.[0]?.type === 'text') {
          await thread.startTyping();
        }
      }

      if (event.type === 'agent_end') {
        // Get final message and send to chat
        const messages = await poolEntry.harness.getMessages();
        const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
        if (lastAssistant?.content?.[0]?.type === 'text') {
          await thread.post(lastAssistant.content[0].text);
        }
        eventUnsub();
      }
    });

    // Send user message to harness
    // Note: Need to extract message text from thread
    const messages = await thread.getMessages?.();
    if (messages) {
      for await (const msg of messages) {
        if (msg.author.type === 'user') {
          await poolEntry.harness.sendMessage({
            content: msg.text || '',
          });
          break;
        }
      }
    }
  }

  private extractContext(thread: any): ChatThreadContext | null {
    const adapter = thread.adapter;
    const platform = adapter?.name as 'telegram' | 'discord';
    if (!platform || !['telegram', 'discord'].includes(platform)) {
      return null;
    }

    // Get workspace ID from active platforms
    const config = this.activePlatforms.get(platform);
    if (!config) return null;

    return {
      platform,
      channelId: thread.channelId,
      threadId: thread.id,
      workspaceId: config.workspaceId,
      userId: thread.currentMessage?.author?.id || 'unknown',
      userName: thread.currentMessage?.author?.name,
    };
  }

  private deriveChannelId(adapter: any, threadId: string): string {
    // Extract channel ID from thread ID based on platform
    // Telegram: chat ID is part of message ID
    // Discord: channel ID + thread ID
    if (adapter.name === 'telegram') {
      return threadId.split(':')[0] || threadId;
    }
    if (adapter.name === 'discord') {
      return threadId.split(':')[0] || threadId;
    }
    return threadId;
  }

  /**
   * Shutdown the chat manager.
   */
  async shutdown(): Promise<void> {
    // Stop all polling
    for (const platform of this.activePlatforms.keys()) {
      await this.stopPolling(platform as 'telegram' | 'discord');
    }
    this.chat = null;
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const chatManager = new ChatManager();

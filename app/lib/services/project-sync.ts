/**
 * Project Sync Service
 * Ensures chat history and project data are properly synced to Supabase
 */

import type { Message } from 'ai';
import { supabasePersistence } from './supabase-persistence';

export interface ProjectSyncOptions {
  projectId: string;
  projectName: string;
  messages: Message[];
  files?: Record<string, { type: 'file'; content: string }>;
}

class ProjectSyncService {
  private syncQueue: Map<string, ProjectSyncOptions> = new Map();
  private retryCount: Map<string, number> = new Map();
  private isSyncing = false;
  private readonly MAX_RETRIES = 3;

  /**
   * Queue project for sync
   */
  queueSync(options: ProjectSyncOptions) {
    this.syncQueue.set(options.projectId, options);
    this.processSyncQueue();
  }

  /**
   * Process sync queue
   */
  private async processSyncQueue() {
    if (this.isSyncing || this.syncQueue.size === 0) {
      return;
    }

    this.isSyncing = true;

    try {
      for (const [projectId, options] of this.syncQueue.entries()) {
        await this.syncProject(options);
        this.syncQueue.delete(projectId);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync project to Supabase with strict duplicate prevention
   */
  private async syncProject(options: ProjectSyncOptions) {
    const { projectId, projectName, messages, files } = options;

    try {
      console.log(`🔄 Syncing project ${projectId}...`);

      // STRICT: Validate project has content before syncing
      const hasMessages = messages && messages.length > 0;
      const hasFiles = files && Object.keys(files).length > 0;

      if (!hasMessages && !hasFiles) {
        console.log(`⏭️ Skipping sync: Project ${projectId} has no content`);
        return;
      }

      // 1. Ensure project exists (check by ID to prevent duplicates)
      const projects = await supabasePersistence.getProjects();
      const existingProject = projects.find((p) => p.id === projectId);

      if (!existingProject) {
        // Create project with the specific projectId to prevent foreign key issues
        await supabasePersistence.createProject(projectName, 'Chat conversation', projectId);
        console.log(`✅ Created project ${projectId}`);
      } else {
        // Update project timestamp and name to show in history (newest first)
        await supabasePersistence.updateProject(projectId, {
          name: projectName || existingProject.name || 'Untitled Project',
          updated_at: new Date().toISOString(),
        });
      }

      // 2. Sync chat messages (delete old, insert new to prevent duplicates)
      if (hasMessages) {
        // Delete existing messages for this project
        await supabasePersistence.deleteChatHistory(projectId);
        
        // Insert all messages
        for (const message of messages) {
          if (message.content && message.content.trim().length > 0) {
            await supabasePersistence.saveChatMessage({
              id: message.id,
              projectId,
              role: message.role as 'user' | 'assistant' | 'system',
              content: message.content,
            });
          }
        }
        console.log(`✅ Synced ${messages.length} messages`);
      }

      // 3. Sync project files (upsert to prevent duplicates)
      if (hasFiles) {
        const fileEntries = Object.entries(files);
        
        for (const [filePath, fileData] of fileEntries) {
          if (fileData.type === 'file' && fileData.content) {
            // Save to project_files table (upsert)
            await supabasePersistence.saveProjectFile({
              projectId,
              filePath,
              content: fileData.content,
            });
          }
        }
        console.log(`✅ Synced ${fileEntries.length} files`);
      }

      console.log(`✅ Project ${projectId} synced successfully`);
      // Clear retry count on success
      this.retryCount.delete(projectId);
    } catch (error) {
      console.error(`❌ Failed to sync project ${projectId}:`, error);
      
      // Check retry count to prevent infinite loop
      const retries = this.retryCount.get(projectId) || 0;
      if (retries < this.MAX_RETRIES) {
        this.retryCount.set(projectId, retries + 1);
        console.log(`🔄 Retry ${retries + 1}/${this.MAX_RETRIES} for project ${projectId}`);
        setTimeout(() => {
          this.queueSync(options);
        }, 5000);
      } else {
        console.error(`❌ Max retries reached for project ${projectId}, giving up`);
        this.retryCount.delete(projectId);
      }
    }
  }

  /**
   * Force sync a project immediately
   */
  async forceSyncProject(options: ProjectSyncOptions) {
    await this.syncProject(options);
  }
}

export const projectSync = new ProjectSyncService();

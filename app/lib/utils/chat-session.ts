/**
 * Chat Session Management
 * Handles proper initialization and cleanup of chat sessions
 */

import { clearCurrentProject } from '~/lib/stores/project';
import { canvasStore } from '~/lib/stores/canvas';
import { workbenchStore } from '~/lib/stores/workbench';
import { screenPersistence } from '~/lib/services/screen-persistence';
import { description, chatId } from '~/lib/persistence/useChatHistory';

/**
 * Start a new chat session
 * Clears all previous state to prevent data mixing
 */
export function startNewChatSession() {
  console.log('🆕 Starting new chat session');
  
  // Clear project state
  clearCurrentProject();
  
  // Clear canvas
  canvasStore.clearAll();
  
  // Clear workbench files
  workbenchStore.files.set({});
  workbenchStore.setShowWorkbench(false);
  
  // Clear screen session cache
  screenPersistence.clearSessionCache();
  
  // Clear chat metadata
  description.set(undefined);
  chatId.set(undefined);
  
  console.log('✅ New chat session initialized');
}

/**
 * Check if current session has any content
 */
export function hasSessionContent(): boolean {
  const hasFiles = Object.keys(workbenchStore.files.get()).length > 0;
  const hasPages = canvasStore.getAllPages().length > 0;
  const hasDescription = description.get() && description.get() !== 'New Chat';
  
  return hasFiles || hasPages || hasDescription;
}

/**
 * Validate if project should be saved
 */
export function shouldSaveProject(): boolean {
  const projectName = description.get();
  const hasFiles = Object.keys(workbenchStore.files.get()).length > 0;
  const hasPages = canvasStore.getAllPages().length > 0;
  
  // Must have valid name AND content
  const hasValidName = projectName && 
    projectName !== 'New Chat' && 
    projectName !== 'New Project' && 
    projectName !== 'Untitled Project' &&
    projectName.trim().length > 0;
  
  const hasContent = hasFiles || hasPages;
  
  return hasValidName && hasContent;
}

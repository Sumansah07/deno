/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import { MODEL_REGEX, PROVIDER_REGEX } from '~/utils/constants';
import { Markdown } from './Markdown';
import { useStore } from '@nanostores/react';
import { profileStore } from '~/lib/stores/profile';
import { useState } from 'react';
import WithTooltip from '~/components/ui/Tooltip';
import type {
  TextUIPart,
  ReasoningUIPart,
  ToolInvocationUIPart,
  SourceUIPart,
  FileUIPart,
  StepStartUIPart,
} from '@ai-sdk/ui-utils';

interface UserMessageProps {
  content: string | Array<{ type: string; text?: string; image?: string }>;
  parts:
    | (TextUIPart | ReasoningUIPart | ToolInvocationUIPart | SourceUIPart | FileUIPart | StepStartUIPart)[]
    | undefined;
  onRetry?: (content: string) => void;
  onEdit?: (content: string, messageIndex: number) => void;
  messageIndex?: number;
  isLastMessage?: boolean;
  hasError?: boolean;
}

export function UserMessage({ content, parts, onRetry, onEdit, messageIndex = 0, isLastMessage, hasError }: UserMessageProps) {
  const profile = useStore(profileStore);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isHovered, setIsHovered] = useState(false);

  // Extract images from parts - look for file parts with image mime types
  const images =
    parts?.filter(
      (part): part is FileUIPart => part.type === 'file' && 'mimeType' in part && part.mimeType.startsWith('image/'),
    ) || [];

  const handleRetry = () => {
    const textContent = Array.isArray(content) 
      ? stripMetadata(content.find((item) => item.type === 'text')?.text || '')
      : stripMetadata(content);
    onRetry?.(textContent);
  };

  const handleEdit = () => {
    const textContent = Array.isArray(content)
      ? stripMetadata(content.find((item) => item.type === 'text')?.text || '')
      : stripMetadata(content);
    setEditedContent(textContent);
    setIsEditing(true);
  };

  const handleCopy = async () => {
    const textContent = Array.isArray(content)
      ? stripMetadata(content.find((item) => item.type === 'text')?.text || '')
      : stripMetadata(content);
    await navigator.clipboard.writeText(textContent);
  };

  const handleSaveEdit = () => {
    if (editedContent.trim()) {
      onEdit?.(editedContent, messageIndex);
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent('');
  };

  if (Array.isArray(content)) {
    const textItem = content.find((item) => item.type === 'text');
    const textContent = stripMetadata(textItem?.text || '');

    return (
      <div className="overflow-hidden flex flex-col gap-3 items-center" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
        <div className="flex flex-row items-start justify-between overflow-hidden shrink-0 self-start w-full">
          <div className="flex items-start">
            {profile?.avatar || profile?.username ? (
              <div className="flex items-end gap-2">
                <img
                  src={profile.avatar}
                  alt={profile?.username || 'User'}
                  className="w-[25px] h-[25px] object-cover rounded-full"
                  loading="eager"
                  decoding="sync"
                />
                <span className="text-bolt-elements-textPrimary text-sm">
                  {profile?.username ? profile.username : ''}
                </span>
              </div>
            ) : (
              <div className="i-ph:user-fill text-accent-500 text-2xl" />
            )}
          </div>
          {(isHovered || isLastMessage) && (
            <div className="flex gap-2 ml-auto">
              {hasError && isLastMessage && onRetry && (
                <WithTooltip tooltip="Retry with same prompt">
                  <button
                    onClick={handleRetry}
                    className="i-ph:arrow-clockwise text-lg text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                  />
                </WithTooltip>
              )}
              <WithTooltip tooltip="Copy prompt">
                <button
                  onClick={handleCopy}
                  className="i-ph:copy text-lg text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                />
              </WithTooltip>
              {onEdit && (
                <WithTooltip tooltip="Edit and resend">
                  <button
                    onClick={handleEdit}
                    className="i-ph:pencil-simple text-lg text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                  />
                </WithTooltip>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4 bg-accent-500/10 backdrop-blur-sm p-3 py-3 w-auto rounded-lg mr-auto w-full">
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full min-h-[100px] p-2 rounded bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary border border-bolt-elements-borderColor focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-1 text-sm rounded bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-4"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1 text-sm rounded bg-accent-500 text-white hover:bg-accent-600"
                >
                  Send
                </button>
              </div>
            </div>
          ) : (
            <>
              {textContent && <Markdown html>{textContent}</Markdown>}
              {images.map((item, index) => (
                <img
                  key={index}
                  src={`data:${item.mimeType};base64,${item.data}`}
                  alt={`Image ${index + 1}`}
                  className="max-w-full h-auto rounded-lg"
                  style={{ maxHeight: '512px', objectFit: 'contain' }}
                />
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  const textContent = stripMetadata(content);

  return (
    <div className="flex flex-col w-full" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      {(isHovered || isLastMessage) && (
        <div className="flex gap-2 justify-end mb-2">
          {hasError && isLastMessage && onRetry && (
            <WithTooltip tooltip="Retry with same prompt">
              <button
                onClick={handleRetry}
                className="i-ph:arrow-clockwise text-lg text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
              />
            </WithTooltip>
          )}
          <WithTooltip tooltip="Copy prompt">
            <button
              onClick={handleCopy}
              className="i-ph:copy text-lg text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
            />
          </WithTooltip>
          {onEdit && (
            <WithTooltip tooltip="Edit and resend">
              <button
                onClick={handleEdit}
                className="i-ph:pencil-simple text-lg text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
              />
            </WithTooltip>
          )}
        </div>
      )}
      <div className="flex flex-col bg-accent-500/10 backdrop-blur-sm px-5 p-3.5 w-auto rounded-lg ml-auto">
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full min-h-[100px] p-2 rounded bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary border border-bolt-elements-borderColor focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancelEdit}
                className="px-3 py-1 text-sm rounded bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-4"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-3 py-1 text-sm rounded bg-accent-500 text-white hover:bg-accent-600"
              >
                Send
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-3.5 mb-4">
              {images.map((item, index) => (
                <div className="relative flex rounded-lg border border-bolt-elements-borderColor overflow-hidden">
                  <div className="h-16 w-16 bg-transparent outline-none">
                    <img
                      key={index}
                      src={`data:${item.mimeType};base64,${item.data}`}
                      alt={`Image ${index + 1}`}
                      className="h-full w-full rounded-lg"
                      style={{ objectFit: 'fill' }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Markdown html>{textContent}</Markdown>
          </>
        )}
      </div>
    </div>
  );
}

function stripMetadata(content: string) {
  const artifactRegex = /<boltArtifact\s+[^>]*>[\s\S]*?<\/boltArtifact>/gm;
  const designContextRegex = /<design_context>[\s\S]*?<\/design_context>/gm;
  return content.replace(MODEL_REGEX, '').replace(PROVIDER_REGEX, '').replace(artifactRegex, '').replace(designContextRegex, '').trim();
}

export function NonStreamingLoader() {
  return (
    <div className="flex items-center gap-2 text-bolt-elements-textSecondary">
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-bolt-elements-textSecondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-bolt-elements-textSecondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-bolt-elements-textSecondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-sm">Generating complete response...</span>
    </div>
  );
}

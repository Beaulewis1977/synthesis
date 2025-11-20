import type { ChatMessage as ChatMessageType } from '../types';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`mb-md flex ${isUser ? 'justify-end' : 'justify-start'}`}
      data-role={message.role}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser ? 'bg-accent text-white' : 'bg-bg-secondary text-text-primary border border-border'
        }`}
      >
        {/* Message content */}
        <div className="whitespace-pre-wrap break-words">{message.content}</div>

        {/* Tool calls indicator */}
        {message.tool_calls && message.tool_calls.length > 0 && (
          <div className="mt-3 pt-3 border-t border-blue-400/30">
            <p className="text-xs font-semibold mb-2 opacity-90">Tools Used:</p>
            <div className="flex flex-wrap gap-2">
              {message.tool_calls.map((call) => (
                <span
                  key={call.id}
                  className="inline-flex items-center gap-1 text-xs bg-blue-500/20 px-2 py-1 rounded"
                >
                  <span>🔧</span>
                  <span>{call.tool}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-300">
            <p className="text-xs font-semibold mb-2 text-text-secondary">📚 Sources:</p>
            <ul className="text-xs space-y-1 text-text-secondary">
              {message.citations.map((cite, idx) => (
                <li key={`${cite.title}-${idx}`} className="flex items-start gap-1">
                  <span>•</span>
                  <span>
                    {cite.title}
                    {cite.page && `, p. ${cite.page}`}
                    {cite.section && ` (${cite.section})`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

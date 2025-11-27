"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import { FeedbackButtons } from "@/components/feedback-buttons";

const generateSessionId = () => Math.random().toString(36).substring(2, 15);

interface MessageMetadata {
  runId?: string;
}

export default function Chat() {
  const [input, setInput] = useState("");

  // TCC: Generate sessionId to track this conversation across multiple requests
  const [sessionId] = useState<string>(generateSessionId());

  const { messages, sendMessage } = useChat();

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      <div className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Weather Assistant - Try: &quot;What&apos;s the weather in Tokyo?&quot; or &quot;Pick a random city&quot;
      </div>

      {messages.map((message) => (
        <div key={message.id} className="whitespace-pre-wrap mb-4">
          <div className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
            {message.role === "user" ? "You:" : "Assistant:"}
          </div>
          <div className="text-zinc-900 dark:text-zinc-100">
            {message.parts.map((part, i): React.ReactNode => {
              if (part.type === "text") {
                return <div key={`${message.id}-${i}`}>{part.text}</div>;
              }
              return null;
            })}
          </div>
          {message.role === "assistant" &&
          message.metadata &&
          (message.metadata as MessageMetadata).runId ? (
            <FeedbackButtons
              runId={(message.metadata as MessageMetadata).runId!}
            />
          ) : null}
        </div>
      ))}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) {
            sendMessage(
              { text: input },
              {
                body: {
                  sessionId, // TCC: Pass sessionId to server for telemetry
                },
              }
            );
            setInput("");
          }
        }}
      >
        <input
          className="fixed dark:bg-zinc-900 bottom-0 w-full max-w-md p-2 mb-8 border border-zinc-300 dark:border-zinc-800 rounded shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={input}
          placeholder="Type your message..."
          onChange={(e) => setInput(e.currentTarget.value)}
        />
      </form>
    </div>
  );
}

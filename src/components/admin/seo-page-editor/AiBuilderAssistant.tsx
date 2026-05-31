"use client";

import {
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import type { PageAiProposalInsertResult } from "@/app/admin/pages/actions";
import type { AiPageProposalReview } from "@/lib/services/ai-page-proposals";
import {
  aiBlockReviewBody,
  aiBlockReviewTitle,
  blockLabel,
  completionMessagesForBlock,
} from "@/lib/page-builder/editor-helpers";
import {
  formatPageBuilderAiToolResultSummary,
  pageBuilderAiChatResponseSchema,
  pageBuilderAiContextSchema,
  type PageBuilderAiClarification,
  type PageBuilderAiPendingDelete,
} from "@/lib/page-builder/ai-chat";
import { miniButtonClass } from "@/components/admin/seo-page-editor/editor-styles";
import type { SeoPageEditorController } from "@/components/admin/seo-page-editor/useSeoPageEditorController";

// The generative SEO agent lives in its own floating surface so the right
// sidebar stays purely SEO configuration + publish, and structure mutation
// never originates from the readiness panel. The launcher is offset on desktop
// when the SEO panel is open so it never covers the sticky Publish footer.
export function AiBuilderAssistant({
  editor,
}: {
  editor: SeoPageEditorController;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const canRunAiAgent = Boolean(editor.page?.id);
  const seoPanelOpenOnDesktop =
    !editor.isNarrowEditor && !editor.isSeoSidebarCollapsed;
  const offsetClass = seoPanelOpenOnDesktop ? "xl:right-[28rem]" : "";
  const pendingCount = editor.aiProposals.filter(
    (proposal) => proposal.status === "proposed",
  ).length;
  const storageKey = `page-builder-ai-chat-${editor.effectivePageId ?? "new"}`;
  const [chatState, dispatchChat] = useReducer(
    chatReducer,
    storageKey,
    initialChatState,
  );

  useEffect(() => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(
        chatState.messages.map(({ role, content }) => ({ role, content })),
      ),
    );
  }, [chatState.messages, storageKey]);

  async function sendChatMessage(message: string) {
    const content = message.trim();
    if (!content || chatState.isLoading) return;

    const userMessage: AiChatMessage = {
      id: makeMessageId(),
      role: "user",
      content,
    };
    const nextMessages = [...chatState.messages, userMessage].slice(-12);
    dispatchChat({ type: "submitStart", messages: nextMessages });

    try {
      const response = await fetch("/api/page-builder/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content: text }) => ({
            role,
            content: text,
          })),
          context: buildAiContextSnapshot(editor),
        }),
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload &&
          "message" in payload &&
          typeof (payload as { message?: unknown }).message === "string"
            ? (payload as { message: string }).message
            : "The AI assistant could not respond.";
        throw new Error(message);
      }

      const parsed = pageBuilderAiChatResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("The AI assistant returned an invalid response.");
      }

      const applyResult = editor.applyPageBuilderAiTools(parsed.data.toolCalls);
      const toolSummary = formatPageBuilderAiToolResultSummary(applyResult);
      const assistantContent = [parsed.data.message, toolSummary]
        .filter(Boolean)
        .join("\n\n");

      dispatchChat({
        type: "assistantMessage",
        message: {
          id: makeMessageId(),
          role: "assistant",
          content: assistantContent || "Done.",
          clarification: applyResult.clarification,
          pendingDelete: applyResult.pendingDelete,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The AI assistant could not respond.";
      dispatchChat({
        type: "errorMessage",
        message: {
          id: makeMessageId(),
          role: "assistant",
          content: message,
        },
        error: message,
      });
    }
  }

  return (
    <>
      {isOpen && (
        <section
          aria-label="AI page builder assistant"
          className={`fixed right-4 bottom-24 z-[70] flex max-h-[76vh] w-[min(28rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-2xl ${offsetClass}`}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-violet-100 bg-violet-50 px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-violet-900">
                <SparkIcon />
                AI Page Assistant
              </h2>
              <p className="mt-1 text-xs text-violet-700">
                Draft edits land in this page only after the editor validates
                them.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs font-semibold text-violet-600 transition hover:bg-violet-100 hover:text-violet-900 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                onClick={() => dispatchChat({ type: "clearMessages" })}
              >
                Clear
              </button>
              <button
                type="button"
                aria-label="Close AI assistant"
                className="rounded-lg p-1 text-violet-500 transition hover:bg-violet-100 hover:text-violet-800 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                onClick={() => setIsOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            <AiBlockChecklist
              editor={editor}
              onPrompt={(prompt) => {
                void sendChatMessage(prompt);
              }}
            />

            <ChatMessageList
              messages={chatState.messages}
              isLoading={chatState.isLoading}
              onClarification={(option) => {
                void sendChatMessage(option);
              }}
              onConfirmDelete={(messageId, blockId) => {
                const message = editor.confirmAiDeleteBlock(blockId);
                dispatchChat({
                  type: "resolveDelete",
                  messageId,
                  message: {
                    id: makeMessageId(),
                    role: "assistant",
                    content: message,
                  },
                });
              }}
              onCancelDelete={(messageId) => {
                dispatchChat({
                  type: "resolveDelete",
                  messageId,
                  message: {
                    id: makeMessageId(),
                    role: "assistant",
                    content: "Deletion cancelled.",
                  },
                });
              }}
            />

            {chatState.error && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-red-100">
                {chatState.error}
              </p>
            )}

            <details className="mt-4 rounded-lg border border-violet-100 bg-violet-50/50">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-violet-800">
                Source proposals
                {pendingCount > 0 ? ` · ${pendingCount}` : ""}
              </summary>
              <div className="border-t border-violet-100 p-3">
                <button
                  type="button"
                  className="w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 focus-visible:ring-4 focus-visible:ring-violet-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canRunAiAgent || editor.isAiGenerating}
                  onClick={() => {
                    void editor.runAiSeoAgent();
                  }}
                >
                  {editor.isAiGenerating
                    ? "Running..."
                    : canRunAiAgent
                      ? "Run SEO agent"
                      : "Save the page first"}
                </button>

                {editor.aiProposalResult.status !== "idle" &&
                  editor.aiProposalResult.message && (
                    <p
                      className={`mt-4 rounded-lg px-4 py-3 text-sm font-medium ring-1 ring-inset ${
                        editor.aiProposalResult.status === "error"
                          ? "bg-red-50 text-red-700 ring-red-200"
                          : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      }`}
                    >
                      {editor.aiProposalResult.message}
                    </p>
                  )}

                <AiProposalReviewList
                  proposals={editor.aiProposals}
                  insertResult={editor.aiInsertResult}
                  isInserting={editor.isAiInserting}
                  onInsertBlocks={editor.insertAiProposalBlocks}
                />
              </div>
            </details>
          </div>

          <div className="shrink-0 border-t border-violet-100 bg-white p-3">
            <label className="sr-only" htmlFor="page-ai-chat-input">
              Message AI assistant
            </label>
            <div className="flex items-end gap-2">
              <textarea
                id="page-ai-chat-input"
                value={chatState.input}
                rows={2}
                className="min-h-11 flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-200 focus:outline-none"
                placeholder="Ask for a page edit"
                disabled={chatState.isLoading}
                onChange={(event) =>
                  dispatchChat({ type: "setInput", input: event.target.value })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendChatMessage(chatState.input);
                  }
                }}
              />
              <button
                type="button"
                aria-label="Send message"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm transition hover:bg-violet-700 focus-visible:ring-4 focus-visible:ring-violet-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  chatState.isLoading || chatState.input.trim().length === 0
                }
                onClick={() => {
                  void sendChatMessage(chatState.input);
                }}
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </section>
      )}

      <button
        type="button"
        aria-label={isOpen ? "Close AI assistant" : "Open AI assistant"}
        aria-expanded={isOpen}
        className={`fixed right-4 bottom-6 z-[70] inline-flex items-center gap-2 rounded-full border border-violet-400 bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-violet-700 focus-visible:ring-4 focus-visible:ring-violet-300 focus-visible:outline-none ${offsetClass}`}
        onClick={() => setIsOpen((open) => !open)}
      >
        <SparkIcon />
        <span>AI</span>
        {!isOpen && pendingCount > 0 && (
          <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-violet-700">
            {pendingCount}
          </span>
        )}
      </button>
    </>
  );
}

function SparkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  clarification?: PageBuilderAiClarification | null;
  pendingDelete?: PageBuilderAiPendingDelete | null;
};

type AiChatState = {
  input: string;
  messages: AiChatMessage[];
  isLoading: boolean;
  error: string | null;
};

type AiChatAction =
  | { type: "setInput"; input: string }
  | { type: "submitStart"; messages: AiChatMessage[] }
  | { type: "assistantMessage"; message: AiChatMessage }
  | { type: "errorMessage"; message: AiChatMessage; error: string }
  | { type: "resolveDelete"; messageId: string; message: AiChatMessage }
  | { type: "clearMessages" };

function initialChatState(storageKey: string): AiChatState {
  return {
    input: "",
    messages: loadStoredChatMessages(storageKey),
    isLoading: false,
    error: null,
  };
}

function chatReducer(state: AiChatState, action: AiChatAction): AiChatState {
  if (action.type === "setInput") {
    return { ...state, input: action.input };
  }
  if (action.type === "submitStart") {
    return {
      ...state,
      input: "",
      messages: action.messages,
      error: null,
      isLoading: true,
    };
  }
  if (action.type === "assistantMessage") {
    return {
      ...state,
      messages: [...state.messages, action.message],
      isLoading: false,
    };
  }
  if (action.type === "errorMessage") {
    return {
      ...state,
      messages: [...state.messages, action.message],
      error: action.error,
      isLoading: false,
    };
  }
  if (action.type === "resolveDelete") {
    return {
      ...state,
      messages: [
        ...state.messages.map((message) =>
          message.id === action.messageId
            ? { ...message, pendingDelete: null }
            : message,
        ),
        action.message,
      ],
    };
  }
  return { ...state, messages: [], error: null };
}

function AiBlockChecklist({
  editor,
  onPrompt,
}: {
  editor: SeoPageEditorController;
  onPrompt: (prompt: string) => void;
}) {
  const entries = editor.builderBlockEntries;
  if (entries.length === 0) {
    return (
      <button
        type="button"
        className="w-full rounded-lg border border-dashed border-violet-200 bg-violet-50 px-3 py-4 text-sm font-semibold text-violet-800 transition hover:bg-violet-100 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
        onClick={() =>
          onPrompt(
            "Draft a strong first page structure with a hero, useful sections, FAQ, and CTA.",
          )
        }
      >
        Draft page structure
      </button>
    );
  }

  const readyCount = entries.filter(
    (entry) => completionMessagesForBlock(entry.block).length === 0,
  ).length;

  return (
    <details
      className="rounded-lg border border-violet-100 bg-violet-50/50"
      open
    >
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-violet-800">
        Blocks · {readyCount} of {entries.length} ready
      </summary>
      <div className="grid gap-1 border-t border-violet-100 p-2">
        {entries.slice(0, 8).map((entry) => {
          const issues = completionMessagesForBlock(entry.block);
          return (
            <button
              key={entry.block.id}
              type="button"
              className="flex items-center justify-between gap-3 rounded-md p-2 text-left text-xs transition hover:bg-white focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
              onClick={() =>
                onPrompt(
                  `Please draft or improve the "${blockLabel(entry.block.type)}" block with ID ${entry.block.id}.`,
                )
              }
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-slate-800">
                  {entry.blockNumber}. {blockLabel(entry.block.type)}
                </span>
                {issues[0] && (
                  <span className="block truncate text-slate-500">
                    {issues[0]}
                  </span>
                )}
              </span>
              <span
                className={`size-2.5 shrink-0 rounded-full ${
                  issues.length === 0 ? "bg-emerald-500" : "bg-amber-400"
                }`}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </details>
  );
}

function ChatMessageList({
  messages,
  isLoading,
  onClarification,
  onConfirmDelete,
  onCancelDelete,
}: {
  messages: AiChatMessage[];
  isLoading: boolean;
  onClarification: (option: string) => void;
  onConfirmDelete: (messageId: string, blockId: string) => void;
  onCancelDelete: (messageId: string) => void;
}) {
  if (messages.length === 0 && !isLoading) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-violet-200 bg-violet-50/60 px-4 py-6 text-center text-sm leading-6 text-violet-700">
        No messages yet.
      </p>
    );
  }

  return (
    <div
      className="mt-4 space-y-3"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          onClarification={onClarification}
          onConfirmDelete={onConfirmDelete}
          onCancelDelete={onCancelDelete}
        />
      ))}
      {isLoading && (
        <p className="w-fit rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-500">
          Thinking&hellip;
        </p>
      )}
    </div>
  );
}

function ChatMessage({
  message,
  onClarification,
  onConfirmDelete,
  onCancelDelete,
}: {
  message: AiChatMessage;
  onClarification: (option: string) => void;
  onConfirmDelete: (messageId: string, blockId: string) => void;
  onCancelDelete: (messageId: string) => void;
}) {
  const isUser = message.role === "user";

  return (
    <article className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`min-w-0 rounded-lg px-3 py-2 text-sm leading-5 break-words ${
          isUser ? "max-w-[85%]" : "max-w-[92%]"
        } ${
          isUser ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-800"
        }`}
      >
        <FormattedChatContent content={message.content} isUser={isUser} />

        {message.clarification && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.clarification.options.map((option) => (
              <button
                key={option}
                type="button"
                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200 transition hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                onClick={() => onClarification(option)}
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {message.pendingDelete && (
          <div className="mt-3 rounded-md bg-white p-2 text-xs text-slate-700 ring-1 ring-red-100">
            <p className="font-semibold text-red-700">
              Delete {message.pendingDelete.blockLabel}?
            </p>
            {message.pendingDelete.reason && (
              <p className="mt-1 text-slate-500">
                {message.pendingDelete.reason}
              </p>
            )}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded-md bg-red-600 px-2.5 py-1 font-semibold text-white transition hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:outline-none"
                onClick={() =>
                  onConfirmDelete(message.id, message.pendingDelete!.blockId)
                }
              >
                Delete block
              </button>
              <button
                type="button"
                className="rounded-md bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 transition hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:outline-none"
                onClick={() => onCancelDelete(message.id)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

type FormattedChatBlock =
  | { key: string; type: "heading"; lines: FormattedTextLine[] }
  | { key: string; type: "paragraph"; lines: FormattedTextLine[] }
  | {
      key: string;
      type: "ordered-list" | "unordered-list";
      items: FormattedListItem[];
    };

type FormattedListItem = {
  key: string;
  lines: FormattedTextLine[];
};

type FormattedTextLine = {
  key: string;
  text: string;
};

function FormattedChatContent({
  content,
  isUser,
}: {
  content: string;
  isUser: boolean;
}) {
  const blocks = splitFormattedChatBlocks(content);

  return (
    <div className="space-y-3">
      {blocks.map((block) => {
        if (block.type === "heading") {
          return (
            <p
              key={block.key}
              className={`font-semibold ${isUser ? "text-white" : "text-slate-900"}`}
            >
              <InlineFormattedText
                text={block.lines.map((line) => line.text).join(" ")}
                isUser={isUser}
              />
            </p>
          );
        }

        if (block.type === "paragraph") {
          return (
            <p key={block.key}>
              <InlineFormattedText
                text={block.lines.map((line) => line.text).join(" ")}
                isUser={isUser}
              />
            </p>
          );
        }

        const ListTag = block.type === "ordered-list" ? "ol" : "ul";
        return (
          <ListTag
            key={block.key}
            className={`space-y-2 pl-5 ${
              block.type === "ordered-list" ? "list-decimal" : "list-disc"
            }`}
          >
            {block.items.map((item) => (
              <li key={item.key} className="pl-1">
                <InlineFormattedText
                  text={item.lines[0]?.text ?? ""}
                  isUser={isUser}
                />
                {item.lines.slice(1).map((line) => (
                  <p
                    key={line.key}
                    className={`mt-1 ${
                      isUser ? "text-violet-50" : "text-slate-600"
                    }`}
                  >
                    <InlineFormattedText text={line.text} isUser={isUser} />
                  </p>
                ))}
              </li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}

function InlineFormattedText({
  text,
  isUser,
}: {
  text: string;
  isUser: boolean;
}) {
  const nodes: ReactNode[] = [];
  const tokenPattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={`strong-${match.index}`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <code
          key={`code-${match.index}`}
          className={`rounded px-1 py-0.5 text-[0.92em] break-words ${
            isUser
              ? "bg-white/15 text-white"
              : "bg-white text-slate-800 ring-1 ring-slate-200"
          }`}
        >
          {token.slice(1, -1)}
        </code>,
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return <>{nodes}</>;
}

function splitFormattedChatBlocks(content: string): FormattedChatBlock[] {
  const blocks: FormattedChatBlock[] = [];
  let paragraphLines: FormattedTextLine[] = [];
  let currentList: Extract<
    FormattedChatBlock,
    { type: "ordered-list" | "unordered-list" }
  > | null = null;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const heading = /^#{1,3}\s+(.+)$/.exec(paragraphLines[0]?.text ?? "");
    const lines = heading
      ? [{ ...paragraphLines[0]!, text: heading[1] ?? "" }]
      : paragraphLines;
    blocks.push({
      key: `${heading ? "heading" : "paragraph"}-${paragraphLines[0]?.key ?? "empty"}`,
      type: heading ? "heading" : "paragraph",
      lines,
    });
    paragraphLines = [];
  };

  const flushList = () => {
    if (!currentList) return;
    blocks.push(currentList);
    currentList = null;
  };

  const lines = content.replace(/\r\n/g, "\n").split("\n");
  for (const [sourceIndex, rawLine] of lines.entries()) {
    const sourceLine = sourceIndex + 1;
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }

    const unordered = /^[-*]\s+(.+)$/.exec(line);
    const ordered = /^\d+[.)]\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      const type = ordered ? "ordered-list" : "unordered-list";
      if (!currentList || currentList.type !== type) {
        flushList();
        currentList = { key: `${type}-${sourceLine}`, type, items: [] };
      }
      const itemText = (ordered?.[1] ?? unordered?.[1] ?? "").trim();
      currentList.items.push({
        key: `item-${sourceLine}-${chatTextKey(itemText)}`,
        lines: [formattedLine(itemText, sourceLine)],
      });
      continue;
    }

    if (
      currentList &&
      currentList.items.length > 0 &&
      /^(?:\s{2,}|\t)/.test(rawLine)
    ) {
      currentList.items.at(-1)?.lines.push(formattedLine(line, sourceLine));
      continue;
    }

    flushList();
    paragraphLines.push(formattedLine(line, sourceLine));
  }

  flushParagraph();
  flushList();

  return blocks.length > 0
    ? blocks
    : [
        {
          key: "paragraph-fallback",
          type: "paragraph",
          lines: [formattedLine(content, 1)],
        },
      ];
}

function formattedLine(text: string, sourceLine: number): FormattedTextLine {
  return {
    key: `line-${sourceLine}-${chatTextKey(text)}`,
    text,
  };
}

function chatTextKey(text: string) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function buildAiContextSnapshot(editor: SeoPageEditorController) {
  return pageBuilderAiContextSchema.parse({
    pageId: editor.effectivePageId ?? null,
    status: editor.page?.status ?? "draft",
    title: editor.title,
    slug: editor.visibleSlug,
    targetKeyword: editor.targetKeyword,
    seoTitle: editor.seoTitle,
    metaDescription: editor.metaDescription,
    selectedBlockId: editor.selectedBlockId,
    content: editor.content,
    publishReadiness: {
      blockers: editor.seoReadiness.blockers.map((finding) => finding.message),
      warnings: editor.seoReadiness.warnings.map((finding) => finding.message),
      opportunities: editor.seoReadiness.opportunities.map(
        (finding) => finding.message,
      ),
    },
  });
}

function loadStoredChatMessages(storageKey: string): AiChatMessage[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (
        typeof entry !== "object" ||
        !entry ||
        ((entry as { role?: unknown }).role !== "user" &&
          (entry as { role?: unknown }).role !== "assistant") ||
        typeof (entry as { content?: unknown }).content !== "string"
      ) {
        return [];
      }
      return [
        {
          id: makeMessageId(),
          role: (entry as { role: "user" | "assistant" }).role,
          content: (entry as { content: string }).content,
        },
      ];
    });
  } catch {
    return [];
  }
}

function makeMessageId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

type AiReviewProposedBlock = AiPageProposalReview["proposal"]["blocks"][number];

function AiProposalReviewList({
  proposals,
  insertResult,
  isInserting,
  onInsertBlocks,
}: {
  proposals: AiPageProposalReview[];
  insertResult: PageAiProposalInsertResult;
  isInserting: boolean;
  onInsertBlocks: (proposalId: string, blockIds: string[]) => void;
}) {
  if (proposals.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-violet-200 bg-violet-50/60 px-4 py-6 text-center text-sm leading-6 text-violet-700">
        No proposals yet. Run the SEO agent to generate source-backed draft
        blocks you can review and insert.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {proposals.slice(0, 3).map((proposal) => (
        <AiProposalReviewCard
          key={proposal.id}
          proposal={proposal}
          insertResult={insertResult}
          isInserting={isInserting}
          onInsertBlocks={onInsertBlocks}
        />
      ))}
    </div>
  );
}

function AiProposalReviewCard({
  proposal,
  insertResult,
  isInserting,
  onInsertBlocks,
}: {
  proposal: AiPageProposalReview;
  insertResult: PageAiProposalInsertResult;
  isInserting: boolean;
  onInsertBlocks: (proposalId: string, blockIds: string[]) => void;
}) {
  const defaultSelectedBlockIds = useMemo(
    () =>
      proposal.proposal.blocks.flatMap((entry) =>
        canInsertAiProposedBlock(entry) ? [entry.block.id] : [],
      ),
    [proposal],
  );
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>(
    defaultSelectedBlockIds,
  );
  const proposalResult =
    insertResult.proposalId === proposal.id ? insertResult : null;
  const isProposed = proposal.status === "proposed";
  const selectableCount = defaultSelectedBlockIds.length;
  const sourceRefCount = proposal.proposal.blocks.reduce(
    (count, entry) => count + aiSourceCount(entry),
    0,
  );
  const warningCount =
    proposal.warnings.length +
    proposal.proposal.blocks.reduce(
      (count, entry) => count + entry.warnings.length,
      0,
    );

  return (
    <article className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-violet-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-950">
              AI proposal
            </h4>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {isProposed ? "Ready" : proposal.status}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {isProposed
              ? "Review selected content before inserting it into the page."
              : "Already accepted. Check the editor below for duplicate or outdated sections before publishing."}
          </p>
        </div>
        {isProposed && (
          <button
            type="button"
            className={miniButtonClass}
            disabled={isInserting || selectedBlockIds.length === 0}
            onClick={() => onInsertBlocks(proposal.id, selectedBlockIds)}
          >
            {isInserting ? "Inserting..." : "Insert selected content"}
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-violet-50 p-2">
          <p className="text-lg font-semibold text-slate-950">
            {proposal.proposal.blocks.length}
          </p>
          <p className="text-[11px] font-medium text-slate-500">Items</p>
        </div>
        <div className="rounded-md bg-violet-50 p-2">
          <p className="text-lg font-semibold text-slate-950">
            {sourceRefCount}
          </p>
          <p className="text-[11px] font-medium text-slate-500">Sources</p>
        </div>
        <div className="rounded-md bg-violet-50 p-2">
          <p className="text-lg font-semibold text-slate-950">{warningCount}</p>
          <p className="text-[11px] font-medium text-slate-500">Warnings</p>
        </div>
      </div>

      {proposal.proposal.metadata.seoTitle && (
        <p className="mt-3 rounded-md bg-violet-50 px-3 py-2 text-xs leading-5 text-violet-900">
          SEO title suggestion:{" "}
          <span className="font-semibold text-slate-800">
            {proposal.proposal.metadata.seoTitle}
          </span>
        </p>
      )}

      {proposalResult?.message && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-xs leading-5 ring-1 ${
            proposalResult.status === "error"
              ? "bg-red-50 text-red-700 ring-red-100"
              : "bg-emerald-50 text-emerald-700 ring-emerald-100"
          }`}
        >
          {proposalResult.message}
        </p>
      )}

      <details className="mt-3 rounded-md border border-violet-100 bg-violet-50/40">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700">
          Review content changes · {selectableCount} safe to insert
        </summary>
        <div className="grid gap-2 border-t border-violet-100 p-2">
          {proposal.proposal.blocks.map((entry) => {
            const canInsert = canInsertAiProposedBlock(entry);
            const checked = selectedBlockIds.includes(entry.block.id);
            return (
              <label
                key={entry.block.id}
                className={`flex gap-3 rounded-md border p-3 text-left ${
                  canInsert && isProposed
                    ? "border-slate-200 bg-slate-50"
                    : "border-slate-100 bg-slate-50/60 text-slate-400"
                }`}
              >
                <input
                  aria-label={`Insert ${aiBlockReviewTitle(entry.block)}`}
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  disabled={!canInsert || !isProposed || isInserting}
                  onChange={(event) => {
                    const nextChecked = event.target.checked;
                    setSelectedBlockIds((current) =>
                      nextChecked
                        ? [...new Set([...current, entry.block.id])]
                        : current.filter((id) => id !== entry.block.id),
                    );
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {blockLabel(entry.block.type)}
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                      {aiSourceCount(entry)} source refs
                    </span>
                  </span>
                  <span className="mt-1 block text-sm font-medium text-slate-800">
                    {aiBlockReviewTitle(entry.block)}
                  </span>
                  {aiBlockReviewBody(entry.block) && (
                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-500">
                      {aiBlockReviewBody(entry.block)}
                    </span>
                  )}
                  {entry.warnings.length > 0 && (
                    <span className="mt-2 block text-xs leading-5 text-amber-700">
                      {entry.warnings
                        .map((warning) => warning.message)
                        .join(" ")}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </details>

      {proposal.warnings.length > 0 && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 ring-1 ring-amber-100">
          {proposal.warnings.map((warning) => warning.message).join(" ")}
        </p>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer text-[11px] font-semibold text-slate-400">
          Technical reference
        </summary>
        <p className="mt-1 font-mono text-[11px] break-all text-slate-400">
          {proposal.id}
        </p>
      </details>
    </article>
  );
}

function canInsertAiProposedBlock(entry: AiReviewProposedBlock) {
  return (
    aiSourceCount(entry) > 0 &&
    !entry.warnings.some(
      (warning) =>
        warning.code === "unsupported_claim" || warning.code === "needs_source",
    )
  );
}

function aiSourceCount(entry: AiReviewProposedBlock) {
  return (
    entry.sourceDocumentIds.length +
    entry.sourceExcerptIds.length +
    entry.approvedClaimIds.length
  );
}

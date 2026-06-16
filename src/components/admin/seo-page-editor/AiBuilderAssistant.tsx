"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
import type { PageBlock } from "@/lib/page-builder/blocks";
import type { SeoReadinessFinding } from "@/lib/page-builder/seo-readiness";
import {
  createDocumentImportProposal,
  type DocumentImportProposal,
} from "@/lib/page-builder/document-import";
import {
  findingDotClass,
  labelForReadinessStatus,
  miniButtonClass,
  readinessPillClass,
} from "@/components/admin/seo-page-editor/editor-styles";
import {
  findingSeverityLabel,
  friendlyEvidenceText,
  friendlyFindingLocation,
  requiresSeoSettings,
  suggestedBlockForFinding,
} from "@/components/admin/seo-page-editor/SeoReadinessHelpers";
import type { SeoPageEditorController } from "@/components/admin/seo-page-editor/useSeoPageEditorController";

const AI_CHAT_PANEL_HEIGHT_KEY = "page-builder-ai-chat-panel-height";
const AI_CHAT_PANEL_WIDTH_KEY = "page-builder-ai-chat-panel-width";
const AI_CHAT_PANEL_MIN_HEIGHT = 320;
const AI_CHAT_PANEL_DEFAULT_HEIGHT = 420;
const AI_CHAT_PANEL_MAX_HEIGHT_VH = 76;
const AI_CHAT_PANEL_MIN_WIDTH = 280;
const AI_CHAT_PANEL_DEFAULT_WIDTH = 448;
const AI_CHAT_PANEL_VIEWPORT_MARGIN = 32;

function getAiChatPanelMaxHeight() {
  if (typeof window === "undefined") {
    return AI_CHAT_PANEL_DEFAULT_HEIGHT;
  }
  return (window.innerHeight * AI_CHAT_PANEL_MAX_HEIGHT_VH) / 100;
}

function getAiChatPanelMaxWidth() {
  if (typeof window === "undefined") {
    return AI_CHAT_PANEL_DEFAULT_WIDTH;
  }
  return window.innerWidth - AI_CHAT_PANEL_VIEWPORT_MARGIN;
}

function clampAiChatPanelHeight(height: number) {
  return Math.min(
    getAiChatPanelMaxHeight(),
    Math.max(AI_CHAT_PANEL_MIN_HEIGHT, height),
  );
}

function clampAiChatPanelWidth(width: number) {
  return Math.min(
    getAiChatPanelMaxWidth(),
    Math.max(AI_CHAT_PANEL_MIN_WIDTH, width),
  );
}

function loadStoredAiChatPanelHeight() {
  if (typeof window === "undefined") {
    return AI_CHAT_PANEL_DEFAULT_HEIGHT;
  }
  const stored = window.localStorage.getItem(AI_CHAT_PANEL_HEIGHT_KEY);
  if (!stored) {
    return clampAiChatPanelHeight(AI_CHAT_PANEL_DEFAULT_HEIGHT);
  }
  const parsed = Number(stored);
  if (!Number.isFinite(parsed)) {
    return clampAiChatPanelHeight(AI_CHAT_PANEL_DEFAULT_HEIGHT);
  }
  return clampAiChatPanelHeight(parsed);
}

function loadStoredAiChatPanelWidth() {
  if (typeof window === "undefined") {
    return AI_CHAT_PANEL_DEFAULT_WIDTH;
  }
  const stored = window.localStorage.getItem(AI_CHAT_PANEL_WIDTH_KEY);
  if (!stored) {
    return clampAiChatPanelWidth(AI_CHAT_PANEL_DEFAULT_WIDTH);
  }
  const parsed = Number(stored);
  if (!Number.isFinite(parsed)) {
    return clampAiChatPanelWidth(AI_CHAT_PANEL_DEFAULT_WIDTH);
  }
  return clampAiChatPanelWidth(parsed);
}

// The generative SEO agent lives in its own floating surface so the right
// sidebar stays purely SEO configuration + publish, and structure mutation
// never originates from the readiness panel. The panel stays pinned to the
// viewport edge even when the SEO drawer is open.
export function AiBuilderAssistant({
  editor,
}: {
  editor: SeoPageEditorController;
}) {
  const [isUserOpen, setIsUserOpen] = useState(false);
  const isOpen = isUserOpen;
  const sidePanelOpenOnNarrow =
    editor.isNarrowEditor &&
    (!editor.isBlockSidebarCollapsed || !editor.isSeoSidebarCollapsed);
  const bothEditorSidePanelsOpenOnDesktop =
    !editor.isNarrowEditor &&
    !editor.isBlockSidebarCollapsed &&
    !editor.isSeoSidebarCollapsed;
  const shouldDeferToEditorSidePanel =
    sidePanelOpenOnNarrow || bothEditorSidePanelsOpenOnDesktop;
  const seoReviewFindingCount =
    editor.seoReadiness.blockers.length +
    editor.seoReadiness.warnings.length +
    editor.seoReadiness.opportunities.length;
  const storageKey = editor.effectivePageId
    ? `page-builder-ai-chat-${editor.effectivePageId}`
    : null;
  const [chatState, dispatchChat] = useReducer(
    chatReducer,
    storageKey,
    initialChatState,
  );
  const [documentImportText, setDocumentImportText] = useState("");
  const [documentImportProposal, setDocumentImportProposal] =
    useState<DocumentImportProposal | null>(null);
  const [documentImportMessage, setDocumentImportMessage] = useState<
    string | null
  >(null);
  const [activeAssistantTool, setActiveAssistantTool] = useState<
    "import" | "review" | null
  >(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(loadStoredAiChatPanelHeight);
  const [panelWidth, setPanelWidth] = useState(loadStoredAiChatPanelWidth);
  const panelHeightResizeSessionRef = useRef<{
    startY: number;
    startHeight: number;
  } | null>(null);
  const panelWidthResizeSessionRef = useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    window.localStorage.setItem(AI_CHAT_PANEL_HEIGHT_KEY, String(panelHeight));
  }, [panelHeight]);

  useEffect(() => {
    window.localStorage.setItem(AI_CHAT_PANEL_WIDTH_KEY, String(panelWidth));
  }, [panelWidth]);

  useEffect(() => {
    function handleViewportResize() {
      setPanelHeight((current) => clampAiChatPanelHeight(current));
      setPanelWidth((current) => clampAiChatPanelWidth(current));
    }
    window.addEventListener("resize", handleViewportResize);
    return () => window.removeEventListener("resize", handleViewportResize);
  }, []);

  useEffect(() => {
    dispatchChat({ type: "reset", storageKey });
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(
        chatState.messages.map(({ role, content }) => ({ role, content })),
      ),
    );
  }, [chatState.messages, storageKey]);

  useLayoutEffect(() => {
    if (!isOpen) return;

    const scrollToLatest = () => {
      chatBottomRef.current?.scrollIntoView({ block: "end" });
      const container = chatScrollRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    };

    scrollToLatest();
    const frame = requestAnimationFrame(scrollToLatest);
    return () => cancelAnimationFrame(frame);
  }, [
    activeAssistantTool,
    chatState.error,
    chatState.isLoading,
    chatState.messages,
    isOpen,
  ]);

  if (shouldDeferToEditorSidePanel) return null;

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

  function createLocalDocumentImportProposal() {
    const text = documentImportText.trim();
    if (!text) return;
    const proposal = createDocumentImportProposal({
      text,
      makeProposalId: () => makeLocalImportId("document_import"),
      makeBlockId: () => makeLocalImportId("block_import"),
    });
    setDocumentImportProposal(proposal);
    setDocumentImportMessage(
      proposal.blocks.length > 0
        ? `${proposal.blocks.length} validated block plan${
            proposal.blocks.length === 1 ? "" : "s"
          } ready for review.`
        : "No valid blocks could be mapped from that document.",
    );
  }

  return (
    <>
      {isOpen && (
        <section
          aria-label="AI page builder assistant"
          style={{
            position: "fixed",
            right: "1rem",
            bottom: "6rem",
            height: panelHeight,
            width: panelWidth,
            minHeight: AI_CHAT_PANEL_MIN_HEIGHT,
            maxHeight: `${AI_CHAT_PANEL_MAX_HEIGHT_VH}vh`,
            minWidth: AI_CHAT_PANEL_MIN_WIDTH,
            maxWidth: `calc(100vw - ${AI_CHAT_PANEL_VIEWPORT_MARGIN}px)`,
          }}
          className="z-[70] flex flex-col overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-2xl"
        >
          <AiAssistantPanelEdgeResize
            axis="vertical"
            ariaLabel="Resize assistant panel height"
            className="relative flex h-3 shrink-0 cursor-ns-resize touch-none items-center justify-center border-b border-violet-100 bg-violet-50/80 transition hover:bg-violet-100 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none focus-visible:ring-inset"
            indicatorClassName="h-1 w-10 rounded-full bg-violet-300"
            onResizeStart={(_, clientY) => {
              panelHeightResizeSessionRef.current = {
                startY: clientY,
                startHeight: panelHeight,
              };
            }}
            onResizeMove={(clientX, clientY) => {
              const session = panelHeightResizeSessionRef.current;
              if (!session || clientY === undefined) return;
              const delta = session.startY - clientY;
              setPanelHeight(
                clampAiChatPanelHeight(session.startHeight + delta),
              );
            }}
            onResizeEnd={() => {
              panelHeightResizeSessionRef.current = null;
            }}
          />
          <AiAssistantPanelEdgeResize
            axis="horizontal"
            ariaLabel="Resize assistant panel width"
            className="absolute top-0 bottom-0 left-0 z-10 flex w-3 cursor-ew-resize touch-none items-center justify-center border-r border-violet-100 bg-violet-50/80 transition hover:bg-violet-100 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none focus-visible:ring-inset"
            indicatorClassName="h-10 w-1 rounded-full bg-violet-300"
            onResizeStart={(clientX) => {
              panelWidthResizeSessionRef.current = {
                startX: clientX,
                startWidth: panelWidth,
              };
            }}
            onResizeMove={(clientX) => {
              const session = panelWidthResizeSessionRef.current;
              if (!session || clientX === undefined) return;
              const delta = session.startX - clientX;
              setPanelWidth(clampAiChatPanelWidth(session.startWidth + delta));
            }}
            onResizeEnd={() => {
              panelWidthResizeSessionRef.current = null;
            }}
          />
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
                onClick={() => setIsUserOpen(false)}
              >
                Hide
              </button>
            </div>
          </div>

          <div
            ref={chatScrollRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4"
          >
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
            <div
              ref={chatBottomRef}
              aria-hidden="true"
              className="h-px shrink-0 scroll-mt-4"
            />
          </div>

          <div className="shrink-0 border-t border-violet-100 bg-white p-3">
            {activeAssistantTool === "import" ? (
              <DocumentImportPanel
                embedded
                text={documentImportText}
                message={documentImportMessage}
                proposal={documentImportProposal}
                onTextChange={(value) => {
                  setDocumentImportText(value);
                  setDocumentImportMessage(null);
                }}
                onCreateProposal={createLocalDocumentImportProposal}
                onInsertBlocks={(blocks) => {
                  editor.insertDocumentImportBlocks(blocks);
                  setDocumentImportMessage(
                    `${blocks.length} imported block${
                      blocks.length === 1 ? "" : "s"
                    } inserted into the draft.`,
                  );
                }}
              />
            ) : null}

            {activeAssistantTool === "review" ? (
              <SeoAssistantReviewPanel embedded editor={editor} />
            ) : null}

            <label className="sr-only" htmlFor="page-ai-chat-input">
              Message AI assistant
            </label>
            <textarea
              id="page-ai-chat-input"
              value={chatState.input}
              rows={2}
              className="min-h-11 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-200 focus:outline-none"
              placeholder="Describe what to build or change — e.g. draft a hero, FAQ, and CTA for this page"
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
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <AssistantIconButton
                  label="Import document"
                  pressed={activeAssistantTool === "import"}
                  onClick={() =>
                    setActiveAssistantTool((current) =>
                      current === "import" ? null : "import",
                    )
                  }
                >
                  <UploadIcon />
                </AssistantIconButton>
                <AssistantIconButton
                  label="Review SEO"
                  pressed={activeAssistantTool === "review"}
                  badge={
                    seoReviewFindingCount > 0
                      ? seoReviewFindingCount
                      : undefined
                  }
                  onClick={() =>
                    setActiveAssistantTool((current) =>
                      current === "review" ? null : "review",
                    )
                  }
                >
                  <ReviewIcon />
                </AssistantIconButton>
              </div>
              <AssistantIconButton
                label="Send message"
                primary
                disabled={
                  chatState.isLoading || chatState.input.trim().length === 0
                }
                onClick={() => {
                  void sendChatMessage(chatState.input);
                }}
              >
                <SendIcon />
              </AssistantIconButton>
            </div>
          </div>
        </section>
      )}

      <button
        type="button"
        data-builder-walkthrough="ai"
        aria-label={isOpen ? "Close AI assistant" : "Open AI assistant"}
        aria-expanded={isOpen}
        className="fixed right-4 bottom-6 z-[70] inline-flex items-center gap-2 rounded-full border border-violet-400 bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-violet-700 focus-visible:ring-4 focus-visible:ring-violet-300 focus-visible:outline-none"
        onClick={() => setIsUserOpen((open) => !open)}
      >
        <SparkIcon />
        <span>AI</span>
      </button>
    </>
  );
}

function AiAssistantPanelEdgeResize({
  axis,
  ariaLabel,
  className,
  indicatorClassName,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
}: {
  axis: "vertical" | "horizontal";
  ariaLabel: string;
  className: string;
  indicatorClassName: string;
  onResizeStart: (clientX: number, clientY: number) => void;
  onResizeMove: (
    clientX: number | undefined,
    clientY: number | undefined,
  ) => void;
  onResizeEnd: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={className}
      onPointerDown={(event) => {
        event.preventDefault();
        onResizeStart(event.clientX, event.clientY);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        if (axis === "vertical") {
          onResizeMove(undefined, event.clientY);
          return;
        }
        onResizeMove(event.clientX, undefined);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        onResizeEnd();
      }}
      onPointerCancel={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        onResizeEnd();
      }}
    >
      <span className={indicatorClassName} aria-hidden="true" />
    </button>
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

function ReviewIcon() {
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
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
      <path d="M8 11.5 10 13l4-5" />
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
  | { type: "reset"; storageKey: string | null }
  | { type: "setInput"; input: string }
  | { type: "submitStart"; messages: AiChatMessage[] }
  | { type: "assistantMessage"; message: AiChatMessage }
  | { type: "errorMessage"; message: AiChatMessage; error: string }
  | { type: "resolveDelete"; messageId: string; message: AiChatMessage };

function initialChatState(storageKey: string | null): AiChatState {
  return {
    input: "",
    messages: storageKey ? loadStoredChatMessages(storageKey) : [],
    isLoading: false,
    error: null,
  };
}

function chatReducer(state: AiChatState, action: AiChatAction): AiChatState {
  if (action.type === "reset") {
    return initialChatState(action.storageKey);
  }
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
  return state;
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
    return null;
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
    return null;
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
    pageType: editor.pageType,
    templateKey: editor.templateKey,
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

function makeLocalImportId(prefix: string) {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${suffix}`;
}

function DocumentImportIcon() {
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
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M12 18v-6" />
      <path d="m9 15 3 3 3-3" />
    </svg>
  );
}

function UploadIcon() {
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
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function PasteIcon() {
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
      <path d="M15 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="9" y="2" width="6" height="4" rx="1" />
    </svg>
  );
}

function AssistantIconButton({
  label,
  children,
  pressed = false,
  primary = false,
  disabled = false,
  badge,
  onClick,
}: {
  label: string;
  children: ReactNode;
  pressed?: boolean;
  primary?: boolean;
  disabled?: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      title={label}
      className={`relative inline-flex size-10 items-center justify-center rounded-lg transition focus-visible:ring-4 focus-visible:ring-violet-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
        primary
          ? "bg-violet-600 text-white shadow-sm hover:bg-violet-700"
          : pressed
            ? "bg-violet-100 text-violet-900 ring-1 ring-violet-200"
            : "text-violet-700 hover:bg-violet-50 hover:text-violet-900"
      }`}
      onClick={onClick}
    >
      {children}
      {badge ? (
        <span className="absolute -top-1 -right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

type DocumentImportMode = "upload" | "paste";

const documentImportAccept =
  ".txt,.md,text/plain,text/markdown,application/octet-stream";

export function DocumentImportPanel({
  embedded = false,
  message,
  proposal,
  text,
  onCreateProposal,
  onInsertBlocks,
  onTextChange,
}: {
  embedded?: boolean;
  message: string | null;
  proposal: DocumentImportProposal | null;
  text: string;
  onCreateProposal: () => void;
  onInsertBlocks: (blocks: PageBlock[]) => void;
  onTextChange: (value: string) => void;
}) {
  const [importMode, setImportMode] = useState<DocumentImportMode>("paste");
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileUpload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadFileName(file.name);

    try {
      const importedText = await file.text();
      if (!importedText.trim()) {
        setUploadError("That file is empty. Try another document.");
        onTextChange("");
        return;
      }
      onTextChange(importedText);
    } catch {
      setUploadError("Could not read that file. Try a .txt or .md document.");
      onTextChange("");
    }
  }

  return (
    <section
      aria-labelledby="document-import-title"
      className={`rounded-lg border border-violet-100 bg-violet-50/50 ${
        embedded ? "mb-3 max-h-[min(40vh,20rem)] overflow-y-auto" : "mt-4"
      }`}
    >
      <div
        className={`${embedded ? "px-3 py-2" : "flex items-start gap-3 px-3 py-3"}`}
      >
        {!embedded ? (
          <span
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 ring-1 ring-violet-200"
            aria-hidden="true"
          >
            <DocumentImportIcon />
          </span>
        ) : null}
        <div className="min-w-0">
          <h3
            id="document-import-title"
            className="text-xs font-semibold text-violet-900"
          >
            Import document
          </h3>
          {!embedded ? (
            <p className="mt-1 text-xs leading-5 text-violet-700">
              Turn an outline or brief into draft blocks you can review before
              inserting.
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 border-t border-violet-100 p-3">
        <div
          className="grid grid-cols-2 gap-1 rounded-lg bg-white p-1 ring-1 ring-violet-100"
          role="tablist"
          aria-label="Import method"
        >
          <button
            type="button"
            role="tab"
            aria-selected={importMode === "upload"}
            className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none ${
              importMode === "upload"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-violet-700 hover:bg-violet-50"
            }`}
            onClick={() => setImportMode("upload")}
          >
            <UploadIcon />
            Upload
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={importMode === "paste"}
            className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none ${
              importMode === "paste"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-violet-700 hover:bg-violet-50"
            }`}
            onClick={() => setImportMode("paste")}
          >
            <PasteIcon />
            Paste
          </button>
        </div>

        <p className="rounded-lg bg-white px-3 py-2 text-xs leading-5 text-violet-700 ring-1 ring-violet-100">
          <span className="font-semibold text-violet-900">
            Formatting guidelines:
          </span>{" "}
          one <code># Title</code>, <code>## Section</code> per block (max 8),{" "}
          <code>###</code>/<code>####</code> headings, plain <code>-</code> or{" "}
          <code>1.</code> lists (max 12), and <code>[text](url)</code> links.
          Avoid tables, raw HTML, images, nested lists, and frontmatter.
        </p>

        {importMode === "upload" ? (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-violet-200 bg-white px-4 py-6 text-center transition focus-within:ring-2 focus-within:ring-violet-200 hover:border-violet-300 hover:bg-violet-50/40">
            <span className="flex size-10 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <UploadIcon />
            </span>
            <span className="text-sm font-semibold text-violet-900">
              Upload a document
            </span>
            <span className="text-xs leading-5 text-violet-700">
              .txt or .md files
            </span>
            <input
              type="file"
              accept={documentImportAccept}
              className="sr-only"
              onChange={(event) => {
                void handleFileUpload(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        ) : (
          <label className="block">
            <span className="text-xs font-semibold text-violet-900">
              Paste document text
            </span>
            <textarea
              data-testid="document-import-text"
              value={text}
              rows={5}
              className="mt-2 min-h-28 w-full resize-y rounded-lg border border-violet-100 bg-white px-3 py-2 text-sm leading-6 text-slate-900 shadow-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-200 focus:outline-none"
              placeholder="Paste a brief, outline, or document excerpt"
              onChange={(event) => {
                setUploadFileName(null);
                setUploadError(null);
                onTextChange(event.target.value);
              }}
            />
          </label>
        )}

        {uploadFileName ? (
          <p className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-violet-800 ring-1 ring-violet-100">
            Loaded {uploadFileName}
          </p>
        ) : null}
        {uploadError ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-red-100">
            {uploadError}
          </p>
        ) : null}

        <button
          type="button"
          className="w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 focus-visible:ring-4 focus-visible:ring-violet-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          disabled={text.trim().length === 0}
          onClick={onCreateProposal}
        >
          Create block plan
        </button>
        {message && (
          <p className="rounded-lg bg-white px-3 py-2 text-xs leading-5 text-violet-800 ring-1 ring-violet-100">
            {message}
          </p>
        )}
        {proposal && (
          <DocumentImportReview
            key={proposal.id}
            proposal={proposal}
            onInsertBlocks={onInsertBlocks}
          />
        )}
      </div>
    </section>
  );
}

function SeoAssistantReviewPanel({
  embedded = false,
  editor,
}: {
  embedded?: boolean;
  editor: SeoPageEditorController;
}) {
  const summary = editor.seoReadiness;
  const metrics = [
    {
      label: "Words",
      value: summary.metrics.visibleWordCount.toLocaleString(),
    },
    { label: "Blocks", value: summary.metrics.blockCount.toString() },
    {
      label: "Internal links",
      value: summary.metrics.internalLinkCount.toString(),
    },
    { label: "Images", value: summary.metrics.imageCount.toString() },
    { label: "FAQs", value: summary.metrics.faqItemCount.toString() },
  ];
  const topFindings = [
    ...summary.blockers,
    ...summary.warnings,
    ...summary.opportunities,
  ].slice(0, 5);

  return (
    <section
      aria-labelledby="ai-seo-review-title"
      className={`rounded-lg border border-violet-100 bg-violet-50/50 ${
        embedded ? "mb-3 max-h-[min(40vh,20rem)] overflow-y-auto" : "mt-4"
      }`}
    >
      <div className="space-y-3 p-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3
              id="ai-seo-review-title"
              className="text-xs font-semibold text-violet-900"
            >
              Review SEO
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${readinessPillClass(
                summary.status,
              )}`}
            >
              {labelForReadinessStatus(summary.status)}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-violet-700">
            Checks the current draft against the same readiness rules used
            before publishing.
          </p>
        </div>

        <div className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-violet-100">
          <p className="text-[11px] font-semibold tracking-wider text-violet-500 uppercase">
            Next required step
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-950">
            {editor.nextPublishStep.title}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {editor.nextPublishStep.detail}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg bg-white p-2 text-center shadow-sm ring-1 ring-violet-100"
            >
              <dt className="text-[10px] font-semibold text-slate-500">
                {metric.label}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-950">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-violet-900">
            Top findings
          </h4>
          {topFindings.length > 0 ? (
            topFindings.map((finding, index) => (
              <SeoReviewFindingCard
                key={`${finding.code}-${finding.path}-${index}`}
                finding={finding}
                editor={editor}
              />
            ))
          ) : (
            <p className="rounded-lg bg-emerald-50 px-3 py-3 text-xs leading-5 text-emerald-800 ring-1 ring-emerald-100">
              No readiness findings on this draft. Open the public preview
              before publishing.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function SeoReviewFindingCard({
  finding,
  editor,
}: {
  finding: SeoReadinessFinding;
  editor: SeoPageEditorController;
}) {
  return (
    <article className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-violet-100">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`size-2 rounded-full ${findingDotClass(finding.severity)}`}
          aria-hidden="true"
        />
        <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
          {findingSeverityLabel(finding.severity)}
        </span>
        <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
          {friendlyFindingLocation(finding)}
        </span>
      </div>
      <p className="mt-2 text-sm leading-5 font-semibold text-slate-900">
        {finding.message}
      </p>
      {friendlyEvidenceText(finding) ? (
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {friendlyEvidenceText(finding)}
        </p>
      ) : null}
      <SeoReviewFindingAction finding={finding} editor={editor} />
    </article>
  );
}

function SeoReviewFindingAction({
  finding,
  editor,
}: {
  finding: SeoReadinessFinding;
  editor: SeoPageEditorController;
}) {
  const suggestedBlock = suggestedBlockForFinding(finding);

  if (suggestedBlock) {
    return (
      <button
        type="button"
        className={`${miniButtonClass} mt-3`}
        onClick={() => editor.addSuggestedBlock(suggestedBlock.type)}
      >
        {suggestedBlock.label}
      </button>
    );
  }

  if (requiresSeoSettings(finding)) {
    return (
      <button
        type="button"
        className={`${miniButtonClass} mt-3`}
        onClick={() => editor.focusSeoSetting(finding)}
      >
        Open SEO settings
      </button>
    );
  }

  return null;
}

function DocumentImportReview({
  proposal,
  onInsertBlocks,
}: {
  proposal: DocumentImportProposal;
  onInsertBlocks: (blocks: PageBlock[]) => void;
}) {
  const defaultSelectedBlockIds = useMemo(
    () => proposal.blocks.map((entry) => entry.block.id),
    [proposal],
  );
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>(
    defaultSelectedBlockIds,
  );
  const selectedBlocks = proposal.blocks.filter((entry) =>
    selectedBlockIds.includes(entry.block.id),
  );

  return (
    <section className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-violet-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-950">
            {proposal.sourceTitle}
          </h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Pasted text · {proposal.lineCount} source lines
          </p>
        </div>
        <button
          type="button"
          className={miniButtonClass}
          disabled={selectedBlocks.length === 0}
          onClick={() =>
            onInsertBlocks(selectedBlocks.map((entry) => entry.block))
          }
        >
          Insert selected
        </button>
      </div>
      <p className="mt-3 line-clamp-3 rounded-md bg-violet-50 px-3 py-2 text-xs leading-5 text-violet-900">
        {proposal.sourceExcerpt}
      </p>
      {proposal.warnings.length > 0 && (
        <p
          role="status"
          className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 ring-1 ring-amber-100"
        >
          {proposal.warnings.join(" ")}
        </p>
      )}
      <div className="mt-3 grid gap-2">
        {proposal.blocks.map((entry) => {
          const checked = selectedBlockIds.includes(entry.block.id);
          return (
            <label
              key={entry.block.id}
              className="flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-left"
            >
              <input
                aria-label={`Insert imported ${blockLabel(entry.block.type)}`}
                type="checkbox"
                className="mt-1"
                checked={checked}
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
                    Lines {entry.sourceLines[0]}-{entry.sourceLines[1]}
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
                <span className="mt-2 line-clamp-2 block text-[11px] leading-5 text-violet-700">
                  Source: {entry.sourceExcerpt}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

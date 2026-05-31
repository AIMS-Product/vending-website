"use client";

import {
  CARD_GRID_MAX_CARDS,
  FAQ_MAX_ITEMS,
  cardGridLinkLabel,
  type PageBlock,
} from "@/lib/page-builder/blocks";
import { moveItem } from "@/lib/page-builder/content-ops";
import {
  blockCanvasPlaceholders,
  richTextBodyPlaceholder,
} from "@/lib/page-builder/block-editor-placeholders";
import {
  appendBlankCard,
  appendBlankFaq,
  blockLabel,
  blockSummary,
  blockVariantLabel,
  cardItemKey,
  completionMessagesForBlock,
  editableRichTextBodyText,
  hasEditorText,
  removeCard,
  removeFaqItem,
  richTextBodyFromEditableText,
  syncedTrackingName,
  updateCard,
  updateFaqItem,
  type CardGridBlock,
  type FaqBlock,
} from "@/lib/page-builder/editor-helpers";
import type { MoveDirection } from "@/lib/page-builder/editor-state";
import {
  OptionalBlockField,
  builderOptionalFieldScopeClass,
} from "@/components/admin/seo-page-editor/OptionalBlockField";
import {
  BlockToolbar,
  type BlockToolbarStructure,
} from "@/components/admin/seo-page-editor/BuilderEditorUi";
import {
  HeroInlineContentFields,
  ImageBlockCanvas,
  SplitHeroBlockCanvas,
  VideoBlockCanvas,
} from "@/components/admin/seo-page-editor/MediaBlockCanvasEditors";
import {
  TextAreaInput,
  TextInput,
} from "@/components/admin/seo-page-editor/EditorInputs";
import {
  bodyTextareaClass,
  dangerButtonClass,
  disabledLeadFieldClass,
  eyebrowInputClass,
  miniButtonClass,
  sectionHeadingInputClass,
} from "@/components/admin/seo-page-editor/editor-styles";

function FaqCanvasItemEditorList({
  block,
  onChange,
}: {
  block: FaqBlock;
  onChange: (block: PageBlock) => void;
}) {
  const items =
    block.props.items.length > 0
      ? block.props.items
      : [{ question: "", answer: "" }];

  return (
    <>
      {items.map((item, itemIndex) => (
        <div key={`${block.id}-faq-canvas-${itemIndex}`} className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              FAQ {itemIndex + 1}
            </p>
            {items.length > 1 && (
              <button
                type="button"
                className={dangerButtonClass}
                onClick={() =>
                  onChange({
                    ...block,
                    props: {
                      ...block.props,
                      items: removeFaqItem(block.props.items, itemIndex),
                    },
                  })
                }
              >
                Remove
              </button>
            )}
          </div>
          <TextInput
            label="Question"
            placeholder={blockCanvasPlaceholders.faq.question}
            value={item.question}
            onChange={(value) =>
              onChange({
                ...block,
                props: {
                  ...block.props,
                  items: updateFaqItem(block.props.items, itemIndex, {
                    question: value,
                  }),
                },
              })
            }
          />
          <TextAreaInput
            label="Answer"
            placeholder={blockCanvasPlaceholders.faq.answer}
            value={item.answer}
            onChange={(value) =>
              onChange({
                ...block,
                props: {
                  ...block.props,
                  items: updateFaqItem(block.props.items, itemIndex, {
                    answer: value,
                  }),
                },
              })
            }
          />
        </div>
      ))}
      <div className="p-5">
        <button
          type="button"
          className={miniButtonClass}
          disabled={block.props.items.length >= FAQ_MAX_ITEMS}
          onClick={() =>
            onChange({
              ...block,
              props: {
                ...block.props,
                items:
                  block.props.items.length === 0
                    ? appendBlankFaq([{ question: "", answer: "" }])
                    : appendBlankFaq(block.props.items),
              },
            })
          }
        >
          {block.props.items.length >= FAQ_MAX_ITEMS
            ? `${FAQ_MAX_ITEMS} FAQ limit reached`
            : "Add FAQ"}
        </button>
      </div>
    </>
  );
}

function BlockEditorToolbar({
  block,
  blockIndex,
  blockNumber,
  blockCount,
  toolbarStructure,
  onMove,
  onMoveToIndex,
  onDuplicate,
  onRemove,
  onEditSettings,
}: {
  block: PageBlock;
  blockIndex: number;
  blockNumber: number;
  blockCount: number;
  toolbarStructure?: BlockToolbarStructure;
  onMove: (direction: MoveDirection) => void;
  onMoveToIndex: (targetIndex: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onEditSettings: () => void;
}) {
  const blockCompletionMessages = completionMessagesForBlock(block);
  const completionStatus =
    blockCompletionMessages.length > 0 ? "Needs content" : "Ready";

  return (
    <div className="pointer-events-none absolute inset-x-2 top-2 z-10">
      <BlockToolbar
        label={`Page content ${blockNumber}`}
        typeLabel={blockLabel(block.type)}
        variantLabel={blockVariantLabel(block)}
        description={blockSummary(block)}
        status={completionStatus}
        statusDetail={
          blockCompletionMessages.length > 0
            ? blockCompletionMessages.join(" ")
            : undefined
        }
        icon={block.type}
        blockIndex={blockIndex}
        blockCount={blockCount}
        onMove={onMove}
        onMoveToIndex={onMoveToIndex}
        onDuplicate={onDuplicate}
        onRemove={onRemove}
        onEditSettings={onEditSettings}
        structure={toolbarStructure}
      />
    </div>
  );
}

function RichTextCanvasEditor({
  block,
  onChange,
}: {
  block: Extract<PageBlock, { type: "rich_text" }>;
  onChange: (block: PageBlock) => void;
}) {
  return (
    <div className={`${builderOptionalFieldScopeClass} px-3 py-7 sm:px-4`}>
      <OptionalBlockField
        block={block}
        field="eyebrow"
        onChange={onChange}
        compact
      >
        <label className="block">
          <span className="sr-only">Eyebrow</span>
          <input
            aria-label="Eyebrow"
            value={block.props.eyebrow}
            placeholder={blockCanvasPlaceholders.rich_text.eyebrow}
            onChange={(event) =>
              onChange({
                ...block,
                props: {
                  ...block.props,
                  eyebrow: event.target.value,
                },
              })
            }
            className={eyebrowInputClass}
          />
        </label>
      </OptionalBlockField>
      <OptionalBlockField
        block={block}
        field="heading"
        onChange={onChange}
        compact
      >
        <label className="mt-3 block">
          <span className="sr-only">Heading</span>
          <input
            aria-label="Heading"
            value={block.props.heading}
            placeholder={blockCanvasPlaceholders.rich_text.heading}
            onChange={(event) =>
              onChange({
                ...block,
                props: {
                  ...block.props,
                  heading: event.target.value,
                },
              })
            }
            className={sectionHeadingInputClass}
          />
        </label>
      </OptionalBlockField>
      <label className="mt-4 block">
        <span className="sr-only">Body</span>
        <textarea
          aria-label="Body"
          value={editableRichTextBodyText(block)}
          placeholder={richTextBodyPlaceholder(block.variant)}
          onChange={(event) =>
            onChange({
              ...block,
              props: {
                ...block.props,
                body: richTextBodyFromEditableText(block, event.target.value),
              },
            })
          }
          rows={5}
          className={bodyTextareaClass}
        />
      </label>
    </div>
  );
}

function CtaCanvasEditor({
  block,
  onChange,
}: {
  block: Extract<PageBlock, { type: "cta" }>;
  onChange: (block: PageBlock) => void;
}) {
  return (
    <div className="px-3 py-4 sm:px-4">
      <label className="inline-flex min-h-12 max-w-sm items-center justify-center rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] px-5 py-3 text-sm font-black text-[#111111] uppercase shadow-[5px_5px_0_#111111]">
        <span className="sr-only">CTA label</span>
        <input
          aria-label="CTA label"
          value={block.props.label}
          placeholder={blockCanvasPlaceholders.cta.label}
          onChange={(event) => {
            const nextLabel = event.target.value;
            onChange({
              ...block,
              props: {
                ...block.props,
                label: nextLabel,
                trackingName: syncedTrackingName({
                  currentTrackingName: block.props.trackingName,
                  previousLabel: block.props.label,
                  nextLabel,
                  fallback: "cta",
                }),
              },
            });
          }}
          className="w-full min-w-28 bg-transparent outline-none placeholder:text-[#111111]/55"
        />
      </label>
    </div>
  );
}

function FaqCanvasEditor({
  block,
  onChange,
}: {
  block: Extract<PageBlock, { type: "faq" }>;
  onChange: (block: PageBlock) => void;
}) {
  return (
    <>
      <div className={`${builderOptionalFieldScopeClass} px-3 py-4 sm:px-4`}>
        <OptionalBlockField
          block={block}
          field="heading"
          onChange={onChange}
          compact
        >
          <label className="block">
            <span className="sr-only">Heading</span>
            <input
              aria-label="Heading"
              value={block.props.heading}
              placeholder={blockCanvasPlaceholders.faq.heading}
              onChange={(event) =>
                onChange({
                  ...block,
                  props: {
                    ...block.props,
                    heading: event.target.value,
                  },
                })
              }
              className={sectionHeadingInputClass}
            />
          </label>
        </OptionalBlockField>
      </div>
      <div
        className={`${builderOptionalFieldScopeClass} mt-5 divide-y-2 divide-[#bfeeff] rounded-[10px] border-2 border-[#111111] bg-white px-3 shadow-[7px_7px_0_#55b8e8] sm:px-4`}
      >
        <FaqCanvasItemEditorList block={block} onChange={onChange} />
      </div>
    </>
  );
}

function CardGridCanvasEditor({
  block,
  onChange,
  onEditSettings,
}: {
  block: CardGridBlock;
  onChange: (block: PageBlock) => void;
  onEditSettings: () => void;
}) {
  return (
    <div className="px-3 py-4 sm:px-4">
      <div className={builderOptionalFieldScopeClass}>
        <OptionalBlockField
          block={block}
          field="heading"
          onChange={onChange}
          compact
        >
          <label className="block">
            <span className="sr-only">Heading</span>
            <input
              aria-label="Heading"
              value={block.props.heading}
              placeholder={blockCanvasPlaceholders.card_grid.heading}
              onChange={(event) =>
                onChange({
                  ...block,
                  props: {
                    ...block.props,
                    heading: event.target.value,
                  },
                })
              }
              className={sectionHeadingInputClass}
            />
          </label>
        </OptionalBlockField>
      </div>
      <div className={cardGridCanvasGridClass(block)}>
        {block.props.cards.map((card, cardIndex) => (
          <article
            key={cardItemKey(block.id, cardIndex)}
            className={cardGridCanvasCardClass(block, cardIndex)}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Card {cardIndex + 1}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={miniButtonClass}
                  disabled={cardIndex === 0}
                  onClick={() =>
                    onChange({
                      ...block,
                      props: {
                        ...block.props,
                        cards: moveItem(block.props.cards, cardIndex, "up"),
                      },
                    })
                  }
                >
                  Up
                </button>
                <button
                  type="button"
                  className={miniButtonClass}
                  disabled={cardIndex === block.props.cards.length - 1}
                  onClick={() =>
                    onChange({
                      ...block,
                      props: {
                        ...block.props,
                        cards: moveItem(block.props.cards, cardIndex, "down"),
                      },
                    })
                  }
                >
                  Down
                </button>
                <button
                  type="button"
                  className={dangerButtonClass}
                  onClick={() =>
                    onChange({
                      ...block,
                      props: {
                        ...block.props,
                        cards: removeCard(block.props.cards, cardIndex),
                      },
                    })
                  }
                >
                  Remove
                </button>
              </div>
            </div>
            <TextInput
              label="Card title"
              placeholder={blockCanvasPlaceholders.card_grid.title}
              value={card.title}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: {
                    ...block.props,
                    cards: updateCard(block.props.cards, cardIndex, {
                      title: value,
                    }),
                  },
                })
              }
            />
            <TextAreaInput
              label="Card body"
              placeholder={blockCanvasPlaceholders.card_grid.body}
              value={card.body}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: {
                    ...block.props,
                    cards: updateCard(block.props.cards, cardIndex, {
                      body: value,
                    }),
                  },
                })
              }
            />
            <button
              type="button"
              onClick={onEditSettings}
              aria-label={`Edit optional link for card ${cardIndex + 1}`}
              className={`mt-4 inline-flex items-center gap-2 text-sm font-black uppercase focus-visible:ring-2 focus-visible:ring-[#0b63f6]/30 focus-visible:outline-none ${
                hasEditorText(card.href)
                  ? "text-[#066a99] hover:text-[#111111]"
                  : "text-slate-400 hover:text-[#066a99]"
              }`}
            >
              {cardGridLinkLabel(card)}
              {!hasEditorText(card.href) && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase ring-1 ring-slate-200">
                  Optional
                </span>
              )}
            </button>
          </article>
        ))}
        <button
          type="button"
          className="group flex h-full min-h-[22rem] flex-col items-center justify-center gap-3 rounded-[10px] border-2 border-dashed border-[#55b8e8]/70 bg-white p-5 text-center text-sm font-black text-[#0b63f6] uppercase shadow-[5px_5px_0_rgba(85,184,232,0.25)] transition hover:-translate-y-0.5 hover:border-[#0b63f6] hover:bg-[#f7fbff] hover:text-[#111111] focus-visible:ring-2 focus-visible:ring-[#0b63f6] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:shadow-none disabled:hover:translate-y-0"
          disabled={block.props.cards.length >= CARD_GRID_MAX_CARDS}
          onClick={(event) => {
            event.currentTarget.blur();
            onChange({
              ...block,
              props: {
                ...block.props,
                cards: appendBlankCard(block.props.cards),
              },
            });
          }}
        >
          <span
            className="flex size-12 items-center justify-center rounded-full border-2 border-current bg-white shadow-sm transition group-hover:scale-105"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </span>
          <span>
            {block.props.cards.length >= CARD_GRID_MAX_CARDS
              ? `${CARD_GRID_MAX_CARDS} card limit reached`
              : "Add card"}
          </span>
        </button>
      </div>
    </div>
  );
}

export function BlockEditor({
  block,
  blockIndex,
  blockNumber,
  blockCount,
  toolbarStructure,
  onChange,
  onMove,
  onMoveToIndex,
  onDuplicate,
  onRemove,
  onEditSettings,
}: {
  block: PageBlock;
  blockIndex: number;
  blockNumber: number;
  blockCount: number;
  toolbarStructure?: BlockToolbarStructure;
  onChange: (block: PageBlock) => void;
  onMove: (direction: MoveDirection) => void;
  onMoveToIndex: (targetIndex: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onEditSettings: () => void;
}) {
  const renderInlineContentEditor = true;

  return (
    <article
      id={`builder-block-${blockNumber}`}
      data-builder-block-id={block.id}
      className="group/editor scroll-mt-28 transition-all"
    >
      <div className="relative isolate min-w-0 rounded-[12px] border border-transparent bg-transparent transition-all focus-within:border-[#0b63f6]/50 focus-within:bg-white/80 focus-within:ring-4 focus-within:ring-[#0b63f6]/5 hover:border-slate-300 hover:bg-white/70">
        <BlockEditorToolbar
          block={block}
          blockIndex={blockIndex}
          blockNumber={blockNumber}
          blockCount={blockCount}
          toolbarStructure={toolbarStructure}
          onMove={onMove}
          onMoveToIndex={onMoveToIndex}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
          onEditSettings={onEditSettings}
        />

        {renderInlineContentEditor && (
          <details open className="contents">
            <summary className="hidden text-sm font-semibold text-slate-800">
              Block settings
            </summary>
            <div className="px-3 pt-14 pb-6 sm:px-4">
              {block.type === "rich_text" && (
                <RichTextCanvasEditor block={block} onChange={onChange} />
              )}

              {block.type === "hero" &&
                (block.variant === "split" ? (
                  <SplitHeroBlockCanvas
                    block={block}
                    onChange={onChange}
                    onEditSettings={onEditSettings}
                  />
                ) : (
                  <HeroInlineContentFields block={block} onChange={onChange} />
                ))}

              {block.type === "image" && (
                <ImageBlockCanvas
                  block={block}
                  onChange={onChange}
                  onEditSettings={onEditSettings}
                />
              )}

              {block.type === "cta" && (
                <CtaCanvasEditor block={block} onChange={onChange} />
              )}

              {block.type === "video" && (
                <VideoBlockCanvas
                  block={block}
                  onChange={onChange}
                  onEditSettings={onEditSettings}
                />
              )}

              {block.type === "faq" && (
                <FaqCanvasEditor block={block} onChange={onChange} />
              )}

              {block.type === "card_grid" && (
                <CardGridCanvasEditor
                  block={block}
                  onChange={onChange}
                  onEditSettings={onEditSettings}
                />
              )}

              {block.type === "proof" && (
                <figure className="rounded-[10px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8]">
                  <div className={builderOptionalFieldScopeClass}>
                    <OptionalBlockField
                      block={block}
                      field="eyebrow"
                      onChange={onChange}
                      compact
                    >
                      <TextInput
                        hideLabel
                        label="Eyebrow"
                        placeholder={blockCanvasPlaceholders.proof.eyebrow}
                        value={block.props.eyebrow}
                        onChange={(value) =>
                          onChange({
                            ...block,
                            props: { ...block.props, eyebrow: value },
                          })
                        }
                      />
                    </OptionalBlockField>
                  </div>
                  <label className="mt-3 block">
                    <span className="sr-only">Body</span>
                    <textarea
                      aria-label="Body"
                      value={block.props.body}
                      placeholder={blockCanvasPlaceholders.proof.body}
                      onChange={(event) =>
                        onChange({
                          ...block,
                          props: { ...block.props, body: event.target.value },
                        })
                      }
                      rows={3}
                      className="focus:ring-brand-100 w-full bg-transparent text-xl leading-8 font-semibold text-slate-950 outline-none focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:ring-2"
                    />
                  </label>
                  <div
                    className={`${builderOptionalFieldScopeClass} mt-4 space-y-4`}
                  >
                    <OptionalBlockField
                      block={block}
                      field="name"
                      onChange={onChange}
                      compact
                    >
                      <TextInput
                        hideLabel
                        label="Name"
                        placeholder={blockCanvasPlaceholders.proof.name}
                        value={block.props.name}
                        onChange={(value) =>
                          onChange({
                            ...block,
                            props: { ...block.props, name: value },
                          })
                        }
                      />
                    </OptionalBlockField>
                    <OptionalBlockField
                      block={block}
                      field="context"
                      onChange={onChange}
                      compact
                    >
                      <TextInput
                        hideLabel
                        label="Context"
                        placeholder={blockCanvasPlaceholders.proof.context}
                        value={block.props.context}
                        onChange={(value) =>
                          onChange({
                            ...block,
                            props: { ...block.props, context: value },
                          })
                        }
                      />
                    </OptionalBlockField>
                  </div>
                </figure>
              )}

              {block.type === "lead_form" && (
                <div className="grid gap-6 rounded-[10px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8]">
                  <div className={builderOptionalFieldScopeClass}>
                    <OptionalBlockField
                      block={block}
                      field="heading"
                      onChange={onChange}
                      compact
                    >
                      <label className="block">
                        <span className="sr-only">Heading</span>
                        <input
                          aria-label="Heading"
                          value={block.props.heading}
                          placeholder={
                            blockCanvasPlaceholders.lead_form.heading
                          }
                          onChange={(event) =>
                            onChange({
                              ...block,
                              props: {
                                ...block.props,
                                heading: event.target.value,
                              },
                            })
                          }
                          className={sectionHeadingInputClass}
                        />
                      </label>
                    </OptionalBlockField>
                    <OptionalBlockField
                      block={block}
                      field="body"
                      onChange={onChange}
                      compact
                    >
                      <label className="mt-3 block">
                        <span className="sr-only">Body</span>
                        <textarea
                          aria-label="Body"
                          value={block.props.body}
                          placeholder={blockCanvasPlaceholders.lead_form.body}
                          onChange={(event) =>
                            onChange({
                              ...block,
                              props: {
                                ...block.props,
                                body: event.target.value,
                              },
                            })
                          }
                          rows={3}
                          className={bodyTextareaClass}
                        />
                      </label>
                    </OptionalBlockField>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className={disabledLeadFieldClass}>Full name</div>
                    <div className={disabledLeadFieldClass}>Email</div>
                    <div className={disabledLeadFieldClass}>Phone</div>
                    <div className={disabledLeadFieldClass}>Market</div>
                  </div>
                  <div>
                    <label className="inline-flex max-w-xs rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] px-5 py-3 text-sm font-black text-[#111111] uppercase shadow-[5px_5px_0_#111111]">
                      <span className="sr-only">Submit label</span>
                      <input
                        aria-label="Submit label"
                        value={block.props.submitLabel}
                        placeholder={
                          blockCanvasPlaceholders.lead_form.submitLabel
                        }
                        onChange={(event) => {
                          const nextLabel = event.target.value;
                          onChange({
                            ...block,
                            props: {
                              ...block.props,
                              submitLabel: nextLabel,
                              trackingName: syncedTrackingName({
                                currentTrackingName: block.props.trackingName,
                                previousLabel: block.props.submitLabel,
                                nextLabel,
                                fallback: "lead-form",
                              }),
                            },
                          });
                        }}
                        className="w-full min-w-24 bg-transparent outline-none placeholder:text-[#111111]/55"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </article>
  );
}

function cardGridCanvasGridClass(block: CardGridBlock) {
  if (block.variant === "compact") {
    return "mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4";
  }

  if (block.variant === "feature") {
    return "mt-5 grid gap-4 md:grid-cols-[1.1fr_0.9fr]";
  }

  return "mt-5 grid gap-4 md:grid-cols-3";
}

function cardGridCanvasCardClass(block: CardGridBlock, cardIndex: number) {
  return `rounded-[10px] border-2 border-[#111111] bg-white p-5 shadow-[5px_5px_0_#55b8e8] ${
    block.variant === "feature" && cardIndex === 0
      ? "md:row-span-2 md:min-h-64"
      : ""
  } ${block.variant === "compact" ? "p-4" : ""}`;
}

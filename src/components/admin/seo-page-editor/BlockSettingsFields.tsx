"use client";

import { CARD_GRID_MAX_CARDS, type PageBlock } from "@/lib/page-builder/blocks";
import { moveItem } from "@/lib/page-builder/content-ops";
import { blockCanvasPlaceholders } from "@/lib/page-builder/block-editor-placeholders";
import {
  appendBlankCard,
  cardItemKey,
  removeCard,
  syncedTrackingName,
  updateCard,
} from "@/lib/page-builder/editor-helpers";
import {
  MediaLibrarySelectButton,
  useMediaPicker,
} from "@/components/admin/MediaPickerProvider";
import {
  TextAreaInput,
  TextInput,
} from "@/components/admin/seo-page-editor/EditorInputs";
import { FaqItemEditorList } from "@/components/admin/seo-page-editor/FaqSettingsEditor";
import { OptionalBlockField } from "@/components/admin/seo-page-editor/OptionalBlockField";
import { HERO_BODY_MAX_LENGTH } from "@/components/admin/seo-page-editor/editor-limits";
import {
  applyMediaAssetToImageBlock,
  applyMediaAssetToSplitHeroBlock,
  applyMediaAssetToVideoBlock,
  applyMediaAssetToVideoThumbnailBlock,
  selectedMediaAssetLabel,
} from "@/components/admin/seo-page-editor/editor-media";
import {
  dangerButtonClass,
  miniButtonClass,
  secondaryButtonClass,
} from "@/components/admin/seo-page-editor/editor-styles";
import { RichTextBodyEditor } from "@/components/admin/seo-page-editor/RichTextBodyEditor";

export function BlockSidebarSettingsPanel({
  block,
  onChange,
}: {
  block: PageBlock;
  onChange: (block: PageBlock) => void;
}) {
  const { assets, openMediaPicker } = useMediaPicker();
  return (
    <div className="space-y-4">
      {block.type === "rich_text" && (
        <>
          <OptionalBlockField
            block={block}
            field="eyebrow"
            label="Eyebrow"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Eyebrow"
              value={block.props.eyebrow}
              placeholder={blockCanvasPlaceholders.rich_text.eyebrow}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, eyebrow: value },
                })
              }
            />
          </OptionalBlockField>
          <OptionalBlockField
            block={block}
            field="heading"
            label="Heading"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Heading"
              value={block.props.heading}
              placeholder={blockCanvasPlaceholders.rich_text.heading}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, heading: value },
                })
              }
            />
          </OptionalBlockField>
          <RichTextBodyEditor
            document={block.props.body}
            variant={block.variant}
            onChange={(body) =>
              onChange({
                ...block,
                props: { ...block.props, body },
              })
            }
          />
        </>
      )}

      {block.type === "hero" && (
        <>
          <OptionalBlockField
            block={block}
            field="eyebrow"
            label="Eyebrow"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Eyebrow"
              value={block.props.eyebrow}
              placeholder={blockCanvasPlaceholders.hero.eyebrow}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, eyebrow: value },
                })
              }
            />
          </OptionalBlockField>
          <TextAreaInput
            label="Headline"
            value={block.props.heading}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, heading: value },
              })
            }
          />
          <OptionalBlockField
            block={block}
            field="body"
            label="Body"
            onChange={onChange}
          >
            <TextAreaInput
              hideLabel
              label="Body"
              value={block.props.body}
              maxLength={HERO_BODY_MAX_LENGTH}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, body: value },
                })
              }
            />
          </OptionalBlockField>
          <OptionalBlockField
            block={block}
            field="cta"
            label="CTA"
            onChange={onChange}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label="CTA label"
                value={block.props.ctaLabel}
                onChange={(value) =>
                  onChange({
                    ...block,
                    props: {
                      ...block.props,
                      ctaLabel: value,
                      ctaTrackingName: syncedTrackingName({
                        currentTrackingName: block.props.ctaTrackingName,
                        previousLabel: block.props.ctaLabel,
                        nextLabel: value,
                        fallback: "hero-cta",
                      }),
                    },
                  })
                }
              />
              <TextInput
                label="CTA destination URL"
                value={block.props.ctaHref}
                onChange={(value) =>
                  onChange({
                    ...block,
                    props: { ...block.props, ctaHref: value },
                  })
                }
              />
              <TextInput
                label="Internal CTA label"
                value={block.props.ctaTrackingName}
                onChange={(value) =>
                  onChange({
                    ...block,
                    props: { ...block.props, ctaTrackingName: value },
                  })
                }
              />
            </div>
          </OptionalBlockField>
          {block.variant === "split" && (
            <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-slate-700">
                  Media library asset
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedMediaAssetLabel(
                    assets,
                    block.props.mediaAssetId,
                    block.props.mediaSrc,
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <MediaLibrarySelectButton
                    label="Choose from library"
                    onClick={() =>
                      openMediaPicker({
                        allowedTypes: ["image"],
                        onSelect: (asset) =>
                          onChange(
                            applyMediaAssetToSplitHeroBlock(block, asset),
                          ),
                      })
                    }
                  />
                  {(block.props.mediaAssetId || block.props.mediaSrc) && (
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      onClick={() =>
                        onChange({
                          ...block,
                          props: {
                            ...block.props,
                            mediaAssetId: undefined,
                            mediaSrc: "",
                            mediaAltText: "",
                            mediaCaption: "",
                          },
                        })
                      }
                    >
                      Clear media
                    </button>
                  )}
                </div>
              </div>
              <TextInput
                label="Media path or URL"
                value={block.props.mediaSrc ?? ""}
                onChange={(value) =>
                  onChange({
                    ...block,
                    props: {
                      ...block.props,
                      mediaAssetId: undefined,
                      mediaSrc: value,
                    },
                  })
                }
              />
              <TextInput
                label="Media alt text"
                value={block.props.mediaAltText ?? ""}
                onChange={(value) =>
                  onChange({
                    ...block,
                    props: { ...block.props, mediaAltText: value },
                  })
                }
              />
              <OptionalBlockField
                block={block}
                field="mediaCaption"
                label="Media caption"
                onChange={onChange}
              >
                <TextInput
                  hideLabel
                  label="Media caption"
                  value={block.props.mediaCaption ?? ""}
                  onChange={(value) =>
                    onChange({
                      ...block,
                      props: { ...block.props, mediaCaption: value },
                    })
                  }
                />
              </OptionalBlockField>
              <TextInput
                label="Proof text"
                value={block.props.proofText ?? ""}
                onChange={(value) =>
                  onChange({
                    ...block,
                    props: { ...block.props, proofText: value },
                  })
                }
              />
            </div>
          )}
        </>
      )}

      {block.type === "image" && (
        <>
          <div>
            <p className="text-sm font-medium text-slate-700">
              Media library asset
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {selectedMediaAssetLabel(
                assets,
                block.props.assetId,
                block.props.src,
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MediaLibrarySelectButton
                label="Choose from library"
                onClick={() =>
                  openMediaPicker({
                    allowedTypes: ["image"],
                    onSelect: (asset) =>
                      onChange(applyMediaAssetToImageBlock(block, asset)),
                  })
                }
              />
              {(block.props.assetId || block.props.src) && (
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() =>
                    onChange({
                      ...block,
                      props: {
                        ...block.props,
                        assetId: undefined,
                        src: "",
                        altText: "",
                        caption: "",
                        sourceRightsNotes: "",
                      },
                    })
                  }
                >
                  Clear media
                </button>
              )}
            </div>
          </div>
          <TextInput
            label="Image path or URL"
            value={block.props.src}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, src: value },
              })
            }
          />
          <TextInput
            label="Alt text"
            value={block.props.altText}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, altText: value },
              })
            }
          />
          <OptionalBlockField
            block={block}
            field="caption"
            label="Caption"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Caption"
              value={block.props.caption}
              placeholder={blockCanvasPlaceholders.image.caption}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, caption: value },
                })
              }
            />
          </OptionalBlockField>
          <TextInput
            label="Rights notes"
            value={block.props.sourceRightsNotes}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, sourceRightsNotes: value },
              })
            }
          />
        </>
      )}

      {block.type === "cta" && (
        <>
          <TextInput
            label="Button text"
            value={block.props.label}
            onChange={(value) =>
              onChange({
                ...block,
                props: {
                  ...block.props,
                  label: value,
                  trackingName: syncedTrackingName({
                    currentTrackingName: block.props.trackingName,
                    previousLabel: block.props.label,
                    nextLabel: value,
                    fallback: "cta",
                  }),
                },
              })
            }
          />
          <TextInput
            label="Destination URL"
            value={block.props.href}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, href: value },
              })
            }
          />
          <TextInput
            label="Internal CTA label"
            value={block.props.trackingName}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, trackingName: value },
              })
            }
          />
          <TextInput
            label="Preset ID"
            value={block.props.presetId ?? ""}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, presetId: value || undefined },
              })
            }
          />
        </>
      )}

      {block.type === "video" && (
        <>
          <OptionalBlockField
            block={block}
            field="title"
            label="Title"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Title"
              value={block.props.title}
              placeholder={blockCanvasPlaceholders.video.title}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, title: value },
                })
              }
            />
          </OptionalBlockField>
          <div>
            <p className="text-sm font-medium text-slate-700">Library video</p>
            <p className="mt-1 text-xs text-slate-500">
              {selectedMediaAssetLabel(
                assets,
                block.props.assetId,
                block.props.url,
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MediaLibrarySelectButton
                label="Choose from library"
                onClick={() =>
                  openMediaPicker({
                    allowedTypes: ["video", "embed"],
                    onSelect: (asset) =>
                      onChange(applyMediaAssetToVideoBlock(block, asset)),
                  })
                }
              />
            </div>
          </div>
          <TextInput
            label="URL"
            value={block.props.url}
            onChange={(value) =>
              onChange({
                ...block,
                props: {
                  ...block.props,
                  assetId: undefined,
                  url: value,
                },
              })
            }
          />
          <div>
            <p className="text-sm font-medium text-slate-700">
              Thumbnail override
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {selectedMediaAssetLabel(
                assets,
                block.props.thumbnailAssetId,
                block.props.thumbnailSrc,
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MediaLibrarySelectButton
                label="Choose image"
                onClick={() =>
                  openMediaPicker({
                    allowedTypes: ["image"],
                    onSelect: (asset) =>
                      onChange(
                        applyMediaAssetToVideoThumbnailBlock(block, asset),
                      ),
                  })
                }
              />
              {(block.props.thumbnailAssetId || block.props.thumbnailSrc) && (
                <button
                  type="button"
                  className={miniButtonClass}
                  onClick={() =>
                    onChange({
                      ...block,
                      props: {
                        ...block.props,
                        thumbnailAssetId: undefined,
                        thumbnailSrc: "",
                        thumbnailAltText: "",
                      },
                    })
                  }
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <TextInput
            label="Thumbnail URL"
            value={block.props.thumbnailSrc ?? ""}
            onChange={(value) =>
              onChange({
                ...block,
                props: {
                  ...block.props,
                  thumbnailAssetId: undefined,
                  thumbnailSrc: value,
                },
              })
            }
          />
          <OptionalBlockField
            block={block}
            field="caption"
            label="Caption"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Caption"
              value={block.props.caption}
              placeholder={blockCanvasPlaceholders.video.caption}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, caption: value },
                })
              }
            />
          </OptionalBlockField>
        </>
      )}

      {block.type === "faq" && (
        <>
          <OptionalBlockField
            block={block}
            field="heading"
            label="Heading"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Heading"
              value={block.props.heading}
              placeholder={blockCanvasPlaceholders.faq.heading}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, heading: value },
                })
              }
            />
          </OptionalBlockField>
          <FaqItemEditorList key={block.id} block={block} onChange={onChange} />
        </>
      )}

      {block.type === "card_grid" && (
        <>
          <OptionalBlockField
            block={block}
            field="heading"
            label="Heading"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Heading"
              value={block.props.heading}
              placeholder={blockCanvasPlaceholders.card_grid.heading}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, heading: value },
                })
              }
            />
          </OptionalBlockField>
          <div className="space-y-3">
            {block.props.cards.map((card, cardIndex) => (
              <div
                key={cardItemKey(block.id, cardIndex)}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
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
                            cards: moveItem(
                              block.props.cards,
                              cardIndex,
                              "down",
                            ),
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
                <TextInput
                  label="Card link (optional)"
                  placeholder="Optional destination URL"
                  value={card.href ?? ""}
                  onChange={(value) =>
                    onChange({
                      ...block,
                      props: {
                        ...block.props,
                        cards: updateCard(block.props.cards, cardIndex, {
                          href: value,
                        }),
                      },
                    })
                  }
                />
                <TextInput
                  label="Card link label (optional)"
                  placeholder="Defaults to the card title"
                  value={card.linkLabel ?? ""}
                  onChange={(value) =>
                    onChange({
                      ...block,
                      props: {
                        ...block.props,
                        cards: updateCard(block.props.cards, cardIndex, {
                          linkLabel: value,
                        }),
                      },
                    })
                  }
                />
              </div>
            ))}
            <button
              type="button"
              className={miniButtonClass}
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
              {block.props.cards.length >= CARD_GRID_MAX_CARDS
                ? `${CARD_GRID_MAX_CARDS} card limit reached`
                : "Add card"}
            </button>
          </div>
        </>
      )}

      {block.type === "proof" && (
        <>
          <OptionalBlockField
            block={block}
            field="eyebrow"
            label="Eyebrow"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Eyebrow"
              value={block.props.eyebrow}
              placeholder={blockCanvasPlaceholders.proof.eyebrow}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, eyebrow: value },
                })
              }
            />
          </OptionalBlockField>
          <TextAreaInput
            label="Quote or stat"
            value={block.props.body}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, body: value },
              })
            }
          />
          <OptionalBlockField
            block={block}
            field="name"
            label="Name"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Name"
              value={block.props.name}
              placeholder={blockCanvasPlaceholders.proof.name}
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
            label="Context"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Context"
              value={block.props.context}
              placeholder={blockCanvasPlaceholders.proof.context}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, context: value },
                })
              }
            />
          </OptionalBlockField>
          <TextInput
            label="Proof item ID"
            value={block.props.proofItemId ?? ""}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, proofItemId: value || undefined },
              })
            }
          />
        </>
      )}

      {block.type === "lead_form" && (
        <>
          <OptionalBlockField
            block={block}
            field="heading"
            label="Heading"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Heading"
              value={block.props.heading}
              placeholder={blockCanvasPlaceholders.lead_form.heading}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, heading: value },
                })
              }
            />
          </OptionalBlockField>
          <OptionalBlockField
            block={block}
            field="body"
            label="Helper copy"
            onChange={onChange}
          >
            <TextAreaInput
              hideLabel
              label="Helper copy"
              value={block.props.body}
              placeholder={blockCanvasPlaceholders.lead_form.body}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, body: value },
                })
              }
            />
          </OptionalBlockField>
          <TextInput
            label="Submit label"
            value={block.props.submitLabel}
            onChange={(value) =>
              onChange({
                ...block,
                props: {
                  ...block.props,
                  submitLabel: value,
                  trackingName: syncedTrackingName({
                    currentTrackingName: block.props.trackingName,
                    previousLabel: block.props.submitLabel,
                    nextLabel: value,
                    fallback: "lead-form",
                  }),
                },
              })
            }
          />
          <TextInput
            label="Internal form label"
            value={block.props.trackingName}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, trackingName: value },
              })
            }
          />
        </>
      )}
    </div>
  );
}

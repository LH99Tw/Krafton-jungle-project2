import { Node, mergeAttributes, type JSONContent } from "@tiptap/core";
import CharacterCount from "@tiptap/extension-character-count";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextSelection } from "@tiptap/pm/state";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
  Ungroup,
  X,
} from "lucide-react";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export type RichDocument = JSONContent;
export type UploadedPostImage = {
  id: string;
  url: string;
  width: number;
  height: number;
};

const RichImage = Node.create({
  name: "richImage",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      imageId: { default: "" },
      src: { default: "" },
      alt: { default: "" },
      caption: { default: "" },
      width: { default: 100 },
      align: { default: "center" },
    };
  },
  parseHTML() {
    return [{ tag: "figure[data-rich-image]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const { src, alt, caption, width, align, imageId } = HTMLAttributes;
    return [
      "figure",
      mergeAttributes({
        "data-rich-image": "",
        "data-image-id": imageId,
        "data-align": align,
        style: `--image-width:${width}%`,
      }),
      ["img", { src, alt, draggable: false }],
      caption ? ["figcaption", {}, caption] : "",
    ];
  },
});

const ImageGroup = Node.create({
  name: "imageGroup",
  group: "block",
  content: "richImage{2,3}",
  defining: true,
  draggable: true,
  addAttributes() {
    return { caption: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "figure[data-image-group]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "figure",
      mergeAttributes(HTMLAttributes, { "data-image-group": "" }),
      ["div", { "data-image-group-grid": "" }, 0],
      HTMLAttributes.caption ? ["figcaption", {}, HTMLAttributes.caption] : "",
    ];
  },
});

const extensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  Link.configure({
    openOnClick: false,
    autolink: true,
    HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
  }),
  Placeholder.configure({
    placeholder:
      "여기에 이야기를 적어보세요. 이미지를 끌어다 놓을 수도 있어요.",
  }),
  CharacterCount.configure({ limit: 20000 }),
  RichImage,
  ImageGroup,
];

const legacyDocument = (text: string): JSONContent => ({
  type: "doc",
  content: text
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((paragraph) => ({
      type: "paragraph",
      content: paragraph ? [{ type: "text", text: paragraph }] : undefined,
    })),
});
const imageCount = (document: JSONContent) => {
  let count = 0;
  const visit = (node: JSONContent) => {
    if (node.type === "richImage") count += 1;
    node.content?.forEach(visit);
  };
  visit(document);
  return count;
};

const optimizeImage = async (file: File) => {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("JPEG, PNG, WebP 이미지만 사용할 수 있습니다.");
  if (file.size > 2 * 1024 * 1024)
    throw new Error("원본 이미지는 장당 2MB 이하여야 합니다.");
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const ratio = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이미지를 변환할 수 없습니다.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const toBlob = (quality: number) =>
    new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
  let blob: Blob | null = null;
  for (const quality of [0.82, 0.74, 0.66, 0.58]) {
    blob = await toBlob(quality);
    if (blob && blob.size <= 2 * 1024 * 1024) break;
  }
  if (!blob) throw new Error("이미지를 압축할 수 없습니다.");
  return {
    file: new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, {
      type: "image/webp",
    }),
    width,
    height,
  };
};

type Props = {
  value?: RichDocument | null;
  legacyText?: string;
  draftKey: string;
  onChange: (document: RichDocument, text: string) => void;
  onUpload: (
    file: File,
    width: number,
    height: number,
  ) => Promise<UploadedPostImage>;
  onDelete: (id: string) => Promise<void>;
  onUploading: (value: boolean) => void;
};

export function RichTextEditor({
  value,
  legacyText = "",
  onChange,
  onUpload,
  onDelete,
  onUploading,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [uploadCount, setUploadCount] = useState(0);
  const editor = useEditor({
    extensions,
    content: value ?? legacyDocument(legacyText),
    editorProps: {
      attributes: { class: "rich-editor-content", "aria-label": "게시글 본문" },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (!files.length) return false;
        event.preventDefault();
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (position) view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(position.pos))));
        void addFiles(files);
        return true;
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (!files.length) return false;
        event.preventDefault();
        void addFiles(files);
        return true;
      },
    },
    onCreate: ({ editor: next }) =>
      onChange(next.getJSON(), next.getText({ blockSeparator: "\n\n" })),
    onUpdate: ({ editor: next }) =>
      onChange(next.getJSON(), next.getText({ blockSeparator: "\n\n" })),
  });

  useEffect(() => {
    if (
      editor &&
      value &&
      JSON.stringify(editor.getJSON()) !== JSON.stringify(value)
    ) {
      editor.commands.setContent(value, false);
      onChange(editor.getJSON(), editor.getText({ blockSeparator: "\n\n" }));
    }
  }, [editor, value]);
  if (!editor) return null;

  async function addFiles(files: File[]) {
    setError("");
    const remaining = 5 - imageCount(editor!.getJSON()) - uploadCount;
    if (remaining <= 0)
      return setError("글에는 이미지를 최대 5장까지 넣을 수 있습니다.");
    const selected = files.slice(0, remaining);
    setUploadCount((count) => count + selected.length);
    onUploading(true);
    try {
      for (const source of selected) {
        const optimized = await optimizeImage(source);
        const image = await onUpload(
          optimized.file,
          optimized.width,
          optimized.height,
        );
        editor!
          .chain()
          .focus()
          .insertContent({
            type: "richImage",
            attrs: {
              imageId: image.id,
              src: image.url,
              alt: source.name.replace(/\.[^.]+$/, ""),
              caption: "",
              width: 100,
              align: "center",
            },
          })
          .run();
      }
      if (files.length > selected.length)
        setError("이미지는 글당 최대 5장까지만 추가했습니다.");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setUploadCount((count) => Math.max(0, count - selected.length));
      onUploading(false);
    }
  }

  const selectedImage = editor.isActive("richImage");
  const selectedAttrs = selectedImage
    ? editor.getAttributes("richImage")
    : null;
  const selectedGroup = (() => {
    if (!selectedImage) return null;
    const resolved = editor.state.doc.resolve(editor.state.selection.from);
    for (let depth = resolved.depth; depth > 0; depth -= 1) {
      if (resolved.node(depth).type.name === "imageGroup")
        return { depth, attrs: resolved.node(depth).attrs };
    }
    return null;
  })();
  const setImage = (attrs: Record<string, unknown>) =>
    editor.chain().focus().updateAttributes("richImage", attrs).run();
  const removeImage = async () => {
    const id = String(selectedAttrs?.imageId ?? "");
    editor.chain().focus().deleteSelection().run();
    if (id) await onDelete(id).catch(() => undefined);
  };
  const groupFollowing = () => {
    const { state } = editor;
    const pos = state.selection.from;
    const current = state.doc.nodeAt(pos);
    if (current?.type.name !== "richImage") return;
    const nodes = [current];
    let end = pos + current.nodeSize;
    while (nodes.length < 3) {
      const next = state.doc.nodeAt(end);
      if (next?.type.name !== "richImage") break;
      nodes.push(next);
      end += next.nodeSize;
    }
    if (nodes.length < 2)
      return setError("바로 다음에 있는 이미지를 먼저 추가해 주세요.");
    const group = state.schema.nodes.imageGroup.create({ caption: "" }, nodes);
    editor.view.dispatch(
      state.tr.replaceWith(pos, end, group).scrollIntoView(),
    );
  };
  const ungroup = () => {
    const { state } = editor;
    const resolved = state.doc.resolve(state.selection.from);
    let depth = resolved.depth;
    while (depth > 0 && resolved.node(depth).type.name !== "imageGroup")
      depth -= 1;
    if (!depth) return;
    const group = resolved.node(depth);
    const start = resolved.before(depth);
    editor.view.dispatch(
      state.tr
        .replaceWith(start, start + group.nodeSize, group.content)
        .scrollIntoView(),
    );
  };
  const setCaption = () => {
    const previous = String(
      selectedGroup?.attrs.caption ?? selectedAttrs?.caption ?? "",
    );
    const caption = window.prompt(
      selectedGroup ? "이미지 묶음 캡션" : "이미지 캡션",
      previous,
    );
    if (caption === null) return;
    if (!selectedGroup) return setImage({ caption });
    const { state } = editor;
    const resolved = state.doc.resolve(state.selection.from);
    editor.view.dispatch(
      state.tr.setNodeMarkup(resolved.before(selectedGroup.depth), undefined, {
        ...selectedGroup.attrs,
        caption,
      }),
    );
  };
  const editLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt(
      "연결할 URL을 입력하세요.",
      previous ?? "https://",
    );
    if (href === null) return;
    if (!href.trim())
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: href.trim() })
        .run();
  };

  const Tool = ({
    label,
    active = false,
    disabled = false,
    onClick,
    children,
  }: {
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
  }) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={active ? "active" : ""}
      onClick={onClick}
    >
      {children}
    </button>
  );
  return (
    <section className="rich-editor-shell">
      <div
        className="rich-editor-toolbar"
        role="toolbar"
        aria-label="글 편집 도구"
      >
        <select
          aria-label="문단 스타일"
          value={
            editor.isActive("heading", { level: 1 })
              ? "h1"
              : editor.isActive("heading", { level: 2 })
                ? "h2"
                : editor.isActive("heading", { level: 3 })
                  ? "h3"
                  : "p"
          }
          onChange={(event) => {
            const value = event.target.value;
            if (value === "p") editor.chain().focus().setParagraph().run();
            else
              editor
                .chain()
                .focus()
                .toggleHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 })
                .run();
          }}
        >
          <option value="p">본문</option>
          <option value="h1">제목 1</option>
          <option value="h2">제목 2</option>
          <option value="h3">제목 3</option>
        </select>
        <span className="tool-separator" />
        <Tool
          label="제목 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          <Heading1 />
        </Tool>
        <Tool
          label="제목 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 />
        </Tool>
        <Tool
          label="제목 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <Heading3 />
        </Tool>
        <span className="tool-separator" />
        <Tool
          label="굵게 (Ctrl+B)"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold />
        </Tool>
        <Tool
          label="기울임 (Ctrl+I)"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </Tool>
        <Tool
          label="취소선"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough />
        </Tool>
        <Tool
          label="인라인 코드"
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code />
        </Tool>
        <Tool label="링크" active={editor.isActive("link")} onClick={editLink}>
          <Link2 />
        </Tool>
        <span className="tool-separator" />
        <Tool
          label="글머리 목록"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List />
        </Tool>
        <Tool
          label="번호 목록"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </Tool>
        <Tool
          label="인용"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote />
        </Tool>
        <Tool
          label="코드 블록"
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code />
        </Tool>
        <Tool
          label="구분선"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus />
        </Tool>
        <span className="tool-separator" />
        <Tool label="이미지 추가" onClick={() => inputRef.current?.click()}>
          <ImagePlus />
        </Tool>
        <Tool
          label="실행 취소"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 />
        </Tool>
        <Tool
          label="다시 실행"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 />
        </Tool>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(event) => {
            void addFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </div>
      {selectedImage && (
        <div
          className="image-context-toolbar"
          role="toolbar"
          aria-label="선택한 이미지 편집"
        >
          <Tool
            label="왼쪽 정렬"
            active={selectedAttrs?.align === "left"}
            onClick={() => setImage({ align: "left" })}
          >
            <AlignLeft />
          </Tool>
          <Tool
            label="가운데 정렬"
            active={selectedAttrs?.align === "center"}
            onClick={() => setImage({ align: "center" })}
          >
            <AlignCenter />
          </Tool>
          <Tool
            label="오른쪽 정렬"
            active={selectedAttrs?.align === "right"}
            onClick={() => setImage({ align: "right" })}
          >
            <AlignRight />
          </Tool>
          <label>
            크기{" "}
            <input
              type="range"
              min="25"
              max="100"
              step="5"
              value={Number(selectedAttrs?.width ?? 100)}
              onChange={(event) =>
                setImage({ width: Number(event.target.value) })
              }
            />
            <span>{selectedAttrs?.width}%</span>
          </label>
          <button
            type="button"
            onClick={() => {
              const alt = window.prompt(
                "이미지를 설명하는 대체 텍스트",
                String(selectedAttrs?.alt ?? ""),
              );
              if (alt !== null) setImage({ alt });
            }}
          >
            대체 텍스트
          </button>
          <button
            type="button"
            onClick={setCaption}
          >
            {selectedGroup ? "묶음 캡션" : "캡션"}
          </button>
          <button type="button" onClick={groupFollowing}>
            <Ungroup /> 옆에 배치
          </button>
          <button type="button" onClick={ungroup}>
            그룹 해제
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => void removeImage()}
          >
            <X /> 삭제
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
      <div className="rich-editor-foot">
        <span>이미지는 JPEG·PNG·WebP, 장당 2MB · 최대 5장</span>
        <span>
          {editor.storage.characterCount.characters().toLocaleString()}/20,000
        </span>
      </div>
      {error && (
        <p className="rich-editor-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

const marks = (node: JSONContent, content: ReactNode) =>
  (node.marks ?? []).reduce<ReactNode>((result, mark, index) => {
    if (mark.type === "bold") return <strong key={index}>{result}</strong>;
    if (mark.type === "italic") return <em key={index}>{result}</em>;
    if (mark.type === "strike") return <s key={index}>{result}</s>;
    if (mark.type === "code") return <code key={index}>{result}</code>;
    if (
      mark.type === "link" &&
      typeof mark.attrs?.href === "string" &&
      /^(https?:\/\/|mailto:)/i.test(mark.attrs.href)
    )
      return (
        <a
          key={index}
          href={mark.attrs.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          {result}
        </a>
      );
    return result;
  }, content);

const renderNode = (node: JSONContent, key: number | string): ReactNode => {
  const children = node.content?.map((child, index) =>
    renderNode(child, index),
  );
  if (node.type === "text")
    return <Fragment key={key}>{marks(node, node.text)}</Fragment>;
  if (node.type === "paragraph") return <p key={key}>{children}</p>;
  if (node.type === "heading") {
    const Tag =
      `h${[1, 2, 3].includes(Number(node.attrs?.level)) ? node.attrs?.level : 2}` as "h1";
    return <Tag key={key}>{children}</Tag>;
  }
  if (node.type === "bulletList") return <ul key={key}>{children}</ul>;
  if (node.type === "orderedList") return <ol key={key}>{children}</ol>;
  if (node.type === "listItem") return <li key={key}>{children}</li>;
  if (node.type === "blockquote")
    return <blockquote key={key}>{children}</blockquote>;
  if (node.type === "codeBlock")
    return (
      <pre key={key}>
        <code>{children}</code>
      </pre>
    );
  if (node.type === "horizontalRule") return <hr key={key} />;
  if (node.type === "hardBreak") return <br key={key} />;
  if (node.type === "richImage" && typeof node.attrs?.src === "string")
    return (
      <figure
        key={key}
        className="post-rich-image"
        data-align={node.attrs?.align ?? "center"}
        style={
          {
            "--image-width": `${Math.min(100, Math.max(25, Number(node.attrs?.width) || 100))}%`,
          } as CSSProperties
        }
      >
        <img src={node.attrs.src} alt={String(node.attrs?.alt ?? "")} />
        {node.attrs?.caption && (
          <figcaption>{String(node.attrs.caption)}</figcaption>
        )}
      </figure>
    );
  if (node.type === "imageGroup")
    return (
      <figure key={key} className="post-image-group">
        <div>{children}</div>
        {node.attrs?.caption && (
          <figcaption>{String(node.attrs.caption)}</figcaption>
        )}
      </figure>
    );
  return <Fragment key={key}>{children}</Fragment>;
};

export function RichContent({
  document,
  fallback,
}: {
  document?: RichDocument | null;
  fallback?: string;
}) {
  if (!document?.content) return <>{fallback}</>;
  return <>{document.content.map((node, index) => renderNode(node, index))}</>;
}

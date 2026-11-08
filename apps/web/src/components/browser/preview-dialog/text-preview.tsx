import { Alert, AlertDescription } from "@fileee/ui/components/alert";
import { Spinner } from "@fileee/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { TEXT_LIMIT, decodeText } from "../../../lib/text.ts";
import { Centered } from "./centered.tsx";

const TOKENS =
  "[&_.hljs-comment]:text-muted-foreground [&_.hljs-comment]:italic " +
  "[&_.hljs-keyword]:text-violet-700 dark:[&_.hljs-keyword]:text-violet-300 " +
  "[&_.hljs-built_in]:text-violet-700 dark:[&_.hljs-built_in]:text-violet-300 " +
  "[&_.hljs-type]:text-violet-700 dark:[&_.hljs-type]:text-violet-300 " +
  "[&_.hljs-literal]:text-amber-700 dark:[&_.hljs-literal]:text-amber-300 " +
  "[&_.hljs-number]:text-amber-700 dark:[&_.hljs-number]:text-amber-300 " +
  "[&_.hljs-string]:text-emerald-700 dark:[&_.hljs-string]:text-emerald-300 " +
  "[&_.hljs-regexp]:text-emerald-700 dark:[&_.hljs-regexp]:text-emerald-300 " +
  "[&_.hljs-attr]:text-sky-700 dark:[&_.hljs-attr]:text-sky-300 " +
  "[&_.hljs-attribute]:text-sky-700 dark:[&_.hljs-attribute]:text-sky-300 " +
  "[&_.hljs-title]:text-blue-700 dark:[&_.hljs-title]:text-blue-300 " +
  "[&_.hljs-section]:text-blue-700 dark:[&_.hljs-section]:text-blue-300 " +
  "[&_.hljs-name]:text-rose-700 dark:[&_.hljs-name]:text-rose-300 " +
  "[&_.hljs-tag]:text-rose-700 dark:[&_.hljs-tag]:text-rose-300";

interface HastNode {
  type: string;
  value?: string;
  properties?: { className?: string[] };
  children?: HastNode[];
}

/** React elements, never innerHTML: an uploaded file's text can only ever become text nodes. */
const renderNode = (node: HastNode, key: number): ReactNode =>
  node.type === "text" ? (
    node.value
  ) : (
    <span key={key} className={node.properties?.className?.join(" ")}>
      {node.children?.map(renderNode)}
    </span>
  );

async function loadText(url: string, name: string) {
  const res = await fetch(url, { headers: { Range: `bytes=0-${TEXT_LIMIT - 1}` } });

  if (!res.ok) throw new Error(`The bucket answered HTTP ${res.status}.`);

  const decoded = decodeText(new Uint8Array(await res.arrayBuffer()));

  if (!decoded) throw new Error("This doesn't look like text.");

  const { common, createLowlight } = await import("lowlight");
  const lowlight = createLowlight(common);
  const language = name.toLowerCase().split(".").at(-1)!;

  return {
    text: decoded.text,
    nodes: lowlight.registered(language)
      ? (lowlight.highlight(language, decoded.text).children as HastNode[])
      : null,
  };
}

export function TextPreview({
  url,
  name,
  size,
  onFail,
}: {
  url: string;
  name: string;
  size: number;
  onFail: () => void;
}) {
  const { data, isError } = useQuery({
    queryKey: ["preview-text", url],
    queryFn: () => loadText(url, name),
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    if (isError) onFail();
  }, [isError, onFail]);

  if (!data) {
    return (
      <Centered>
        <Spinner />
      </Centered>
    );
  }

  return (
    <div className="flex h-[80svh] flex-col gap-2">
      {size > TEXT_LIMIT && (
        <Alert>
          <AlertDescription>Showing the first 1 MiB. Download it to see the rest.</AlertDescription>
        </Alert>
      )}

      <pre
        className={`min-h-0 flex-1 overflow-auto rounded-md bg-muted/50 p-3 font-mono text-xs ${TOKENS}`}
      >
        <code>{data.nodes ? data.nodes.map(renderNode) : data.text}</code>
      </pre>
    </div>
  );
}

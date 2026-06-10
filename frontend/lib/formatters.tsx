import React from "react";

export function parseInlineStyles(htmlText: string): string {
  if (!htmlText) return "";
  let parsed = htmlText.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-zinc-100">$1</strong>');
  parsed = parsed.replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 mx-0.5 font-mono text-[11.5px] bg-zinc-800 text-zinc-300 rounded-md border border-white/5">$1</code>');
  
  // Format PMID [PMID: 12345] -> Clickable link
  parsed = parsed.replace(
    /\[PMID:\s*(\d+)\]/g,
    '<a href="https://pubmed.ncbi.nlm.nih.gov/$1/" target="_blank" rel="noopener noreferrer" class="px-1.5 py-0.5 mx-0.5 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[11px] font-mono border border-blue-500/20 inline-flex items-center gap-1 transition-colors">📄 PMID: $1</a>'
  );

  // Format DOI [DOI: 10.1002/...] -> Clickable link
  parsed = parsed.replace(
    /\[DOI:\s*([^\s\]]+)\]/g,
    '<a href="https://doi.org/$1" target="_blank" rel="noopener noreferrer" class="px-1.5 py-0.5 mx-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-mono border border-zinc-700 inline-flex items-center gap-1 transition-colors">🔗 DOI: $1</a>'
  );

  return parsed;
}

export function ClinicalTextRenderer({ text, className = "" }: { text: string; className?: string }) {
  if (!text) return null;

  const lines = text.split("\n");

  return (
    <div className={`text-zinc-300 text-[13px] leading-relaxed ${className}`}>
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();

        if (!trimmed) return <div key={lineIdx} className="h-2" />;

        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={lineIdx} className="text-sm font-semibold text-zinc-100 mt-4 mb-2">
              {trimmed.replace("### ", "")}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={lineIdx} className="text-base font-semibold text-zinc-100 mt-5 mb-3 border-b border-white/5 pb-1">
              {trimmed.replace("## ", "")}
            </h3>
          );
        }

        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const content = trimmed.substring(2);
          return (
            <ul key={lineIdx} className="pl-5 my-1 list-disc list-outside marker:text-zinc-600">
              <li dangerouslySetInnerHTML={{ __html: parseInlineStyles(content) }} />
            </ul>
          );
        }

        return (
          <p
            key={lineIdx}
            className="my-1.5"
            dangerouslySetInnerHTML={{ __html: parseInlineStyles(trimmed) }}
          />
        );
      })}
    </div>
  );
}

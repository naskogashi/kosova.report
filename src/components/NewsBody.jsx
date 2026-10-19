import { parseBody } from "../lib/news";

// Renders the editor's plain-text format as React elements. No raw HTML.
function Inline({ parts }) {
  return parts.map((part, index) => {
    if (part.type === "bold") return <strong key={index} className="font-extrabold">{part.value}</strong>;
    if (part.type === "link") {
      const external = /^https?:/.test(part.href);
      return (
        <a
          key={index}
          href={part.href}
          className="font-bold text-blue underline underline-offset-4"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {part.value}
        </a>
      );
    }
    return part.value;
  });
}

export default function NewsBody({ body }) {
  return (
    <div className="grid gap-5 text-lg leading-relaxed">
      {parseBody(body).map((block, index) => {
        if (block.type === "h2")
          return (
            <h2 key={index} className="mt-4 text-2xl font-extrabold tracking-[-0.02em]">
              <Inline parts={block.content} />
            </h2>
          );
        if (block.type === "h3")
          return (
            <h3 key={index} className="mt-2 text-xl font-extrabold">
              <Inline parts={block.content} />
            </h3>
          );
        if (block.type === "list")
          return (
            <ul key={index} className="grid list-disc gap-2 pl-6 marker:text-blue">
              {block.items.map((item, i) => (
                <li key={i}>
                  <Inline parts={item} />
                </li>
              ))}
            </ul>
          );
        return (
          <p key={index}>
            <Inline parts={block.content} />
          </p>
        );
      })}
    </div>
  );
}

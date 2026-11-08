import { InputGroup, InputGroupAddon, InputGroupInput } from "@fileee/ui/components/input-group";
import { SearchIcon } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export function SearchBox({ q, onChange }: { q: string; onChange: (q: string) => void }) {
  const [text, setText] = useState(q);
  const input = useRef<HTMLInputElement>(null);

  // Arriving with nothing to look at, the next thing to do is type.
  useEffect(() => {
    if (!q) input.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on arrival.
  }, []);

  // Follows the URL (back, a link), except while typing, when the URL is what's behind.
  useEffect(() => {
    if (document.activeElement !== input.current) setText(q);
  }, [q]);

  useEffect(() => {
    if (text.trim() === q) return;

    const timer = setTimeout(() => onChange(text.trim()), 200);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onChange is new on every render, and only the text starts a search.
  }, [text, q]);

  return (
    <InputGroup className="max-w-2xl">
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>

      <InputGroupInput
        ref={input}
        type="search"
        aria-label="Search files"
        placeholder="Search files"
        maxLength={200}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </InputGroup>
  );
}

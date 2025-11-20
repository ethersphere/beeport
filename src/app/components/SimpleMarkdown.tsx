interface Props {
  children: string;
}

const SimpleMarkdown = ({ children }: Props) => {
  // Split by both bold (**text**) and links ([text](url))
  const parts = children.split(/(\*\*.*?\*\*|\[.*?\]\(.*?\))/);

  return (
    <>
      {parts.map((part, i) => {
        // Handle bold text
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        // Handle links [text](url)
        if (part.startsWith('[') && part.includes('](')) {
          const match = part.match(/\[(.*?)\]\((.*?)\)/);
          if (match) {
            const [, text, url] = match;
            return (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                {text}
              </a>
            );
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

export default SimpleMarkdown;

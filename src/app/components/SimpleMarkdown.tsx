interface Props {
  children: string;
}

const SimpleMarkdown = ({ children }: Props) => {
  const parts = children.split(/(\*\*.*?\*\*)/);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

export default SimpleMarkdown;

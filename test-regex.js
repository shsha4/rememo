const content = `# 개발자
박민준은 개발자이다.`;

const titles = ['디케이테크인', '개발자', '박민준'];
const currentTitle = '개발자';

// Filter out current title
const filteredTitles = titles.filter(t => t !== currentTitle);
console.log('Filtered titles:', filteredTitles);

// Sort by length (longest first)
const sortedTitles = [...filteredTitles].sort((a, b) => b.length - a.length);
console.log('Sorted titles:', sortedTitles);

for (const title of sortedTitles) {
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?<![\\w가-힣])${escapedTitle}(?:(?=[은는이가을를의](?![\\w가-힣]))|(?![\\w가-힣]))`, 'g');

  console.log(`\nSearching for "${title}":`);
  console.log('Regex:', regex);

  let match;
  const matches = [];
  while ((match = regex.exec(content)) !== null) {
    matches.push({
      match: match[0],
      index: match.index,
      context: content.substring(Math.max(0, match.index - 5), Math.min(content.length, match.index + match[0].length + 5))
    });
  }

  console.log('Matches found:', matches.length);
  matches.forEach(m => {
    console.log(`  - "${m.match}" at index ${m.index}, context: "${m.context}"`);
  });
}
